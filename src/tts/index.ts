/**
 * Text-to-speech engine abstraction.
 */

import { Config } from '../config.js';
import { TranslationError } from '../types.js';
import { playAudio } from '../audioPlayer.js';
import { edgeTtsToBuffer } from './edge.js';
import { openAiTtsToBuffer } from './openai.js';

export type TtsEngineId = 'edge' | 'openai';

export interface TtsOptions {
  text: string;
  lang: string;
  /** Optional engine override; defaults to the configured TTS engine. */
  engine?: string;
  /** Optional voice override. */
  voice?: string;
}

/**
 * Speaks the given text using the configured (or requested) TTS engine.
 */
export async function speakText(options: TtsOptions): Promise<void> {
  const config = Config.get();
  const engine = options.engine ?? config.ttsEngine;

  let buffer: Uint8Array;
  if (engine === 'openai') {
    buffer = await openAiTtsToBuffer(options.text, options.voice ?? config.openAiVoice);
  } else if (engine === 'edge') {
    buffer = await edgeTtsToBuffer(
      options.text,
      options.lang,
      options.voice || config.edgeVoice || undefined,
      config.edgeSpeedPercent,
    );
  } else {
    throw new TranslationError(`未知的 TTS 引擎: ${engine}`);
  }

  await playAudio(buffer);
}

export { isEdgeTtsLanguageSupported } from './edge.js';
