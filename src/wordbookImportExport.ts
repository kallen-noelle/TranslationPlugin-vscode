/**
 * Word book import/export (JSON), mirroring the IntelliJ plugin's
 * WordBookExporter so files can be exchanged between the two plugins.
 */

import * as vscode from 'vscode';
import { Store } from './store.js';
import { describeError, log } from './feedback.js';

interface ExportItem {
  word: string;
  sourceLanguage: string;
  targetLanguage: string;
  phonetic: string | null;
  explanation: string | null;
  tags: string | null;
  createdAt: number;
}

/** Exports the word book to a JSON file (same shape as the IntelliJ plugin). */
export async function exportWordBook(): Promise<void> {
  const entries = Store.get().getWordBook();
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file('wordbook.json'),
    filters: { JSON: ['json'] },
    saveLabel: '导出',
  });
  if (!uri) {
    return;
  }
  const items: ExportItem[] = entries.map((e) => ({
    word: e.original,
    sourceLanguage: e.srcLang,
    targetLanguage: e.targetLang,
    phonetic: e.phonetic,
    explanation: e.translation,
    tags: e.tags,
    createdAt: e.addedAt,
  }));
  try {
    await vscode.workspace.fs.writeFile(
      uri,
      Buffer.from(JSON.stringify(items, null, 2), 'utf-8'),
    );
    void vscode.window.showInformationMessage(`已导出 ${items.length} 个单词`);
  } catch (error) {
    void vscode.window.showErrorMessage(`导出失败: ${describeError(error)}`);
  }
}

/** Imports words from a JSON file exported by either plugin. */
export async function importWordBook(): Promise<void> {
  const uris = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: { JSON: ['json'] },
    openLabel: '导入',
  });
  if (!uris || uris.length === 0) {
    return;
  }
  try {
    const bytes = await vscode.workspace.fs.readFile(uris[0]);
    const data = JSON.parse(Buffer.from(bytes).toString('utf-8')) as Record<string, unknown>[];

    let added = 0;
    let skipped = 0;
    for (const item of data) {
      const word = String(item.word ?? '');
      const srcLang = String(item.sourceLanguage ?? item.source_language ?? '');
      const targetLang = String(item.targetLanguage ?? item.target_language ?? '');
      if (!word.trim() || !srcLang || !targetLang) {
        skipped++;
        continue;
      }
      const ok = await Store.get().addToWordBook({
        original: word,
        translation: String(item.explanation ?? item.translation ?? ''),
        srcLang,
        targetLang,
        phonetic: item.phonetic ? String(item.phonetic) : null,
      });
      if (ok) {
        added++;
      } else {
        skipped++;
      }
    }

    await vscode.commands.executeCommand('translation.wordbook.refresh');
    void vscode.window.showInformationMessage(`导入完成: 新增 ${added} 条, 跳过 ${skipped} 条`);
  } catch (error) {
    void vscode.window.showErrorMessage(`导入失败: ${describeError(error)}`);
    log(error);
  }
}
