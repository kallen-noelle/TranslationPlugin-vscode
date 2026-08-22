// Verify the OpenAI-compatible chat translation flow using a provided API key.
// The key is expected in the DEEPSEEK_KEY environment variable (never hard-coded).
// The prompt construction mirrors src/translator/openai.ts buildTranslationMessages.

const BASE = process.env.OPENAI_COMPAT_BASE ?? 'https://api.deepseek.com';
const MODEL = process.env.OPENAI_COMPAT_MODEL ?? 'deepseek-chat';
const KEY = process.env.DEEPSEEK_KEY;
if (!KEY) {
  console.error('Missing DEEPSEEK_KEY env var');
  process.exit(2);
}

const NAMES = { 'zh-CN': 'Chinese (Simplified)', 'zh-TW': 'Chinese (Traditional)', en: 'English', auto: 'Auto' };
const name = (c) => NAMES[c] ?? c;

function buildTranslationMessages(text, src, tgt, isDocument = false) {
  const direction = src === 'auto' ? 'into' : `from ${name(src)} to`;
  if (isDocument) {
    return [
      {
        role: 'system',
        content:
          'You are an html document translator.\n' +
          'The user will provide you with an html document.\n' +
          `Translate the html document ${direction} ${name(tgt)}.\n` +
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
        `Translate the text ${direction} ${name(tgt)}.\n` +
        'Do not return the translated text in triple quotes.',
    },
    { role: 'user', content: `"""\n${text}\n"""` },
  ];
}

async function chat(messages) {
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  return data.choices?.[0]?.message?.content ?? '';
}

async function main() {
  let msgs = buildTranslationMessages('The quick brown fox jumps over the lazy dog', 'auto', 'zh-CN');
  console.log('en->zh-CN :', (await chat(msgs)).trim());

  msgs = buildTranslationMessages('获取用户名并验证权限', 'zh-CN', 'en');
  console.log('zh-CN->en :', (await chat(msgs)).trim());

  msgs = buildTranslationMessages('<p>Hello <b>world</b></p>', 'auto', 'zh-CN', true);
  console.log('doc->zh   :', (await chat(msgs)).trim());
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
