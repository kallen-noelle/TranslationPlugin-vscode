/**
 * User-facing feedback: progress indicators, rich error dialogs, and a
 * translation log output channel (useful during development).
 */

import * as vscode from 'vscode';
import { translate } from './service.js';
import { getActiveEngine, getEngine, getActiveEngineId } from './translator/registry.js';
import { Translation, TranslationError } from './types.js';

// ---------------------------------------------------------------------------
// Log output channel
// ---------------------------------------------------------------------------

let output: vscode.OutputChannel | undefined;

export function getOutput(): vscode.OutputChannel {
  if (!output) {
    output = vscode.window.createOutputChannel('Translation');
  }
  return output;
}

export function log(...args: unknown[]): void {
  const text = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  getOutput().appendLine(text);
}

export function logError(error: unknown): void {
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
  log(`[error] ${detail}`);
}

export function showLog(): void {
  getOutput().show(true);
}

// ---------------------------------------------------------------------------
// Error description
// ---------------------------------------------------------------------------

/** Converts any error into a human-readable Chinese message. */
export function describeError(error: unknown): string {
  if (error instanceof TranslationError) {
    return error.message;
  }
  if (error instanceof Error) {
    const msg = error.message;
    if (/fetch failed/i.test(msg)) {
      return '网络连接失败,请检查网络或代理设置';
    }
    if (/abort/i.test(msg) || /timed out/i.test(msg) || /timeout/i.test(msg)) {
      return '请求超时,请稍后重试';
    }
    return msg;
  }
  return String(error);
}

// ---------------------------------------------------------------------------
// Status bar flash
// ---------------------------------------------------------------------------

/** Shows a transient message in the status bar. */
export function flashStatus(message: string, timeout = 2500): void {
  void vscode.window.setStatusBarMessage(message, timeout);
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// ---------------------------------------------------------------------------
// Rich error dialog
// ---------------------------------------------------------------------------

export interface ErrorActions {
  /** Invoked when the user clicks "重试". */
  retry?: () => void;
}

/** Shows an error dialog with the reason plus action buttons. */
export async function showTranslationError(error: unknown, actions: ErrorActions = {}): Promise<void> {
  const message = describeError(error);
  const engine =
    error instanceof TranslationError && error.engineName
      ? error.engineName
      : getEngine(getActiveEngineId())?.name ?? '翻译';

  logError(error);

  const buttons: string[] = [];
  const handlers: Record<string, () => void> = {};

  if (actions.retry) {
    buttons.push('重试');
    handlers['重试'] = actions.retry;
  }
  buttons.push('切换引擎', '检查配置');
  handlers['切换引擎'] = () => void vscode.commands.executeCommand('translation.switchEngine');
  handlers['检查配置'] = () => void vscode.commands.executeCommand('translation.configure');

  const picked = await vscode.window.showErrorMessage(`翻译失败 [${engine}]: ${message}`, ...buttons);
  if (picked) {
    handlers[picked]?.();
  }
}

// ---------------------------------------------------------------------------
// Progress-wrapped translation
// ---------------------------------------------------------------------------

export interface TranslateWithFeedbackOptions extends ErrorActions {
  /** Log the error but do not show a dialog (e.g. hover). */
  silentError?: boolean;
}

/**
 * Translates with a progress indicator and rich error feedback.
 * Returns `undefined` on failure.
 */
export async function translateWithFeedback(
  text: string,
  srcLang: string,
  targetLang: string,
  options: TranslateWithFeedbackOptions = {},
): Promise<Translation | undefined> {
  const engine = getActiveEngine();
  return vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `翻译中 (${engine.name})…` },
    async () => {
      log(`> translate [${engine.name}] ${srcLang}→${targetLang}: ${truncate(text, 100)}`);
      try {
        const result = await translate(text, srcLang, targetLang);
        log(`  ✓ ${truncate(result.translation ?? '', 120)}`);
        flashStatus(`✓ ${engine.name}: ${truncate(result.translation ?? '', 60)}`);
        return result;
      } catch (error) {
        if (options.silentError) {
          logError(error);
          return undefined;
        }
        await showTranslationError(error, { retry: options.retry });
        return undefined;
      }
    },
  );
}

/** Runs an arbitrary async task inside a progress notification. */
export async function runWithProgress<T>(
  title: string,
  action: () => Promise<T>,
): Promise<T | undefined> {
  return vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title }, action);
}
