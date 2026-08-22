/**
 * Comment detection helpers for the "Translate Comments" command.
 */

import * as vscode from 'vscode';

const LINE_COMMENT_PREFIXES: Record<string, string[]> = {
  javascript: ['//'],
  typescript: ['//'],
  javascriptreact: ['//'],
  typescriptreact: ['//'],
  java: ['//'],
  c: ['//'],
  cpp: ['//'],
  csharp: ['//'],
  'objective-c': ['//'],
  'objective-cpp': ['//'],
  swift: ['//'],
  kotlin: ['//'],
  groovy: ['//'],
  dart: ['//'],
  rust: ['//'],
  go: ['//'],
  php: ['//', '#'],
  scala: ['//'],
  python: ['#'],
  ruby: ['#'],
  shellscript: ['#'],
  powershell: ['#'],
  yaml: ['#'],
  dockerfile: ['#'],
  makefile: ['#'],
  lua: ['--'],
  sql: ['--'],
  mysql: ['--'],
  pgsql: ['--'],
  hcl: ['#'],
  toml: ['#'],
  ini: [';'],
  elixir: ['#'],
  haskell: ['--'],
  fsharp: ['//'],
  vue: ['//'],
  svelte: ['//'],
};

interface CommentLine {
  range: vscode.Range;
  /** The comment text without the prefix marker. */
  text: string;
  /** Full original line. */
  line: string;
  /** The comment marker (e.g. `//`, `#`, `--`). */
  marker: string;
}

/** Collects line comments in the given range (deduplicated text). */
export function findCommentLines(
  doc: vscode.TextDocument,
  range: vscode.Range,
): CommentLine[] {
  const prefixes = LINE_COMMENT_PREFIXES[doc.languageId] ?? [];
  if (prefixes.length === 0) {
    return [];
  }

  const lines: CommentLine[] = [];
  const startLine = range.start.line;
  const endLine = range.end.line;

  for (let i = startLine; i <= endLine; i++) {
    const line = doc.lineAt(i);
    const trimmed = line.text.trimStart();
    const leadingWs = line.firstNonWhitespaceCharacterIndex;

    const prefix = prefixes.find((p) => trimmed.startsWith(p));
    if (!prefix) {
      continue;
    }

    let commentText = trimmed.slice(prefix.length);
    // For HTML/XML line comments the prefix is '<!--' — handle as block-ish.
    if (prefix === '<!--') {
      commentText = commentText.replace(/-->\s*$/, '');
    }
    commentText = commentText.trim();
    if (!commentText) {
      continue;
    }

    // Skip shebangs and pragmas.
    if (/^(#!|\s*!?\s*(pragma|region|endregion|endif|include|import)\b)/i.test(commentText)) {
      continue;
    }

    lines.push({
      range: new vscode.Range(i, leadingWs, i, line.text.length),
      text: commentText,
      line: line.text,
      marker: prefix,
    });
  }

  return lines;
}
