import * as vscode from 'vscode';
import { Config } from './config.js';
import { Store } from './store.js';
import { initRegistry } from './translator/registry.js';
import { registerCommands } from './commands.js';
import { registerHoverProvider } from './hover.js';
import { registerWordBookView } from './wordBookView.js';
import { WordOfDayPanel } from './webview/wordOfDay.js';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Auto-show the Word of the Day panel on startup, if enabled and not shown today.
 */
function scheduleWordOfDayAutoShow(context: vscode.ExtensionContext): void {
  const config = Config.get();
  if (!config.wordOfDayAutoShow) {
    return;
  }

  const store = Store.get();
  const today = todayKey();
  if (store.getWordOfDayAutoShownDate() === today) {
    return;
  }

  const delayMs = Math.max(0, config.wordOfDayAutoShowDelay) * 1000;
  const timer = setTimeout(() => {
    void store.setWordOfDayAutoShownDate(today);
    WordOfDayPanel.show(context);
  }, delayMs);

  context.subscriptions.push({
    dispose() { clearTimeout(timer); },
  });
}

export function activate(context: vscode.ExtensionContext): void {
  Config.init(context);
  Store.init(context);
  initRegistry(context);

  registerWordBookView(context);

  context.subscriptions.push(
    ...registerCommands({ ctx: context }),
    registerHoverProvider(),
  );

  scheduleWordOfDayAutoShow(context);
}

export function deactivate(): void {
  // Nothing to clean up: subscriptions are disposed by VS Code.
}
