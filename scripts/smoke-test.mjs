// Smoke test for the translation engines (runs without VS Code).
import { GoogleTranslator } from '../out/translator/google.js';
import { MicrosoftTranslator } from '../out/translator/microsoft.js';
import { splitWords, splitCamelCaseWords } from '../out/camelCase.js';
import { formatTranslation } from '../out/replace.js';

const log = (label, value) => console.log(label.padEnd(34), '=>', JSON.stringify(value));

async function main() {
  console.log('=== wordExtractor / replace ===');
  log('splitWords("helloWorld")', splitWords('helloWorld'));
  log('splitWords("getUserName")', splitWords('getUserName'));
  log('splitWords("HTTPClient")', splitWords('HTTPClient'));
  log('splitWords("user_name")', splitWords('user_name'));
  log('splitCamelCaseWords("getUserName")', splitCamelCaseWords('getUserName'));
  log('camelCase(获取用户名 via "Get user name")', formatTranslation('Get user name', 'camelCase'));
  log('snake_case', formatTranslation('Get user name', 'snake_case'));
  log('PascalCase', formatTranslation('Get user name', 'PascalCase'));

  console.log('\n=== Google ===');
  try {
    const r = await GoogleTranslator.translate('hello world', 'auto', 'zh-CN');
    log('hello world -> zh-CN', r);
  } catch (e) {
    console.log('Google ERROR:', e.message);
  }

  try {
    const r = await GoogleTranslator.translate('获取用户名', 'auto', 'en');
    log('获取用户名 -> en', r);
  } catch (e) {
    console.log('Google ERROR:', e.message);
  }

  console.log('\n=== Microsoft ===');
  try {
    const r = await MicrosoftTranslator.translate('hello world', 'auto', 'zh-CN');
    log('hello world -> zh-CN', r);
  } catch (e) {
    console.log('Microsoft ERROR:', e.message);
  }

  try {
    const r = await MicrosoftTranslator.translate('apple', 'en', 'zh-CN');
    log('apple -> zh-CN (dict)', { translation: r.translation, dict: r.dict });
  } catch (e) {
    console.log('Microsoft ERROR:', e.message);
  }
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
