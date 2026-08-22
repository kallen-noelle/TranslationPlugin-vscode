import * as vscode from 'vscode';
import { Config } from './config.js';
import { translate } from './service.js';
import { logError } from './feedback.js';

/**
 * A hover provider that translates the word under the cursor.
 */
export function registerHoverProvider(): vscode.Disposable {
  let pendingTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingPos: vscode.Position | undefined;
  let disposed = false;

  const provider: vscode.HoverProvider = {
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
            md.supportThemeIcons = true;
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

  return vscode.Disposable.from(
    vscode.languages.registerHoverProvider({ scheme: 'file' }, provider),
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

function escapeMd(text: string): string {
  return text.replace(/([*_`#[\]])/g, '\\$1');
}
