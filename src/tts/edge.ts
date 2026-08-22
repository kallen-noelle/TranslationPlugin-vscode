/**
 * Microsoft Edge TTS — free text-to-speech via the Edge read-aloud WebSocket.
 */

import { createHash, randomUUID } from 'crypto';
import WebSocket from 'ws';

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS_URL =
  'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
const WIN_EPOCH = 11644473600; // seconds between 1601-01-01 and 1970-01-01
const TURN_END = 'turn.end';
const MAX_TEXT_LENGTH = 200;

// Chromium version reported to the service; must match Sec-MS-GEC-Version.
const CHROMIUM_VERSION = '143.0.3650.75';
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_VERSION}`;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) ' +
  `Chrome/${CHROMIUM_VERSION.split('.')[0]}.0.0.0 Safari/537.36 Edg/${CHROMIUM_VERSION.split('.')[0]}.0.0.0`;

// Corrects the system clock if it is offset from Microsoft's servers.
let clockSkewSeconds = 0;

// Map of language code -> default Edge voice (subset used by the plugin).
const DEFAULT_VOICES: Record<string, string> = {
  'zh-CN': 'zh-CN-XiaoxiaoNeural',
  'zh-HK': 'zh-HK-HiuGaaiNeural',
  'zh-TW': 'zh-TW-HsiaoChenNeural',
  'en-US': 'en-US-JennyNeural',
  'en-GB': 'en-GB-LibbyNeural',
  'ja-JP': 'ja-JP-NanamiNeural',
  'ko-KR': 'ko-KR-SunHiNeural',
  'fr-FR': 'fr-FR-DeniseNeural',
  'de-DE': 'de-DE-KatjaNeural',
  'es-ES': 'es-ES-ElviraNeural',
  'pt-BR': 'pt-BR-FranciscaNeural',
  'pt-PT': 'pt-PT-RaquelNeural',
  'ru-RU': 'ru-RU-SvetlanaNeural',
  'it-IT': 'it-IT-ElsaNeural',
  'nl-NL': 'nl-NL-ColetteNeural',
  'pl-PL': 'pl-PL-ZofiaNeural',
  'tr-TR': 'tr-TR-EmelNeural',
  'vi-VN': 'vi-VN-HoaiMyNeural',
  'th-TH': 'th-TH-PremwadeeNeural',
  'id-ID': 'id-ID-GadisNeural',
  'ar-SA': 'ar-SA-ZariyahNeural',
  'hi-IN': 'hi-IN-SwaraNeural',
  'sv-SE': 'sv-SE-SofieNeural',
  'da-DK': 'da-DK-ChristelNeural',
  'nb-NO': 'nb-NO-PernilleNeural',
  'fi-FI': 'fi-FI-SelmaNeural',
  'cs-CZ': 'cs-CZ-VlastaNeural',
  'hu-HU': 'hu-HU-NoemiNeural',
  'ro-RO': 'ro-RO-AlinaNeural',
  'bg-BG': 'bg-BG-KalinaNeural',
  'uk-UA': 'uk-UA-PolinaNeural',
  'el-GR': 'el-GR-NestorasNeural',
  'he-IL': 'he-IL-AvriNeural',
  'ms-MY': 'ms-MY-YasminNeural',
  'ca-ES': 'ca-ES-JoanaNeural',
  'et-EE': 'et-EE-AnuNeural',
  'lv-LV': 'lv-LV-EveritaNeural',
  'lt-LT': 'lt-LT-OnaNeural',
  'sk-SK': 'sk-SK-ViktoriaNeural',
  'sl-SI': 'sl-SI-PetraNeural',
  'hr-HR': 'hr-HR-GabrijelaNeural',
  'sr-RS': 'sr-RS-SophieNeural',
  'mn-MN': 'mn-MN-YesuiNeural',
  'ne-NP': 'ne-NP-HemkalaNeural',
  'ta-IN': 'ta-IN-PallaviNeural',
  'te-IN': 'te-IN-ShrutiNeural',
  'bn-IN': 'bn-IN-BashkarNeural',
  'kn-IN': 'kn-IN-GaganNeural',
  'gu-IN': 'gu-IN-NiranjanNeural',
  'ml-IN': 'ml-IN-SobhanaNeural',
  'ur-IN': 'ur-IN-SalmanNeural',
  'ps-AF': 'ps-AF-GulNawazNeural',
  'fa-IR': 'fa-IR-DilaraNeural',
  'am-ET': 'am-ET-AmehaNeural',
  'sw-KE': 'sw-KE-ZuriNeural',
  'zu-ZA': 'zu-ZA-ThandoNeural',
  'cy-GB': 'cy-GB-AledNeural',
  'ga-IE': 'ga-IE-ColmNeural',
  'mt-MT': 'mt-MT-GraceNeural',
  'sq-AL': 'sq-AL-AnilaNeural',
  'eu-ES': 'eu-ES-AinhoaNeural',
  'gl-ES': 'gl-ES-SabelaNeural',
  'az-AZ': 'az-AZ-BabekNeural',
  'uz-UZ': 'uz-UZ-MadinaNeural',
  'kk-KZ': 'kk-KZ-AigulNeural',
  'km-KH': 'km-KH-PisethNeural',
  'lo-LA': 'lo-LA-KeomanyNeural',
  'my-MM': 'my-MM-NilarNeural',
  'is-IS': 'is-IS-GudrunNeural',
  'mk-MK': 'mk-MK-AleksandarNeural',
  'af-ZA': 'af-ZA-AdriNeural',
};

function defaultVoiceForLang(lang: string): string {
  const locale = LOCALE_FOR_LANG[lang] ?? 'en-US';
  return DEFAULT_VOICES[locale] ?? DEFAULT_VOICES['en-US']!;
}

const LOCALE_FOR_LANG: Record<string, string> = {
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  en: 'en-US',
  'en-US': 'en-US',
  'en-GB': 'en-GB',
  ja: 'ja-JP',
  ko: 'ko-KR',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  pt: 'pt-PT',
  'pt-BR': 'pt-BR',
  ru: 'ru-RU',
  it: 'it-IT',
  nl: 'nl-NL',
  pl: 'pl-PL',
  tr: 'tr-TR',
  vi: 'vi-VN',
  th: 'th-TH',
  id: 'id-ID',
  ar: 'ar-SA',
  hi: 'hi-IN',
  he: 'he-IL',
  sv: 'sv-SE',
  da: 'da-DK',
  no: 'nb-NO',
  fi: 'fi-FI',
  cs: 'cs-CZ',
  hu: 'hu-HU',
  ro: 'ro-RO',
  bg: 'bg-BG',
  uk: 'uk-UA',
  el: 'el-GR',
};

// ---------------------------------------------------------------------------
// DRM token (Sec-MS-GEC).
// ---------------------------------------------------------------------------

function generateSecMsGecToken(): string {
  // Apply the clock-skew correction learned from a previous 403 response.
  let ticks = Math.floor(Date.now() / 1000) + clockSkewSeconds + WIN_EPOCH;
  ticks -= ticks % 300; // round down to the nearest 5 minutes
  ticks *= 10_000_000; // 100-nanosecond intervals
  return createHash('sha256').update(`${ticks}${TRUSTED_CLIENT_TOKEN}`).digest('hex').toUpperCase();
}

function getSecMsGecVersion(): string {
  return SEC_MS_GEC_VERSION;
}

function getTimestamp(): string {
  // Javascript-style UTC date string, matching edge-tts `date_to_string()`.
  const now = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${days[now.getUTCDay()]} ${months[now.getUTCMonth()]} ${pad(now.getUTCDate())} ${now.getUTCFullYear()} ` +
    `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} ` +
    'GMT+0000 (Coordinated Universal Time)'
  );
}

// ---------------------------------------------------------------------------
// SSML & message framing.
// ---------------------------------------------------------------------------

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSsml(text: string, voice: string, rate: number): string {
  const clamped = Math.max(-50, Math.min(100, rate));
  const rateStr = clamped >= 0 ? `+${clamped}` : `${clamped}`;
  return (
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
    `<voice name='${escapeXml(voice)}'>` +
    `<prosody pitch='+0Hz' rate='${rateStr}%' volume='+0%'>${escapeXml(text)}</prosody>` +
    `</voice></speak>`
  );
}

function buildMessage(contentType: string, path: string, content: string, requestId?: string, appendZ = false): string {
  let msg = '';
  if (requestId) {
    msg += `X-RequestId:${requestId}\r\n`;
  }
  msg += `Content-Type:${contentType}\r\n`;
  // The ssml path appends a trailing 'Z' (mirrors the Microsoft Edge bug / edge-tts).
  msg += `X-Timestamp:${getTimestamp()}${appendZ ? 'Z' : ''}\r\n`;
  msg += `Path:${path}\r\n\r\n`;
  msg += content;
  return msg;
}

// String booleans, minified JSON — same shape as edge-tts sends.
const SPEECH_CONFIG =
  '{"context":{"synthesis":{"audio":{"metadataoptions":{' +
  '"sentenceBoundaryEnabled":"true","wordBoundaryEnabled":"false"},' +
  '"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}';

/** Splits text into chunks no longer than [max] characters at sentence boundaries. */
function splitSentences(text: string, max: number): string[] {
  const result: string[] = [];
  let buffer = '';
  const parts = text.split(/(?<=[.!?。！？;；\n])/);
  for (const part of parts) {
    if (buffer.length + part.length > max && buffer.length > 0) {
      result.push(buffer.trim());
      buffer = '';
    }
    if (part.length > max) {
      // Hard-break very long tokens.
      let remaining = part;
      while (remaining.length > max) {
        result.push(remaining.slice(0, max));
        remaining = remaining.slice(max);
      }
      buffer += remaining;
    } else {
      buffer += part;
    }
  }
  if (buffer.trim().length > 0) {
    result.push(buffer.trim());
  }
  return result;
}

/**
 * Synthesizes [text] to MP3 bytes using the Edge read-aloud service.
 */
export async function edgeTtsToBuffer(
  text: string,
  lang: string,
  voice?: string,
  rate: number = 0,
): Promise<Uint8Array> {
  const selectedVoice = voice?.trim() || defaultVoiceForLang(lang);
  const sentences = splitSentences(text, MAX_TEXT_LENGTH);

  const run = (allowRetry: boolean): Promise<Uint8Array> =>
    new Promise<Uint8Array>((resolve, reject) => {
      const query = new URLSearchParams();
      query.set('TrustedClientToken', TRUSTED_CLIENT_TOKEN);
      query.set('Sec-MS-GEC', generateSecMsGecToken());
      query.set('Sec-MS-GEC-Version', getSecMsGecVersion());
      query.set('ConnectionId', randomUUID().replace(/-/g, ''));

      const ws = new WebSocket(`${WSS_URL}?${query.toString()}`, {
        headers: {
          Pragma: 'no-cache',
          'Cache-Control': 'no-cache',
          Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
          'Sec-WebSocket-Version': '13',
          'User-Agent': USER_AGENT,
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Accept-Language': 'en-US,en;q=0.9',
          // A fresh MUID cookie is required by the service (edge-tts 7.x).
          Cookie: `muid=${randomUUID().replace(/-/g, '').toUpperCase()};`,
        },
      });

      const audioChunks: Buffer[] = [];
      let sentenceIndex = 0;
      let finished = false;
      let failed = false;

      const timeout = setTimeout(() => {
        fail(new Error('Edge TTS 请求超时'));
      }, 30000);

      function fail(error: Error): void {
        if (failed || finished) {
          return;
        }
        failed = true;
        clearTimeout(timeout);
        try {
          ws.close();
        } catch {
          // ignore
        }
        reject(error);
      }

      function sendNextSentence(): void {
        if (failed || finished) {
          return;
        }
        if (sentenceIndex >= sentences.length) {
          finished = true;
          clearTimeout(timeout);
          ws.close();
          const total = Buffer.concat(audioChunks);
          resolve(new Uint8Array(total));
          return;
        }

        ws.send(
          buildMessage('application/json; charset=utf-8', 'speech.config', SPEECH_CONFIG),
        );
        ws.send(
          buildMessage(
            'application/ssml+xml',
            'ssml',
            buildSsml(sentences[sentenceIndex], selectedVoice, rate),
            randomUUID().replace(/-/g, ''),
            true, // append 'Z' to the timestamp (edge-tts / Edge bug)
          ),
        );
      }

      ws.on('open', () => {
        sendNextSentence();
      });

      ws.on('message', (data, isBinary) => {
        if (isBinary) {
          const buf = data as Buffer;
          if (buf.length < 2) {
            return;
          }
          const headerLength = buf.readUInt16BE(0);
          const audio = buf.subarray(headerLength + 2);
          if (audio.length > 0) {
            audioChunks.push(Buffer.from(audio));
          }
          return;
        }

        const message = data.toString();
        const pathMatch = /^Path:(\S+)/m.exec(message);
        if (pathMatch && pathMatch[1] === TURN_END) {
          sentenceIndex++;
          sendNextSentence();
        }
      });

      ws.on('unexpected-response', (_req, res) => {
        // 403 usually means the system clock is offset from Microsoft's server,
        // making the Sec-MS-GEC token stale. Correct the skew and retry once.
        if (res.statusCode === 403 && allowRetry) {
          const serverDate = res.headers['date'];
          const serverTime = serverDate ? Date.parse(serverDate) : NaN;
          if (!Number.isNaN(serverTime)) {
            clockSkewSeconds = (serverTime - Date.now()) / 1000;
          }
          try {
            ws.terminate();
          } catch {
            // ignore
          }
          reject(new Error('Edge TTS 需要校正时钟后重试'));
          return;
        }
        fail(new Error(`Edge TTS 连接失败: HTTP ${res.statusCode}`));
      });

      ws.on('error', (error) => {
        fail(new Error(`Edge TTS 连接失败: ${error.message}`));
      });

      ws.on('close', () => {
        if (!finished && !failed) {
          fail(new Error('Edge TTS 连接提前关闭'));
        }
      });
    });

  try {
    return await run(true);
  } catch (error) {
    // Retry once with the corrected clock (only if the first attempt 403'd).
    if (error instanceof Error && error.message === 'Edge TTS 需要校正时钟后重试') {
      return run(false);
    }
    throw error;
  }
}

/** Whether Edge TTS supports the given language. */
export function isEdgeTtsLanguageSupported(lang: string): boolean {
  return lang in LOCALE_FOR_LANG;
}

export { defaultVoiceForLang };
