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
import { resolveWordBookPath } from './wordbookDb.js';
import { setActiveEngine } from './translator/registry.js';
import { updateStatusBar } from './statusbar.js';
import { getDiskCacheSize, evictAllDiskCaches, formatByteSize } from './cacheService.js';

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

      case 'saveSetting':
        await this.saveSetting(msg.key as string, msg.value);
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

      case 'clearCache': {
        evictAllDiskCaches();
        this.post({ type: 'cacheCleared', cacheSize: formatByteSize(getDiskCacheSize()) });
        void vscode.window.showInformationMessage('磁盘缓存已清除');
        break;
      }

      case 'browseWordbookPath': {
        const picked = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          title: '选择单词本存储路径',
        });
        if (picked && picked.length > 0) {
          const p = picked[0].fsPath;
          await vscode.workspace.getConfiguration('translation').update('wordbook.path', p, vscode.ConfigurationTarget.Global);
          this.post({ type: 'wordbookPathChanged', path: resolveWordBookPath(p) });
        }
        break;
      }

      case 'clearHistory': {
        await Store.get().clearHistory();
        this.post({ type: 'historyCleared' });
        void vscode.window.showInformationMessage('历史记录已清除');
        break;
      }
    }
  }

  private async sendSettings(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('translation');
    const apiKey = await Config.get().getApiKey('openai');
    const cacheSize = this.getCacheSize();
    this.post({
      type: 'settings',
      settings: {
        defaultEngine: cfg.get('defaultEngine', 'microsoft'),
        mainLanguage: cfg.get('mainLanguage', 'zh-CN'),
        sourceLanguage: cfg.get('sourceLanguage', 'auto'),
        targetLanguage: cfg.get('targetLanguage', 'zh-CN'),
        'font.family': cfg.get('font.family', ''),
        'font.phonetic': cfg.get('font.phonetic', ''),
        'textSelection.stripPunctuation': cfg.get('textSelection.stripPunctuation', false),
        'textSelection.preserveFormat': cfg.get('textSelection.preserveFormat', false),
        'textSelection.autoCapture': cfg.get('textSelection.autoCapture', false),
        'textSelection.regexFilter': cfg.get('textSelection.regexFilter', ''),
        'hover.enabled': cfg.get('hover.enabled', true),
        'hover.docTranslation': cfg.get('hover.docTranslation', true),
        'popup.autoRead': cfg.get('popup.autoRead', 'none'),
        'popup.position': cfg.get('popup.position', 'cursor'),
        'popup.autoCopy': cfg.get('popup.autoCopy', false),
        'replace.contextMenu': cfg.get('replace.contextMenu', true),
        'replace.selectLanguageFirst': cfg.get('replace.selectLanguageFirst', false),
        'replace.useLastLanguage': cfg.get('replace.useLastLanguage', false),
        'replace.autoReplace': cfg.get('replace.autoReplace', false),
        replaceSeparator: cfg.get('replaceSeparator', 'original'),
        'wordOfDay.autoShow': cfg.get('wordOfDay.autoShow', true),
        'wordOfDay.showDefinition': cfg.get('wordOfDay.showDefinition', true),
        'wordbook.path': cfg.get('wordbook.path', ''),
        'wordbook.resolvedPath': resolveWordBookPath(cfg.get('wordbook.path', '')),
        'history.maxEntries': cfg.get('history.maxEntries', 100),
        autoTranslateDocument: cfg.get('autoTranslateDocument', true),
        contextMenuOnlyWithSelection: cfg.get('contextMenuOnlyWithSelection', true),
        ttsEngine: cfg.get('ttsEngine', 'edge'),
        'tts.edge.voice': cfg.get('tts.edge.voice', ''),
        'tts.edge.speed': cfg.get('tts.edge.speed', '0%'),
        'tts.openai.voice': cfg.get('tts.openai.voice', 'alloy'),
        'openai.baseUrl': cfg.get('openai.baseUrl', 'https://api.openai.com'),
        'openai.model': cfg.get('openai.model', 'gpt-4o-mini'),
      },
      apiKey: apiKey ? '已配置(****)' : '未配置',
      cacheSize,
    });
  }

  private getCacheSize(): string {
    return formatByteSize(getDiskCacheSize());
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
  }

  private async saveSetting(key: string, value: unknown): Promise<void> {
    if (!key) return;
    if (key === 'history.maxEntries' && typeof value === 'string') {
      value = parseInt(value, 10);
    }
    if (key === 'openai.apiKey') {
      if (typeof value === 'string' && value) {
        await Config.get().setApiKey('openai', value);
      }
      return;
    }
    const cfg = vscode.workspace.getConfiguration('translation');
    try {
      await cfg.update(key, value, vscode.ConfigurationTarget.Global);
    } catch (error) {
      void vscode.window.showErrorMessage(`保存配置失败: ${describeError(error)}`);
    }
    if (key === 'defaultEngine' && typeof value === 'string') {
      await setActiveEngine(this.ctx, value);
      updateStatusBar();
    }
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
