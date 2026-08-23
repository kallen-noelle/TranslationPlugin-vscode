import * as vscode from 'vscode';
import { Config } from './config.js';
import { translate } from './service.js';
import { logError } from './feedback.js';

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
            md.appendMarkdown(`**${escapeMd(word)}** — *${escapeMd(result.translation ?? '')}*`);
            if (result.dict && result.dict.length > 0) {
              md.appendMarkdown('\n\n---\n');
              for (const d of result.dict.slice(0, 3)) {
                const term = d.term ? `**${escapeMd(d.term)}**` : '';
                const entries = (d.entries ?? [])
                  .slice(0, 5)
                  .map((e) => escapeMd(e.translation))
                  .join('; ');
                md.appendMarkdown(`\n*${escapeMd(d.pos ?? '')}* ${term} ${entries}`);
              }
            }

            // Action links with codicons
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
            md.appendMarkdown(
              `[$(unmute) 朗读](command:translation.hover.speak?${speakArgs} "朗读单词")` +
              ` &nbsp;|&nbsp; ` +
              `[$(star-full) 收藏](command:translation.hover.save?${saveArgs} "加入生词本")` +
              ` &nbsp;|&nbsp; ` +
              `[$(clippy) 复制](command:translation.hover.copy?${copyArgs} "复制译文")` +
              ` &nbsp;|&nbsp; ` +
              `[$(window) 弹窗](command:translation.hover.openDialog?${openDialogArgs} "打开翻译弹窗")`,
            );

            md.supportThemeIcons = true;
            md.isTrusted = true;
            resolve(new vscode.Hover([md], wordRange));
          } catch (error) {
            logError(error);
            resolve(null);
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

        const result = await translate(combined, srcLang, targetLang);
        const translated = result.translation;
        if (!translated || translated.trim() === combined.trim()) {
          return null;
        }

        const md = new vscode.MarkdownString();
        md.appendMarkdown(`$(globe) **翻译**\n\n`);
        md.appendMarkdown(escapeMd(translated));
        md.supportThemeIcons = true;
        md.isTrusted = true;

        return new vscode.Hover([md], wordRange);
      } catch (error) {
        logError(error);
        return null;
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

function escapeMd(text: string): string {
  return text.replace(/([*_`#[\]])/g, '\\$1');
}
