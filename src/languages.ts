/**
 * Language definitions and per-engine code mappings.
 *
 * The generic `code` follows Google's language codes (also used by Baidu/Youdao).
 * Microsoft uses a different set for a few languages (Chinese variants etc).
 */

export const AUTO = 'auto';

export interface Language {
  /** Generic language code (Google-compatible). */
  code: string;
  /** English name. */
  name: string;
  /** Chinese name. */
  nameZh: string;
}

// A curated list of commonly used languages (subset of the full list).
export const LANGUAGES: Language[] = [
  { code: 'auto', name: 'Auto', nameZh: '自动检测' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nameZh: '中文(简体)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nameZh: '中文(繁体)' },
  { code: 'en', name: 'English', nameZh: '英语' },
  { code: 'en-US', name: 'English (American)', nameZh: '英语(美国)' },
  { code: 'en-GB', name: 'English (British)', nameZh: '英语(英国)' },
  { code: 'ja', name: 'Japanese', nameZh: '日语' },
  { code: 'ko', name: 'Korean', nameZh: '韩语' },
  { code: 'fr', name: 'French', nameZh: '法语' },
  { code: 'de', name: 'German', nameZh: '德语' },
  { code: 'es', name: 'Spanish', nameZh: '西班牙语' },
  { code: 'pt', name: 'Portuguese', nameZh: '葡萄牙语' },
  { code: 'pt-BR', name: 'Portuguese (Brazilian)', nameZh: '葡萄牙语(巴西)' },
  { code: 'ru', name: 'Russian', nameZh: '俄语' },
  { code: 'it', name: 'Italian', nameZh: '意大利语' },
  { code: 'nl', name: 'Dutch', nameZh: '荷兰语' },
  { code: 'pl', name: 'Polish', nameZh: '波兰语' },
  { code: 'tr', name: 'Turkish', nameZh: '土耳其语' },
  { code: 'vi', name: 'Vietnamese', nameZh: '越南语' },
  { code: 'th', name: 'Thai', nameZh: '泰语' },
  { code: 'id', name: 'Indonesian', nameZh: '印尼语' },
  { code: 'ms', name: 'Malay', nameZh: '马来语' },
  { code: 'ar', name: 'Arabic', nameZh: '阿拉伯语' },
  { code: 'hi', name: 'Hindi', nameZh: '印地语' },
  { code: 'he', name: 'Hebrew', nameZh: '希伯来语' },
  { code: 'sv', name: 'Swedish', nameZh: '瑞典语' },
  { code: 'da', name: 'Danish', nameZh: '丹麦语' },
  { code: 'no', name: 'Norwegian', nameZh: '挪威语' },
  { code: 'fi', name: 'Finnish', nameZh: '芬兰语' },
  { code: 'cs', name: 'Czech', nameZh: '捷克语' },
  { code: 'hu', name: 'Hungarian', nameZh: '匈牙利语' },
  { code: 'ro', name: 'Romanian', nameZh: '罗马尼亚语' },
  { code: 'bg', name: 'Bulgarian', nameZh: '保加利亚语' },
  { code: 'uk', name: 'Ukrainian', nameZh: '乌克兰语' },
  { code: 'el', name: 'Greek', nameZh: '希腊语' },
  { code: 'sk', name: 'Slovak', nameZh: '斯洛伐克语' },
  { code: 'hr', name: 'Croatian', nameZh: '克罗地亚语' },
  { code: 'sl', name: 'Slovenian', nameZh: '斯洛文尼亚语' },
  { code: 'lt', name: 'Lithuanian', nameZh: '立陶宛语' },
  { code: 'lv', name: 'Latvian', nameZh: '拉脱维亚语' },
  { code: 'et', name: 'Estonian', nameZh: '爱沙尼亚语' },
  { code: 'fa', name: 'Persian', nameZh: '波斯语' },
  { code: 'ur', name: 'Urdu', nameZh: '乌尔都语' },
  { code: 'bn', name: 'Bengali', nameZh: '孟加拉语' },
  { code: 'ta', name: 'Tamil', nameZh: '泰米尔语' },
  { code: 'te', name: 'Telugu', nameZh: '泰卢固语' },
  { code: 'ca', name: 'Catalan', nameZh: '加泰罗尼亚语' },
  { code: 'fil', name: 'Filipino', nameZh: '菲律宾语' },
  { code: 'sw', name: 'Swahili', nameZh: '斯瓦希里语' },
  { code: 'cy', name: 'Welsh', nameZh: '威尔士语' },
  { code: 'af', name: 'Afrikaans', nameZh: '南非荷兰语' },
  { code: 'sq', name: 'Albanian', nameZh: '阿尔巴尼亚语' },
  { code: 'am', name: 'Amharic', nameZh: '阿姆哈拉语' },
  { code: 'az', name: 'Azerbaijani', nameZh: '阿塞拜疆语' },
  { code: 'eu', name: 'Basque', nameZh: '巴斯克语' },
  { code: 'be', name: 'Belarusian', nameZh: '白俄罗斯语' },
  { code: 'bs', name: 'Bosnian', nameZh: '波斯尼亚语' },
  { code: 'eo', name: 'Esperanto', nameZh: '世界语' },
  { code: 'ga', name: 'Irish', nameZh: '爱尔兰语' },
  { code: 'gl', name: 'Galician', nameZh: '加利西亚语' },
  { code: 'ka', name: 'Georgian', nameZh: '格鲁吉亚语' },
  { code: 'kk', name: 'Kazakh', nameZh: '哈萨克语' },
  { code: 'km', name: 'Khmer', nameZh: '高棉语' },
  { code: 'lo', name: 'Lao', nameZh: '老挝语' },
  { code: 'lb', name: 'Luxembourgish', nameZh: '卢森堡语' },
  { code: 'mk', name: 'Macedonian', nameZh: '马其顿语' },
  { code: 'mt', name: 'Maltese', nameZh: '马耳他语' },
  { code: 'mn', name: 'Mongolian', nameZh: '蒙古语' },
  { code: 'my', name: 'Myanmar', nameZh: '缅甸语' },
  { code: 'ne', name: 'Nepali', nameZh: '尼泊尔语' },
  { code: 'pa', name: 'Punjabi', nameZh: '旁遮普语' },
  { code: 'si', name: 'Sinhala', nameZh: '僧伽罗语' },
  { code: 'sr', name: 'Serbian', nameZh: '塞尔维亚语' },
  { code: 'so', name: 'Somali', nameZh: '索马里语' },
  { code: 'tg', name: 'Tajik', nameZh: '塔吉克语' },
  { code: 'uz', name: 'Uzbek', nameZh: '乌兹别克语' },
  { code: 'zu', name: 'Zulu', nameZh: '祖鲁语' },
];

const byCode = new Map(LANGUAGES.map((l) => [l.code, l]));

export function getLanguage(code: string): Language | undefined {
  return byCode.get(code);
}

export function languageName(code: string): string {
  return byCode.get(code)?.name ?? code;
}

export function languageNameZh(code: string): string {
  return byCode.get(code)?.nameZh ?? code;
}

/** Code -> Microsoft/Bing code. Most codes match; Chinese variants differ. */
const MICROSOFT_MAP: Record<string, string> = {
  auto: 'auto-detect',
  'zh-CN': 'zh-Hans',
  'zh-TW': 'zh-Hant',
  en: 'en',
  'pt-BR': 'pt-BR',
};

export function toMicrosoftCode(code: string): string {
  return MICROSOFT_MAP[code] ?? code;
}

export function fromMicrosoftCode(code: string): string {
  for (const [generic, ms] of Object.entries(MICROSOFT_MAP)) {
    if (ms === code) {
      return generic;
    }
  }
  return code;
}

/** Code -> English display name used in the OpenAI prompt. */
export function toOpenAiLanguageName(code: string): string {
  if (code === AUTO) {
    return 'Auto';
  }
  return languageName(code);
}
