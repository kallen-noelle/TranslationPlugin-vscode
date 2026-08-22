import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface WebviewMessage {
  type: string;
  [key: string]: unknown;
}

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
