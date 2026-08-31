import * as vscode from 'vscode';
import { Config } from './config.js';
import { translate } from './service.js';
import { ExtractMode, DictItem } from './types.js';
import { extractText } from './wordExtractor.js';
import { formatTranslation } from './replace.js';
import { TranslationDialogPanel } from './webview/translationDialog.js';
import { WordOfDayPanel } from './webview/wordOfDay.js';
import { speakText } from './tts/index.js';
import { saveTranslationToWordBook } from './store.js';
import { createStatusBarItem, updateStatusBar, pickEngine } from './statusbar.js';
import { findCommentLines } from './comments.js';
import { getActiveEngine, getActiveEngineId } from './translator/registry.js';
import { translateDocumentWithOpenAi } from './translator/openai.js';
import { translateWithFeedback, showTranslationError, runWithProgress, flashStatus, truncate, showLog } from './feedback.js';
import { refreshWordBookView } from './wordBookView.js';

export interface CommandContext {
  ctx: vscode.ExtensionContext;
}

function getConfigLangPair(): { src: string; tgt: string } {
  const config = Config.get();
  return { src: config.sourceLanguage, tgt: config.targetLanguage };
}

function requireEditor(): vscode.TextEditor | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage('没有活动的编辑器');
  }
  return editor;
}

// ---------------------------------------------------------------------------
// Show Translation Dialog
// ---------------------------------------------------------------------------

async function showDialog(c: CommandContext): Promise<void> {
  TranslationDialogPanel.show(c.ctx);
}

// ---------------------------------------------------------------------------
// Translate
// ---------------------------------------------------------------------------

async function translateSelection(c: CommandContext, mode: ExtractMode = ExtractMode.Auto): Promise<void> {
  const editor = requireEditor();
  if (!editor) {
    return;
  }
  const extracted = extractText(editor, mode);
  if (!extracted || !extracted.text) {
    void vscode.window.showWarningMessage('未找到可翻译的文本');
    return;
  }

  const config = Config.get();

  // For single-word selection, show hover-style translation popup.
  const isSingleWord = /^[\p{L}\p{N}_]+$/u.test(extracted.text.trim());
  if (isSingleWord && config.hoverEnabled) {
    // Move cursor to the start of the selected word, then trigger hover.
    const targetPos = extracted.range.start;
    editor.selection = new vscode.Selection(targetPos, targetPos);
    // Reveal the position so the hover appears in view.
    editor.revealRange(extracted.range, vscode.TextEditorRevealType.Default);
    // Trigger the built-in show hover command.
    void vscode.commands.executeCommand('editor.action.showHover');
    return;
  }

  // Fallback: full translation with notification/dialog for longer text.
  const { src, tgt } = getConfigLangPair();
  const result = await translateWithFeedback(extracted.text, src, tgt, {
    retry: () => void translateSelection(c, mode),
  });
  if (!result) {
    return;
  }

  // Auto-copy translation to clipboard if enabled.
  if (config.get('popup.autoCopy', false) && result.translation) {
    await vscode.env.clipboard.writeText(result.translation);
  }

  // Pre-fill the dialog if it is open.
  TranslationDialogPanel.postTranslation(extracted.text, result.srcLang, result.targetLang);

  if (config.showResultInNotification) {
    const openAction = '在弹窗中查看';
    const choice = await vscode.window.showInformationMessage(
      result.translation || '(空)',
      openAction,
    );
    if (choice === openAction) {
      TranslationDialogPanel.show(c.ctx);
    }
  }
}

// ---------------------------------------------------------------------------
// Replace with Translation
// ---------------------------------------------------------------------------

async function replaceWithTranslation(): Promise<void> {
  const editor = requireEditor();
  if (!editor) {
    return;
  }
  const extracted = extractText(editor, ExtractMode.Auto);
  if (!extracted || !extracted.text) {
    void vscode.window.showWarningMessage('未找到可替换的文本');
    return;
  }

  const { src, tgt } = getConfigLangPair();
  const config = Config.get();
  const result = await translateWithFeedback(extracted.text, src, tgt, {
    retry: () => void replaceWithTranslation(),
  });
  if (!result) {
    return;
  }

  const translation = result.translation ?? '';
  const formatted = formatTranslation(translation, config.replaceSeparator);

  if (config.replaceSeparator !== 'original') {
    // Also offer camelCase variant, mirroring the IntelliJ plugin behavior.
    const camel = formatTranslation(translation, 'camelCase');
    const use = await vscode.window.showQuickPick(
      [
        { label: formatted, description: config.replaceSeparator },
        { label: camel, description: 'camelCase' },
        { label: translation, description: 'original' },
      ],
      { placeHolder: '选择替换格式' },
    );
    if (!use) {
      return;
    }
    await editor.edit((builder) => builder.replace(extracted.range, use.label));
    flashStatus(`已替换为: ${truncate(use.label, 60)}`);
  } else {
    await editor.edit((builder) => builder.replace(extracted.range, formatted));
    flashStatus(`已替换为: ${truncate(formatted, 60)}`);
  }
}

// ---------------------------------------------------------------------------
// Translate Document / Comments
// ---------------------------------------------------------------------------

async function translateDocument(c: CommandContext): Promise<void> {
  const editor = requireEditor();
  if (!editor) {
    return;
  }
  const doc = editor.document;
  const text = doc.getText().trim();
  if (!text) {
    return;
  }
  const { src, tgt } = getConfigLangPair();
  const engine = getActiveEngine();
  const result = await runWithProgress(`翻译中 (${engine.name})…`, async () => {
    try {
      if (getActiveEngineId() === 'openai' && (doc.languageId === 'html' || doc.languageId === 'xml')) {
        const translated = await translateDocumentWithOpenAi(text, src, tgt);
        return { original: text, translation: translated, srcLang: src, targetLang: tgt, sourceLanguages: [src] };
      }
      return await translate(text, src, tgt);
    } catch (error) {
      await showTranslationError(error, { retry: () => void translateDocument(c) });
      return undefined;
    }
  });
  if (!result) {
    return;
  }
  // Auto-copy translation to clipboard if enabled.
  if (Config.get().get('popup.autoCopy', false) && result.translation) {
    await vscode.env.clipboard.writeText(result.translation);
  }
  TranslationDialogPanel.showWithResult(c.ctx, result);
}

async function translateComments(): Promise<void> {
  const editor = requireEditor();
  if (!editor) {
    return;
  }
  const doc = editor.document;
  const range = editor.selection.isEmpty ? new vscode.Range(0, 0, doc.lineCount, 0) : editor.selection;

  const commentLines = findCommentLines(doc, range);
  if (commentLines.length === 0) {
    void vscode.window.showInformationMessage('未找到可翻译的注释');
    return;
  }

  const { src, tgt } = getConfigLangPair();
  const seen = new Map<string, string>();
  const engine = getActiveEngine();

  const ok = await runWithProgress(`翻译注释 (${engine.name})…`, async () => {
    try {
      // Translate unique comment texts.
      const unique = [...new Set(commentLines.map((l) => l.text))];
      for (const commentText of unique) {
        const result = await translate(commentText, src, tgt);
        seen.set(commentText, result.translation ?? '');
      }
      return true;
    } catch (error) {
      await showTranslationError(error, { retry: () => void translateComments() });
      return false;
    }
  });
  if (!ok) {
    return;
  }

  // Build a single WorkspaceEdit replacing each comment line.
  const workspaceEdit = new vscode.WorkspaceEdit();
  for (const l of commentLines) {
    const translated = seen.get(l.text);
    if (!translated || translated === l.text) {
      continue;
    }
    const prefix = l.line.slice(0, l.range.start.character);
    workspaceEdit.replace(doc.uri, l.range, `${prefix}${l.marker} ${translated}`);
  }
  await vscode.workspace.applyEdit(workspaceEdit);
  void vscode.window.showInformationMessage(`已翻译 ${commentLines.length} 行注释`);
}

// ---------------------------------------------------------------------------
// Switch Engine
// ---------------------------------------------------------------------------

async function switchEngine(c: CommandContext): Promise<void> {
  await pickEngine(c.ctx);
}

// ---------------------------------------------------------------------------
// Text to Speech
// ---------------------------------------------------------------------------

async function tts(): Promise<void> {
  const editor = requireEditor();
  if (!editor) {
    return;
  }
  const selection = editor.selection;
  const text = selection.isEmpty
    ? extractText(editor, ExtractMode.Exclusive)?.text
    : editor.document.getText(selection);
  if (!text || !text.trim()) {
    void vscode.window.showWarningMessage('未找到可朗读的文本');
    return;
  }
  const config = Config.get();
  const lang = config.sourceLanguage === 'auto' ? detectLangForTts(text) : config.sourceLanguage;
  await runWithProgress('朗读中…', async () => {
    try {
      await speakText({ text: text.trim(), lang });
      flashStatus(`🔊 ${truncate(text.trim(), 40)}`);
    } catch (error) {
      await showTranslationError(error);
    }
  });
}

function detectLangForTts(text: string): string {
  const cjk = (text.match(/[一-鿿]/g) ?? []).length;
  const latin = (text.match(/[a-zA-Z]/g) ?? []).length;
  if (cjk > 0 && cjk >= latin) {
    return 'zh-CN';
  }
  if (cjk === 0 && latin > 0) {
    return 'en';
  }
  return 'en';
}

// ---------------------------------------------------------------------------
// Word Book & Word of the Day
// ---------------------------------------------------------------------------

async function wordOfDay(c: CommandContext): Promise<void> {
  WordOfDayPanel.show(c.ctx);
}

async function saveWordBook(): Promise<void> {
  const editor = requireEditor();
  if (!editor) {
    return;
  }
  const selection = editor.selection;
  if (selection.isEmpty) {
    void vscode.window.showWarningMessage('请先选中文本');
    return;
  }
  const text = editor.document.getText(selection);
  const { src, tgt } = getConfigLangPair();
  const result = await translateWithFeedback(text, src, tgt, {
    retry: () => void saveWordBook(),
  });
  if (!result) {
    return;
  }
  const saved = await saveTranslationToWordBook(result);
  if (saved) {
    refreshWordBookView();
  }
  void vscode.window.showInformationMessage(saved ? '已加入生词本' : '没有可保存的内容');
}

// ---------------------------------------------------------------------------
// Configure
// ---------------------------------------------------------------------------

async function configure(): Promise<void> {
  const openaiKey = await Config.get().getApiKey('openai');
  const current = openaiKey ? '已配置(****)' : '未配置';
  const choice = await vscode.window.showQuickPick(
    [
      { label: 'OpenAI API Key', description: current, detail: '用于 OpenAI 翻译与 TTS' },
      { label: '打开设置', detail: '打开 Translation 插件设置页' },
    ],
    { placeHolder: '选择配置项' },
  );
  if (!choice) {
    return;
  }
  if (choice.label === '打开设置') {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'translation.');
    return;
  }

  const input = await vscode.window.showInputBox({
    prompt: '输入 OpenAI API Key(留空以清除)',
    password: true,
  });
  if (input === undefined) {
    return;
  }
  await Config.get().setApiKey('openai', input);
  void vscode.window.showInformationMessage(input ? 'OpenAI API Key 已保存' : 'OpenAI API Key 已清除');
}

// ---------------------------------------------------------------------------
// Show translation log
// ---------------------------------------------------------------------------

function showLogCommand(): void {
  showLog();
}

// ---------------------------------------------------------------------------
// Settings toolbar commands
// ---------------------------------------------------------------------------

function openSettings(): void {
  void vscode.commands.executeCommand('workbench.action.openSettings', 'translation.');
}

async function switchTtsEngine(): Promise<void> {
  const config = Config.get();
  const current = config.ttsEngine;
  const picked = await vscode.window.showQuickPick(
    [
      { label: 'Microsoft Edge TTS', description: current === 'edge' ? '当前' : undefined, id: 'edge' },
      { label: 'OpenAI TTS', description: current === 'openai' ? '当前' : undefined, id: 'openai' },
    ],
    { placeHolder: '选择 TTS 引擎' },
  );
  if (!picked) {
    return;
  }
  await vscode.workspace
    .getConfiguration('translation')
    .update('ttsEngine', picked.id, vscode.ConfigurationTarget.Global);
  void vscode.window.showInformationMessage(`TTS 引擎已切换为 ${picked.label}`);
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerCommands(c: CommandContext): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  disposables.push(
    vscode.commands.registerCommand('translation.showDialog', () => showDialog(c)),
    vscode.commands.registerCommand('translation.translate', () => translateSelection(c)),
    vscode.commands.registerCommand('translation.replaceWithTranslation', () => replaceWithTranslation()),
    vscode.commands.registerCommand('translation.translateDocument', () => translateDocument(c)),
    vscode.commands.registerCommand('translation.translateComments', () => translateComments()),
    vscode.commands.registerCommand('translation.switchEngine', () => switchEngine(c)),
    vscode.commands.registerCommand('translation.tts', () => tts()),
    vscode.commands.registerCommand('translation.wordOfDay', () => wordOfDay(c)),
    vscode.commands.registerCommand('translation.saveWordBook', () => saveWordBook()),
    vscode.commands.registerCommand('translation.configure', () => configure()),
    vscode.commands.registerCommand('translation.showLog', () => showLogCommand()),
    vscode.commands.registerCommand('translation.openSettings', () => openSettings()),
    vscode.commands.registerCommand('translation.switchTtsEngine', () => switchTtsEngine()),
  );

  // Internal commands used by hover provider (accept arguments from command: links).
  disposables.push(
    vscode.commands.registerCommand('translation.hover.speak', async (args?: { text?: string; lang?: string }) => {
      const text = args?.text?.trim();
      if (!text) { return; }
      const lang = args?.lang || Config.get().sourceLanguage;
      try {
        await runWithProgress('朗读中…', () => speakText({ text, lang }));
      } catch (error) {
        showTranslationError(error);
      }
    }),
    vscode.commands.registerCommand('translation.hover.copy', async (args?: { text?: string }) => {
      const text = args?.text;
      if (text) {
        await vscode.env.clipboard.writeText(text);
        void vscode.window.showInformationMessage('已复制到剪贴板');
      }
    }),
    vscode.commands.registerCommand('translation.hover.save', async (args?: { original?: string; translation?: string; srcLang?: string; targetLang?: string; dict?: unknown }) => {
      const original = args?.original?.trim();
      const translation = args?.translation?.trim();
      if (!original || !translation) { return; }
      const srcLang = args?.srcLang || 'auto';
      const targetLang = args?.targetLang || Config.get().targetLanguage;
      const saved = await saveTranslationToWordBook({
        original,
        translation,
        srcLang,
        targetLang,
        sourceLanguages: [srcLang],
        dict: args?.dict as DictItem[] | undefined,
      });
      if (saved) { refreshWordBookView(); }
      void vscode.window.showInformationMessage(saved ? '已加入生词本' : '该词已存在生词本中');
    }),
    vscode.commands.registerCommand('translation.hover.openDialog', (args?: { text?: string; srcLang?: string; targetLang?: string }) => {
      TranslationDialogPanel.show(c.ctx);
      if (args?.text) {
        TranslationDialogPanel.postTranslation(
          args.text,
          args.srcLang || Config.get().sourceLanguage,
          args.targetLang || Config.get().targetLanguage,
        );
      }
    }),
  );

  // Status bar engine indicator.
  disposables.push(createStatusBarItem());
  disposables.push(vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('translation.defaultEngine')) {
      updateStatusBar();
    }
  }));

  return disposables;
}