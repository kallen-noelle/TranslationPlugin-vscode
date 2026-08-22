/**
 * OpenAI TTS — requires an API key.
 */

import { Config } from '../config.js';
import { TranslationError } from '../types.js';
import { HttpError } from '../http.js';

/**
 * Synthesizes [text] to MP3 bytes using the OpenAI audio/speech API.
 */
export async function openAiTtsToBuffer(
  text: string,
  voice?: string,
): Promise<Uint8Array> {
  const config = Config.get();
  const apiKey = await config.getApiKey('openai');
  if (!apiKey) {
    throw new TranslationError(
      'OpenAI API Key 未配置。请运行 "Translation: Configure" 命令设置。',
      'openai',
      'OpenAI Translator',
    );
  }

  const url = `${config.openAiBaseUrl}/v1/audio/speech`;
  const body = {
    model: 'tts-1',
    input: text,
    voice: voice ?? config.openAiVoice,
    speed: 1,
    response_format: 'mp3',
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new TranslationError(
        `OpenAI TTS 请求失败: HTTP ${res.status}`,
        'openai',
        'OpenAI Translator',
      );
    }
    return new Uint8Array(await res.arrayBuffer());
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TranslationError('OpenAI TTS 请求超时', 'openai', 'OpenAI Translator');
    }
    throw new TranslationError(
      `OpenAI TTS 请求失败: ${error instanceof Error ? error.message : String(error)}`,
      'openai',
      'OpenAI Translator',
    );
  } finally {
    clearTimeout(timer);
  }
}
