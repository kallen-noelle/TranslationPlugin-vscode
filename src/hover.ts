import * as vscode from 'vscode';
import { Config } from './config.js';
import { translate } from './service.js';
import { logError, describeError } from './feedback.js';

/** Guard to prevent recursive hover provider calls. */
let inDocTranslateCall = false;

/**
 * A hover provider that translates the word under the cursor.
 */
export function registerHoverProvider(): vscode.Disposable {
  let pendingTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingPos: vscode.Position | undefined;
  let disposed = false;

  // --- Word translation hover ---
  const wordProvider: vscode.HoverProvider = {
    provideHover(document, position) {
      const config = Config.get();
      if (!config.hoverEnabled) {
        return null;
      }

      // Only hover over letter-like text.
      const wordRange = document.getWordRangeAtPosition(position, /[\p{L}\p{N}_]+/u);
      if (!wordRange) {
        return null;
      }
      const word = document.getText(wordRange).trim();
      if (!word) {
        return null;
      }

      if (pendingPos && pendingPos.isEqual(position)) {
        return null;
      }
      pendingPos = position;

      if (pendingTimer) {
        clearTimeout(pendingTimer);
      }

      const delay = Math.max(0, config.hoverDelay);

      const promise = new Promise<vscode.Hover | null>((resolve) => {
        pendingTimer = setTimeout(async () => {
          if (disposed || !vscode.window.activeTextEditor) {
            resolve(null);
            return;
          }
          try {
            const srcLang = config.sourceLanguage === 'auto'
              ? await detectLang(word)
              : config.sourceLanguage;
            const result = await translate(word, srcLang, config.targetLanguage);
            const md = new vscode.MarkdownString();

            // Main translation line
            md.appendMarkdown(`**${escapeMd(word)}**`);
            if (result.transliteration) {
              md.appendMarkdown(`  *${escapeMd(result.transliteration)}*`);
            }
            md.appendMarkdown(`\n\n${escapeMd(result.translation ?? '')}`);

            // Dictionary entries
            if (result.dict && result.dict.length > 0) {
              md.appendMarkdown('\n\n---\n');
              for (const d of result.dict.slice(0, 4)) {
                const pos = d.pos ? `*${escapeMd(d.pos)}* ` : '';
                const term = d.term ? `**${escapeMd(d.term)}** ` : '';
                const entries = (d.entries ?? [])
                  .slice(0, 6)
                  .map((e) => escapeMd(e.translation))
                  .join('; ');
                md.appendMarkdown(`\n${pos}${term}${entries}`);
              }
            }

            // Action links
            const translation = result.translation ?? '';
            const resultSrcLang = result.srcLang || srcLang;
            const resultTargetLang = result.targetLang || config.targetLanguage;

            const speakArgs = encodeURIComponent(JSON.stringify({ text: word, lang: resultSrcLang }));
            const copyArgs = encodeURIComponent(JSON.stringify({ text: translation }));
            const saveArgs = encodeURIComponent(JSON.stringify({
              original: word,
              translation,
              srcLang: resultSrcLang,
              targetLang: resultTargetLang,
              dict: result.dict,
            }));
            const openDialogArgs = encodeURIComponent(JSON.stringify({
              text: word,
              srcLang: resultSrcLang,
              targetLang: resultTargetLang,
            }));

            md.appendMarkdown('\n\n---\n');
            // 按钮顺序: 朗读 → 收藏 → 打开翻译弹窗 → 复制译文
            md.appendMarkdown(
              `[$(unmute)](command:translation.hover.speak?${speakArgs} "朗读") ` +
              `[$(star-full)](command:translation.hover.save?${saveArgs} "收藏到生词本") ` +
              `[$(window)](command:translation.hover.openDialog?${openDialogArgs} "打开翻译弹窗") ` +
              `[$(clippy)](command:translation.hover.copy?${copyArgs} "复制译文")`,
            );

            md.supportThemeIcons = true;
            md.isTrusted = true;
            resolve(new vscode.Hover([md], wordRange));
          } catch (error) {
            logError(error);
            const errMd = new vscode.MarkdownString();
            errMd.appendMarkdown(`$(error) **翻译失败**\n\n`);
            errMd.appendMarkdown(escapeMd(describeError(error)));
            errMd.supportThemeIcons = true;
            errMd.isTrusted = true;
            resolve(new vscode.Hover([errMd], wordRange));
          }
        }, delay);
      });

      return promise;
    },
  };

  // --- Documentation translation hover ---
  const docProvider: vscode.HoverProvider = {
    async provideHover(document, position) {
      const config = Config.get();
      if (!config.hoverEnabled || !config.hoverDocTranslation) {
        return null;
      }

      // Prevent recursive calls when we invoke executeHoverProvider ourselves.
      if (inDocTranslateCall) {
        return null;
      }

      const wordRange = document.getWordRangeAtPosition(position, /[\p{L}\p{N}_]+/u);
      if (!wordRange) {
        return null;
      }

      try {
        inDocTranslateCall = true;
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
          'vscode.executeHoverProvider',
          document.uri,
          position,
        );
        if (!hovers || hovers.length === 0) {
          return null;
        }

        // Collect all markdown content from language service hovers.
        const docParts: string[] = [];
        for (const hover of hovers) {
          for (const content of hover.contents) {
            if (typeof content === 'string') {
              docParts.push(content);
            } else if ('value' in content && typeof (content as vscode.MarkdownString).value === 'string') {
              docParts.push((content as vscode.MarkdownString).value);
            }
          }
        }

        if (docParts.length === 0) {
          return null;
        }

        const combined = docParts.join('\n\n');

        // Skip if content is too short (probably just a word translation target).
        if (combined.trim().length < 30) {
          return null;
        }

        // Detect if the content is mostly English (needs translation to target language).
        const englishRatio = estimateEnglishRatio(combined);
        if (englishRatio < 0.3) {
          // Already mostly non-English, skip.
          return null;
        }

        // Translate the documentation text.
        const srcLang = 'en';
        const targetLang = config.targetLanguage === 'en' ? 'zh-CN' : config.targetLanguage;

        // 翻译前保护代码块、行内标识符、URL、主题图标等不应翻译的内容
        const { protected: protectedInput, tokens } = protectNonTranslatable(combined);
        const result = await translate(protectedInput, srcLang, targetLang);
        let translated = result.translation;
        // 恢复占位符
        translated = restoreNonTranslatable(translated ?? '', tokens);
        if (!translated || translated.trim() === combined.trim()) {
          return null;
        }

        const md = new vscode.MarkdownString();
        md.appendMarkdown(`$(globe) **文档翻译**\n\n`);
        // 翻译结果保留 Markdown 格式（代码块、反引号、链接等），不再 escape
        md.appendMarkdown(translated);
        md.supportThemeIcons = true;
        md.isTrusted = true;

        return new vscode.Hover([md], wordRange);
      } catch (error) {
        logError(error);
        const errMd = new vscode.MarkdownString();
        errMd.appendMarkdown(`$(error) **文档翻译失败**\n\n`);
        errMd.appendMarkdown(escapeMd(describeError(error)));
        errMd.supportThemeIcons = true;
        errMd.isTrusted = true;
        return new vscode.Hover([errMd], wordRange);
      } finally {
        inDocTranslateCall = false;
      }
    },
  };

  return vscode.Disposable.from(
    vscode.languages.registerHoverProvider({ scheme: 'file' }, wordProvider),
    vscode.languages.registerHoverProvider({ scheme: 'file' }, docProvider),
    { dispose: () => { disposed = true; if (pendingTimer) clearTimeout(pendingTimer); } },
  );
}

/** Simple heuristic source-language detection (CJK vs Latin). */
async function detectLang(text: string): Promise<string> {
  const cjkCount = (text.match(/[一-鿿]/g) ?? []).length;
  const letterCount = (text.match(/[a-zA-Z]/g) ?? []).length;
  if (cjkCount > 0 && cjkCount >= letterCount) {
    return 'zh-CN';
  }
  return 'auto';
}

/** Estimate what fraction of the text is English alphabetic characters. */
function estimateEnglishRatio(text: string): number {
  const letters = (text.match(/[a-zA-Z]/g) ?? []).length;
  const total = text.replace(/\s/g, '').length;
  return total === 0 ? 0 : letters / total;
}

/**
 * 翻译前保护 Markdown 中的代码块、行内代码、链接 URL、主题图标等不应翻译的内容。
 * 返回替换后的文本和替换表(placeholder → 原文)。
 *
 * 保护范围:
 *   1. ```...``` 围栏代码块 (含语言标识)
 *   2. `...` 行内代码/标识符
 *   3. [...](url) 中的 URL 部分
 *   4. $(icon-name) VS Code 主题图标
 *   5. **text** / *text* 粗斜体里的英文标识符 (可能被引擎误译)
 */
function protectNonTranslatable(text: string): { protected: string; tokens: string[] } {
  const tokens: string[] = [];
  const push = (m: string): string => {
    const idx = tokens.length;
    tokens.push(m);
    return `<<KEEP_${idx}>>`;
  };

  let protectedText = text;

  // 1. 围栏代码块 ``` ... ```
  protectedText = protectedText.replace(/```[\s\S]*?```/g, (m) => push(m));

  // 2. 行内代码 `...`
  protectedText = protectedText.replace(/`[^`]+`/g, (m) => push(m));

  // 3. Markdown 链接 URL [...](url) — 只保护 url 部分
  protectedText = protectedText.replace(/(\[([^\]]*)\]\()([^)]+)(\))/g, (_m, pre, label, url, post) => {
    const urlPlaceholder = push(url);
    return `${pre}${label}${urlPlaceholder}${post}`;
  });

  // 4. VS Code 主题图标 $(name)
  protectedText = protectedText.replace(/\$\([a-z][a-z0-9-]*\)/gi, (m) => push(m));

  // 5. 命令链接 command:... — 保护整个命令 URI
  protectedText = protectedText.replace(/\(command:[^)]+\)/g, (m) => push(m));

  return { protected: protectedText, tokens };
}

/** 用保护表把占位符恢复成原文。 */
function restoreNonTranslatable(text: string, tokens: string[]): string {
  return text.replace(/<<KEEP_(\d+)>>/g, (_m, idx) => {
    const i = parseInt(idx, 10);
    return Number.isFinite(i) && i >= 0 && i < tokens.length ? tokens[i] : _m;
  });
}

function escapeMd(text: string): string {
  return text.replace(/([*_`#[\]])/g, '\\$1');
}
