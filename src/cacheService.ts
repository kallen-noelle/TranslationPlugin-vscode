/**
 * Disk cache for translation results — mirrors the original IntelliJ plugin's
 * CacheService. Stores translation JSON in individual files under the caches/
 * directory, keyed by a hash of (text + srcLang + targetLang + engine).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { Translation } from './types.js';

const MAX_DISK_CACHE_SIZE = 1024;
const TRIM_INTERVAL_MS = 5 * 24 * 60 * 60 * 1000;
const STORAGE_FILE_NAME = 'wordbook.sqlite';

function defaultDataDir(): string {
  const envVar = process.platform === 'win32' ? 'LOCALAPPDATA' : 'XDG_DATA_HOME';
  const envVal = process.env[envVar];
  if (envVal) {
    return path.join(envVal, 'Yii.Guxing', 'TranslationPlugin');
  }
  return path.join(os.homedir(), '.TranslationPlugin');
}

function cacheDir(): string {
  return path.join(defaultDataDir(), 'caches');
}

function cacheKey(text: string, srcLang: string, targetLang: string, engine: string): string {
  const raw = `${text}\0${srcLang}\0${targetLang}\0${engine}`;
  return crypto.createHash('sha1').update(raw).digest('hex');
}

function cacheFilePath(key: string): string {
  return path.join(cacheDir(), key);
}

function ensureCacheDir(): void {
  const dir = cacheDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let lastTrimAt = 0;

function trimDiskCachesIfNeed(): void {
  const now = Date.now();
  if (now - lastTrimAt < TRIM_INTERVAL_MS) {
    return;
  }
  lastTrimAt = now;

  try {
    const dir = cacheDir();
    if (!fs.existsSync(dir)) {
      return;
    }
    const files = fs.readdirSync(dir).filter((f) => !f.endsWith('.tmp'));
    if (files.length <= MAX_DISK_CACHE_SIZE) {
      return;
    }

    const sorted = files
      .map((name) => {
        const fp = path.join(dir, name);
        try {
          const stat = fs.statSync(fp);
          return { name, atime: stat.atimeMs };
        } catch {
          return { name, atime: 0 };
        }
      })
      .sort((a, b) => a.atime - b.atime);

    const toDelete = sorted.slice(0, sorted.length - MAX_DISK_CACHE_SIZE);
    for (const f of toDelete) {
      try {
        fs.unlinkSync(path.join(dir, f.name));
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

/** Gets a cached translation from disk. Returns null on miss. */
export function getDiskCache(text: string, srcLang: string, targetLang: string, engine: string): Translation | null {
  try {
    const key = cacheKey(text, srcLang, targetLang, engine);
    const fp = cacheFilePath(key);
    if (!fs.existsSync(fp)) {
      return null;
    }
    const data = fs.readFileSync(fp, 'utf-8');
    const parsed = JSON.parse(data) as Translation;
    // Update access time
    try {
      const now = new Date();
      fs.utimesSync(fp, now, now);
    } catch {
      // ignore
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Stores a translation result to disk cache. */
export function putDiskCache(text: string, srcLang: string, targetLang: string, engine: string, translation: Translation): void {
  try {
    ensureCacheDir();
    const key = cacheKey(text, srcLang, targetLang, engine);
    const fp = cacheFilePath(key);
    fs.writeFileSync(fp, JSON.stringify(translation), 'utf-8');
    trimDiskCachesIfNeed();
  } catch {
    // ignore
  }
}

/** Calculates total disk cache size in bytes. */
export function getDiskCacheSize(): number {
  try {
    const dir = cacheDir();
    if (!fs.existsSync(dir)) {
      return 0;
    }
    const files = fs.readdirSync(dir).filter((f) => !f.endsWith('.tmp'));
    let total = 0;
    for (const f of files) {
      try {
        const stat = fs.statSync(path.join(dir, f));
        total += stat.size;
      } catch {
        // ignore
      }
    }
    return total;
  } catch {
    return 0;
  }
}

/** Clears all disk cache files. */
export function evictAllDiskCaches(): void {
  try {
    const dir = cacheDir();
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch {
    // ignore
  }
}

/** Formats bytes into human-readable string (e.g. "1.2KB", "3.4MB"). */
export function formatByteSize(bytes: number): string {
  if (bytes === 0) {
    return '0KB';
  }
  const kb = bytes / 1024;
  if (kb >= 1024) {
    return `${(kb / 1024).toFixed(1)}MB`;
  }
  if (kb >= 1) {
    return `${kb.toFixed(1)}KB`;
  }
  return `${bytes}B`;
}
