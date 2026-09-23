import { useCallback, useEffect, useRef, useState } from 'react';
import { onHostMessage, postHost } from '../../lib/vscode';
import { mediaSvgUrl } from '../../lib/mediaIcon';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

interface LanguageOption {
  code: string;
  name: string;
  nameZh?: string;
}

interface DictEntry {
  translation: string;
  backTranslations?: string[];
}
interface DictGroup {
  pos?: string;
  term?: string;
  entries?: DictEntry[];
}

interface ExampleItem {
  sourcePrefix: string;
  sourceTerm: string;
  sourceSuffix: string;
  targetPrefix: string;
  targetTerm: string;
  targetSuffix: string;
}

interface TranslationResult {
  original: string;
  translation: string;
  transliteration?: string;
  dict?: DictGroup[];
  examples?: ExampleItem[];
  spelling?: string | null;
  srcLang?: string;
  targetLang?: string;
}

interface HistoryEntry {
  original: string;
  translation: string;
  srcLang: string;
  targetLang: string;
}

type HostMessage =
  | { type: 'languages'; languages: LanguageOption[] }
  | { type: 'init'; srcLang: string; targetLang: string; activeEngine?: string }
  | { type: 'setText'; text: string }
  | { type: 'preFillResult'; result: TranslationResult }
  | { type: 'result'; result: TranslationResult }
  | { type: 'error'; message: string }
  | { type: 'history'; entries: HistoryEntry[] };

export default function App() {
  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const [srcLang, setSrcLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('zh-CN');
  const [activeEngine, setActiveEngine] = useState('');
  const [input, setInput] = useState('');
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const off = onHostMessage<HostMessage>((msg) => {
      switch (msg.type) {
        case 'languages':
          setLanguages(msg.languages);
          break;
        case 'init':
          if (msg.srcLang) setSrcLang(msg.srcLang);
          if (msg.targetLang) setTargetLang(msg.targetLang);
          if (msg.activeEngine) setActiveEngine(msg.activeEngine);
          break;
        case 'setText':
          if (msg.text) {
            setInput(msg.text);
            setTimeout(() => doTranslate(msg.text, undefined, undefined), 0);
          }
          break;
        case 'preFillResult':
          if (msg.result) {
            setInput(msg.result.original || '');
            if (msg.result.srcLang) setSrcLang(msg.result.srcLang);
            if (msg.result.targetLang) setTargetLang(msg.result.targetLang);
            setResult(msg.result);
            setError(null);
          }
          break;
        case 'result':
          setResult(msg.result);
          setError(null);
          setLoading(false);
          break;
        case 'error':
          setError(msg.message);
          setLoading(false);
          break;
        case 'history':
          setHistory(msg.entries);
          break;
      }
    });
    postHost({ type: 'ready' });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doTranslate = useCallback(
    (textOverride?: string, srcOverride?: string, tgtOverride?: string) => {
      const text = (textOverride ?? input).trim();
      if (!text) return;
      const s = srcOverride ?? srcLang ?? 'auto';
      const t = tgtOverride ?? targetLang ?? 'zh-CN';
      setLoading(true);
      setError(null);
      setResult(null);
      postHost({ type: 'translate', text, srcLang: s, targetLang: t });
    },
    [input, srcLang, targetLang],
  );

  const handleSwap = () => {
    const newSrc = targetLang;
    const newTgt = srcLang;
    setSrcLang(newSrc);
    setTargetLang(newTgt);
    postHost({ type: 'setLanguages', srcLang: newSrc, targetLang: newTgt });
    if (input.trim()) {
      doTranslate(undefined, newSrc, newTgt);
    }
  };

  const handleSrcChange = (v: string) => {
    setSrcLang(v);
    postHost({ type: 'setLanguages', srcLang: v, targetLang });
  };
  const handleTgtChange = (v: string) => {
    setTargetLang(v);
    postHost({ type: 'setLanguages', srcLang, targetLang: v });
    if (input.trim()) doTranslate(undefined, undefined, v);
  };

  return (
    <div className="p-3 text-[13px]">
      {/* ── Language bar ── */}
      <div className="mb-2.5 flex items-center gap-1.5">
        <Select value={srcLang} onValueChange={handleSrcChange}>
          <SelectTrigger className="min-w-0 flex-1 h-[26px] text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languages.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.name}{l.nameZh ? ` (${l.nameZh})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          className="cursor-pointer bg-transparent border-0 p-0.5 px-1.5 text-[var(--vscode-editor-foreground)] hover:opacity-80"
          title="Swap languages"
          onClick={handleSwap}
        >
          <img src={mediaSvgUrl('swap')} alt="swap" className="block size-3.5" />
        </button>
        <Select value={targetLang} onValueChange={handleTgtChange}>
          <SelectTrigger className="min-w-0 flex-1 h-[26px] text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languages.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.name}{l.nameZh ? ` (${l.nameZh})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Input ── */}
      <Textarea
        ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
        className="min-h-[90px] resize-y"
        placeholder="输入要翻译的文本..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') doTranslate();
        }}
      />

      {/* ── Buttons ── */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button className="px-3.5" onClick={() => doTranslate()}>
          <img src={mediaSvgUrl('translation')} alt="translate" className="size-3.5" />
          翻译
        </Button>
        <Button
          variant="secondary"
          className="px-3.5"
          onClick={() => {
            setInput('');
            setResult(null);
            setError(null);
          }}
        >
          清空
        </Button>
        <Button
          variant="secondary"
          className="px-3.5"
          onClick={() => {
            if (result?.translation) postHost({ type: 'speak', text: result.translation, lang: result.targetLang });
          }}
        >
          <img src={mediaSvgUrl('speech')} alt="speak" className="size-3.5" />
          朗读
        </Button>
        <Button
          variant="secondary"
          className="px-3.5"
          onClick={() => {
            if (result?.translation) postHost({ type: 'copy', text: result.translation });
          }}
        >
          复制译文
        </Button>
        <Button
          variant="secondary"
          className="px-3.5"
          onClick={() => {
            if (result?.translation)
              postHost({
                type: 'saveWord',
                original: result.original,
                translation: result.translation,
                srcLang: result.srcLang ?? srcLang,
                targetLang: result.targetLang ?? targetLang,
              });
          }}
        >
          <img src={mediaSvgUrl('starOn')} alt="save" className="size-3.5" />
          存词
        </Button>
        <Button variant="secondary" className="px-3.5" onClick={() => postHost({ type: 'openWordBook' })}>
          <img src={mediaSvgUrl('wordbook')} alt="wordbook" className="size-3.5" />
          生词本
        </Button>

        {activeEngine && (
          <span className="whitespace-nowrap rounded-[10px] border border-[var(--vscode-widget-border)] px-2 py-0.5 text-[11px] text-[var(--vscode-descriptionForeground)]">
            {activeEngine}
          </span>
        )}
      </div>

      {/* ── Result area ── */}
      <div className="mt-3.5 min-h-[60px] rounded-[4px] border border-[var(--vscode-widget-border)] p-3 whitespace-pre-wrap break-words">
        {error ? (
          <div className="text-[var(--vscode-errorForeground)]">{error}</div>
        ) : loading ? (
          <div className="text-[var(--vscode-descriptionForeground)]">翻译中...</div>
        ) : result ? (
          <ResultView result={result} />
        ) : (
          <div className="text-[var(--vscode-descriptionForeground)]">在编辑器中选中文本后翻译,或在上方输入。</div>
        )}
      </div>

      {/* ── History ── */}
      {history.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1.5 flex items-center justify-between text-[12px] uppercase text-[var(--vscode-descriptionForeground)]">
            <span>历史记录</span>
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent p-0 text-[11px] text-[var(--vscode-descriptionForeground)] underline"
              onClick={() => postHost({ type: 'clearHistory' })}
            >
              清空
            </button>
          </h3>
          <div>
            {history.slice(0, 20).map((e, i) => (
              <button
                key={i}
                type="button"
                className="mb-1.5 block w-full cursor-pointer rounded-[4px] border border-[var(--vscode-widget-border)] p-1.5 text-left hover:border-[var(--vscode-button-background)]"
                onClick={() => {
                  setInput(e.original);
                  postHost({ type: 'setLanguages', srcLang: e.srcLang, targetLang: e.targetLang });
                  doTranslate(e.original, e.srcLang, e.targetLang);
                }}
              >
                <div className="text-[12px] text-[var(--vscode-descriptionForeground)]">{e.original}</div>
                <div className="mt-0.5 text-sm">{e.translation}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Result sub-view ── */
function ResultView({ result }: { result: TranslationResult }) {
  const hasDict = !!(result.dict && result.dict.length > 0);
  const hasExamples = !!(result.examples && result.examples.length > 0);

  return (
    <div className="whitespace-pre-wrap break-words">
      {/* 原文 */}
      <div className="mb-2 text-[15px] font-medium">
        {result.original}
        {result.srcLang && result.srcLang !== 'auto' && (
          <span className="ml-1 text-[11px] font-normal text-[var(--vscode-descriptionForeground)]">
            [{result.srcLang}]
          </span>
        )}
      </div>

      {/* 译文 */}
      <div className="text-[16px] text-[var(--vscode-editor-foreground)]">{result.translation || ''}</div>

      {/* 音标 */}
      {result.transliteration && (
        <div className="mt-1 text-[13px] text-[var(--vscode-descriptionForeground)]">{result.transliteration}</div>
      )}

      {/* 词典 */}
      {hasDict && (
        <div className="mt-[10px]">
          {result.dict!.map((d, di) => (
            <div key={di}>
              <div className="mt-2 font-semibold text-[var(--vscode-textLink-foreground)]">
                {d.pos ?? ''} · {d.term ?? ''}
              </div>
              {d.entries?.map((entry, ei) => (
                <div key={ei} className="text-[var(--vscode-descriptionForeground)]">
                  {entry.translation}
                  {entry.backTranslations && entry.backTranslations.length > 0 && (
                    <span className="font-semibold">↔ {entry.backTranslations.join(', ').slice(0, 120)}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* 拼写纠错提示 */}
      {result.spelling && result.spelling !== result.original && (
        <div className="mt-2 text-[12px] text-[var(--vscode-descriptionForeground)]">
          是否想输入: <span className="font-semibold">{result.spelling}</span>
        </div>
      )}

      {/* 例句 */}
      {hasExamples && (
        <div className="mt-2 border-t border-[var(--vscode-widget-border)] pt-2">
          <div className="mb-1.5 text-[12px] uppercase text-[var(--vscode-descriptionForeground)]">例句</div>
          {result.examples!.map((ex, ei) => (
            <div key={ei} className="mb-1.5">
              <div className="text-[12px] text-[var(--vscode-descriptionForeground)]">
                {ex.sourcePrefix}
                <span className="font-semibold text-[var(--vscode-editor-foreground)]">{ex.sourceTerm}</span>
                {ex.sourceSuffix}
              </div>
              <div className="text-[12px]">
                {ex.targetPrefix}
                <span className="font-semibold">{ex.targetTerm}</span>
                {ex.targetSuffix}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
