import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface WebviewMessage {
  type: string;
  [key: string]: unknown;
}

/**
 * Directory (relative to extension root) where Vite emits webview bundles.
 * Layout: out/webview-assets/webview-ui/{PageName}.html
 *         out/webview-assets/{PageName}-[hash].js
 *         out/webview-assets/chunks/* / assets/*
 */
export const WEBVIEW_BUNDLE_DIR = path.join('out', 'webview-assets');
export const WEBVIEW_HTML_SUBDIR = path.join('webview-ui');

/**
 * Base class for webview panels: manages the panel lifecycle and a
 * request/response message bridge with the webview.
 */
export abstract class BasePanel {
  protected panel: vscode.WebviewPanel;
  protected disposables: vscode.Disposable[] = [];
  /** Webview-accessible base URI of the extension `media` folder (icons). */
  protected mediaBaseUri: string;
  private disposed = false;

  constructor(
    protected readonly ctx: vscode.ExtensionContext,
    viewType: string,
    title: string,
    viewColumn: vscode.ViewColumn,
    webviewOptions: vscode.WebviewPanelOptions = {},
  ) {
    this.panel = vscode.window.createWebviewPanel(
      viewType,
      title,
      viewColumn,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(ctx.extensionUri, 'media'),
          vscode.Uri.joinPath(ctx.extensionUri, 'src', 'webview', 'media'),
          vscode.Uri.joinPath(ctx.extensionUri, WEBVIEW_BUNDLE_DIR),
        ],
        ...webviewOptions,
      },
    );
    this.panel.iconPath = vscode.Uri.joinPath(ctx.extensionUri, 'media', 'icon.svg');
    this.mediaBaseUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(ctx.extensionUri, 'media'),
    ).toString();

    this.panel.webview.onDidReceiveMessage(
      (msg: WebviewMessage) => {
        void this.onMessage(msg);
      },
      undefined,
      this.disposables,
    );
    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables);
  }

  /**
   * Loads a Vite-built React webview bundle by page name.
   * Reads `out/webview-assets/webview-ui/{pageName}.html`, rewrites
   * relative asset references to absolute `asWebviewUri` URIs, and
   * injects a permissive CSP that allows module scripts from this
   * webview's cspSource.
   *
   * Falls back to setHtmlFromMedia(fileName) if the bundle is missing
   * (dev time or pre-bundle execution).
   */
  protected loadWebviewBundle(pageName: string, legacyMediaFile?: string): void {
    const bundleDir = path.join(this.ctx.extensionPath, WEBVIEW_BUNDLE_DIR, WEBVIEW_HTML_SUBDIR);
    const htmlFile = path.join(bundleDir, `${pageName}.html`);

    if (fs.existsSync(htmlFile)) {
      const raw = fs.readFileSync(htmlFile, 'utf-8');
      const processed = transformBundleHtml(raw, htmlFile, this.panel.webview, this.ctx.extensionUri);
      // Expose the `media/` folder (icons) to the React bundle, mirroring the
      // legacy `{{MEDIA}}` placeholder.
      const withMedia = processed.replace(
        '</head>',
        `  <script>window.__MEDIA_BASE__ = ${JSON.stringify(this.mediaBaseUri)};</script>\n</head>`,
      );
      this.panel.webview.html = withMedia;
      return;
    }

    // Fallback: use legacy media HTML if provided
    if (legacyMediaFile) {
      this.setHtmlFromMedia(legacyMediaFile);
      return;
    }

    // Nothing to show — render a minimal placeholder
    this.panel.webview.html =
      `<html><body style="color:#ccc;padding:16px">Webview bundle not found. Run <code>pnpm vite build</code>.</body></html>`;
  }

  /** Reads a webview HTML file, substituting the `{{MEDIA}}` placeholder. */
  protected setHtmlFromMedia(fileName: string): void {
    const html = readMediaFile(this.ctx, fileName).replaceAll('{{MEDIA}}', this.mediaBaseUri);
    this.panel.webview.html = html;
  }

  /** Sets the panel HTML content. */
  protected setHtml(html: string): void {
    this.panel.webview.html = html;
  }

  /** Posts a message to the webview. */
  protected post(msg: WebviewMessage): void {
    void this.panel.webview.postMessage(msg);
  }

  /** Handles an incoming message from the webview. */
  protected abstract onMessage(msg: WebviewMessage): Promise<void>;

  /** Reveals the panel (creating its HTML on first reveal). */
  reveal(): void {
    if (!this.panel.visible) {
      this.panel.reveal();
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
    this.panel.dispose();
  }

  get isDisposed(): boolean {
    return this.disposed;
  }
}

/** Reads a media file as a string (relative to the webview media dir). */
export function readMediaFile(ctx: vscode.ExtensionContext, fileName: string): string {
  const file = path.join(ctx.extensionPath, 'src', 'webview', 'media', fileName);
  return fs.readFileSync(file, 'utf-8');
}

/**
 * Rewrites a Vite bundle HTML so it works inside a VS Code webview:
 *   1. Resolves every relative `src="..."` and `href="..."` to an absolute
 *      `asWebviewUri` URI (the path is resolved relative to the HTML file).
 *   2. Removes the `crossorigin` attribute (asWebviewUri resources are same-origin).
 *   3. Injects a Content-Security-Policy meta that allows `script-src` and
 *      `style-src` from this webview's `cspSource` plus `'unsafe-inline'`.
 */
export function transformBundleHtml(
  html: string,
  htmlFilePath: string,
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
): string {
  const htmlDir = path.dirname(htmlFilePath);
  const cspSource = webview.cspSource;

  // Resolve relative asset references → asWebviewUri
  const resolveAsset = (relPath: string): string => {
    const absOnDisk = path.resolve(htmlDir, relPath);
    const relToExt = path.relative(extensionUri.fsPath, absOnDisk);
    // Normalize to forward slashes for URI construction
    const uriPath = relToExt.split(path.sep).join('/');
    return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, uriPath)).toString();
  };

  // Rewrite <script src="..."> and <link href="..."> with relative paths
  // (Vite outputs all these as relative to the HTML file).
  let out = html
    // <script ... src="REL" crossorigin>
    .replace(
      /(<script\b[^>]*\bsrc=")([^"]+)("[^>]*?)(\scrossorigin)?(\s*\/?>)/g,
      (_m, pre, rel, mid, _co, end) => {
        const uri = resolveAsset(rel);
        return `${pre}${uri}${mid}${end.replace(/\scrossorigin/g, '')}`;
      },
    )
    // <link ... href="REL" crossorigin>
    .replace(
      /(<link\b[^>]*\bhref=")([^"]+)("[^>]*?)(\scrossorigin)?(\s*\/?>)/g,
      (_m, pre, rel, mid, _co, end) => {
        const uri = resolveAsset(rel);
        return `${pre}${uri}${mid}${end.replace(/\scrossorigin/g, '')}`;
      },
    );

  // Inject CSP before </head>
  const csp =
    `<meta http-equiv="Content-Security-Policy" content="` +
    `default-src 'none'; ` +
    `script-src ${cspSource} 'unsafe-inline'; ` +
    `style-src ${cspSource} 'unsafe-inline'; ` +
    `img-src ${cspSource} data:; ` +
    `font-src ${cspSource} data:; ` +
    `connect-src ${cspSource}; ` +
    `worker-src ${cspSource}; ` +
    `frame-src 'none'; ` +
    `object-src 'none'; ` +
    `base-uri 'none'; ` +
    `form-action 'none'; ` +
    `"/>`;
  out = out.replace('</head>', `  ${csp}\n</head>`);

  return out;
}
