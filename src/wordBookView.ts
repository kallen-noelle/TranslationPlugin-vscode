/**
 * Word book sidebar view — the VS Code equivalent of the original plugin's
 * docked tool window (a Word | Explanation table with a context menu).
 * Reads the shared SQLite database.
 */

import * as vscode from 'vscode';
import { Store, WordBookEntry } from './store.js';
import { speakText } from './tts/index.js';
import { describeError } from './feedback.js';
import { WordDetailsPanel } from './webview/wordDetails.js';
import { exportWordBook, importWordBook } from './wordbookImportExport.js';

class WordBookItem extends vscode.TreeItem {
  constructor(public readonly entry: WordBookEntry) {
    super(entry.original, vscode.TreeItemCollapsibleState.None);
    // Matches the original table: Explanation column with newlines collapsed.
    this.description = (entry.translation ?? '').replace(/\s*\n\s*/g, ' ');
    this.tooltip = buildDetailText(entry);
    this.contextValue = 'wordBookItem';
    this.command = {
      command: 'translation.wordbook.detail',
      title: '详情',
      arguments: [entry],
    };
  }
}

function buildDetailText(entry: WordBookEntry): string {
  const lines = [
    `${entry.original}`,
    `[${entry.srcLang} → ${entry.targetLang}]`,
  ];
  if (entry.phonetic) {
    lines.push(`音标: ${entry.phonetic}`);
  }
  lines.push(entry.translation ?? '');
  if (entry.tags) {
    lines.push(`标签: ${entry.tags}`);
  }
  if (entry.addedAt) {
    lines.push(`收藏时间: ${new Date(entry.addedAt).toLocaleString()}`);
  }
  return lines.join('\n');
}

class WordBookTreeProvider implements vscode.TreeDataProvider<WordBookItem> {
  private readonly emitter = new vscode.EventEmitter<WordBookItem | undefined | void>();
  readonly onDidChangeTreeData = this.emitter.event;

  refresh(): void {
    this.emitter.fire();
  }

  getTreeItem(element: WordBookItem): vscode.TreeItem {
    return element;
  }

  getChildren(): WordBookItem[] {
    return Store.get().getWordBook().map((e) => new WordBookItem(e));
  }
}

let provider: WordBookTreeProvider | undefined;

/** Refreshes the word book view after the data changes. */
export function refreshWordBookView(): void {
  provider?.refresh();
}

/** Registers the word book tree view and its commands. */
export function registerWordBookView(context: vscode.ExtensionContext): void {
  provider = new WordBookTreeProvider();

  const view = vscode.window.createTreeView('translation.wordbook', {
    treeDataProvider: provider,
  });
  context.subscriptions.push(view);

  context.subscriptions.push(
    vscode.commands.registerCommand('translation.wordbook', () => {
      void vscode.commands.executeCommand('translation.wordbook.focus');
    }),
    vscode.commands.registerCommand('translation.wordbook.refresh', () => provider?.refresh()),
    vscode.commands.registerCommand('translation.wordbook.detail', (entry: WordBookEntry) => {
      WordDetailsPanel.show(context, entry);
    }),
    vscode.commands.registerCommand('translation.wordbook.delete', async (item: WordBookItem) => {
      const e = item.entry;
      const confirmed = await vscode.window.showWarningMessage(
        `确认删除单词 "${e.original}"?`,
        { modal: true },
        '删除',
      );
      if (confirmed !== '删除') {
        return;
      }
      await Store.get().removeFromWordBook(e.original, e.srcLang, e.targetLang);
      provider?.refresh();
    }),
    vscode.commands.registerCommand('translation.wordbook.speak', async (item: WordBookItem) => {
      try {
        await speakText({ text: item.entry.translation, lang: item.entry.targetLang });
      } catch (error) {
        void vscode.window.showErrorMessage(describeError(error));
      }
    }),
    vscode.commands.registerCommand('translation.wordbook.copy', async (item: WordBookItem) => {
      await vscode.env.clipboard.writeText(item.entry.original);
      void vscode.window.showInformationMessage('已复制单词');
    }),
    vscode.commands.registerCommand('translation.wordbook.export', () => exportWordBook()),
    vscode.commands.registerCommand('translation.wordbook.import', () => importWordBook()),
  );
}
