/**
 * Word extraction — ports the IntelliJ plugin's CamelCaseSplitter and provides
 * editor-aware text extraction.
 */

import * as vscode from 'vscode';
import { ExtractMode } from './types.js';

export interface ExtractedText {
  text: string;
  range: vscode.Range;
}

// ---------------------------------------------------------------------------
// CamelCaseSplitter port.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Editor-aware extraction.
// ---------------------------------------------------------------------------

function getWordRangeAtPosition(editor: vscode.TextEditor, pos: vscode.Position): vscode.Range | undefined {
  const range = editor.document.getWordRangeAtPosition(pos);
  return range;
}

/** Extracts text from the editor based on the given mode. */
export function extractText(
  editor: vscode.TextEditor,
  mode: ExtractMode = ExtractMode.Auto,
): ExtractedText | undefined {
  const doc = editor.document;

  if (mode === ExtractMode.Auto && !editor.selection.isEmpty) {
    return { text: doc.getText(editor.selection), range: editor.selection };
  }

  if (mode === ExtractMode.Exclusive) {
    return extractNearestWord(editor);
  }

  // Inclusive or Auto-without-selection: extract the full word run at the caret.
  return extractWordRun(editor);
}

/** Extracts the full identifier / word run containing the caret. */
function extractWordRun(editor: vscode.TextEditor): ExtractedText | undefined {
  const pos = editor.selection.active;
  const range = getWordRangeAtPosition(editor, pos);
  if (!range) {
    return undefined;
  }
  const text = editor.document.getText(range).trim();
  if (!text) {
    return undefined;
  }
  return { text: splitCamelCaseWords(text), range };
}

/** Extracts only the nearest single sub-word at the caret. */
function extractNearestWord(editor: vscode.TextEditor): ExtractedText | undefined {
  const pos = editor.selection.active;
  const range = getWordRangeAtPosition(editor, pos);
  if (!range) {
    return undefined;
  }
  const word = editor.document.getText(range);
  let offset = editor.document.offsetAt(pos) - editor.document.offsetAt(range.start);
  const subWords = splitWords(word);

  let current = range.start;
  for (const sub of subWords) {
    const subEnd = editor.document.positionAt(editor.document.offsetAt(current) + sub.length);
    if (offset >= 0 && offset < sub.length) {
      return { text: sub, range: new vscode.Range(current, subEnd) };
    }
    offset -= sub.length;
    current = subEnd;
  }

  return { text: word, range };
}
