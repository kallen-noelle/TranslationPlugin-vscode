/**
 * Pure camelCase / snake_case word splitting (no VS Code dependency).
 * Ported from the IntelliJ plugin's CamelCaseSplitter.
 */

const LETTER_REGEX = /\p{L}/u;

function isLetter(char: string): boolean {
  return LETTER_REGEX.test(char);
}

function isUpper(char: string): boolean {
  return char === char.toUpperCase() && char !== char.toLowerCase();
}

function isLower(char: string): boolean {
  return char === char.toLowerCase() && char !== char.toUpperCase();
}

/** Non-letter character type (used to keep consecutive digits together). */
function nonLetterType(char: string): number {
  if (/\d/.test(char)) {
    return 1;
  }
  if (/\s/.test(char)) {
    return 2;
  }
  return 3;
}

/**
 * Splits text into camelCase / snake_case aware word tokens.
 * Mirrors `CamelCaseSplitter.split` from the IntelliJ plugin.
 */
export function splitWords(text: string): string[] {
  const chars = Array.from(text);
  if (!chars.some((c) => !(isLower(c) && isLetter(c)))) {
    return [text];
  }

  const result: string[] = [];
  let index = 0;
  let wordStart = -1;
  let prevType = -1;
  let prevLetter = false;

  const push = (end: number) => {
    if (wordStart >= 0 && end > wordStart) {
      result.push(text.substring(wordStart, end));
    }
    wordStart = -1;
  };

  for (const char of chars) {
    const curLetter = isLetter(char);
    const curType = curLetter ? (isUpper(char) ? 2 : 1) : nonLetterType(char);

    if (curLetter) {
      if (!prevLetter && wordStart >= 0) {
        push(index);
      }
      if (wordStart < 0) {
        wordStart = index;
      } else if (isUpper(char) && isLower(chars[index - 1])) {
        // camelCase boundary: "hello|World"
        push(index);
        wordStart = index;
      } else if (index - wordStart > 1 && isLower(char) && isUpper(chars[index - 1])) {
        // "HTTPServer" -> "HTTP|Server"
        push(index - 1);
        wordStart = index - 1;
      }
    } else if (wordStart < 0 || (!prevLetter && prevType === curType)) {
      if (wordStart < 0) {
        wordStart = index;
      }
    } else {
      push(index);
      wordStart = index;
    }

    prevType = curType;
    prevLetter = curLetter;
    index += char.length;
  }

  if (wordStart >= 0 && wordStart < text.length) {
    result.push(text.substring(wordStart));
  }

  return result;
}

const WORDS_ONLY = /^[\p{L}]+$/u;

/** Splits a word into camelCase sub-words joined by spaces, if it is all letters. */
export function splitCamelCaseWords(text: string): string {
  if (WORDS_ONLY.test(text)) {
    return splitWords(text).join(' ');
  }
  return text;
}
