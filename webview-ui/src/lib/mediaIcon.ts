/**
 * Helpers to reference the extension `media` folder icons from the webview.
 * The panel injects `window.__MEDIA_BASE__` (an asWebviewUri of `media/`),
 * and dark themes switch to the `_dark.svg` variants like the legacy HTML.
 */
declare global {
  interface Window {
    __MEDIA_BASE__?: string;
  }
}

export function mediaBase(): string {
  return window.__MEDIA_BASE__ ?? '';
}

export function isDarkTheme(): boolean {
  return document.body.classList.contains('vscode-dark');
}

export function mediaIcon(name: string): string {
  const base = `${mediaBase()}/icons/${name}.svg`;
  return isDarkTheme() ? base.replace('.svg', '_dark.svg') : base;
}

export function mediaSvgUrl(name: string): string {
  return mediaIcon(name);
}
