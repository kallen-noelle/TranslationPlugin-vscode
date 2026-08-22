/**
 * OpenAI Translator — chat completions based, requires an API key.
 */

import { Config } from '../config.js';
import { languageName } from '../languages.js';
import { TranslationError, Translator } from '../types.js';
import { postJson, HttpError } from '../http.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Renders the translator prompt template and splits it into chat messages. */
export function buildTranslationMessages(
  text: string,
  srcLang: string,
  targetLang: string,
  isDocument = false,
): ChatMessage[] {
  const srcName = languageName(srcLang);
  const targetName = languageName(targetLang);
  const direction = srcLang === 'auto' ? 'into' : `from ${srcName} to`;

  if (isDocument) {
    return [
      {
        role: 'system',
        content:
          'You are an html document translator.\n' +
          'The user will provide you with an html document.\n' +
          `Translate the html document ${direction} ${targetName}.\n` +
          'Do not translate the content inside "pre" and "code" tags.',
      },
      { role: 'user', content: text },
    ];
  }

  return [
    {
      role: 'system',
      content:
        'You are a translator.\n' +
        'The user will provide you with text in triple quotes.\n' +
        `Translate the text ${direction} ${targetName}.\n` +
        'Do not return the translated text in triple quotes.',
    },
    { role: 'user', content: `"""\n${text}\n"""` },
  ];
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

async function callChatCompletion(
  messages: ChatMessage[],
  config: Config,
): Promise<string> {
  const apiKey = await config.getApiKey('openai');
  if (!apiKey) {
    throw new TranslationError(
      'OpenAI API Key 未配置。请运行 "Translation: Configure" 命令设置。',
      'openai',
      'OpenAI Translator',
    );
  }

  const url = `${config.openAiBaseUrl}/v1/chat/completions`;
  let result: ChatCompletionResponse;
  try {
    result = await postJson<ChatCompletionResponse>(
      url,
      { model: config.openAiModel, messages },
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 401) {
      throw new TranslationError(
        'OpenAI API Key 无效。请运行 "Translation: Configure" 命令重新设置。',
        'openai',
        'OpenAI Translator',
      );
    }
    throw new TranslationError(
      `OpenAI 请求失败: ${error instanceof Error ? error.message : String(error)}`,
      'openai',
      'OpenAI Translator',
    );
  }

  if (result.error) {
    throw new TranslationError(
      `OpenAI 返回错误: ${result.error.message ?? '未知错误'}`,
      'openai',
      'OpenAI Translator',
    );
  }

  const content = result.choices?.[0]?.message?.content ?? '';
  return content.trim();
}

export const OpenAiTranslator: Translator = {
  id: 'openai',
  name: 'OpenAI Translator',
  supportsAuto: true,
  supportedSourceLanguages: ['auto'],
  supportedTargetLanguages: ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'ru', 'it', 'nl', 'pl', 'tr', 'vi', 'th', 'id', 'ar', 'hi', 'he', 'sv', 'da', 'no', 'fi', 'cs', 'hu', 'ro', 'bg', 'uk', 'el', 'sk', 'hr', 'sl', 'lt', 'lv', 'et', 'fa', 'ur', 'bn', 'ta', 'te', 'ca', 'fil', 'sw', 'cy', 'af', 'sq', 'am', 'az', 'eu', 'be', 'bs', 'eo', 'ga', 'gl', 'ka', 'kk', 'km', 'lo', 'mk', 'mn', 'my', 'ne', 'pa', 'si', 'sr', 'so', 'uz', 'zu'],

  async translate(text, srcLang, targetLang) {
    const config = Config.get();
    const messages = buildTranslationMessages(text, srcLang, targetLang);
    const content = await callChatCompletion(messages, config);
    return {
      original: text,
      translation: content || text,
      srcLang,
      targetLang,
      sourceLanguages: [srcLang],
    };
  },
};

/** Translates an HTML document via OpenAI, stripping a possible markdown code fence. */
export async function translateDocumentWithOpenAi(
  html: string,
  srcLang: string,
  targetLang: string,
): Promise<string> {
  const config = Config.get();
  const messages = buildTranslationMessages(html, srcLang, targetLang, true);
  let translated = await callChatCompletion(messages, config);
  if (translated.startsWith('```html\n') && translated.endsWith('\n```')) {
    translated = translated.slice(8, -4);
  }
  return translated;
}
