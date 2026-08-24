/**
 * Translation orchestration: caching, history recording, error handling.
 */

import { Config } from './config.js';
import { getActiveEngine, getEngine, getActiveEngineId } from './translator/registry.js';
import { HistoryEntry, Store } from './store.js';
import { Translation, TranslationError } from './types.js';
import { getDiskCache, putDiskCache } from './cacheService.js';

const memoryCache = new Map<string, Translation>();

function cacheKey(engineId: string, text: string, src: string, tgt: string): string {
  return [engineId, src, tgt, text].join('');
}

/**
 * Translates [text] using the active engine (or the requested one), with caching.
 */
export async function translate(
  text: string,
  srcLang: string,
  targetLang: string,
  engineId?: string,
): Promise<Translation> {
  const id = engineId ?? getActiveEngineId();
  const engine = getEngine(id) ?? getActiveEngine();
  const key = cacheKey(engine.id, text, srcLang, targetLang);

  const memHit = memoryCache.get(key);
  if (memHit) {
    return memHit;
  }

  const diskHit = getDiskCache(text, srcLang, targetLang, engine.id);
  if (diskHit) {
    memoryCache.set(key, diskHit);
    return diskHit;
  }

  let result: Translation;
  try {
    result = await engine.translate(text, srcLang, targetLang);
  } catch (error) {
    if (error instanceof TranslationError) {
      throw error;
    }
    throw new TranslationError(
      error instanceof Error ? error.message : String(error),
      engine.id,
      engine.name,
    );
  }

  memoryCache.set(key, result);
  if (memoryCache.size > 2000) {
    memoryCache.clear();
  }
  putDiskCache(text, srcLang, targetLang, engine.id, result);

  const config = Config.get();
  const entry: HistoryEntry = {
    original: result.original,
    translation: result.translation ?? '',
    srcLang: result.srcLang,
    targetLang: result.targetLang,
    engine: engine.id,
    timestamp: Date.now(),
  };
  await Store.get().addHistory(entry, config.historyMaxEntries);

  return result;
}

/** Clears the in-memory translation cache. */
export function clearCache(): void {
  memoryCache.clear();
}

/** Renders an error into a user-facing message. */
export function errorMessage(error: unknown): string {
  if (error instanceof TranslationError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
