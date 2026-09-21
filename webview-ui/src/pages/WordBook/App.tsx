// React 核心钩子
import { useEffect, useRef, useState } from 'react';
// 工具函数：类名合并
import { cn } from '../../lib/utils';
// VS Code Webview 与宿主扩展通信的封装
import { onHostMessage, postHost } from '../../lib/vscode';
// UI 组件库（基于 Radix/VS Code 主题风格）
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Checkbox } from '../../components/ui/checkbox';


import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Dialog, DialogContent } from '../../components/ui/dialog';
// Lucide 图标（通用 UI 图标）
import {
  ArrowUpDown,
  Copy,
  Download,
  Lightbulb,
  MoreHorizontal,
  RefreshCw,
  Search,
  Settings,
  Star,
  Trash,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
// 引擎图标（Microsoft/Google 有特殊 4 色版本,Lucide 无对应,保留自定义组件）
import { EngineIcon } from '../../components/icons';

/* ────────────────── 类型定义 ────────────────── */

// 生词本中的单个词条
interface WordBookEntry {
  id: number;           // 唯一标识
  original: string;    // 原文/单词
  translation: string; // 译文/释义
  phonetic?: string | null; // 音标（可选）
  tags?: string | null;     // 标签（可选）
  srcLang: string;          // 源语言代码
  targetLang: string;       // 目标语言代码
  addedAt?: number | null;  // 添加时间戳
}

// 列表排序模式：按时间 / 字母升序 / 字母降序
type SortMode = 'time' | 'asc' | 'desc';

// 设置对象的通用键值结构
type SettingsShape = Record<string, unknown>;

// Webview 与扩展宿主之间的消息协议（判别联合类型）
type HostMsg =
  | { type: 'entries'; entries: WordBookEntry[] }
  | { type: 'settings'; settings: SettingsShape; apiKey: string; cacheSize: string }
  | { type: 'saved' }
  | { type: 'historyCleared' }
  | { type: 'cacheCleared'; cacheSize: string }
  | { type: 'wordbookPathChanged'; path: string; rawPath: string };

/* ────────────────── 常量 ────────────────── */

// 设置面板中的可选字体列表
const FONT_LIST = [
  'Consolas',
  'Courier New',
  'Fira Code',
  'JetBrains Mono',
  'Source Code Pro',
  'Microsoft YaHei',
  'SimSun',
  'KaiTi',
  'Segoe UI',
  'Arial',
];

// 支持的语言代码列表
const LANG_CODES = [
  'auto', 'zh_CN', 'zh_TW', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'pt_BR', 'ru',
  'it', 'nl', 'pl', 'tr', 'vi', 'th', 'id', 'ar', 'hi', 'he', 'sv', 'da', 'no', 'fi',
  'cs', 'hu', 'ro', 'bg', 'uk', 'el', 'sk', 'hr', 'sl', 'lt', 'lv', 'et', 'fa', 'ur',
  'bn', 'ta', 'te', 'ca', 'fil', 'sw', 'cy',
];

// 语言代码 → 显示名称的映射
const LANG_NAMES: Record<string, string> = {
  auto: 'Auto Detect',
  zh_CN: '简体中文',
  zh_TW: '繁體中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  pt: 'Português',
  pt_BR: 'Português (Brasil)',
  ru: 'Русский',
  it: 'Italiano',
  nl: 'Nederlands',
  pl: 'Polski',
  tr: 'Türkçe',
  vi: 'Tiếng Việt',
  th: 'ไทย',
  id: 'Indonesia',
  ar: 'العربية',
  hi: 'हिन्दी',
  he: 'עברית',
  sv: 'Svenska',
  da: 'Dansk',
  no: 'Norsk',
  fi: 'Suomi',
  cs: 'Čeština',
  hu: 'Magyar',
  ro: 'Română',
  bg: 'Български',
  uk: 'Українська',
  el: 'Ελληνικά',
  sk: 'Slovenčina',
  hr: 'Hrvatski',
  sl: 'Slovenščina',
  lt: 'Lietuvių',
  lv: 'Latviešu',
  et: 'Eesti',
  fa: 'فارسی',
  ur: 'اردو',
  bn: 'বাংলা',
  ta: 'தமிழ்',
  te: 'తెలుగు',
  ca: 'Català',
  fil: 'Filipino',
  sw: 'Kiswahili',
  cy: 'Cymraeg',
};

// 翻译引擎下拉选项
const ENGINE_OPTIONS = [
  { value: 'microsoft', label: 'Microsoft Translator', engine: 'microsoft' },
  { value: 'google', label: 'Google Translate', engine: 'google' },
  { value: 'openai', label: 'OpenAI', engine: 'openai' },
];

// TTS（文字转语音）引擎下拉选项
const TTS_ENGINE_OPTIONS = [
  { value: 'edge', label: 'Microsoft Edge TTS', engine: 'microsoft' },
  { value: 'openai', label: 'OpenAI TTS', engine: 'openai' },
];

/* ────────────────── 工具函数 ────────────────── */

// 从设置对象中安全读取字符串值，支持点号分隔的嵌套键路径
const str = (s: SettingsShape, k: string, d = '') => (s[k] as string) ?? d;
// 从设置对象中安全读取布尔值
const bool = (s: SettingsShape, k: string) => !!s[k];

// 收集当前设置面板中所有可配置项，整理成可序列化的对象发送给宿主
function collectSettings(s: SettingsShape): Record<string, unknown> {
  return {
    defaultEngine: str(s, 'defaultEngine', 'microsoft'),
    mainLanguage: str(s, 'mainLanguage', 'zh_CN'),
    sourceLanguage: str(s, 'sourceLanguage', 'auto'),
    targetLanguage: str(s, 'targetLanguage', 'zh_CN'),
    'font.family': str(s, 'font.family'),
    'font.phonetic': str(s, 'font.phonetic'),
    'textSelection.stripPunctuation': bool(s, 'textSelection.stripPunctuation'),
    'textSelection.preserveFormat': bool(s, 'textSelection.preserveFormat'),
    'textSelection.autoCapture': bool(s, 'textSelection.autoCapture'),
    'textSelection.regexFilter': str(s, 'textSelection.regexFilter'),
    'hover.enabled': bool(s, 'hover.enabled'),
    'hover.docTranslation': bool(s, 'hover.docTranslation'),
    'popup.autoRead': str(s, 'popup.autoRead', 'none'),
    'popup.position': str(s, 'popup.position', 'cursor'),
    'popup.autoCopy': bool(s, 'popup.autoCopy'),
    'replace.contextMenu': bool(s, 'replace.contextMenu'),
    'replace.selectLanguageFirst': bool(s, 'replace.selectLanguageFirst'),
    'replace.useLastLanguage': bool(s, 'replace.useLastLanguage'),
    'replace.autoReplace': bool(s, 'replace.autoReplace'),
    replaceSeparator: str(s, 'replaceSeparator', 'original'),
    'wordOfDay.autoShow': bool(s, 'wordOfDay.autoShow'),
    'wordOfDay.showDefinition': bool(s, 'wordOfDay.showDefinition'),
    'wordbook.path': str(s, 'wordbook.path'),
    'history.maxEntries': Number(s['history.maxEntries'] ?? 100),
    autoTranslateDocument: bool(s, 'autoTranslateDocument'),
    contextMenuOnlyWithSelection: bool(s, 'contextMenuOnlyWithSelection'),
    ttsEngine: str(s, 'ttsEngine', 'edge'),
    'tts.edge.voice': str(s, 'tts.edge.voice'),
    'tts.edge.speed': str(s, 'tts.edge.speed', '0%'),
    'tts.openai.voice': str(s, 'tts.openai.voice', 'alloy'),
    'openai.baseUrl': str(s, 'openai.baseUrl', 'https://api.openai.com'),
    'openai.model': str(s, 'openai.model', 'gpt-4o-mini'),
    'openai.apiKey': str(s, 'openai.apiKey'),
  };
}

/* ────────────────── 主应用组件 ────────────────── */

export default function App() {
  // —— 列表相关状态 ——
  const [entries, setEntries] = useState<WordBookEntry[]>([]);      // 生词本条目列表
  const [selectedId, setSelectedId] = useState<number | null>(null); // 当前选中条目的 ID
  const [sortMode, setSortMode] = useState<SortMode>('time');       // 排序方式
  const [searchQuery, setSearchQuery] = useState('');                // 搜索关键词
  const [showSearch, setShowSearch] = useState(false);               // 是否显示搜索栏
  const [showSettings, setShowSettings] = useState(false);           // 是否显示设置面板
  const [showMore, setShowMore] = useState(false);                   // 是否显示"更多"下拉菜单
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; entry: WordBookEntry } | null>(null); // 右键菜单状态

  // —— 设置相关状态（从宿主同步而来）——
  const [settings, setSettings] = useState<SettingsShape>({});   // 完整配置对象
  const [apiKey, setApiKey] = useState('');                      // API 密钥（敏感，单独存储）
  const [cacheSize, setCacheSize] = useState('0KB');            // 磁盘缓存大小显示
  const [pathDisplay, setPathDisplay] = useState('');            // 单词本文件路径显示

  // —— 弹窗状态 ——
  const [openaiModal, setOpenaiModal] = useState(false);         // OpenAI 高级配置弹窗
  const [ttsModal, setTtsModal] = useState(false);               // TTS 配置弹窗

  // —— DOM 引用 ——
  const moreRef = useRef<HTMLDivElement>(null);                  // "更多"下拉容器，用于外部点击判断
  const searchInputRef = useRef<HTMLInputElement>(null);         // 搜索输入框，用于自动聚焦

  /* ── 挂载时注册宿主消息监听器并拉取初始数据 ── */
  useEffect(() => {
    // 注册消息监听，返回的 off 函数用于卸载时清理
    const off = onHostMessage<HostMsg>((msg) => {
      switch (msg.type) {
        // 收到生词本条目列表
        case 'entries':
          setEntries(msg.entries || []);
          break;
        // 收到完整设置（含 API Key、缓存大小、单词本路径等）
        case 'settings': {
          const s = msg.settings || {};
          setSettings(s);
          setApiKey(msg.apiKey || '');
          setCacheSize(msg.cacheSize || '0KB');
          // 优先显示解析后的绝对路径，没有则回退到用户配置的原始路径
          setPathDisplay(str(s, 'wordbook.resolvedPath', '') || str(s, 'wordbook.path'));
          break;
        }
        // 设置保存成功，刷新数据并关闭设置面板
        case 'saved':
          postHost({ type: 'getWords' });
          setShowSettings(false);
          break;
        // 缓存清理完成，更新显示
        case 'cacheCleared':
          setCacheSize(msg.cacheSize || '0KB');
          break;
        // 用户变更了单词本存储路径
        case 'wordbookPathChanged':
          setPathDisplay(msg.path || '');
          setSettings((s) => ({ ...s, 'wordbook.path': msg.rawPath || '', 'wordbook.resolvedPath': msg.path || '' }));
          break;
        // 历史记录清空（目前无需额外处理）
        case 'historyCleared':
          break;
      }
    });
    // 主动向宿主请求初始数据
    postHost({ type: 'getWords' });
    postHost({ type: 'getSettings' });
    // 组件卸载时移除消息监听器，防止内存泄漏
    return off;
  }, []);

  /* ── 全局点击 / 窗口失焦时关闭"更多"菜单和右键菜单 ── */
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      // 点击发生在"更多"容器内部时不关闭（由内部 toggle 逻辑处理）
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false);
      setCtxMenu(null);
    };
    const onBlur = () => {
      setShowMore(false);
      setCtxMenu(null);
    };
    document.addEventListener('click', onDocClick);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  /* ── 键盘快捷键：Ctrl/Cmd+F 切换搜索，Escape 关闭搜索 ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        toggleSearch(true);
      }
      if (e.key === 'Escape' && showSearch) toggleSearch(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }); // 无依赖数组，每次渲染都重绑以获取最新的 showSearch 值

  // 切换搜索栏显示状态；打开时自动聚焦并选中输入内容
  const toggleSearch = (show: boolean) => {
    setShowSearch(show);
    if (show) {
      setTimeout(() => searchInputRef.current?.select(), 0);
    } else {
      setSearchQuery('');
    }
  };

  // 向宿主发送 VS Code 命令执行请求
  const runCommand = (command: string) => postHost({ type: 'command', command });

  /* ── 排序相关 ── */
  const sortLabel = sortMode === 'asc' ? 'A-Z' : sortMode === 'desc' ? 'Z-A' : '时间';
  const cycleSort = () => setSortMode((m) => (m === 'time' ? 'asc' : m === 'asc' ? 'desc' : 'time'));
  const toggleWordSort = () => setSortMode((m) => (m === 'asc' ? 'desc' : 'asc'));

  // 根据搜索关键词和排序模式，计算出最终要渲染的条目列表
  const sortedList = (() => {
    const filtered = !searchQuery
      ? entries
      : entries.filter((e) => {
          const w = (e.original || '').toLowerCase();
          const t = (e.translation || '').toLowerCase();
          return w.includes(searchQuery) || t.includes(searchQuery);
        });
    return [...filtered].sort((a, b) => {
      if (sortMode === 'asc') return a.original.localeCompare(b.original);
      if (sortMode === 'desc') return b.original.localeCompare(a.original);
      return (b.addedAt || 0) - (a.addedAt || 0);
    });
  })();

  // 打开词条详情：选中条目并通知宿主展示详情页
  const openRow = (entry: WordBookEntry) => {
    setSelectedId(entry.id);
    postHost({ type: 'detail', entry });
  };
  // 行右键菜单：阻止默认菜单，记录鼠标位置用于渲染自定义菜单
  const onRowContext = (e: React.MouseEvent, entry: WordBookEntry) => {
    e.preventDefault();
    setSelectedId(entry.id);
    setCtxMenu({ x: e.clientX, y: e.clientY, entry });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--vscode-sideBar-background)] text-[var(--vscode-sideBar-foreground)]">
      {/* ── Toolbar ── */}
      <div className="flex flex-shrink-0 items-center gap-0.5 border-b border-[var(--vscode-widget-border)] px-1.5 py-[3px]">
        <button
          type="button"
          title={`排序(当前: ${sortLabel})`}
          className="inline-flex cursor-pointer items-center gap-1 rounded-[4px] border-0 bg-transparent p-[3px_6px] leading-none text-[var(--vscode-sideBar-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]"
          onClick={cycleSort}
        >
          <ArrowUpDown className="size-[15px]" />
          <span className="text-[11px] leading-none text-[var(--vscode-descriptionForeground)]">{sortLabel}</span>
        </button>
        <div className="flex-1" />
        <button
          type="button"
          title="刷新"
          className="inline-flex cursor-pointer items-center gap-1 rounded-[4px] border-0 bg-transparent p-[3px_6px] leading-none text-[var(--vscode-sideBar-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]"
          onClick={() => postHost({ type: 'refresh' })}
        >
          <RefreshCw className="size-[15px]" />
        </button>
        <button
          type="button"
          title="每日一词"
          className="inline-flex cursor-pointer items-center gap-1 rounded-[4px] border-0 bg-transparent p-[3px_6px] leading-none text-[var(--vscode-sideBar-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]"
          onClick={() => runCommand('translation.wordOfDay')}
        >
          <Lightbulb size={15} color="#fff700" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          title="设置"
          className={cn(
            'inline-flex cursor-pointer items-center gap-1 rounded-[4px] border-0 bg-transparent p-[3px_6px] leading-none text-[var(--vscode-sideBar-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]',
            showSettings && 'bg-[var(--vscode-list-activeSelectionBackground)]',
          )}
          onClick={() => {
            if (showSettings) {
              setShowSettings(false);
            } else {
              postHost({ type: 'getSettings' });
              setShowMore(false);
              setShowSettings(true);
            }
          }}
        >
          <Settings className="size-[15px]" />
        </button>
        <div className="relative" ref={moreRef}>
          <button
            type="button"
            title="更多选项"
            className="inline-flex min-w-[24px] cursor-pointer items-center justify-center rounded-[4px] border-0 bg-transparent p-[2px_6px_4px] text-[14px] font-bold leading-none tracking-[1px] text-[var(--vscode-sideBar-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]"
            onClick={(e) => {
              e.stopPropagation();
              setShowMore((v) => !v);
            }}
          >
           
            <MoreHorizontal size={15} />
          </button>

          {/* ── More dropdown ── */}
          {showMore && (
            <div className="absolute right-0 top-full z-[1000] mt-0.5 min-w-[200px] rounded-[6px] border border-[var(--vscode-menu-border)] bg-[var(--vscode-menu-background)] py-1 text-[var(--vscode-menu-foreground)] shadow-lg">
              <div
                className="flex cursor-pointer items-center gap-2.5 px-3.5 py-1.5 text-[13px] hover:bg-[var(--vscode-menu-selectionBackground)] hover:text-[var(--vscode-menu-selectionForeground)]"
                onClick={() => {
                  setShowMore(false);
                  runCommand('translation.wordbook.import');
                }}
              >
                <Download className="size-[15px] text-[var(--vscode-descriptionForeground)] hover:text-inherit" />
                <span className="flex-1">导入</span>
              </div>
              <div className="group relative">
                <div className="flex cursor-pointer items-center gap-2.5 px-3.5 py-1.5 text-[13px] hover:bg-[var(--vscode-menu-selectionBackground)] hover:text-[var(--vscode-menu-selectionForeground)]">
                  <Upload className="size-[15px] text-[var(--vscode-descriptionForeground)]" />
                  <span className="flex-1">导出</span>
                  <span className="text-[9px] opacity-50">▶</span>
                </div>
                <div className="absolute left-full top-0 hidden min-w-[200px] rounded-[6px] border border-[var(--vscode-menu-border)] bg-[var(--vscode-menu-background)] py-1 text-[var(--vscode-menu-foreground)] shadow-lg group-hover:block">
                  <div
                    className="flex cursor-pointer items-center gap-2 px-3.5 py-1.5 text-[13px] hover:bg-[var(--vscode-menu-selectionBackground)] hover:text-[var(--vscode-menu-selectionForeground)]"
                    onClick={() => {
                      setShowMore(false);
                      runCommand('translation.wordbook.exportJson');
                    }}
                  >
                    JSON 格式<span className="ml-auto text-[11px] opacity-80">完整数据</span>
                  </div>
                  <div
                    className="flex cursor-pointer items-center gap-2 px-3.5 py-1.5 text-[13px] hover:bg-[var(--vscode-menu-selectionBackground)] hover:text-[var(--vscode-menu-selectionForeground)]"
                    onClick={() => {
                      setShowMore(false);
                      runCommand('translation.wordbook.exportTxt');
                    }}
                  >
                    TXT 格式<span className="ml-auto text-[11px] opacity-80">单词+释义</span>
                  </div>
                  <div
                    className="flex cursor-pointer items-center gap-2 px-3.5 py-1.5 text-[13px] hover:bg-[var(--vscode-menu-selectionBackground)] hover:text-[var(--vscode-menu-selectionForeground)]"
                    onClick={() => {
                      setShowMore(false);
                      runCommand('translation.wordbook.exportXml');
                    }}
                  >
                    XML 格式<span className="ml-auto text-[11px] opacity-80">结构化</span>
                  </div>
                </div>
              </div>
              <div className="my-1 h-px bg-[var(--vscode-menu-separatorBackground)]" />
              <div
                className="flex cursor-pointer items-center gap-2.5 px-3.5 py-1.5 text-[13px] hover:bg-[var(--vscode-menu-selectionBackground)] hover:text-[var(--vscode-menu-selectionForeground)]"
                onClick={() => {
                  setShowMore(false);
                  toggleSearch(true);
                }}
              >
                <Search class="size-[15px] text-[var(--vscode-descriptionForeground)]" />
                <span className="flex-1">快速搜索</span>
                <span className="text-[11px] text-[var(--vscode-descriptionForeground)] opacity-80">Ctrl+F</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Search bar ── */}
      {showSearch && (
        <div className="flex flex-shrink-0 items-center gap-1.5 border-b border-[var(--vscode-widget-border)] bg-[var(--vscode-sideBar-background)] px-2 py-1">
          <Search className="size-[15px] text-[var(--vscode-descriptionForeground)]" />
          <Input
            ref={searchInputRef}
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.trim().toLowerCase())}
            onKeyDown={(e) => {
              if (e.key === 'Escape') toggleSearch(false);
            }}
            className="flex-1 text-[12px]"
            placeholder="搜索单词或释义..."
          />
          {searchQuery && (
            <span className="whitespace-nowrap text-[11px] text-[var(--vscode-descriptionForeground)]">
              {sortedList.length} / {entries.length}
            </span>
          )}
          <button
            type="button"
            title="关闭搜索"
            className="cursor-pointer rounded-[3px] border-0 bg-transparent p-0.5 leading-none text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-sideBar-foreground)]"
            onClick={() => toggleSearch(false)}
          >
            <X className="size-[15px]" />
          </button>
        </div>
      )}

      {/* ── Main ── */}
      {showSettings ? (
        <SettingsView
          settings={settings}
          pathDisplay={pathDisplay}
          cacheSize={cacheSize}
          apiKey={apiKey}
          onSettingsChange={setSettings}
          onSave={() => {
            postHost({ type: 'saveSettings', settings: collectSettings(settings) });
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
          onClearCache={() => postHost({ type: 'clearCache' })}
          onClearHistory={() => postHost({ type: 'clearHistory' })}
          onBrowseWordbookPath={() => postHost({ type: 'browseWordbookPath' })}
          onRestoreWordbookPath={() => setPathDisplay('')}
          onOpenAIOpen={() => setOpenaiModal(true)}
          onTTSSetup={() => setTtsModal(true)}
        />
      ) : (
        <TableView
          entries={sortedList}
          totalCount={entries.length}
          searchQuery={searchQuery}
          selectedId={selectedId}
          onRowClick={openRow}
          onRowContext={onRowContext}
          onWordColClick={toggleWordSort}
          onOpenDialog={() => runCommand('translation.showDialog')}
          onClearSearch={() => toggleSearch(false)}
        />
      )}

      {/* ── Context menu ── */}
      {ctxMenu && (
        <div
          className="fixed z-[1000] min-w-[200px] rounded-[6px] border border-[var(--vscode-menu-border)] bg-[var(--vscode-menu-background)] py-1 text-[var(--vscode-menu-foreground)] shadow-lg"
          style={clampPos(ctxMenu.x, ctxMenu.y, 200, 116)}
          onClick={(e) => e.stopPropagation()}
        >
          <CtxItem icon={<Copy size={16} />} label="复制" onClick={() => { postHost({ type: 'copy', entry: ctxMenu.entry }); setCtxMenu(null); }} />
          <CtxItem icon={<Volume2 size={16} />} label="朗读" onClick={() => { postHost({ type: 'speak', entry: ctxMenu.entry }); setCtxMenu(null); }} />
          <div className="my-1 h-px bg-[var(--vscode-menu-separatorBackground)]" />
          <CtxItem icon={<Trash size={16} color="#ff0000" strokeWidth={3} />} label="删除" onClick={() => { postHost({ type: 'delete', entry: ctxMenu.entry }); setCtxMenu(null); }} />
        </div>
      )}

      {/* ── Modals ── */}
      <OpenaiDialog
        open={openaiModal}
        onOpenChange={setOpenaiModal}
        settings={settings}
        apiKey={apiKey}
        onSave={(patch) => setSettings((s) => ({ ...s, ...patch }))}
      />
      
      <TtsDialog
        open={ttsModal}
        onOpenChange={setTtsModal}
        settings={settings}
        onSave={(patch) => setSettings((s) => ({ ...s, ...patch }))}
      />
    </div>
  );
}


// 右键菜单位置边界约束：防止菜单超出视窗范围
function clampPos(x: number, y: number, w: number, h: number) {
  let left = x;
  let top = y;
  if (left + w > window.innerWidth - 4) left = window.innerWidth - w - 4;
  if (left < 4) left = 4;
  if (top + h > window.innerHeight - 4) top = window.innerHeight - h - 4;
  if (top < 4) top = 4;
  return { left, top };
}

// 右键菜单项：统一的图标 + 标签布局
function CtxItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <div
      className="flex cursor-pointer items-center gap-2.5 px-3.5 py-1.5 text-[13px] hover:bg-[var(--vscode-menu-selectionBackground)] hover:text-[var(--vscode-menu-selectionForeground)]"
      onClick={onClick}
    >
      <span className="text-[var(--vscode-descriptionForeground)]">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

/* ────────────────── 表格视图 ────────────────── */

// 搜索命中高亮：在原始文本中用 <mark> 标签标记匹配关键词的位置
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-[2px] px-px bg-[var(--vscode-editor-findMatchHighlightBackground,rgba(234,92,0,0.4))] text-inherit">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function TableView({
  entries,
  totalCount,
  searchQuery,
  selectedId,
  onRowClick,
  onRowContext,
  onWordColClick,
  onOpenDialog,
  onClearSearch,
}: {
  entries: WordBookEntry[];
  totalCount: number;
  searchQuery: string;
  selectedId: number | null;
  onRowClick: (e: WordBookEntry) => void;
  onRowContext: (e: React.MouseEvent, entry: WordBookEntry) => void;
  onWordColClick: () => void;
  onOpenDialog: () => void;
  onClearSearch: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  // 搜索关键词变化时，自动滚动到第一个匹配项
  useEffect(() => {
    if (!searchQuery) return;
    const firstRow = listRef.current?.querySelector<HTMLElement>('.row[data-match="true"]');
    firstRow?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [entries, searchQuery]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid flex-shrink-0 select-none grid-cols-[1fr_1fr] border-b border-[var(--vscode-widget-border)] px-[10px] py-1 text-[11px] font-semibold uppercase tracking-[0.5px] text-[var(--vscode-descriptionForeground)]">
        <span className="cursor-pointer" onClick={onWordColClick}>
          单词
        </span>
        <span>释义</span>
      </div>

      {totalCount === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-[13px] leading-[1.6] text-[var(--vscode-descriptionForeground)]">
          <span>
            生词本为空。
            <br />
            <a className="cursor-pointer text-[var(--vscode-textLink-foreground)]" onClick={onOpenDialog}>
              打开翻译弹窗
            </a>{' '}
            翻译后点「存词」即可收藏。
          </span>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-[13px] leading-[1.6] text-[var(--vscode-descriptionForeground)]">
          <span>
            没有找到匹配的单词。
            <br />
            <a className="cursor-pointer text-[var(--vscode-textLink-foreground)]" onClick={onClearSearch}>
              清除搜索
            </a>
          </span>
        </div>
      ) : (
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {entries.map((e) => {
            const isMatch = !!(
              searchQuery &&
              ((e.original || '').toLowerCase().includes(searchQuery) ||
                (e.translation || '').toLowerCase().includes(searchQuery))
            );
            const selected = e.id === selectedId;
            return (
              <div
                key={e.id}
                data-match={isMatch}
                className={cn(
                  'row grid cursor-pointer grid-cols-[1fr_1fr] items-start border-b px-[10px] py-[7px] hover:bg-[var(--vscode-list-hoverBackground)]',
                  selected &&
                    'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]',
                )}
                style={{ borderBottomColor: 'var(--vscode-tree-indentGuidesStroke, rgba(128,128,128,0.2))' }}
                onClick={() => onRowClick(e)}
                onContextMenu={(ev) => onRowContext(ev, e)}
              >
                <div className="break-words pr-2 text-[14px] font-semibold">
                  <Highlight text={e.original} query={searchQuery} />
                </div>
                <div
                  className={cn(
                    'break-words whitespace-pre-wrap border-l border-[var(--vscode-widget-border)] pl-2 text-[12px] leading-[1.4] text-[var(--vscode-descriptionForeground)]',
                    selected && 'text-[var(--vscode-list-activeSelectionForeground)] opacity-90',
                  )}
                >
                  <Highlight text={e.translation || ''} query={searchQuery} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ────────────────── 带图标的下拉选择器 ────────────────── */

// 自定义 Select 组件，选中项左侧显示引擎图标；点击外部关闭
function Psel({
  value,
  options,
  onChange,
  className,
}: {
  value: string;
  options: { value: string; label: string; engine: string }[];
  onChange: (v: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 点击外部时关闭下拉菜单
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const sel = options.find((o) => o.value === value) ?? options[0];
  if (!sel) return null;

  return (
    <div ref={ref} className={cn('relative min-w-[200px] max-w-[240px]', className)}>
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-2 rounded-[2px] border border-[var(--vscode-input-border,transparent)] bg-[var(--vscode-input-background)] px-[7px] py-[5px] text-left text-[12px] leading-none text-[var(--vscode-input-foreground)] hover:border-[var(--vscode-widget-border)]"
        onClick={() => setOpen((v) => !v)}
      >
        <EngineIcon engine={sel.engine} />
        <span className="flex-1 overflow-hidden truncate leading-[1.2]">{sel.label}</span>
        <ArrowUpDown className="size-[15px] opacity-70" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-[9999] mt-0.5 min-w-full rounded-[4px] border border-[var(--vscode-menu-border)] bg-[var(--vscode-menu-background)] py-[3px] text-[var(--vscode-menu-foreground)] shadow-md">
          {options.map((o) => (
            <div
              key={o.value}
              className={cn(
                'flex cursor-pointer items-center gap-2 px-2.5 py-[5px] text-[12px] hover:bg-[var(--vscode-menu-selectionBackground)] hover:text-[var(--vscode-menu-selectionForeground)]',
                o.value === value && 'font-semibold',
              )}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <EngineIcon engine={o.engine} />
              <span>{o.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 小齿轮图标按钮，用于在设置项旁打开高级配置弹窗
function GearBtn({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      className="flex cursor-pointer items-center rounded-[3px] border-0 bg-transparent p-0.5 text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-sideBar-foreground)]"
      onClick={onClick}
    >
      <Settings class="size-[15px]" />
    </button>
  );
}

/* ────────────────── 设置面板 ────────────────── */

// 设置面板中的分组区块（带标题 + 底部边框）
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--vscode-widget-border)] px-3.5 py-3 last:border-b-0">
      <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[1.2px] text-[var(--vscode-descriptionForeground)]">
        {title}
      </h3>
      {children}
    </div>
  );
}

// 设置面板中的行布局：左侧标签 + 右侧控件
function FieldRow({
  label,
  labelWidth = 100,
  className,
  children,
}: {
  label: string;
  labelWidth?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('mb-2 flex min-h-[28px] items-center gap-2', className)}>
      <span className="flex-shrink-0 text-right text-[12px] leading-[1.4]" style={{ flexBasis: labelWidth }}>
        {label}
      </span>
      <div className="flex flex-1 items-center gap-1">{children}</div>
    </div>
  );
}

// 复选框行：可以带缩进用于子选项
function CheckRow({
  label,
  checked,
  onChange,
  indent,
  className,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  indent?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn('mb-1.5 flex cursor-pointer select-none items-center gap-2 text-[12px]', className)}
      style={indent ? { marginLeft: 20 } : undefined}
    >
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      <span className="leading-[1.4]">{label}</span>
    </label>
  );
}

// 语言下拉选择器：封装了国家代码与中文名的映射
function LangSelect({
  value,
  onChange,
  includeAuto,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  includeAuto: boolean;
  className?: string;
}) {
  const codes = includeAuto ? LANG_CODES : LANG_CODES.filter((c) => c !== 'auto');
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn('min-w-[200px] max-w-[240px]', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {codes.map((c) => (
          <SelectItem key={c} value={c}>
            {LANG_NAMES[c] || c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SettingsView({
  settings,
  pathDisplay,
  cacheSize,
  apiKey,
  onSettingsChange,
  onSave,
  onClose,
  onClearCache,
  onClearHistory,
  onBrowseWordbookPath,
  onRestoreWordbookPath,
  onOpenAIOpen,
  onTTSSetup,
}: {
  settings: SettingsShape;
  pathDisplay: string;
  cacheSize: string;
  apiKey: string;
  onSettingsChange: (s: SettingsShape) => void;
  onSave: () => void;
  onClose: () => void;
  onClearCache: () => void;
  onClearHistory: () => void;
  onBrowseWordbookPath: () => void;
  onRestoreWordbookPath: () => void;
  onOpenAIOpen: () => void;
  onTTSSetup: () => void;
}) {
  // 便捷更新函数：修改单个设置项后创建新对象触发 state 更新
  const update = (key: string, value: unknown) => onSettingsChange({ ...settings, [key]: value });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {/* 常规 */}
      <Section title="常规">
        <FieldRow label="翻译引擎:">
          <Psel
            className="flex-1"
            value={str(settings, 'defaultEngine', 'microsoft')}
            options={ENGINE_OPTIONS}
            onChange={(v) => update('defaultEngine', v)}
          />
          {str(settings, 'defaultEngine', 'microsoft') === 'openai' && (
            <GearBtn title="引擎高级设置" onClick={onOpenAIOpen} />
          )}
        </FieldRow>
        <FieldRow label="TTS 引擎:">
          <Psel
            className="flex-1"
            value={str(settings, 'ttsEngine', 'edge')}
            options={TTS_ENGINE_OPTIONS}
            onChange={(v) => update('ttsEngine', v)}
          />
          {(str(settings, 'ttsEngine', 'edge') === 'openai' || str(settings, 'ttsEngine', 'edge') === 'edge') && (
            <GearBtn title="TTS 高级设置" onClick={onTTSSetup} />
          )}
        </FieldRow>
        <FieldRow label="主要语言:">
          <LangSelect value={str(settings, 'mainLanguage', 'zh-CN')} onChange={(v) => update('mainLanguage', v)} includeAuto={false} />
        </FieldRow>
        <FieldRow label="源语言:">
          <LangSelect value={str(settings, 'sourceLanguage', 'auto')} onChange={(v) => update('sourceLanguage', v)} includeAuto />
        </FieldRow>
        <FieldRow label="目标语言:">
          <LangSelect value={str(settings, 'targetLanguage', 'zh-CN')} onChange={(v) => update('targetLanguage', v)} includeAuto={false} />
        </FieldRow>
      </Section>

      {/* 字体 */}
      <Section title="字体">
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-[12px]">主要字体:</label>
            <Select value={str(settings, 'font.family')} onValueChange={(v) => update('font.family', v === '__default__' ? '' : v)}>
              <SelectTrigger className="min-w-[200px] max-w-[240px]">
                <SelectValue placeholder="留空使用默认字体" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__" className="text-[var(--vscode-descriptionForeground)]">默认字体</SelectItem>
                {FONT_LIST.map((f) => (
                  <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div
              className="mt-1 flex min-h-[36px] items-center justify-center rounded-[3px] border border-[var(--vscode-widget-border)] bg-[var(--vscode-input-background)] px-2.5 py-2 text-center text-[13px] leading-[1.5]"
              style={{ fontFamily: str(settings, 'font.family').trim() || undefined }}
            >
              海内存知己·天涯若比邻
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-[12px]">注音字体:</label>
            <Select value={str(settings, 'font.phonetic')} onValueChange={(v) => update('font.phonetic', v === '__default__' ? '' : v)}>
              <SelectTrigger className="min-w-[200px] max-w-[240px]">
                <SelectValue placeholder="留空使用默认字体" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__" className="text-[var(--vscode-descriptionForeground)]">默认字体</SelectItem>
                {FONT_LIST.map((f) => (
                  <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div
              className="mt-1 flex min-h-[36px] items-center justify-center rounded-[3px] border border-[var(--vscode-widget-border)] bg-[var(--vscode-input-background)] px-2.5 py-2 text-center text-[13px] leading-[1.5]"
              style={{ fontFamily: str(settings, 'font.phonetic').trim() || undefined }}
            >
              <span
                className="text-[14px] tracking-[1px]"
                style={{ fontFamily: "'Segoe UI', 'Charis SIL', 'Doulos SIL', serif" }}
              >
                iː ɛ ɔː uː ɑː ɪ ɘ ɔ u ɐ ɛ ʌ ɑɪ ɛɪ ɔɪ ɪə ɛə ʊə
              </span>
            </div>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button
            variant="secondary"
            onClick={() => {
              update('font.family', '');
              update('font.phonetic', '');
            }}
          >
            恢复默认设置
          </Button>
        </div>
      </Section>

      {/* 翻译弹出窗 */}
      <Section title="翻译弹出窗">
        <CheckRow label="悬停翻译" checked={bool(settings, 'hover.enabled')} onChange={(v) => update('hover.enabled', v)} />
        <CheckRow label="函数文档翻译" checked={bool(settings, 'hover.docTranslation')} onChange={(v) => update('hover.docTranslation', v)} />
        <CheckRow label="自动复制译文" checked={bool(settings, 'popup.autoCopy')} onChange={(v) => update('popup.autoCopy', v)} />
        <FieldRow label="自动朗读:" className="mt-1.5">
          <Select value={str(settings, 'popup.autoRead', 'none')} onValueChange={(v) => update('popup.autoRead', v)}>
            <SelectTrigger className="min-w-[200px] max-w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">不朗读</SelectItem>
              <SelectItem value="original">原文</SelectItem>
              <SelectItem value="translation">译文</SelectItem>
              <SelectItem value="both">原文和译文</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="弹窗位置:">
          <Select value={str(settings, 'popup.position', 'cursor')} onValueChange={(v) => update('popup.position', v)}>
            <SelectTrigger className="min-w-[200px] max-w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cursor">跟随光标</SelectItem>
              <SelectItem value="center">居中</SelectItem>
              <SelectItem value="mouse">跟随鼠标</SelectItem>
            </SelectContent>
          </Select>
          <span className="inline-flex cursor-help items-center text-[13px] text-[var(--vscode-descriptionForeground)]" title="翻译弹窗的显示位置">
            ❓
          </span>
        </FieldRow>
      </Section>

      {/* 文本选择 */}
      <Section title="文本选择">
        <CheckRow label="自动去除标点符号" checked={bool(settings, 'textSelection.stripPunctuation')} onChange={(v) => update('textSelection.stripPunctuation', v)} />
        <CheckRow label="保留内容格式" checked={bool(settings, 'textSelection.preserveFormat')} onChange={(v) => update('textSelection.preserveFormat', v)} />
        <CheckRow label="打开翻译对话框时取词" checked={bool(settings, 'textSelection.autoCapture')} onChange={(v) => update('textSelection.autoCapture', v)} />
        <div className="my-0.5 flex items-center gap-1.5" style={{ marginLeft: 24 }}>
          <input
            type="text"
            placeholder="如 [\*/#$]"
            value={str(settings, 'textSelection.regexFilter')}
            onChange={(e) => update('textSelection.regexFilter', e.target.value)}
            className="flex-1 rounded-[2px] border border-[var(--vscode-input-border,transparent)] bg-[var(--vscode-input-background)] px-1.5 py-1 text-[12px] text-[var(--vscode-input-foreground)] outline-none"
            style={{ fontFamily: 'var(--vscode-editor-font-family, monospace)' }}
          />
          <span className="inline-flex cursor-help items-center text-[13px] text-[var(--vscode-descriptionForeground)]" title="正则表达式，匹配的字符将在翻译前被移除">
            ❓
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-[var(--vscode-descriptionForeground)]" style={{ marginLeft: 24 }}>
          正则表达式，匹配的字符将在翻译前被移除
        </div>
      </Section>

      {/* 翻译并替换 */}
      <Section title="翻译并替换">
        <CheckRow label="翻译前选择语言" checked={bool(settings, 'replace.selectLanguageFirst')} onChange={(v) => update('replace.selectLanguageFirst', v)} />
        <CheckRow label="使用上次选择的语言" indent checked={bool(settings, 'replace.useLastLanguage')} onChange={(v) => update('replace.useLastLanguage', v)} />
        <CheckRow label="加入到上下文菜单" checked={bool(settings, 'replace.contextMenu')} onChange={(v) => update('replace.contextMenu', v)} />
        <CheckRow label="如果结果只有一个，则自动替换" checked={bool(settings, 'replace.autoReplace')} onChange={(v) => update('replace.autoReplace', v)} />
        <FieldRow label="分隔符:" className="mt-1.5">
          <Select value={str(settings, 'replaceSeparator', 'original')} onValueChange={(v) => update('replaceSeparator', v)}>
            <SelectTrigger className="min-w-[200px] max-w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="original">原文</SelectItem>
              <SelectItem value="camelCase">camelCase</SelectItem>
              <SelectItem value="snake_case">snake_case</SelectItem>
              <SelectItem value="PascalCase">PascalCase</SelectItem>
              <SelectItem value="kebab-case">kebab-case</SelectItem>
            </SelectContent>
          </Select>
          <span className="inline-flex cursor-help items-center text-[13px] text-[var(--vscode-descriptionForeground)]" title="替换翻译时使用的分隔符样式">
            ❓
          </span>
        </FieldRow>
      </Section>

      {/* 每日单词 */}
      <Section title="每日单词">
        <CheckRow label="启动时显示每日单词" checked={bool(settings, 'wordOfDay.autoShow')} onChange={(v) => update('wordOfDay.autoShow', v)} />
        <CheckRow label="显示单词释义" checked={bool(settings, 'wordOfDay.showDefinition')} onChange={(v) => update('wordOfDay.showDefinition', v)} />
      </Section>

      {/* 单词本 */}
      <Section title="单词本">
        <FieldRow label="存储路径:">
          <input
            type="text"
            readOnly
            placeholder="点击浏览选择路径..."
            value={pathDisplay}
            onClick={onBrowseWordbookPath}
            className="flex-1 cursor-pointer rounded-[2px] border border-[var(--vscode-input-border,transparent)] bg-[var(--vscode-input-background)] px-1.5 py-1 text-[12px] text-[var(--vscode-input-foreground)] outline-none"
          />
          <Button
            variant="secondary"
            className="whitespace-nowrap !h-auto !px-2.5 text-[12px]"
            title="浏览..."
            onClick={onBrowseWordbookPath}
          >
            浏览...
          </Button>
        </FieldRow>
        <FieldRow label="">
          <Button variant="secondary" className="!h-auto !px-2.5 text-[12px]" title="恢复默认路径" onClick={onRestoreWordbookPath}>
            恢复默认
          </Button>
        </FieldRow>
        <div className="mt-1 text-[11px] text-[var(--vscode-descriptionForeground)]">
          要使用 iCloud Drive、Google Drive、One Drive 和 Dropbox 等同步服务，只需将存储路径设置到相应的同步文件夹内即可。
        </div>
      </Section>

      {/* 缓存和历史记录 */}
      <Section title="缓存和历史记录">
        <FieldRow label="磁盘缓存:">
          <span className="mr-2 text-[var(--vscode-descriptionForeground)]">{cacheSize}</span>
          <Button variant="secondary" className="!h-auto !px-3 text-[12px]" onClick={onClearCache}>
            清除
          </Button>
        </FieldRow>
        <FieldRow label="最大历史数:">
          <Select value={String(Number(settings['history.maxEntries'] ?? 100))} onValueChange={(v) => update('history.maxEntries', Number(v))}>
            <SelectTrigger className="!w-auto min-w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[20, 50, 100, 200, 500].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="secondary" className="ml-2 !h-auto !px-3 text-[12px]" onClick={onClearHistory}>
            清除历史记录
          </Button>
        </FieldRow>
      </Section>

      {/* 其他 */}
      <Section title="其他">
        <CheckRow label="自动翻译文档" checked={bool(settings, 'autoTranslateDocument')} onChange={(v) => update('autoTranslateDocument', v)} />
        <CheckRow label="仅当文本被选中时，右键菜单显示翻译操作" checked={bool(settings, 'contextMenuOnlyWithSelection')} onChange={(v) => update('contextMenuOnlyWithSelection', v)} />
      </Section>

      {/* 保存/取消（sticky 粘底，与旧版 wordBookWebview.html settings-actions 一致） */}
      <div className="sticky bottom-0 z-10 mt-[14px] flex justify-end gap-2 border-t border-[var(--vscode-widget-border)] bg-[var(--vscode-editor-background)] px-[14px] py-[10px]">
        <Button variant="secondary" onClick={onClose}>
          取消
        </Button>
        <Button onClick={onSave}>保存</Button>
      </div>
    </div>
  );
}

/* ────────────────── OpenAI 高级配置弹窗 ────────────────── */

// OpenAI 官方及常见兼容服务商的已知模型列表
const KNOWN_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'];

// 当用户选择了 OpenAI 翻译引擎时弹出的配置对话框（模型、API 端点、密钥）
function OpenaiDialog({
  open,
  onOpenChange,
  settings,
  apiKey,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  settings: SettingsShape;
  apiKey: string;
  onSave: (patch: Partial<SettingsShape>) => void;
}) {
  const current = str(settings, 'openai.model', 'gpt-4o-mini');
  const [model, setModel] = useState(current);
  const [customChecked, setCustomChecked] = useState(false);
  const [customModel, setCustomModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com');
  const [keyInput, setKeyInput] = useState('');

  // 弹窗打开时，用当前设置初始化表单值
  useEffect(() => {
    if (!open) return;
    setBaseUrl(str(settings, 'openai.baseUrl', 'https://api.openai.com'));
    setKeyInput('');
    // 如果当前使用的是已知列表外的模型，则自动切换到"自定义"模式
    if (current && !KNOWN_MODELS.includes(current)) {
      setModel('custom');
      setCustomChecked(true);
      setCustomModel(current);
    } else {
      setModel(current);
      setCustomChecked(false);
      setCustomModel('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 模型选择变化：同步更新"自定义"模式开关
  const handleModelChange = (v: string) => {
    setModel(v);
    setCustomChecked(v === 'custom');
  };

  // 确认保存：组装配置 patch 并通知宿主
  const handleOk = () => {
    const finalModel = customChecked ? customModel.trim() || 'gpt-4o-mini' : model;
    const patch: Partial<SettingsShape> = {
      'openai.model': finalModel,
      'openai.baseUrl': baseUrl || 'https://api.openai.com',
    };
    // 只有用户实际输入了密钥才覆盖（为空表示不修改已保存的密钥）
    if (keyInput) (patch as Record<string, unknown>)['openai.apiKey'] = keyInput;
    onSave(patch);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px] gap-0 overflow-y-auto rounded-[8px] p-0">
        <div className="flex items-center gap-2 border-b border-[var(--vscode-widget-border)] px-3.5 py-2.5">
          <EngineIcon engine="openai" />
          <span className="flex-1 text-[13px] font-semibold">OpenAI 翻译配置</span>
        </div>
        <div className="px-3.5 py-3">
          <FieldRow label="服务商:" labelWidth={90}>
            <Psel
              className="flex-1"
              value="openai"
              options={[{ value: 'openai', label: 'OpenAI', engine: 'openai' }]}
              onChange={() => {}}
            />
          </FieldRow>
          <FieldRow label="模型:" labelWidth={90}>
            <Select value={model} onValueChange={handleModelChange}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                <SelectItem value="gpt-4-turbo">gpt-4-turbo</SelectItem>
                <SelectItem value="gpt-3.5-turbo">gpt-3.5-turbo</SelectItem>
                <SelectItem value="custom">自定义...</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--vscode-descriptionForeground)]" style={{ marginLeft: 90 }}>
            <Checkbox
              checked={customChecked}
              onCheckedChange={(v) => {
                const chk = !!v;
                setCustomChecked(chk);
                if (chk) {
                  setModel('custom');
                } else {
                  if (model === 'custom') setModel('gpt-4o-mini');
                }
              }}
            />
            <span>自定义模型</span>
            {customChecked && (
              <input
                type="text"
                autoFocus
                placeholder="输入模型名称"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                className="ml-1 flex-1 rounded-[2px] border border-[var(--vscode-input-border,transparent)] bg-[var(--vscode-input-background)] px-1 py-[3px] text-[12px] text-[var(--vscode-input-foreground)] outline-none"
              />
            )}
          </div>
          <FieldRow label="API 端点:" labelWidth={90} className="mt-2">
            <div className="flex flex-1">
              <input
                type="text"
                placeholder="https://api.openai.com"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full flex-1 rounded-l-[2px] border border-r-0 border-[var(--vscode-input-border,transparent)] bg-[var(--vscode-input-background)] px-1.5 py-1 text-[12px] text-[var(--vscode-input-foreground)] outline-none"
              />
              <input
                type="text"
                readOnly
                value="/v1/chat/completions"
                className="w-[160px] flex-none rounded-r-[2px] border border-[var(--vscode-input-border,transparent)] bg-[var(--vscode-input-background)] px-1.5 py-1 text-[11px] text-[var(--vscode-descriptionForeground)] outline-none"
              />
            </div>
          </FieldRow>
          <FieldRow label="API 密钥:" labelWidth={90}>
            <input
              type="password"
              placeholder={apiKey ? '已保存(****),输入以更新' : '未配置'}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="flex-1 rounded-[2px] border border-[var(--vscode-input-border,transparent)] bg-[var(--vscode-input-background)] px-1.5 py-1 text-[12px] text-[var(--vscode-input-foreground)] outline-none"
            />
            <span
              className="inline-flex cursor-help items-center text-[13px] text-[var(--vscode-descriptionForeground)]"
              title="API 密钥将安全存储在系统凭据库中"
            >
              ❓
            </span>
          </FieldRow>
        </div>
        <div className="flex items-center gap-2 border-t border-[var(--vscode-widget-border)] px-3.5 py-2.5">
          <span className="inline-flex cursor-help items-center text-[13px] text-[var(--vscode-descriptionForeground)]" title="需要帮助？">
            ❓
          </span>
          <div className="flex-1" />
          <Button className="min-w-[72px]" onClick={handleOk}>
            确定
          </Button>
          <Button variant="secondary" className="min-w-[72px]" onClick={() => onOpenChange(false)}>
            取消
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────── TTS 朗读配置弹窗 ────────────────── */

// 语音合成引擎配置对话框：支持 Microsoft Edge TTS 和 OpenAI TTS
function TtsDialog({
  open,
  onOpenChange,
  settings,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  settings: SettingsShape;
  onSave: (patch: Partial<SettingsShape>) => void;
}) {
  const [provider, setProvider] = useState('edge');
  const [edgeVoice, setEdgeVoice] = useState('');
  const [edgeSpeed, setEdgeSpeed] = useState('0%');
  const [openaiVoice, setOpenaiVoice] = useState('alloy');

  // 弹窗打开时，从当前设置初始化各个表单字段
  useEffect(() => {
    if (!open) return;
    setProvider(str(settings, 'ttsEngine', 'edge'));
    setEdgeVoice(str(settings, 'tts.edge.voice'));
    setEdgeSpeed(str(settings, 'tts.edge.speed', '0%'));
    setOpenaiVoice(str(settings, 'tts.openai.voice', 'alloy'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 保存：组装 TTS 相关配置 patch 并关闭弹窗
  const handleOk = () => {
    onSave({
      ttsEngine: provider,
      'tts.edge.voice': edgeVoice,
      'tts.edge.speed': edgeSpeed,
      'tts.openai.voice': openaiVoice,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px] gap-0 overflow-y-auto rounded-[8px] p-0">
        <div className="flex items-center gap-2 border-b border-[var(--vscode-widget-border)] px-3.5 py-2.5">
          <Volume2 class="size-[15px]" />
          <span className="flex-1 text-[13px] font-semibold">TTS 朗读设置</span>
        </div>
        <div className="px-3.5 py-3">
          <FieldRow label="服务商:" labelWidth={90}>
            <Psel
              className="flex-1"
              value={provider}
              options={TTS_ENGINE_OPTIONS}
              onChange={setProvider}
            />
          </FieldRow>
          {provider === 'edge' && (
            <>
              <FieldRow label="音色:" labelWidth={90} className="mt-2">
                <input
                  type="text"
                  placeholder="如 zh-CN-XiaoxiaoNeural,留空自动"
                  value={edgeVoice}
                  onChange={(e) => setEdgeVoice(e.target.value)}
                  className="flex-1 rounded-[2px] border border-[var(--vscode-input-border,transparent)] bg-[var(--vscode-input-background)] px-1.5 py-1 text-[12px] text-[var(--vscode-input-foreground)] outline-none"
                />
              </FieldRow>
              <FieldRow label="语速:" labelWidth={90}>
                <Select value={edgeSpeed} onValueChange={setEdgeSpeed}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-50%">慢速 (-50%)</SelectItem>
                    <SelectItem value="-25%">较慢 (-25%)</SelectItem>
                    <SelectItem value="0%">正常 (0%)</SelectItem>
                    <SelectItem value="+25%">较快 (+25%)</SelectItem>
                    <SelectItem value="+50%">快速 (+50%)</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
            </>
          )}
          {provider === 'openai' && (
            <FieldRow label="音色:" labelWidth={90} className="mt-2">
              <Select value={openaiVoice} onValueChange={setOpenaiVoice}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-[var(--vscode-widget-border)] px-3.5 py-2.5">
          <span className="inline-flex cursor-help items-center text-[13px] text-[var(--vscode-descriptionForeground)]" title="需要帮助？">
            ❓
          </span>
          <div className="flex-1" />
          <Button className="min-w-[72px]" onClick={handleOk}>
            确定
          </Button>
          <Button variant="secondary" className="min-w-[72px]" onClick={() => onOpenChange(false)}>
            取消
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}