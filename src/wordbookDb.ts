/**
 * Word book persistence backed by the same SQLite database as the original
 * IntelliJ TranslationPlugin (interop), so both plugins share the word book.
 *
 * Database location:
 * - Windows:  %LOCALAPPDATA%\Yii.Guxing\TranslationPlugin\wordbook.sqlite
 * - Other:    $XDG_DATA_HOME/Yii.Guxing/TranslationPlugin/wordbook.sqlite
 *             or ~/.TranslationPlugin/wordbook.sqlite
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';

function logError(error: unknown): void {
  console.error('[wordbook-db]', error instanceof Error ? error.stack ?? error.message : String(error));
}

/** A row in the shared `wordbook` table (schema matches the IntelliJ plugin). */
export interface WordBookRow {
  _id: number;
  word: string;
  source_language: string;
  target_language: string;
  phonetic: string | null;
  explanation: string | null;
  tags: string | null;
  created_at: number;
}

export interface AddWordInput {
  word: string;
  sourceLanguage: string;
  targetLanguage: string;
  phonetic?: string | null;
  explanation?: string | null;
}

const STORAGE_FILE_NAME = 'wordbook.sqlite';

/** Resolves the original plugin's default data directory. */
export function defaultDataDir(): string {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      return path.join(localAppData, 'Yii.Guxing', 'TranslationPlugin');
    }
  } else {
    const xdg = process.env.XDG_DATA_HOME;
    if (xdg) {
      return path.join(xdg, 'Yii.Guxing', 'TranslationPlugin');
    }
    return path.join(os.homedir(), '.TranslationPlugin');
  }
  return path.join(os.homedir(), '.TranslationPlugin');
}

/** Resolves the word book database file. `customPath` may be a file or a directory. */
export function resolveWordBookPath(customPath?: string): string {
  const p = customPath?.trim();
  if (p) {
    return /\.sqlite$/i.test(p) ? p : path.join(p, STORAGE_FILE_NAME);
  }
  return path.join(defaultDataDir(), STORAGE_FILE_NAME);
}

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS wordbook (
  "_id"             INTEGER PRIMARY KEY,
  word              TEXT     COLLATE NOCASE NOT NULL,
  source_language   TEXT                   NOT NULL,
  target_language   TEXT                   NOT NULL,
  phonetic          TEXT,
  explanation       TEXT,
  tags              TEXT,
  created_at        DATETIME               NOT NULL
)
`;

const CREATE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS wordbook_unique_index
  ON wordbook (word, source_language, target_language)
`;

/**
 * Opens the shared word book database, creating the file/table if needed.
 * Returns `undefined` if the database cannot be opened.
 */
function openDatabase(customPath?: string): Database.Database | undefined {
  try {
    const file = resolveWordBookPath(customPath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const db = new Database(file);
    db.pragma('journal_mode = WAL');
    db.exec(CREATE_TABLE_SQL);
    db.exec(CREATE_INDEX_SQL);
    return db;
  } catch (error) {
    logError(error);
    return undefined;
  }
}

let db: Database.Database | undefined;
let dbPath = '';

function getDb(customPath?: string): Database.Database | undefined {
  const file = resolveWordBookPath(customPath);
  if (db && dbPath === file) {
    return db;
  }
  if (db) {
    try {
      db.close();
    } catch {
      // ignore
    }
    db = undefined;
  }
  dbPath = file;
  db = openDatabase(customPath);
  return db;
}

function rowToEntry(r: WordBookRow): WordBookEntry {
  return {
    id: r._id,
    original: r.word,
    translation: r.explanation ?? '',
    srcLang: r.source_language,
    targetLang: r.target_language,
    phonetic: r.phonetic,
    tags: r.tags,
    addedAt: r.created_at,
  };
}

export interface WordBookEntry {
  id: number;
  original: string;
  translation: string;
  srcLang: string;
  targetLang: string;
  phonetic: string | null;
  tags: string | null;
  addedAt: number;
}

export function getWordBook(customPath?: string): WordBookEntry[] {
  const database = getDb(customPath);
  if (!database) {
    return [];
  }
  try {
    const rows = database
      .prepare('SELECT * FROM wordbook ORDER BY created_at DESC')
      .all() as WordBookRow[];
    return rows.map(rowToEntry);
  } catch (error) {
    logError(error);
    return [];
  }
}

/**
 * Adds a word to the shared word book. Returns `true` if a new row was
 * inserted, `false` if it already exists or the database is unavailable.
 */
export function addWordToWordBook(input: AddWordInput, customPath?: string): boolean {
  const database = getDb(customPath);
  if (!database) {
    return false;
  }
  try {
    const result = database
      .prepare(
        `INSERT OR IGNORE INTO wordbook
           (word, source_language, target_language, phonetic, explanation, tags, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?)`,
      )
      .run(
        input.word,
        input.sourceLanguage,
        input.targetLanguage,
        input.phonetic ?? null,
        input.explanation ?? null,
        Date.now(),
      );
    return result.changes > 0;
  } catch (error) {
    logError(error);
    return false;
  }
}

export function removeWordFromWordBook(
  word: string,
  srcLang: string,
  targetLang: string,
  customPath?: string,
): void {
  const database = getDb(customPath);
  if (!database) {
    return;
  }
  try {
    database
      .prepare('DELETE FROM wordbook WHERE word = ? AND source_language = ? AND target_language = ?')
      .run(word, srcLang, targetLang);
  } catch (error) {
    logError(error);
  }
}

export function clearWordBook(customPath?: string): void {
  const database = getDb(customPath);
  if (!database) {
    return;
  }
  try {
    database.prepare('DELETE FROM wordbook').run();
  } catch (error) {
    logError(error);
  }
}

export interface UpdateWordInput {
  phonetic?: string | null;
  explanation?: string | null;
  tags?: string | null;
}

/** Updates the editable fields (phonetic / explanation / tags) of a word by id. */
export function updateWordInWordBook(id: number, input: UpdateWordInput, customPath?: string): void {
  const database = getDb(customPath);
  if (!database) {
    return;
  }
  try {
    database
      .prepare('UPDATE wordbook SET phonetic = ?, explanation = ?, tags = ? WHERE "_id" = ?')
      .run(input.phonetic ?? null, input.explanation ?? null, input.tags ?? null, id);
  } catch (error) {
    logError(error);
  }
}
