import * as vscode from 'vscode';
import { BasePanel, WebviewMessage } from './panel.js';
import { WORD_LIST, WordItem } from '../words.js';
import { Store } from '../store.js';
import { speakText } from '../tts/index.js';
import { describeError } from '../feedback.js';

let instance: WordOfDayPanel | undefined;

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function resolveWord(forceNext: boolean): { item: WordItem; index: number } {
  const store = Store.get();
  const state = store.getWordOfDayState();
  const today = todayKey();

  if (!forceNext && state.date === today && state.index >= 0) {
    return { item: WORD_LIST[state.index % WORD_LIST.length], index: state.index };
  }

  // Deterministic daily word based on the day of year.
  const index = state.date === today ? (state.index + 1) % WORD_LIST.length : dayOfYear(new Date()) % WORD_LIST.length;
  void store.setWordOfDayState(today, index);
  return { item: WORD_LIST[index], index };
}

/**
 * The Word of the Day panel (a webview).
 */
export class WordOfDayPanel extends BasePanel {
  private constructor(ctx: vscode.ExtensionContext) {
    super(ctx, 'translation.wordOfDay', 'Word of the Day', vscode.ViewColumn.Beside);
    this.setHtmlFromMedia('wordOfDay.html');
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
    const { item, index } = resolveWord(forceNext);
    this.post({
      type: 'word',
      item,
      index,
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
        try {
          await speakText({ text: word, lang: 'en' });
        } catch (error) {
          void vscode.window.showErrorMessage(describeError(error));
        }
        break;
      }
    }
  }
}
