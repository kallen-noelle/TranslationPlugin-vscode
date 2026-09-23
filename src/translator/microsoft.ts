/**
 * Microsoft Translator — uses the free Bing Translate web endpoints
 * (the same service behind bing.com/translator). No API key required.
 *
 * Aligned with the IntelliJ plugin's BingTranslator:
 *   - ttranslatev3   text translation (split into ≤1000-char chunks, concurrent)
 *   - tspellcheckv3  spell correction
 *   - tlookupv3      dictionary lookup (requires translatedtext)
 *   - texamplev3     bilingual example sentences
 */

import { DictItem, ExampleItem, Translation, TranslationError, Translator } from '../types.js';
import { describeError, log } from '../feedback.js';
import { fromMicrosoftCode, toMicrosoftCode } from '../languages.js';

const BING_ORIGIN = 'https://www.bing.com';
const TRANSLATOR_PAGE = `${BING_ORIGIN}/translator`;
const TRANSLATE_API = `${BING_ORIGIN}/ttranslatev3`;
const SPELLCHECK_API = `${BING_ORIGIN}/tspellcheckv3`;
const DICTIONARY_API = `${BING_ORIGIN}/tlookupv3`;
const EXAMPLE_API = `${BING_ORIGIN}/texamplev3`;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/151.0.4129.59';

/** Maximum characters translated in a single request. */
const MAX_CHARS_PER_REQUEST = 1000;
/** Maximum length of text that can be looked up in the dictionary / examples. */
const MAX_DICT_INPUT_TEXT_LENGTH = 50;
/** Maximum length of text that can be sent to the spell checker. */
const MAX_SPELLCHECK_INPUT_TEXT_LENGTH = 50;
/** Safety margin subtracted from the server-provided TTL before caching. */
const EXPIRY_SAFETY_MARGIN_MS = 60 * 1000;

const WHITESPACE_REGEX = /[ \u3000\n\r\t\s]+/g;
const ABUSE_PREVENTION_REGEX =
  /params_AbusePreventionHelper\s*=\s*\[\s*(\d+)\s*,\s*"([^"]+)"\s*,\s*(\d+)\s*\]/;
const IG_REGEX = /IG\s*:\s*"([A-Fa-f0-9]+)"/;
const IID_REGEX = /data-iid\s*=\s*"([^"]+)"/;

interface BingConfig {
  ig: string;
  iid: string;
  key: string;
  token: string;
  subdomain: string;
  /** Absolute timestamp (ms) after which the token should be refreshed. */
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Authentication (IG / IID / AbusePreventionHelper token)
// ---------------------------------------------------------------------------

let cachedConfig: BingConfig | undefined;
let configPromise: Promise<BingConfig> | undefined;

/**
 * Fetches the Bing Translator page and parses the abuse-prevention token,
 * IG and IID. The token TTL is respected (minus a safety margin).
 */
async function fetchConfig(): Promise<BingConfig> {
  const res = await fetch(TRANSLATOR_PAGE, {
    headers: { 'user-agent': UA },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new TranslationError(`Microsoft 认证失败: HTTP ${res.status}`, 'microsoft', 'Microsoft Translator');
  }
  const body = await res.text();
  const subdomain = /^https?:\/\/(\w+)\.bing\.com/.exec(res.url)?.[1] ?? 'www';
  const ig = IG_REGEX.exec(body)?.[1];
  const iid = IID_REGEX.exec(body)?.[1];
  const abuse = ABUSE_PREVENTION_REGEX.exec(body);

  if (!ig || !iid || !abuse) {
    throw new TranslationError('Microsoft 认证失败: 无法获取页面令牌', 'microsoft', 'Microsoft Translator');
  }
  const [, key, token, ttlMs] = abuse;
  const ttl = Math.max(Number(ttlMs) - EXPIRY_SAFETY_MARGIN_MS, 0);
  return { ig, iid, key, token, subdomain, expiresAt: Date.now() + ttl };
}

function invalidateConfig(): void {
  cachedConfig = undefined;
}

async function getConfig(): Promise<BingConfig> {
  if (cachedConfig && Date.now() < cachedConfig.expiresAt) {
    return cachedConfig;
  }
  if (!configPromise) {
    configPromise = fetchConfig()
      .then((config) => {
        cachedConfig = config;
        return config;
      })
      .finally(() => {
        configPromise = undefined;
      });
  }
  return configPromise;
}

/** Builds a request URL with the required `isVertical`, `IG` and `IID` params. */
function requestUrl(baseUrl: string, config: BingConfig): string {
  const url = new URL(baseUrl);
  url.hostname = `${config.subdomain}.bing.com`;
  return `${url.toString()}?isVertical=1&IG=${encodeURIComponent(config.ig)}&IID=${encodeURIComponent(config.iid)}`;
}

/** Builds a URL-encoded form body merging `token` and `key` with the params. */
function requestForm(config: BingConfig, params: Record<string, string>): string {
  return new URLSearchParams({
    ...params,
    token: config.token,
    key: config.key,
  }).toString();
}

/** POSTs a form and parses the JSON response, throwing a translation error on failure. */
async function postFormJson<T>(url: string, body: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'user-agent': UA,
        referer: TRANSLATOR_PAGE,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TranslationError('Microsoft 翻译请求超时', 'microsoft', 'Microsoft Translator');
    }
    throw new TranslationError(
      `Microsoft 翻译请求失败: ${describeError(error)}`,
      'microsoft',
      'Microsoft Translator',
    );
  } finally {
    clearTimeout(timer);
  }

  const raw = await res.text();
  if (!res.ok) {
    throw new TranslationError(`Microsoft 翻译请求失败: HTTP ${res.status}`, 'microsoft', 'Microsoft Translator');
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new TranslationError('Microsoft 翻译返回为空(响应解析失败)', 'microsoft', 'Microsoft Translator');
  }
}

// ---------------------------------------------------------------------------
// Translation (ttranslatev3) — chunked
// ---------------------------------------------------------------------------

interface TranslateResponseItem {
  detectedLanguage?: { language: string };
  translations?: { text: string; to?: string; transliteration?: { text: string } }[];
}

interface TranslationChunk {
  text: string;
  detectedLang?: string;
  transliteration?: string;
}

async function callTranslateChunk(
  text: string,
  fromLang: string,
  toLang: string,
  config: BingConfig,
): Promise<TranslationChunk> {
  const url = requestUrl(TRANSLATE_API, config);
  const body = requestForm(config, { text, fromLang, to: toLang });
  const json = await postFormJson<TranslateResponseItem[]>(url, body, 20000);

  const item = json?.[0];
  const translation = item?.translations?.[0]?.text;
  if (translation === undefined) {
    log('[microsoft] Translation field is undefined. Response:', JSON.stringify(json).slice(0, 500));
    const errorObj = json as unknown as { statusCode?: number; message?: string };
    if (errorObj.statusCode || errorObj.message) {
      throw new TranslationError(
        `Microsoft 翻译失败: ${errorObj.statusCode ?? ''} ${errorObj.message ?? ''}`.trim(),
        'microsoft',
        'Microsoft Translator',
      );
    }
    throw new TranslationError('Microsoft 翻译返回为空(令牌可能已过期)', 'microsoft', 'Microsoft Translator');
  }

  return {
    text: translation,
    detectedLang: item?.detectedLanguage?.language,
    transliteration: item?.translations?.[0]?.transliteration?.text,
  };
}

/**
 * Splits text into chunks fitting `maxLen`, preferring sentence boundaries and
 * collapsing whitespace runs to single spaces (so boundaries can be recovered).
 */
function splitText(text: string, maxLen: number): string[] {
  const optimized = text.replace(WHITESPACE_REGEX, ' ').trim();
  if (!optimized) return [];
  if (optimized.length <= maxLen) return [optimized];

  const units = (optimized.match(/[^.!?。！？]+[.!?。！？]*/g) ?? [optimized])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const chunks: string[] = [];
  let current = '';
  for (const unit of units) {
    if (unit.length > maxLen) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      let rest = unit;
      while (rest.length > maxLen) {
        chunks.push(rest.slice(0, maxLen));
        rest = rest.slice(maxLen);
      }
      if (rest) current = rest;
    } else if (current && current.length + 1 + unit.length > maxLen) {
      chunks.push(current);
      current = unit;
    } else {
      current = current ? `${current} ${unit}` : unit;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Determines whether each adjacent chunk pair was separated by whitespace. */
function computeBoundarySpaces(text: string, chunks: string[]): boolean[] {
  if (chunks.length < 2) return [];
  const optimized = text.replace(WHITESPACE_REGEX, ' ');
  const spaces = new Array<boolean>(chunks.length - 1).fill(false);
  let start = 0;
  for (let i = 1; i < chunks.length; i++) {
    const idx = optimized.indexOf(chunks[i], start);
    if (idx < 0) continue;
    spaces[i - 1] = idx > 0 && optimized[idx - 1] === ' ';
    start = idx + chunks[i].length;
  }
  return spaces;
}

interface TranslateTextResult {
  translation: string;
  detectedLang?: string;
  transliteration?: string;
}

/** Translates `text`, chunking it and merging the concurrent results. */
async function translateText(
  text: string,
  fromLang: string,
  toLang: string,
  config: BingConfig,
): Promise<TranslateTextResult> {
  if (!text.trim()) {
    return { translation: '' };
  }

  // Short text: a single request, no chunking (preserves exact input).
  if (text.length <= MAX_CHARS_PER_REQUEST) {
    const chunk = await callTranslateChunk(text, fromLang, toLang, config);
    return {
      translation: chunk.text,
      detectedLang: chunk.detectedLang,
      transliteration: chunk.transliteration,
    };
  }

  const chunks = splitText(text, MAX_CHARS_PER_REQUEST);
  const results = await Promise.all(chunks.map((c) => callTranslateChunk(c, fromLang, toLang, config)));

  const boundarySpaces = computeBoundarySpaces(text, chunks);
  let merged = '';
  results.forEach((r, i) => {
    if (i > 0 && boundarySpaces[i - 1]) merged += ' ';
    merged += r.text;
  });

  return {
    translation: merged,
    detectedLang: results.find((r) => r.detectedLang)?.detectedLang,
    transliteration: results.find((r) => r.transliteration)?.transliteration,
  };
}

// ---------------------------------------------------------------------------
// Dictionary lookup (tlookupv3)
// ---------------------------------------------------------------------------

interface LookupTranslation {
  displayTarget: string;
  posTag: string;
  confidence: number;
  backTranslations?: { displayText: string }[];
}

interface LookupResult {
  normalizedSource: string;
  translations: LookupTranslation[];
}

async function callLookup(
  text: string,
  translatedText: string,
  fromLang: string,
  toLang: string,
  config: BingConfig,
): Promise<DictItem[] | undefined> {
  if (text.length > MAX_DICT_INPUT_TEXT_LENGTH || !text.trim()) return undefined;

  const url = requestUrl(DICTIONARY_API, config);
  const body = requestForm(config, { from: fromLang, to: toLang, text, translatedtext: translatedText });

  try {
    const data = await postFormJson<LookupResult[]>(url, body, 15000);
    const item = data?.[0];
    if (!item || !item.translations || item.translations.length === 0) return undefined;

    const posMap = new Map<string, { translation: string; backTranslations: string[] }[]>();
    for (const t of item.translations) {
      const pos = posTagToLabel(t.posTag);
      if (!pos) continue;
      const backTranslations = (t.backTranslations ?? [])
        .map((b) => b.displayText)
        .filter((s) => s && s.length > 0);
      if (!posMap.has(pos)) posMap.set(pos, []);
      posMap.get(pos)!.push({ translation: t.displayTarget, backTranslations });
    }
    if (posMap.size === 0) return undefined;
    return [...posMap.entries()].map(([pos, entries]) => ({ pos, entries }));
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Example sentences (texamplev3)
// ---------------------------------------------------------------------------

async function callExamples(
  text: string,
  translation: string,
  fromLang: string,
  toLang: string,
  config: BingConfig,
): Promise<ExampleItem[] | undefined> {
  if (text.length > MAX_DICT_INPUT_TEXT_LENGTH || !text.trim()) return undefined;

  const url = requestUrl(EXAMPLE_API, config);
  const body = requestForm(config, { from: fromLang, to: toLang, text, translation });

  try {
    const data = await postFormJson<{ examples?: ExampleItem[] }[]>(url, body, 15000);
    // Only the first example of each result group is shown (matches IntelliJ).
    const items = (data ?? [])
      .map((d) => d.examples?.[0])
      .filter((e): e is ExampleItem => !!e);
    return items.length > 0 ? items : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Spell check (tspellcheckv3)
// ---------------------------------------------------------------------------

async function callSpellcheck(
  text: string,
  fromLang: string,
  config: BingConfig,
): Promise<string | undefined> {
  if (text.length > MAX_SPELLCHECK_INPUT_TEXT_LENGTH) return undefined;

  const url = requestUrl(SPELLCHECK_API, config);
  const body = requestForm(config, { text, fromLang });

  try {
    const data = await postFormJson<unknown>(url, body, 15000);
    const obj = Array.isArray(data)
      ? (data[0] as { correctedText?: string })
      : (data as { correctedText?: string });
    const corrected = typeof obj?.correctedText === 'string' ? obj.correctedText.trim() : '';
    return corrected || undefined;
  } catch {
    return undefined;
  }
}

/** Maps Bing's posTag to a human-readable Chinese label. */
function posTagToLabel(posTag: string): string | undefined {
  switch (posTag) {
    case 'ADJ': return '形容词';
    case 'ADV': return '副词';
    case 'CONJ': return '连词';
    case 'DET': return '限定词';
    case 'MODAL': return '动词';
    case 'NOUN': return '名词';
    case 'PREP': return '介词';
    case 'PRON': return '代词';
    case 'VERB': return '动词';
    case 'OTHER': return '其他';
    default: return undefined;
  }
}

// ---------------------------------------------------------------------------
// Translator implementation
// ---------------------------------------------------------------------------

export const MicrosoftTranslator: Translator = {
  id: 'microsoft',
  name: 'Microsoft Translator',
  supportsAuto: true,
  supportedSourceLanguages: ['auto'],
  supportedTargetLanguages: ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'pt-BR', 'ru', 'it', 'nl', 'pl', 'tr', 'vi', 'th', 'id', 'ar', 'hi', 'he', 'sv', 'da', 'no', 'fi', 'cs', 'hu', 'ro', 'bg', 'uk', 'el', 'sk', 'hr', 'sl', 'lt', 'lv', 'et', 'fa', 'ur', 'bn', 'ta', 'te', 'ca', 'fil', 'sw', 'cy', 'af', 'sq', 'am', 'az', 'eu', 'be', 'bs', 'eo', 'ga', 'gl', 'ka', 'kk', 'km', 'lo', 'mk', 'mn', 'my', 'ne', 'pa', 'si', 'sr', 'so', 'uz', 'zu'],

  async translate(text, srcLang, targetLang) {
    const to = toMicrosoftCode(targetLang);
    const from = toMicrosoftCode(srcLang);

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        invalidateConfig();
        await new Promise((r) => setTimeout(r, 200 * attempt));
        log(`[microsoft] retry #${attempt + 1} with fresh token...`);
      }

      try {
        const config = await getConfig();
        const transResult = await translateText(text, from, to, config);

        const detected = transResult.detectedLang;
        const resolvedSrcLang = detected ? fromMicrosoftCode(detected) : srcLang;
        // Dictionary / examples / spellcheck need an explicit (non-auto) source language.
        const explicitFrom = resolvedSrcLang === 'auto' ? null : toMicrosoftCode(resolvedSrcLang);
        const translatedText = transResult.translation;

        // Query spellcheck, dictionary and examples in parallel; failures are ignored.
        const [spell, dict, examples] = await Promise.all([
          explicitFrom ? callSpellcheck(text, explicitFrom, config) : Promise.resolve(undefined),
          explicitFrom && translatedText
            ? callLookup(text, translatedText, explicitFrom, to, config)
            : Promise.resolve(undefined),
          explicitFrom && translatedText
            ? callExamples(text, translatedText, explicitFrom, to, config)
            : Promise.resolve(undefined),
        ]);

        return {
          original: text,
          translation: transResult.translation || text,
          srcLang: resolvedSrcLang,
          targetLang,
          sourceLanguages: [resolvedSrcLang],
          transliteration: transResult.transliteration ?? undefined,
          dict: dict ?? undefined,
          examples: examples ?? undefined,
          spelling: spell ?? undefined,
        };
      } catch (error) {
        lastError = error;
        const msg = error instanceof Error ? error.message : String(error);
        const isAuthFailure = /返回为空|认证失败|HTTP 40[13]|HTTP 429/i.test(msg);
        // Only auth/token errors are retried; everything else is thrown immediately.
        if (!isAuthFailure || !(error instanceof TranslationError)) {
          throw error;
        }
        if (attempt === 2) {
          log(`[microsoft] still failing after 3 attempts: ${msg}`);
        } else {
          log(`[microsoft] auth failure (${msg}), will invalidate & retry`);
        }
      }
    }
    throw lastError;
  },
};