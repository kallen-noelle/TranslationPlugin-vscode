/**
 * 纯浏览器预览模式下的 mock 数据注入。
 *
 * VS Code webview 里有 acquireVsCodeApi(),但在浏览器直接打开 Vite 产物时没有。
 * 此时本模块会检测到 acquireVsCodeApi 不存在,自动向 window 上派发假的 postMessage
 * 事件,内容是宿主应该推过来的初始数据,方便在浏览器里直接看到页面效果。
 *
 * 用法: 在每个 main.tsx 顶部 import 一次即可。
 */

// 内联类型,避免 import 真实页面模块(会拉进整个 React 页面)
interface SampleWord {
  id: number; original: string; translation: string; phonetic?: string;
  tags?: string; srcLang: string; targetLang: string; addedAt?: number;
}

// 默认设置(与旧版 collectSettings 默认值对齐)
const DEFAULT_SETTINGS = {
  defaultEngine: 'microsoft',
  mainLanguage: 'zh-CN',
  sourceLanguage: 'auto',
  targetLanguage: 'zh-CN',
  'font.family': '',
  'font.phonetic': '',
  'textSelection.stripPunctuation': true,
  'textSelection.preserveFormat': true,
  'textSelection.autoCapture': false,
  'textSelection.regexFilter': '',
  'hover.enabled': true,
  'hover.docTranslation': true,
  'popup.autoRead': 'none',
  'popup.position': 'cursor',
  'popup.autoCopy': false,
  'replace.contextMenu': true,
  'replace.selectLanguageFirst': true,
  'replace.useLastLanguage': false,
  'replace.autoReplace': false,
  replaceSeparator: 'original',
  'wordOfDay.autoShow': true,
  'wordOfDay.showDefinition': true,
  'wordbook.path': '',
  'history.maxEntries': 100,
  autoTranslateDocument: false,
  contextMenuOnlyWithSelection: false,
  ttsEngine: 'edge',
  'tts.edge.voice': '',
  'tts.edge.speed': '0%',
  'tts.openai.voice': 'alloy',
  'openai.baseUrl': 'https://api.openai.com',
  'openai.model': 'gpt-4o-mini',
};

const SAMPLE_WORDS: SampleWord[] = [
  {
    id: 1, original: 'verify', translation: '核实;验证', phonetic: '/ˈverɪfaɪ/',
    tags: '编程,常用', srcLang: 'en', targetLang: 'zh-CN', addedAt: Date.now() - 3600_000,
  },
  {
    id: 2, original: 'interface', translation: '界面;接口', phonetic: '/ˈɪntərfeɪs/',
    tags: '编程', srcLang: 'en', targetLang: 'zh-CN', addedAt: Date.now() - 86400_000,
  },
  {
    id: 3, original: 'obfuscate', translation: '使模糊;使混乱', phonetic: '/ˈɒbfəskeɪt/',
    tags: '', srcLang: 'en', targetLang: 'zh-CN', addedAt: Date.now() - 172800_000,
  },
  {
    id: 4, original: 'resilience', translation: '韧性;恢复力', phonetic: '/rɪˈzɪliəns/',
    tags: '', srcLang: 'en', targetLang: 'zh-CN', addedAt: Date.now() - 259200_000,
  },
  {
    id: 5, original: 'idempotent', translation: '幂等的', phonetic: '/ˌaɪdemˈpoʊtənt/',
    tags: '编程', srcLang: 'en', targetLang: 'zh-CN', addedAt: Date.now() - 345600_000,
  },
];

const SAMPLE_LANGUAGES = ['auto', 'zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'fr', 'de', 'es'];

const SAMPLE_RESULT = {
  original: 'The quick brown fox jumps over the lazy dog.',
  translation: '敏捷的棕色狐狸跳过那只懒惰的狗。',
  transliteration: '',
  srcLang: 'en',
  targetLang: 'zh-CN',
  dict: [
    {
      pos: '名词', term: 'fox',
      entries: [{ translation: '狐狸;狡猾的人' }],
    },
    {
      pos: '动词', term: 'jump',
      entries: [{ translation: '跳跃;跳过;暴涨' }, { translation: '跳;猛然一动' }],
    },
  ],
};

const SAMPLE_WORD_OF_DAY = {
  word: 'verify', phonetic: '/ˈverɪfaɪ/', translation: '核实;验证',
  definitions: [
    { pos: '动词', meaning: '验证;核实;证明;校验' },
  ],
  example: 'Verify the checksum before installing the package.',
  exampleTranslation: '安装包之前先验证校验和。',
};

const SAMPLE_ENTRY = {
  id: 1, original: 'verify', translation: '核实;验证\n\n动词\n验证;核实;证明;校验',
  phonetic: '/ˈverɪfaɪ/', tags: '编程,常用',
  srcLang: 'en', targetLang: 'zh-CN', addedAt: Date.now() - 3600_000,
};

const SAMPLE_HISTORY = [
  {
    id: 'h1', original: 'concurrency', translation: '并发',
    srcLang: 'en', targetLang: 'zh-CN', timestamp: Date.now() - 600_000,
  },
  {
    id: 'h2', original: 'Abstraction hides implementation details behind a clean interface.',
    translation: '抽象把实现细节隐藏在简洁的接口之后。',
    srcLang: 'en', targetLang: 'zh-CN', timestamp: Date.now() - 1800_000,
  },
];

/** 如果 acquireVsCodeApi 不存在,自动派发 mock 消息。 */
export function injectMockData(): void {
  // VS Code webview 里有 acquireVsCodeApi,浏览器里没有 —— 靠这个区分
  if (typeof acquireVsCodeApi !== 'undefined') {
    return; // 真实宿主,不注入
  }

  // 派发消息的辅助:直接触发 window 的 message 事件(React 的 onHostMessage 用 addEventListener 监听)
  const emit = (data: unknown) => {
    const ev = new MessageEvent('message', { data, origin: '*' });
    window.dispatchEvent(ev);
  };

  // 页面类型由 URL 区分 (Vite dev server 用 /WordBook.html 这种路径)
  const path = window.location.pathname.toLowerCase();

  // 等 React 的 useEffect 注册好监听器再发
  setTimeout(() => {
    // 通用:先推 ready 响应(有些页面等 ready 后才去拉数据)
    emit({ type: 'init' });

    if (path.includes('wordbook') || path.includes('wordbook')) {
      // WordBook 发 entries + settings
      emit({ type: 'entries', entries: SAMPLE_WORDS });
      emit({ type: 'settings', settings: DEFAULT_SETTINGS, cacheSize: '23.4 KB' });
    } else if (path.includes('translationdialog')) {
      // TranslationDialog 发 languages + 示例 result
      emit({ type: 'languages', source: SAMPLE_LANGUAGES, target: SAMPLE_LANGUAGES });
      emit({ type: 'result', ...SAMPLE_RESULT });
      emit({ type: 'history', entries: SAMPLE_HISTORY });
    } else if (path.includes('worddetails')) {
      // WordDetails 发 entry
      emit({ type: 'entry', entry: SAMPLE_ENTRY });
    } else if (path.includes('wordofday')) {
      // WordOfDay 发 word
      emit({ type: 'word', item: SAMPLE_WORD_OF_DAY, index: 0, date: new Date().toLocaleDateString() });
    }

    console.log('[mockDevData] 已注入 mock 消息,path =', path);
  }, 100);
}
