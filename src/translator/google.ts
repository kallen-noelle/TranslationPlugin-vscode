/**
 * Google Translator — free web API (uses the same `tk` token as translate.google.com).
 */

import { DictItem, Translation, TranslationError, Translator } from '../types.js';
import { get, postForm, HttpError } from '../http.js';

const TRANSLATE_API = 'https://translate.google.com/translate_a/single';
const ELEMENT_JS = 'https://translate.google.com/translate_a/element.js';
const PRIMARY_LANG = 'en';
const HOUR_MS = 60 * 60 * 1000;

interface GSentence {
  orig?: string;
  trans?: string;
  src_translit?: string;
  translit?: string;
}

interface GDictEntry {
  word?: string;
  reverse_translation?: string[];
}

interface GDict {
  pos?: string;
  entry?: GDictEntry[];
}

interface GResponse {
  sentences?: GSentence[];
  src?: string;
  dict?: GDict[];
  spell?: { spell_res?: string };
}

// ---------------------------------------------------------------------------
// tk token algorithm (ported from the canonical translate.google.com JS).
// ---------------------------------------------------------------------------

function rl(a: number, b: string): number {
  for (let c = 0; c < b.length - 2; c += 3) {
    const d = b.charAt(c + 2);
    const e = 'a' <= d ? d.charCodeAt(0) - 87 : Number(d);
    const f = '+' === b.charAt(c + 1) ? a >>> e : a << e;
    a = '+' === b.charAt(c) ? (a + f) & 0xffffffff : a ^ f;
  }
  return a;
}

function computeTk(a: string, tkk: [number, number]): string {
  const bytes: number[] = [];
  for (let f = 0; f < a.length; f++) {
    let g = a.charCodeAt(f);
    if (128 > g) {
      bytes.push(g);
    } else {
      if (2048 > g) {
        bytes.push((g >> 6) | 192);
      } else {
        if (55296 == (g & 64512) && f + 1 < a.length && 56320 == (a.charCodeAt(f + 1) & 64512)) {
          g = 65536 + ((g & 1023) << 10) + (a.charCodeAt(++f) & 1023);
          bytes.push((g >> 18) | 240);
          bytes.push(((g >> 12) & 63) | 128);
        } else {
          bytes.push((g >> 12) | 224);
        }
        bytes.push(((g >> 6) & 63) | 128);
      }
      bytes.push((g & 63) | 128);
    }
  }

  const [h, i] = tkk;
  let l = h;
  for (let k = 0; k < bytes.length; k++) {
    l += bytes[k];
    l = rl(l, '+-a^+6');
  }
  l = rl(l, '+-3^+b+-f');
  l ^= i;
  if (0 > l) {
    l = (l & 2147483647) + 2147483648;
  }
  l %= 1e6;
  return l.toString() + '.' + (l ^ h);
}

// ---------------------------------------------------------------------------
// TKK value management (fetched from element.js, cached for one hour).
// ---------------------------------------------------------------------------

const TKK_REGEX = /tkk='(\d+).(-?\d+)'/;

let cachedTkk: [number, number] | undefined;
let tkkFetchedAt = 0;
let tkkPromise: Promise<[number, number]> | undefined;

async function fetchTkk(): Promise<[number, number]> {
  const elementJs = await get(ELEMENT_JS, { timeout: 5000 });
  const match = TKK_REGEX.exec(elementJs);
  if (!match) {
    throw new Error('TKK not found.');
  }
  return [Number(match[1]), Number(match[2])];
}

async function getTkk(): Promise<[number, number]> {
  const now = Date.now();
  if (cachedTkk && now - tkkFetchedAt < HOUR_MS) {
    return cachedTkk;
  }

  if (!tkkPromise) {
    tkkPromise = fetchTkk()
      .then((tkk) => {
        cachedTkk = tkk;
        tkkFetchedAt = Date.now();
        return tkk;
      })
      .catch(() => {
        // Fall back to a locally generated TKK (valid for plain translation).
        const hour = Math.floor(Date.now() / HOUR_MS);
        return [hour, Math.abs(Math.floor(Math.random() * 1e9))] as [number, number];
      })
      .finally(() => {
        tkkPromise = undefined;
      });
  }
  return tkkPromise;
}

function parseResponse(data: GResponse, original: string, target: string): Translation {
  const sentences = data.sentences ?? [];
  const translation = sentences
    .filter((s): s is GSentence & { trans: string } => typeof s.trans === 'string')
    .map((s) => s.trans)
    .join('')
    .replace(/​+/g, '');

  const translit = sentences.find((s) => 'src_translit' in s || 'translit' in s);
  const srcLang = data.src ?? 'auto';

  const dict: DictItem[] = (data.dict ?? []).map((d) => ({
    pos: d.pos,
    entries: (d.entry ?? []).map((e) => ({
      translation: e.word ?? '',
      backTranslations: e.reverse_translation ?? [],
    })),
  }));

  return {
    original,
    translation: translation || original,
    srcLang,
    targetLang: target,
    sourceLanguages: [srcLang],
    srcTransliteration: translit?.src_translit,
    transliteration: translit?.translit,
    dict,
  };
}

export const GoogleTranslator: Translator = {
  id: 'google',
  name: 'Google Translate',
  supportsAuto: true,
  supportedSourceLanguages: ['auto'],
  supportedTargetLanguages: ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'ru', 'it', 'nl', 'pl', 'tr', 'vi', 'th', 'id', 'ar', 'hi', 'he', 'sv', 'da', 'no', 'fi', 'cs', 'hu', 'ro', 'bg', 'uk', 'el', 'sk', 'hr', 'sl', 'lt', 'lv', 'et', 'fa', 'ur', 'bn', 'ta', 'te', 'ca', 'fil', 'sw', 'cy', 'af', 'sq', 'am', 'az', 'eu', 'be', 'bs', 'eo', 'ga', 'gl', 'ka', 'kk', 'km', 'lo', 'mk', 'mn', 'my', 'ne', 'pa', 'si', 'sr', 'so', 'uz', 'zu'],

  async translate(text, srcLang, targetLang) {
    const tkk = await getTkk();
    const tk = computeTk(text, tkk);

    const query = new URLSearchParams();
    query.set('client', 'gtx');
    query.set('sl', srcLang);
    query.set('tl', targetLang);
    query.set('dt', 't');
    query.set('dt', 'bd');
    query.set('dt', 'rm');
    query.set('dt', 'qca');
    query.set('dt', 'ex');
    query.set('dj', '1');
    query.set('ie', 'UTF-8');
    query.set('oe', 'UTF-8');
    query.set('hl', PRIMARY_LANG);
    query.set('tk', tk);

    const url = `${TRANSLATE_API}?${query.toString()}`;
    let body: string;
    try {
      body = await postForm(url, { q: text });
    } catch (error) {
      if (error instanceof HttpError) {
        throw new TranslationError(`Google 翻译请求失败: ${error.message}`, 'google', 'Google Translate');
      }
      throw error;
    }

    let data: GResponse;
    try {
      data = JSON.parse(body) as GResponse;
    } catch {
      throw new TranslationError('Google 翻译响应解析失败', 'google', 'Google Translate');
    }

    return parseResponse(data, text, targetLang);
  },
};
