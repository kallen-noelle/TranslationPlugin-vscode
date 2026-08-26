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

/**
 * Auto-translate entire file content when a file is opened, if enabled.
 * Opens the Translation Dialog with the translated content.
 *
 * Trigger conditions:
 * 1. Config `translation.autoTranslateDocument` is true
 * 2. Document URI scheme is "file" (excludes output panels, settings, diff views)
 * 3. Document languageId is not plaintext, markdown, git-commit, or log
 * 4. The opened document is the active editor's document
 * 5. File content is not empty
 */
function setupAutoTranslateDocument(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (!Config.get().get('autoTranslateDocument', true)) {
        return;
      }
      if (doc.uri.scheme !== 'file') {
        return;
      }
      const langId = doc.languageId;
      if (langId === 'plaintext' || langId === 'markdown' || langId === 'git-commit' || langId === 'log') {
        return;
      }
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document !== doc) {
        return;
      }
      const text = doc.getText().trim();
      if (!text) {
        return;
      }
      void vscode.commands.executeCommand('translation.translateDocument');
    }),
  );
}

/**
 * Set custom context key for contextMenuOnlyWithSelection.
 * Uses setContext instead of config.xxx in when-clauses for reliable updates.
 */
function setupContextMenuKey(context: vscode.ExtensionContext): void {
  const updateKey = () => {
    const enabled = Config.get().get('contextMenuOnlyWithSelection', true);
    void vscode.commands.executeCommand('setContext', 'translation.contextMenuRequiresSelection', enabled);
  };

  updateKey();
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('translation.contextMenuOnlyWithSelection')) {
        updateKey();
      }
    }),
  );
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
  setupAutoTranslateDocument(context);
  setupContextMenuKey(context);
}

export function deactivate(): void {
  // Nothing to clean up: subscriptions are disposed by VS Code.
}
