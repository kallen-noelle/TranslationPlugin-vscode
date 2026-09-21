import { useEffect, useState } from 'react';
import { onHostMessage, postHost } from '../../lib/vscode';
import { Button } from '../../components/ui/button';
import { mediaSvgUrl } from '../../lib/mediaIcon';

interface Definition {
  pos: string;
  meaning: string;
}

interface WordItem {
  word: string;
  phonetic?: string;
  translation?: string;
  definitions?: Definition[];
  example?: string;
  exampleTranslation?: string;
}

interface WordMessage {
  type: 'word';
  item: WordItem;
  index: number;
  date: string;
}

export default function App() {
  const [item, setItem] = useState<WordItem | null>(null);
  const [date, setDate] = useState<string>('');

  useEffect(() => {
    const off = onHostMessage<WordMessage>((msg) => {
      if (msg.type === 'word') {
        setItem(msg.item);
        setDate(msg.date);
      }
    });
    postHost({ type: 'ready' });
    return off;
  }, []);

  if (!item) {
    return <div className="p-6 text-[var(--vscode-descriptionForeground)] text-sm">加载中…</div>;
  }

  const hasDefs = Array.isArray(item.definitions) && item.definitions.length > 0;

  return (
    <div className="flex justify-center p-6">
      <div className="w-full max-w-[480px] rounded-[8px] border border-[var(--vscode-widget-border)] p-6">
        {/* Label */}
        <div className="text-[12px] uppercase tracking-[1px] text-[var(--vscode-descriptionForeground)]">
          Word of the Day
        </div>

        {/* Word */}
        <div className="mt-2 text-[32px] font-bold">{item.word}</div>

        {/* Phonetic (always rendered, like the legacy element) */}
        <div className="mt-0.5 mb-3 text-sm text-[var(--vscode-descriptionForeground)]">
          {item.phonetic ?? ''}
        </div>

        {/* Translation (hidden when definitions are shown, as in legacy) */}
        {!hasDefs && item.translation && (
          <div className="mb-4 text-base">{item.translation}</div>
        )}

        {/* Definitions */}
        {hasDefs && (
          <div className="mb-4 space-y-1">
            {item.definitions!.map((d, i) => (
              <div key={i} className="flex items-start gap-2 text-sm leading-[1.55]">
                <span className="inline-flex flex-shrink-0 min-w-[48px] items-center justify-center rounded-[3px] bg-[color-mix(in_srgb,var(--vscode-button-background)_15%,transparent)] px-2 py-px text-center text-[12px] font-semibold text-[var(--vscode-button-background)]">
                  {d.pos}
                </span>
                <span>{d.meaning}</span>
              </div>
            ))}
          </div>
        )}

        {/* Example (always rendered, like the legacy element) */}
        <div className="mb-1 rounded-none border-l-[3px] border-[var(--vscode-button-background)] bg-[var(--vscode-textBlockQuote-background,transparent)] px-3 py-2 text-[13px]">
          {item.example ?? ''}
        </div>

        {/* Example translation (always rendered) */}
        <div className="mb-4 text-[13px] text-[var(--vscode-descriptionForeground)]">
          {item.exampleTranslation ?? ''}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={() => postHost({ type: 'speak', word: item.word })}>
            <img className="size-3.5" src={mediaSvgUrl('speech')} alt="speak" />
            朗读
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              // 收藏时同时传简洁翻译和详细释义（按词性分组）
              postHost({
                type: 'saveWord',
                word: item.word,
                phonetic: item.phonetic ?? '',
                translation: item.translation ?? '',
                definitions: item.definitions ?? [],
              });
            }}
          >
            <img className="size-3.5" src={mediaSvgUrl('starOn')} alt="save" />
            存到生词本
          </Button>
          <Button variant="secondary" onClick={() => postHost({ type: 'next' })}>
            下一个
          </Button>
        </div>

        {/* Date */}
        <div className="mt-4 text-[12px] text-[var(--vscode-descriptionForeground)]">{date}</div>
      </div>
    </div>
  );
}
