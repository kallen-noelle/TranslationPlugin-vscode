import * as vscode from 'vscode';
import { BasePanel, WebviewMessage } from './panel.js';
import { WordBookEntry, updateWordInWordBook } from '../wordbookDb.js';
import { Config } from '../config.js';
import { speakText } from '../tts/index.js';
import { describeError } from '../feedback.js';

let instance: WordDetailsPanel | undefined;

/**
 * Word details panel — mirrors the original plugin's WordDetailsDialog:
 * shows word, phonetic, tags and explanation, and allows editing.
 */
export class WordDetailsPanel extends BasePanel {
  private constructor(ctx: vscode.ExtensionContext, entry: WordBookEntry) {
    super(ctx, 'translation.wordDetails', 'Word Details', vscode.ViewColumn.Beside);
    this.setHtmlFromMedia('wordDetails.html');
    this.post({ type: 'entry', entry });
  }

  static show(ctx: vscode.ExtensionContext, entry: WordBookEntry): void {
    if (instance && !instance.isDisposed) {
      instance.dispose();
    }
    instance = new WordDetailsPanel(ctx, entry);
  }

  protected async onMessage(msg: WebviewMessage): Promise<void> {
    switch (msg.type) {
      case 'save': {
        const id = Number(msg.id);
        const phonetic = String(msg.phonetic ?? '');
        const tags = String(msg.tags ?? '');
        const explanation = String(msg.explanation ?? '');
        updateWordInWordBook(
          id,
          {
            phonetic: phonetic || null,
            tags: tags || null,
            explanation: explanation || null,
          },
          Config.get().wordbookPath,
        );
        void vscode.commands.executeCommand('translation.wordbook.refresh');
        void vscode.window.showInformationMessage('已保存');
        break;
      }

      case 'speak': {
        const text = String(msg.text ?? '');
        const lang = String(msg.lang ?? 'en');
        try {
          await speakText({ text, lang });
        } catch (error) {
          void vscode.window.showErrorMessage(describeError(error));
        }
        break;
      }
    }
  }
}
