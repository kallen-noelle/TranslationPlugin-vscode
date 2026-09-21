import { useEffect, useState } from 'react';
import { onHostMessage, postHost } from '../../lib/vscode';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';

interface WordBookEntry {
  id: number;
  original: string;
  translation: string;
  phonetic?: string | null;
  tags?: string | null;
  srcLang: string;
  targetLang: string;
  addedAt?: number | null;
}

interface EntryMessage {
  type: 'entry';
  entry: WordBookEntry;
}

export default function App() {
  const [entry, setEntry] = useState<WordBookEntry | null>(null);
  const [phonetic, setPhonetic] = useState('');
  const [tags, setTags] = useState('');
  const [explanation, setExplanation] = useState('');

  useEffect(() => {
    const off = onHostMessage<EntryMessage>((msg) => {
      if (msg.type === 'entry') {
        const e = msg.entry;
        setEntry(e);
        setPhonetic(e.phonetic ?? '');
        setTags(e.tags ?? '');
        setExplanation(e.translation ?? '');
      }
    });
    postHost({ type: 'ready' });
    return off;
  }, []);

  if (!entry) {
    return <div className="p-5 text-[var(--vscode-descriptionForeground)] text-sm">加载中…</div>;
  }

  return (
    <div className="p-5 text-[13px]">
      {/* Word + phonetic */}
      <div className="text-[26px] font-bold">{entry.original}</div>
      <div className="mt-[2px] mb-[14px] text-sm text-[var(--vscode-descriptionForeground)]">
        {entry.phonetic ?? ''}
      </div>

      {/* Phonetic field */}
      <Label className="mt-3 mb-1 block">音标</Label>
      <Input
        className="border-[var(--vscode-widget-border)]"
        placeholder="音标"
        value={phonetic}
        onChange={(e) => setPhonetic(e.target.value)}
      />

      {/* Tags field */}
      <Label className="mt-3 mb-1 block">标签(逗号分隔)</Label>
      <Input
        className="border-[var(--vscode-widget-border)]"
        placeholder="例如: 编程, 常用"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
      />

      {/* Explanation field */}
      <Label className="mt-3 mb-1 block">释义</Label>
      <Textarea
        className="min-h-[120px] border-[var(--vscode-widget-border)]"
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
      />

      {/* Meta */}
      <div className="mt-[10px] flex gap-[14px] text-[12px] text-[var(--vscode-descriptionForeground)]">
        <span>{entry.srcLang} → {entry.targetLang}</span>
        <span>{entry.addedAt ? new Date(entry.addedAt).toLocaleString() : ''}</span>
      </div>

      {/* Actions */}
      <div className="mt-[14px] flex gap-2">
        <Button
          onClick={() =>
            postHost({
              type: 'save',
              id: entry.id,
              phonetic,
              tags,
              explanation,
            })
          }
        >
          保存
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            postHost({
              type: 'speak',
              text: explanation,
              lang: entry.targetLang,
            })
          }
        >
          朗读
        </Button>
      </div>
    </div>
  );
}
