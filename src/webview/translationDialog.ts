import * as vscode from 'vscode';
import { BasePanel, WebviewMessage } from './panel.js';
import { translate } from '../service.js';
import { speakText } from '../tts/index.js';
import { LANGUAGES } from '../languages.js';
import { getActiveEngineId } from '../translator/registry.js';
import { Store, saveTranslationToWordBook } from '../store.js';
import { describeError } from '../feedback.js';
import { refreshWordBookView } from '../wordBookView.js';

let instance: TranslationDialogPanel | undefined;

/**
 * The translation dialog panel (a webview).
 */
export class TranslationDialogPanel extends BasePanel {
  private constructor(ctx: vscode.ExtensionContext) {
    super(ctx, 'translation.dialog', 'Translation', vscode.ViewColumn.Beside);
    this.setHtmlFromMedia('translationDialog.html');
    this.panel.onDidChangeViewState((e) => {
      if (e.webviewPanel.visible) {
        this.sendInitialState();
      }
    });
  }

  static show(ctx: vscode.ExtensionContext): TranslationDialogPanel {
    if (instance && !instance.isDisposed) {
      instance.reveal();
      return instance;
    }
    instance = new TranslationDialogPanel(ctx);
    return instance;
  }

  /** Sends a translation result to the dialog. */
  static postTranslation(original: string, srcLang: string, targetLang: string): void {
    if (instance && !instance.isDisposed) {
      instance.post({ type: 'setText', text: original });
      instance.post({ type: 'setLanguages', srcLang, targetLang });
    }
  }

  private sendInitialState(): void {
    this.post({
      type: 'languages',
      languages: LANGUAGES.map((l) => ({ code: l.code, name: l.name, nameZh: l.nameZh })),
    });
    this.post({
      type: 'init',
      srcLang: Store.get().getLastSourceLanguage(),
      targetLang: Store.get().getLastTargetLanguage(),
      activeEngine: getActiveEngineId(),
    });
    this.post({ type: 'history', entries: Store.get().getHistory() });
  }

  protected async onMessage(msg: WebviewMessage): Promise<void> {
    switch (msg.type) {
      case 'ready':
        this.sendInitialState();
        break;

      case 'translate': {
        const text = String(msg.text ?? '');
        const srcLang = String(msg.srcLang ?? 'auto');
        const targetLang = String(msg.targetLang ?? 'zh-CN');
        try {
          const result = await translate(text, srcLang, targetLang);
          this.post({ type: 'result', result });
        } catch (error) {
          this.post({ type: 'error', message: describeError(error) });
        }
        break;
      }

      case 'setLanguages':
        await Store.get().setLastSourceLanguage(String(msg.srcLang ?? 'auto'));
        await Store.get().setLastTargetLanguage(String(msg.targetLang ?? 'zh-CN'));
        break;

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

      case 'copy':
        await vscode.env.clipboard.writeText(String(msg.text ?? ''));
        void vscode.window.showInformationMessage('已复制到剪贴板');
        break;

      case 'saveWord': {
        const original = String(msg.original ?? '');
        const translation = String(msg.translation ?? '');
        const srcLang = String(msg.srcLang ?? 'auto');
        const targetLang = String(msg.targetLang ?? 'zh-CN');
        const saved = await saveTranslationToWordBook({ original, translation, srcLang, targetLang, sourceLanguages: [srcLang] });
        if (saved) {
          refreshWordBookView();
        }
        void vscode.window.showInformationMessage(saved ? '已加入生词本' : '该词已存在生词本中');
        break;
      }

      case 'openWordBook':
        void vscode.commands.executeCommand('translation.wordbook');
        break;

      case 'getHistory':
        this.post({ type: 'history', entries: Store.get().getHistory() });
        break;

      case 'clearHistory':
        await Store.get().clearHistory();
        this.post({ type: 'history', entries: [] });
        break;
    }
  }
}
