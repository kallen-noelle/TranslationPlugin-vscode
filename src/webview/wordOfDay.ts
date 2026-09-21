/**
 * 每日一词功能。
 *
 * 机制与旧版 IntelliJ 插件完全一致:
 *   1. 优先从生词本 (SQLite) 取所有收藏的单词
 *   2. 随机打乱顺序,每次打开取第一个
 *   3. 如果生词本为空,fallback 到内置的 WORD_LIST
 *
 * 例句 / 词性分组等信息:
 *   - 从生词本取的词条: 解析其 explanation 字段中的词性换行格式 (见 addWordToWordBook 的保存逻辑)
 *   - 内置词库: WORD_LIST 自带 definitions / example / exampleTranslation
 */

import * as vscode from 'vscode';
import { BasePanel, WebviewMessage } from './panel.js';
import { WORD_LIST, WordItem } from '../words.js';
import { Store } from '../store.js';
import { speakText } from '../tts/index.js';
import { describeError } from '../feedback.js';
import { addWordToWordBook, getWordBook, WordBookEntry } from '../wordbookDb.js';

let instance: WordOfDayPanel | undefined;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Fisher-Yates 洗牌。 */
function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 把生词本里保存的 explanation 多行格式解析成 definitions 数组。
 *
 * 预期格式:
 *   简洁翻译                    ← 第一行
 *                               ← 空行
 *   动词                        ← 词性
 *   验证;核实;证明;校验         ← 释义
 *                               ← 空行
 *   名词
 *   验证物
 *
 * 返回:
 *   { translation: '简洁翻译', definitions: [{pos:'动词', meaning:'...'}, ...] }
 */
function parseExplanation(explanation: string): { translation: string; definitions: { pos: string; meaning: string }[] } {
  if (!explanation) { return { translation: '', definitions: [] }; }
  const lines = explanation.split('\n').map((s) => s.trim());
  // 跳过开头的空行
  let idx = 0;
  while (idx < lines.length && lines[idx] === '') { idx++; }
  // 第一行 = 简洁翻译
  const translation = idx < lines.length ? lines[idx] : '';
  idx++;
  const defs: { pos: string; meaning: string }[] = [];
  // 后续成对出现: 空行 → 词性 → 释义
  while (idx < lines.length) {
    // 跳到非空行 (跳过分隔词性的空行)
    while (idx < lines.length && lines[idx] === '') { idx++; }
    if (idx >= lines.length) { break; }
    const pos = lines[idx];
    idx++;
    // 跳过词性后面的空行 (如果有的话)
    while (idx < lines.length && lines[idx] === '') { idx++; }
    const meaning = idx < lines.length ? lines[idx] : '';
    idx++;
    defs.push({ pos, meaning });
  }
  return { translation, definitions: defs };
}

/**
 * 生词本源词条 → 前端渲染用的 WordOfDayItem。
 */
function entryToItem(entry: WordBookEntry): WordOfDayItem {
  // 如果 entry.translation 已经包含词性换行格式,从中提取
  const parsed = parseExplanation(entry.translation);
  return {
    word: entry.original,
    phonetic: entry.phonetic ?? undefined,
    // 简洁翻译优先用解析出来的第一行,没有就用原始 translation 全文
    translation: parsed.translation || entry.translation.split('\n')[0] || entry.translation,
    definitions: parsed.definitions.length > 0 ? parsed.definitions : undefined,
    example: undefined, // 生词本没有例句,后续可通过微软 dictionary examples API 获取
    exampleTranslation: undefined,
    source: 'wordbook',
  };
}

/**
 * 内置词库词条 → WordOfDayItem。
 */
function builtinToItem(item: WordItem): WordOfDayItem {
  return {
    word: item.word,
    phonetic: item.phonetic,
    translation: item.translation,
    definitions: item.definitions,
    example: item.example,
    exampleTranslation: item.exampleTranslation,
    source: 'builtin',
  };
}

/** 前端渲染用的统一词条结构。 */
export interface WordOfDayItem {
  word: string;
  phonetic?: string;
  translation: string;
  definitions?: { pos: string; meaning: string }[];
  example?: string;
  exampleTranslation?: string;
  /** 数据来源,前端可据此调整显示 */
  source: 'wordbook' | 'builtin';
}

/**
 * 挑选今日词条。
 *
 * 优先从生词本取所有词 → shuffle → 取第一个。
 * 生词本为空时 fallback 到内置 WORD_LIST (按 dayOfYear 确定性取词,与旧版保持兼容)。
 */
function resolveWord(forceNext: boolean): { item: WordOfDayItem; index: number } | null {
  const store = Store.get();
  const state = store.getWordOfDayState();
  const today = todayKey();

  // 1. 优先从生词本取
  const wordbookEntries = getWordBook();
  if (wordbookEntries.length > 0) {
    // 生词本里有东西 → shuffle 随机选
    // 同一天内点击 "下一个" 会重新 shuffle 取新的
    const shuffled = shuffle(wordbookEntries);
    // 如果 state 指向的 index 还在范围内,且不是强制 next,可以复用
    if (!forceNext && state.date === today && state.index >= 0 && state.index < shuffled.length) {
      return { item: entryToItem(shuffled[state.index]), index: state.index };
    }
    const index = forceNext
      ? (state.date === today ? (state.index + 1) % shuffled.length : 0)
      : Math.floor(Math.random() * shuffled.length);
    void store.setWordOfDayState(today, index);
    return { item: entryToItem(shuffled[index]), index };
  }

  // 2. Fallback: 用内置词库 (按 dayOfYear 确定性取词)
  if (!forceNext && state.date === today && state.index >= 0 && state.index < WORD_LIST.length) {
    return { item: builtinToItem(WORD_LIST[state.index]), index: state.index };
  }
  const index = state.date === today
    ? (state.index + 1) % WORD_LIST.length
    : dayOfYear(new Date()) % WORD_LIST.length;
  void store.setWordOfDayState(today, index);
  return { item: builtinToItem(WORD_LIST[index]), index };
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

/**
 * 每日一词面板 (webview)。
 */
export class WordOfDayPanel extends BasePanel {
  private constructor(ctx: vscode.ExtensionContext) {
    super(ctx, 'translation.wordOfDay', 'Word of the Day', vscode.ViewColumn.Beside);
    this.loadWebviewBundle('WordOfDay', 'wordOfDay.html');
  }

  static show(ctx: vscode.ExtensionContext): WordOfDayPanel {
    if (instance && !instance.isDisposed) {
      instance.reveal();
      return instance;
    }
    instance = new WordOfDayPanel(ctx);
    return instance;
  }

  private sendWord(forceNext = false): void {
    const result = resolveWord(forceNext);
    if (!result) {
      this.post({ type: 'empty' });
      return;
    }
    this.post({
      type: 'word',
      item: result.item,
      index: result.index,
      date: new Date().toLocaleDateString(),
    });
  }

  protected async onMessage(msg: WebviewMessage): Promise<void> {
    switch (msg.type) {
      case 'ready':
        this.sendWord();
        break;

      case 'next':
        this.sendWord(true);
        break;

      case 'speak': {
        const word = String(msg.word ?? '');
        if (!word) { break; }
        try {
          await speakText({ text: word, lang: 'en' });
        } catch (error) {
          void vscode.window.showErrorMessage(describeError(error));
        }
        break;
      }

      case 'saveWord': {
        const word = String(msg.word ?? '').trim();
        const phonetic = String(msg.phonetic ?? '').trim();
        const translation = String(msg.translation ?? '').trim();
        const defs = Array.isArray(msg.definitions) ? msg.definitions as { pos: string; meaning: string }[] : [];
        if (!word) { break; }

        // 按词性分组拼成多行格式,简洁翻译置顶,每个词性空一行间隔
        const lines: string[] = [];
        if (translation) { lines.push(translation); }
        for (const d of defs) {
          const pos = String(d.pos ?? '').trim();
          const meaning = String(d.meaning ?? '').trim();
          if (!pos && !meaning) { continue; }
          lines.push('');
          if (pos) { lines.push(pos); }
          if (meaning) { lines.push(meaning); }
        }
        const explanation = lines.join('\n');

        try {
          const ok = addWordToWordBook({
            word,
            phonetic: phonetic || undefined,
            sourceLanguage: 'en',
            targetLanguage: 'zh-CN',
            explanation,
          });
          if (ok) {
            void vscode.window.showInformationMessage(`已将 "${word}" 添加到生词本`);
          } else {
            void vscode.window.showWarningMessage(`"${word}" 已在生词本中或添加失败`);
          }
        } catch (error) {
          void vscode.window.showErrorMessage(describeError(error));
        }
        break;
      }
    }
  }
}
