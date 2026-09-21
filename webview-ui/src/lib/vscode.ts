/**
 * Typed wrapper around VS Code's webview API.
 * acquireVsCodeApi() is injected by VS Code at runtime.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const acquireVsCodeApi: any;

export interface WebviewApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

let _api: WebviewApi | null = null;

/** Get (or lazily create) the webview API bridge. */
export function getVscodeApi(): WebviewApi {
  if (!_api) {
    if (typeof acquireVsCodeApi === 'function') {
      _api = acquireVsCodeApi();
    } else {
      // Fallback for browser dev mode (Vite preview).
      // Logs to console instead of posting to VS Code host.
      _api = {
        postMessage: (msg) => console.log('[webview→host]', msg),
        getState: () => null,
        setState: () => {},
      };
    }
  }
  return _api;
}

/** Subscribe to messages from the extension host. */
export function onHostMessage<T = unknown>(handler: (msg: T) => void): () => void {
  const listener = (event: MessageEvent) => handler(event.data as T);
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

/** Post a typed message to the extension host. */
export function postHost<T extends { type: string }>(message: T): void {
  getVscodeApi().postMessage(message);
}
