import * as vscode from 'vscode';
import { BasePanel, WebviewMessage } from './panel.js';
import { translate } from '../service.js';
import { speakText } from '../tts/index.js';
import { LANGUAGES } from '../languages.js';
import { getActiveEngineId } from '../translator/registry.js';
import { Store, saveTranslationToWordBook } from '../store.js';
import { describeError } from '../feedback.js';
import { refreshWordBookView } from '../wordBookView.js';
import { Translation } from '../types.js';

let instance: TranslationDialogPanel | undefined;

/**
 * The translation dialog panel (a webview).
 */
export class TranslationDialogPanel extends BasePanel {
  private ready = false;
  /** ready 到达前到达的 setText 消息暂存,等 languages/init 之后再 flush */
  private pendingSetText?: { text: string; srcLang?: string; targetLang?: string };

  private constructor(ctx: vscode.ExtensionContext) {
    super(ctx, 'translation.dialog', 'Translation', vscode.ViewColumn.Beside);
    this.loadWebviewBundle('TranslationDialog', 'translationDialog.html');
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
      instance.queueSetText(original, srcLang, targetLang);
    }
  }

  /** Shows the dialog and directly renders an already-translated result. */
  static showWithResult(ctx: vscode.ExtensionContext, result: Translation): void {
    const panel = TranslationDialogPanel.show(ctx);
    panel.post({ type: 'preFillResult', result });
  }

  private queueSetText(text: string, srcLang?: string, targetLang?: string): void {
    if (!this.ready) {
      // Webview 还没 ready: 暂存,等 sendInitialState 之后再发,确保 languages 下拉框已填充
      this.pendingSetText = { text, srcLang, targetLang };
      return;
    }
    this.flushSetText(text, srcLang, targetLang);
  }

  private flushSetText(text: string, srcLang?: string, targetLang?: string): void {
    this.post({ type: 'setText', text });
    if (srcLang || targetLang) {
      // 通过 init 消息覆盖用户上次选的语言对
      this.post({
        type: 'init',
        srcLang: srcLang ?? Store.get().getLastSourceLanguage(),
        targetLang: targetLang ?? Store.get().getLastTargetLanguage(),
        activeEngine: getActiveEngineId(),
      });
    }
  }

  private sendInitialState(): void {
    this.ready = true;
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

    // flush 暂存的 setText: 此时 languages/init 都已发,HTML 能正确渲染
    if (this.pendingSetText) {
      const p = this.pendingSetText;
      this.pendingSetText = undefined;
      // 等一个事件循环周期让前面三条消息先到
      setTimeout(() => this.flushSetText(p.text, p.srcLang, p.targetLang), 0);
    }
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