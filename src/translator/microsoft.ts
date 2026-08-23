/**
 * Microsoft Translator — uses the free Bing Translate web endpoint
 * (the same service behind bing.com/translator). No API key required.
 */

import { DictItem, Translation, TranslationError, Translator } from '../types.js';
import { fromMicrosoftCode, toMicrosoftCode } from '../languages.js';

const TRANSLATOR_PAGE = 'https://www.bing.com/translator';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/151.0.4129.59';

interface BingConfig {
  ig: string;
  iid: string;
  key: number;
  token: string;
  subdomain: string;
}

let cachedConfig: BingConfig | undefined;
let configFetchedAt = 0;
let configPromise: Promise<BingConfig> | undefined;
const TOKEN_EXPIRY_MS = 30 * 60 * 1000; // re-fetch conservatively before Bing's 1h expiry

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
  const ig = /IG:"([^"]+)"/.exec(body)?.[1];
  const iid = /data-iid="([^"]+)"/.exec(body)?.[1];
  const abuse = /params_AbusePreventionHelper\s?=\s?([^\]]+\])/.exec(body)?.[1];

  if (!ig || !iid || !abuse) {
    throw new TranslationError('Microsoft 认证失败: 无法获取页面令牌', 'microsoft', 'Microsoft Translator');
  }
  const [key, token] = JSON.parse(abuse) as [number, string];
  return { ig, iid, key, token, subdomain };
}

async function getConfig(): Promise<BingConfig> {
  if (cachedConfig && Date.now() - configFetchedAt < TOKEN_EXPIRY_MS) {
    return cachedConfig;
  }
  if (!configPromise) {
    configPromise = fetchConfig()
      .then((config) => {
        cachedConfig = config;
        configFetchedAt = Date.now();
        return config;
      })
      .finally(() => {
        configPromise = undefined;
      });
  }
  return configPromise;
}

// ---------------------------------------------------------------------------
// Translation (ttranslatev3)
// ---------------------------------------------------------------------------

interface TranslationResult {
  translation: string;
  detectedLang?: string;
  transliteration?: string;
}

async function callTranslate(
  text: string,
  fromLang: string,
  toLang: string,
  config: BingConfig,
): Promise<TranslationResult> {
  const url =
    `https://${config.subdomain}.bing.com/ttranslatev3?isVertical=1&IG=${config.ig}&IID=${config.iid}`;
  const form = new URLSearchParams({
    fromLang,
    to: toLang,
    text,
    token: config.token,
    key: String(config.key),
    tryFetchingGenderDebiasedTranslations: 'true',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'user-agent': UA,
        referer: `https://${config.subdomain}.bing.com/translator`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TranslationError('Microsoft 翻译请求超时', 'microsoft', 'Microsoft Translator');
    }
    throw new TranslationError(
      `Microsoft 翻译请求失败: ${error instanceof Error ? error.message : String(error)}`,
      'microsoft',
      'Microsoft Translator',
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new TranslationError(`Microsoft 翻译请求失败: HTTP ${res.status}`, 'microsoft', 'Microsoft Translator');
  }

  const json = (await res.json()) as {
    detectedLanguage?: { language: string };
    translations?: { text: string; to?: string; transliteration?: { text: string } }[];
  }[];

  const item = json[0];
  const translation = item?.translations?.[0]?.text;
  if (translation === undefined) {
    throw new TranslationError('Microsoft 翻译返回为空', 'microsoft', 'Microsoft Translator');
  }

  return {
    translation,
    detectedLang: item?.detectedLanguage?.language,
    transliteration: item?.translations?.[0]?.transliteration?.text,
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

/**
 * Calls the Bing dictionary lookup endpoint.
 * Returns dictionary entries grouped by part of speech, or undefined for
 * sentences / phrases where no dictionary data is available.
 */
async function callLookup(
  text: string,
  fromLang: string,
  toLang: string,
  config: BingConfig,
): Promise<DictItem[] | undefined> {
  // Skip dictionary lookup for long text (sentences) to avoid wasted requests.
  if (text.length > 80 || /\s/.test(text.trim())) {
    return undefined;
  }

  const url =
    `https://${config.subdomain}.bing.com/tlookupv3?isVertical=1&IG=${config.ig}&IID=${config.iid}`;
  const form = new URLSearchParams({
    from: fromLang,
    to: toLang,
    text,
    token: config.token,
    key: String(config.key),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'user-agent': UA,
        referer: `https://${config.subdomain}.bing.com/translator`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
      signal: controller.signal,
    });
    if (!res.ok) {
      return undefined;
    }
    const data = (await res.json()) as LookupResult[];
    const item = data[0];
    if (!item || !item.translations || item.translations.length === 0) {
      return undefined;
    }

    // Group translations by part of speech, matching the DictItem format.
    const posMap = new Map<string, { translation: string; backTranslations: string[] }[]>();
    for (const t of item.translations) {
      const pos = posTagToLabel(t.posTag);
      if (!pos) {
        continue;
      }
      const backTranslations = (t.backTranslations ?? [])
        .map((b) => b.displayText)
        .filter((s) => s && s.length > 0);
      if (!posMap.has(pos)) {
        posMap.set(pos, []);
      }
      posMap.get(pos)!.push({ translation: t.displayTarget, backTranslations });
    }

    if (posMap.size === 0) {
      return undefined;
    }

    const dict: DictItem[] = [];
    for (const [pos, entries] of posMap) {
      dict.push({ pos, entries });
    }
    return dict;
  } catch {
    // Dictionary lookup failure should not break the translation.
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/** Maps Bing's posTag (e.g. "NOUN", "VERB") to a human-readable label. */
function posTagToLabel(posTag: string): string | undefined {
  switch (posTag) {
    case 'NOUN': return '名词';
    case 'VERB': return '动词';
    case 'ADJ': return '形容词';
    case 'ADV': return '副词';
    case 'PRON': return '代词';
    case 'PREP': return '介词';
    case 'CONJ': return '连词';
    case 'INTJ': return '感叹词';
    case 'DET': return '限定词';
    case 'NUM': return '数词';
    case 'ADP': return '介词';
    case 'AUX': return '助动词';
    case 'SCONJ': return '连词';
    case 'PART': return '助词';
    case 'PROPN': return '专有名词';
    default: return posTag ? posTag.toLowerCase() : undefined;
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
    const config = await getConfig();
    const from = toMicrosoftCode(srcLang);
    const to = toMicrosoftCode(targetLang);

    // The dictionary lookup endpoint requires an explicit source language
    // (it does not support "auto" detection). So when the source language is
    // auto, we run translation first to get the detected language, then use
    // that for the dictionary lookup. Otherwise, both run in parallel.
    let transResult: TranslationResult;
    let dict: DictItem[] | undefined;

    if (from === 'auto-detect' || !from) {
      transResult = await callTranslate(text, from, to, config);
      const detected = transResult.detectedLang;
      if (detected) {
        dict = await callLookup(text, detected, to, config);
      }
    } else {
      [transResult, dict] = await Promise.all([
        callTranslate(text, from, to, config),
        callLookup(text, from, to, config),
      ]);
    }

    const detectedLang = transResult.detectedLang;

    return {
      original: text,
      translation: transResult.translation || text,
      srcLang: detectedLang ? fromMicrosoftCode(detectedLang) : srcLang,
      targetLang,
      sourceLanguages: detectedLang ? [fromMicrosoftCode(detectedLang)] : [srcLang],
      transliteration: transResult.transliteration ?? undefined,
      dict: dict ?? undefined,
    };
  },
};
