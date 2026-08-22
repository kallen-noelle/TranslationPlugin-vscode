/**
 * Microsoft Translator — uses the free Bing Translate web endpoint
 * (the same service behind bing.com/translator). No API key required.
 */

import { TranslationError, Translator } from '../types.js';
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

async function callTranslate(
  text: string,
  fromLang: string,
  toLang: string,
): Promise<{ translation: string; detectedLang?: string }> {
  const config = await getConfig();

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
    translations?: { text: string; to?: string }[];
  }[];

  const item = json[0];
  const translation = item?.translations?.[0]?.text;
  if (translation === undefined) {
    throw new TranslationError('Microsoft 翻译返回为空', 'microsoft', 'Microsoft Translator');
  }

  return {
    translation,
    detectedLang: item?.detectedLanguage?.language,
  };
}

export const MicrosoftTranslator: Translator = {
  id: 'microsoft',
  name: 'Microsoft Translator',
  supportsAuto: true,
  supportedSourceLanguages: ['auto'],
  supportedTargetLanguages: ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'pt-BR', 'ru', 'it', 'nl', 'pl', 'tr', 'vi', 'th', 'id', 'ar', 'hi', 'he', 'sv', 'da', 'no', 'fi', 'cs', 'hu', 'ro', 'bg', 'uk', 'el', 'sk', 'hr', 'sl', 'lt', 'lv', 'et', 'fa', 'ur', 'bn', 'ta', 'te', 'ca', 'fil', 'sw', 'cy', 'af', 'sq', 'am', 'az', 'eu', 'be', 'bs', 'eo', 'ga', 'gl', 'ka', 'kk', 'km', 'lo', 'mk', 'mn', 'my', 'ne', 'pa', 'si', 'sr', 'so', 'uz', 'zu'],

  async translate(text, srcLang, targetLang) {
    const from = toMicrosoftCode(srcLang);
    const to = toMicrosoftCode(targetLang);
    const { translation, detectedLang } = await callTranslate(text, from, to);

    return {
      original: text,
      translation: translation || text,
      srcLang: detectedLang ? fromMicrosoftCode(detectedLang) : srcLang,
      targetLang,
      sourceLanguages: detectedLang ? [fromMicrosoftCode(detectedLang)] : [srcLang],
    };
  },
};
