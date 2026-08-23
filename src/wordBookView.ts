/**
 * Word book sidebar view — a webview view that renders a table (Word | Explanation)
 * with a top toolbar and a custom context menu, mimicking the original plugin.
 * Reads the shared SQLite database.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Config } from './config.js';
import { Store, WordBookEntry } from './store.js';
import { speakText } from './tts/index.js';
import { describeError, log, logError, runWithProgress } from './feedback.js';
import { WordDetailsPanel } from './webview/wordDetails.js';
import { exportWordBook, importWordBook, exportWordBookJson, exportWordBookTxt, exportWordBookXml, importWordBookAuto } from './wordbookImportExport.js';
import { setActiveEngine } from './translator/registry.js';
import { updateStatusBar } from './statusbar.js';

interface WordBookMessage {
  type: string;
  [key: string]: unknown;
}

class WordBookWebviewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private mediaBaseUri = '';

  constructor(private readonly ctx: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    this.mediaBaseUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this.ctx.extensionUri, 'media'),
    ).toString();

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.ctx.extensionUri, 'media'),
        vscode.Uri.joinPath(this.ctx.extensionUri, 'src', 'webview', 'media'),
      ],
    };

    const htmlFile = path.join(this.ctx.extensionPath, 'src', 'webview', 'media', 'wordBookWebview.html');
    const html = fs.readFileSync(htmlFile, 'utf-8').replaceAll('{{MEDIA}}', this.mediaBaseUri);
    webviewView.webview.html = html;

    webviewView.webview.onDidReceiveMessage((msg: WordBookMessage) => {
      void this.onMessage(msg);
    });
  }

  private post(msg: WordBookMessage): void {
    void this.view?.webview.postMessage(msg);
  }

  refresh(): void {
    this.post({ type: 'entries', entries: Store.get().getWordBook() });
  }

  private async onMessage(msg: WordBookMessage): Promise<void> {
    switch (msg.type) {
      case 'getWords':
        this.post({ type: 'entries', entries: Store.get().getWordBook() });
        break;

      case 'refresh':
        this.refresh();
        break;

      case 'getSettings':
        void this.sendSettings();
        break;

      case 'saveSettings':
        await this.saveSettings((msg.settings ?? {}) as Record<string, unknown>);
        this.post({ type: 'saved' });
        break;

      case 'command': {
        const command = String(msg.command ?? '');
        if (command) {
          void vscode.commands.executeCommand(command);
        }
        break;
      }

      case 'detail': {
        const entry = msg.entry as WordBookEntry;
        WordDetailsPanel.show(this.ctx, entry);
        break;
      }

      case 'copy': {
        const entry = msg.entry as WordBookEntry;
        await vscode.env.clipboard.writeText(entry.original);
        void vscode.window.showInformationMessage('已复制单词');
        break;
      }

      case 'speak': {
        const entry = msg.entry as WordBookEntry;
        const text = (entry.original ?? '').trim() || entry.translation;
        if (!text) {
          void vscode.window.showWarningMessage('没有可朗读的内容');
          break;
        }
        await runWithProgress(`朗读中 (${entry.original})…`, async () => {
          try {
            await speakText({ text, lang: entry.srcLang || 'auto' });
          } catch (error) {
            logError(error);
            void vscode.window.showErrorMessage(`朗读失败: ${describeError(error)}`);
          }
        });
        break;
      }

      case 'delete': {
        const entry = msg.entry as WordBookEntry;
        const confirmed = await vscode.window.showWarningMessage(
          `确认删除单词 "${entry.original}"?`,
          { modal: true },
          '删除',
        );
        if (confirmed === '删除') {
          await Store.get().removeFromWordBook(entry.original, entry.srcLang, entry.targetLang);
          this.refresh();
        }
        break;
      }
    }
  }

  private async sendSettings(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('translation');
    const apiKey = await Config.get().getApiKey('openai');
    this.post({
      type: 'settings',
      settings: {
        defaultEngine: cfg.get('defaultEngine', 'google'),
        sourceLanguage: cfg.get('sourceLanguage', 'auto'),
        targetLanguage: cfg.get('targetLanguage', 'zh-CN'),
        replaceSeparator: cfg.get('replaceSeparator', 'original'),
        'hover.enabled': cfg.get('hover.enabled', true),
        ttsEngine: cfg.get('ttsEngine', 'edge'),
        'tts.edge.voice': cfg.get('tts.edge.voice', ''),
        'tts.edge.speed': cfg.get('tts.edge.speed', '0%'),
        'tts.openai.voice': cfg.get('tts.openai.voice', 'alloy'),
        'openai.baseUrl': cfg.get('openai.baseUrl', 'https://api.openai.com'),
        'openai.model': cfg.get('openai.model', 'gpt-4o-mini'),
      },
      apiKey: apiKey ? '已配置(****)' : '未配置',
    });
  }

  private async saveSettings(settings: Record<string, unknown>): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('translation');
    const apiKeyValue = settings['openai.apiKey'];
    delete settings['openai.apiKey'];

    for (const [key, value] of Object.entries(settings)) {
      try {
        await cfg.update(key, value, vscode.ConfigurationTarget.Global);
      } catch (error) {
        void vscode.window.showErrorMessage(`保存配置失败: ${describeError(error)}`);
      }
    }
    if (typeof apiKeyValue === 'string') {
      await Config.get().setApiKey('openai', apiKeyValue);
    }

    const engineId = String(settings.defaultEngine ?? '');
    if (engineId) {
      await setActiveEngine(this.ctx, engineId);
      updateStatusBar();
    }
    void vscode.window.showInformationMessage('设置已保存');
  }
}

let provider: WordBookWebviewProvider | undefined;

/** Refreshes the word book view after the data changes. */
export function refreshWordBookView(): void {
  provider?.refresh();
}

/** Registers the word book webview view. */
export function registerWordBookView(context: vscode.ExtensionContext): void {
  provider = new WordBookWebviewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('translation.wordbook', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('translation.wordbook', () => {
      void vscode.commands.executeCommand('translation.wordbook.focus');
    }),
    vscode.commands.registerCommand('translation.wordbook.refresh', () => provider?.refresh()),
    vscode.commands.registerCommand('translation.wordbook.detail', (entry: WordBookEntry) => {
      WordDetailsPanel.show(context, entry);
    }),
    vscode.commands.registerCommand('translation.wordbook.export', () => exportWordBook()),
    vscode.commands.registerCommand('translation.wordbook.import', () => importWordBookAuto()),
    vscode.commands.registerCommand('translation.wordbook.exportJson', () => exportWordBookJson()),
    vscode.commands.registerCommand('translation.wordbook.exportTxt', () => exportWordBookTxt()),
    vscode.commands.registerCommand('translation.wordbook.exportXml', () => exportWordBookXml()),
  );
}
