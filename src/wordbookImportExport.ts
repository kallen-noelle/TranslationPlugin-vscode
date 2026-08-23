/**
 * Word book import/export (JSON + TXT + XML).
 * Import auto-detects format from file extension and content.
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

function buildExportItems(): ExportItem[] {
  const entries = Store.get().getWordBook();
  return entries.map((e) => ({
    word: e.original,
    sourceLanguage: e.srcLang,
    targetLanguage: e.targetLang,
    phonetic: e.phonetic,
    explanation: e.translation,
    tags: e.tags,
    createdAt: e.addedAt,
  }));
}

async function refreshView(): Promise<void> {
  await vscode.commands.executeCommand('translation.wordbook.refresh');
}

// ---------------------------------------------------------------------------
// JSON format
// ---------------------------------------------------------------------------

export async function exportWordBookJson(): Promise<void> {
  const items = buildExportItems();
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file('wordbook.json'),
    filters: { JSON: ['json'] },
    saveLabel: '导出 JSON',
  });
  if (!uri) return;
  try {
    await vscode.workspace.fs.writeFile(
      uri,
      Buffer.from(JSON.stringify(items, null, 2), 'utf-8'),
    );
    void vscode.window.showInformationMessage(`已导出 ${items.length} 个单词 (JSON)`);
  } catch (error) {
    void vscode.window.showErrorMessage(`导出失败: ${describeError(error)}`);
  }
}

async function importJsonContent(text: string): Promise<{ added: number; skipped: number }> {
  const data = JSON.parse(text) as Record<string, unknown>[];
  if (!Array.isArray(data)) {
    throw new Error('JSON 格式错误: 顶层不是数组');
  }
  let added = 0;
  let skipped = 0;
  for (const item of data) {
    const word = String(item.word ?? '');
    const srcLang = String(item.sourceLanguage ?? item.source_language ?? 'en');
    const targetLang = String(item.targetLanguage ?? item.target_language ?? 'zh-CN');
    if (!word.trim()) {
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
    if (ok) added++; else skipped++;
  }
  return { added, skipped };
}

// ---------------------------------------------------------------------------
// TXT format
// ---------------------------------------------------------------------------

export async function exportWordBookTxt(): Promise<void> {
  const entries = Store.get().getWordBook();
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file('wordbook.txt'),
    filters: { 'Text': ['txt'] },
    saveLabel: '导出 TXT',
  });
  if (!uri) return;
  const lines = entries.map((e) => {
    const word = (e.original ?? '').replace(/\t/g, ' ');
    const trans = (e.translation ?? '').replace(/\t/g, ' ').replace(/\n/g, ' ');
    return `${word}\t${trans}`;
  });
  try {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(lines.join('\n'), 'utf-8'));
    void vscode.window.showInformationMessage(`已导出 ${entries.length} 个单词 (TXT)`);
  } catch (error) {
    void vscode.window.showErrorMessage(`导出失败: ${describeError(error)}`);
  }
}

async function importTxtContent(text: string): Promise<{ added: number; skipped: number }> {
  const lines = text.split(/\r?\n/);

  // Prompt for language pair.
  const srcPick = await vscode.window.showInputBox({
    prompt: '源语言 (如 en, zh-CN)',
    value: 'en',
    placeHolder: 'en',
  });
  if (srcPick === undefined) return { added: 0, skipped: 0 };
  const tgtPick = await vscode.window.showInputBox({
    prompt: '目标语言 (如 zh-CN, en)',
    value: 'zh-CN',
    placeHolder: 'zh-CN',
  });
  if (tgtPick === undefined) return { added: 0, skipped: 0 };

  const srcLang = srcPick.trim() || 'en';
  const targetLang = tgtPick.trim() || 'zh-CN';

  let added = 0;
  let skipped = 0;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    let word = '';
    let translation = '';

    if (line.includes('\t')) {
      const idx = line.indexOf('\t');
      word = line.slice(0, idx).trim();
      translation = line.slice(idx + 1).trim();
    } else if (line.includes(' = ')) {
      const idx = line.indexOf(' = ');
      word = line.slice(0, idx).trim();
      translation = line.slice(idx + 3).trim();
    } else if (line.includes(': ')) {
      const idx = line.indexOf(': ');
      word = line.slice(0, idx).trim();
      translation = line.slice(idx + 2).trim();
    } else {
      word = line;
      translation = '';
    }

    if (!word) { skipped++; continue; }

    const ok = await Store.get().addToWordBook({
      original: word, translation, srcLang, targetLang, phonetic: null,
    });
    if (ok) added++; else skipped++;
  }
  return { added, skipped };
}

// ---------------------------------------------------------------------------
// XML format
// ---------------------------------------------------------------------------

export async function exportWordBookXml(): Promise<void> {
  const items = buildExportItems();
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file('wordbook.xml'),
    filters: { XML: ['xml'] },
    saveLabel: '导出 XML',
  });
  if (!uri) return;

  const esc = (s: string | null | undefined): string =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<wordbook>');
  for (const item of items) {
    lines.push('  <item>');
    lines.push(`    <word>${esc(item.word)}</word>`);
    lines.push(`    <sourceLanguage>${esc(item.sourceLanguage)}</sourceLanguage>`);
    lines.push(`    <targetLanguage>${esc(item.targetLanguage)}</targetLanguage>`);
    if (item.phonetic) lines.push(`    <phonetic>${esc(item.phonetic)}</phonetic>`);
    if (item.explanation) lines.push(`    <explanation>${esc(item.explanation)}</explanation>`);
    if (item.tags) lines.push(`    <tags>${esc(item.tags)}</tags>`);
    lines.push(`    <createdAt>${item.createdAt}</createdAt>`);
    lines.push('  </item>');
  }
  lines.push('</wordbook>');

  try {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(lines.join('\n'), 'utf-8'));
    void vscode.window.showInformationMessage(`已导出 ${items.length} 个单词 (XML)`);
  } catch (error) {
    void vscode.window.showErrorMessage(`导出失败: ${describeError(error)}`);
  }
}

/** Simple regex-based XML parser for wordbook format (no external dependency). */
async function importXmlContent(text: string): Promise<{ added: number; skipped: number }> {
  // Extract all <item>...</item> blocks.
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  const items: { word: string; srcLang: string; targetLang: string; translation: string; phonetic: string | null }[] = [];

  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(text)) !== null) {
    const block = match[1];
    const getTag = (tag: string): string => {
      const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const m = block.match(re);
      return m ? m[1].trim() : '';
    };
    const word = getTag('word');
    const srcLang = getTag('sourceLanguage') || getTag('srcLang') || 'en';
    const targetLang = getTag('targetLanguage') || getTag('tgtLang') || 'zh-CN';
    const translation = getTag('explanation') || getTag('translation') || '';
    const phonetic = getTag('phonetic') || null;
    if (word) {
      items.push({ word, srcLang, targetLang, translation, phonetic });
    }
  }

  if (items.length === 0) {
    throw new Error('XML 中未找到有效的单词条目');
  }

  let added = 0;
  let skipped = 0;
  for (const item of items) {
    const ok = await Store.get().addToWordBook({
      original: item.word,
      translation: item.translation,
      srcLang: item.srcLang,
      targetLang: item.targetLang,
      phonetic: item.phonetic,
    });
    if (ok) added++; else skipped++;
  }
  return { added, skipped };
}

// ---------------------------------------------------------------------------
// Auto-detect import format
// ---------------------------------------------------------------------------

/**
 * Import a word book file with auto-detected format.
 * Detection order: JSON (by content) > XML (by content/tag) > TXT (fallback).
 * File extension is used as a hint but content has final say.
 */
export async function importWordBookAuto(): Promise<void> {
  const uris = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: {
      '生词本文件': ['json', 'txt', 'xml'],
      '所有文件': ['*'],
    },
    openLabel: '导入生词本',
  });
  if (!uris || uris.length === 0) return;

  try {
    const bytes = await vscode.workspace.fs.readFile(uris[0]);
    const text = Buffer.from(bytes).toString('utf-8').trim();
    const fileName = uris[0].fsPath.toLowerCase();

    let format: 'json' | 'xml' | 'txt' | undefined;

    // Detect by content first.
    if (text.startsWith('{') || text.startsWith('[')) {
      format = 'json';
    } else if (text.startsWith('<?xml') || /<wordbook/i.test(text) || /<item\b/i.test(text)) {
      format = 'xml';
    } else if (text.startsWith('[') || text.startsWith('{')) {
      format = 'json';
    }

    // Fall back to extension.
    if (!format) {
      if (fileName.endsWith('.json')) format = 'json';
      else if (fileName.endsWith('.xml')) format = 'xml';
      else format = 'txt';
    }

    let result: { added: number; skipped: number };
    if (format === 'json') {
      result = await importJsonContent(text);
    } else if (format === 'xml') {
      result = await importXmlContent(text);
    } else {
      result = await importTxtContent(text);
    }

    await refreshView();
    void vscode.window.showInformationMessage(
      `导入完成(${format.toUpperCase()}): 新增 ${result.added} 条, 跳过 ${result.skipped} 条`,
    );
  } catch (error) {
    void vscode.window.showErrorMessage(`导入失败: ${describeError(error)}`);
    log(error);
  }
}

// ---------------------------------------------------------------------------
// Export format picker
// ---------------------------------------------------------------------------

export async function exportWordBook(): Promise<void> {
  const choice = await vscode.window.showQuickPick(
    [
      { label: 'JSON 格式', description: '完整数据(含音标、语言、时间)', id: 'json' },
      { label: 'TXT 格式', description: '单词 + 释义,每行一条', id: 'txt' },
      { label: 'XML 格式', description: '结构化 XML,兼容其他工具', id: 'xml' },
    ],
    { placeHolder: '选择导出格式' },
  );
  if (!choice) return;
  if (choice.id === 'json') await exportWordBookJson();
  else if (choice.id === 'xml') await exportWordBookXml();
  else await exportWordBookTxt();
}

/** Kept for backward compatibility — now uses auto-detect. */
export async function importWordBook(): Promise<void> {
  await importWordBookAuto();
}
