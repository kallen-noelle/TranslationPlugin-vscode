// Smoke test for the shared word book DB (read real DB, write to a temp copy).
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { getWordBook, addWordToWordBook, removeWordFromWordBook, resolveWordBookPath } from '../out/wordbookDb.js';

const real = process.env.LOCALAPPDATA + '/Yii.Guxing/TranslationPlugin/wordbook.sqlite';
console.log('real DB exists:', existsSync(real));

// read real DB (default path resolution)
const entries = getWordBook();
console.log('real word count:', entries.length);
console.log('first entry:', JSON.stringify(entries[0]));

// write test on a temp copy
const tmpDir = path.join(tmpdir(), 'wb-test-' + Date.now());
mkdirSync(tmpDir, { recursive: true });
writeFileSync(path.join(tmpDir, 'wordbook.sqlite'), readFileSync(real));

const tmpPath = path.join(tmpDir, 'wordbook.sqlite');
const before = new Database(tmpPath, { readonly: true }).prepare('SELECT count(*) c FROM wordbook').get().c;

const added = addWordToWordBook(
  { word: 'interop-test-word', sourceLanguage: 'en', targetLanguage: 'zh-CN', explanation: '互通测试' },
  tmpPath,
);
const after = new Database(tmpPath, { readonly: true }).prepare('SELECT count(*) c FROM wordbook').get().c;
console.log('add inserted:', added, '| rows before/after:', before, '->', after);

const dup = addWordToWordBook(
  { word: 'interop-test-word', sourceLanguage: 'en', targetLanguage: 'zh-CN', explanation: '互通测试2' },
  tmpPath,
);
console.log('duplicate insert (should be false):', dup);

removeWordFromWordBook('interop-test-word', 'en', 'zh-CN', tmpPath);
const afterRemove = new Database(tmpPath, { readonly: true }).prepare('SELECT count(*) c FROM wordbook').get().c;
console.log('after remove rows:', afterRemove);

try {
  rmSync(tmpDir, { recursive: true, force: true });
} catch {
  // temp file may still be held open by the module singleton; ignore
}
console.log('resolveWordBookPath() =>', resolveWordBookPath());
console.log('OK');
