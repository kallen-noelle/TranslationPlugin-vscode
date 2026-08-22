import * as vscode from 'vscode';
import { Translation } from './types.js';
import { Config } from './config.js';
import {
  WordBookEntry,
  getWordBook,
  addWordToWordBook,
  removeWordFromWordBook,
  clearWordBook,
} from './wordbookDb.js';

export type { WordBookEntry } from './wordbookDb.js';

export interface HistoryEntry {
  original: string;
  translation: string;
  srcLang: string;
  targetLang: string;
  engine: string;
  timestamp: number;
}

const KEYS = {
  history: 'history',
  wordOfDayDate: 'wordOfDay.date',
  wordOfDayIndex: 'wordOfDay.index',
  sourceLanguage: 'sourceLanguage',
  targetLanguage: 'targetLanguage',
} as const;

/**
 * Thin wrapper around `context.globalState` for persistent extension data.
 * The word book itself is stored in the shared SQLite database (see wordbookDb).
 */
export class Store {
  private constructor(private readonly ctx: vscode.ExtensionContext) {}

  private static instance: Store | undefined;

  static init(ctx: vscode.ExtensionContext): Store {
    Store.instance = new Store(ctx);
    return Store.instance;
  }

  static get(): Store {
    if (!Store.instance) {
      throw new Error('Store not initialized');
    }
    return Store.instance;
  }

  private wordBookPath(): string | undefined {
    return Config.get().wordbookPath;
  }

  // ---- Word book (shared SQLite database with the IntelliJ plugin) --------

  getWordBook(): WordBookEntry[] {
    return getWordBook(this.wordBookPath());
  }

  async addToWordBook(entry: {
    original: string;
    translation: string;
    srcLang: string;
    targetLang: string;
    phonetic?: string | null;
  }): Promise<boolean> {
    return addWordToWordBook(
      {
        word: entry.original.trim(),
        sourceLanguage: entry.srcLang,
        targetLanguage: entry.targetLang,
        phonetic: entry.phonetic ?? null,
        explanation: entry.translation,
      },
      this.wordBookPath(),
    );
  }

  async removeFromWordBook(original: string, srcLang: string, targetLang: string): Promise<void> {
    removeWordFromWordBook(original, srcLang, targetLang, this.wordBookPath());
  }

  async clearWordBook(): Promise<void> {
    clearWordBook(this.wordBookPath());
  }

  isInWordBook(original: string, srcLang: string, targetLang: string): boolean {
    return this.getWordBook().some(
      (e) => e.original === original && e.srcLang === srcLang && e.targetLang === targetLang,
    );
  }

  // ---- History -----------------------------------------------------------

  getHistory(): HistoryEntry[] {
    return this.ctx.globalState.get<HistoryEntry[]>(KEYS.history, []);
  }

  async addHistory(entry: HistoryEntry, maxEntries: number): Promise<void> {
    const list = this.getHistory().filter((e) => e.original !== entry.original);
    list.unshift(entry);
    await this.ctx.globalState.update(KEYS.history, list.slice(0, maxEntries));
  }

  async clearHistory(): Promise<void> {
    await this.ctx.globalState.update(KEYS.history, []);
  }

  // ---- Word of the day ---------------------------------------------------

  getWordOfDayState(): { date: string; index: number } {
    const date = this.ctx.globalState.get<string>(KEYS.wordOfDayDate, '');
    const index = this.ctx.globalState.get<number>(KEYS.wordOfDayIndex, 0);
    return { date, index };
  }

  async setWordOfDayState(date: string, index: number): Promise<void> {
    await this.ctx.globalState.update(KEYS.wordOfDayDate, date);
    await this.ctx.globalState.update(KEYS.wordOfDayIndex, index);
  }

  // ---- Language prefs ----------------------------------------------------

  getLastSourceLanguage(): string {
    return this.ctx.globalState.get<string>(KEYS.sourceLanguage, 'auto');
  }

  async setLastSourceLanguage(lang: string): Promise<void> {
    await this.ctx.globalState.update(KEYS.sourceLanguage, lang);
  }

  getLastTargetLanguage(): string {
    return this.ctx.globalState.get<string>(KEYS.targetLanguage, 'zh-CN');
  }

  async setLastTargetLanguage(lang: string): Promise<void> {
    await this.ctx.globalState.update(KEYS.targetLanguage, lang);
  }
}

/**
 * Saves a translation into the shared word book, matching the IntelliJ
 * plugin's data layout: `phonetic` = source transliteration, `explanation` =
 * translation + dictionary groups (e.g. "名词: ...\n动词: ...").
 */
export async function saveTranslationToWordBook(t: Translation): Promise<boolean> {
  const store = Store.get();
  const translation = t.translation ?? '';
  if (!translation || translation === t.original) {
    return false;
  }
  const dictText = (t.dict ?? [])
    .map((d) => `${d.pos ?? ''}: ${(d.entries ?? []).map((e) => e.translation).join('; ')}`)
    .filter((line) => line.trim().length > 0)
    .join('\n');
  const explanation = dictText ? `${translation}\n\n${dictText}` : translation;

  return store.addToWordBook({
    original: t.original,
    translation: explanation,
    srcLang: t.srcLang,
    targetLang: t.targetLang,
    phonetic: t.srcTransliteration ?? null,
  });
}
