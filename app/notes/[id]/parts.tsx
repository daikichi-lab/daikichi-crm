'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useUI } from '@/components/ui';
import { updateNoteTodosAction, updateNoteSummaryAction, addRecoTagAction } from './actions';

/** topbar の操作ボタン（全文コピー） */
export function NoteActions({ fullText }: { fullText: string }) {
  const { toast } = useUI();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      toast('全文をコピーしました');
    } catch {
      toast('コピーできませんでした');
    }
  };
  return <button className="btn btn-sm" onClick={copy}>全文コピー</button>;
}

/** 要点（自動まとめ）を人が編集・保存できるパネル本体。 */
export function SummaryPanel({ id, summary }: { id: string; summary: string | null }) {
  const { toast } = useUI();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(summary ?? '');
  const [pending, start] = useTransition();

  if (!editing) {
    return (
      <div className="panel-body">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          {summary
            ? <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.8, flex: 1 }}>{summary}</p>
            : <div className="muted" style={{ flex: 1 }}>要点はまだありません。</div>}
          <button className="btn btn-sm" onClick={() => { setText(summary ?? ''); setEditing(true); }}>編集</button>
        </div>
      </div>
    );
  }
  return (
    <div className="panel-body">
      <textarea className="input" rows={5} style={{ width: '100%' }} value={text} onChange={(e) => setText(e.target.value)} placeholder="要点を人手で補正…" />
      <div className="row mt8" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn-sm" disabled={pending} onClick={() => setEditing(false)}>キャンセル</button>
        <button className="btn btn-sm btn-primary" disabled={pending} onClick={() => start(async () => {
          const r = await updateNoteSummaryAction(id, text);
          if (r.error) { toast(r.error); return; }
          toast('要点を保存しました');
          setEditing(false);
          router.refresh();
        })}>保存</button>
      </div>
    </div>
  );
}

/** 次にやること（チェック＝完了で一覧から外し、残りを updateNoteTodos で保存） */
export function TodoChecklist({ id, todos }: { id: string; todos: string[] }) {
  const { toast } = useUI();
  const [items, setItems] = useState<string[]>(todos);
  const [pending, startTransition] = useTransition();

  const complete = (todo: string) => {
    const next = items.filter((t) => t !== todo);
    setItems(next);
    startTransition(async () => {
      await updateNoteTodosAction(id, next);
      toast('「次にやること」を完了にしました');
    });
  };

  if (items.length === 0) {
    return <div className="panel-body muted">次にやることはありません。</div>;
  }

  return (
    <div className="panel-body" style={{ paddingTop: 4, paddingBottom: 4 }}>
      {items.map((t) => (
        <label key={t} className="todo">
          <input type="checkbox" disabled={pending} onChange={() => complete(t)} />
          <span>{t}</span>
        </label>
      ))}
    </div>
  );
}

/** 次のアクション（おすすめ）: 検出タグを企業に追加 / 紹介はマッチングへ。 */
export function RecoButtons({ company, companyId, detectedTag = '配送代行', detectedSide = 'offer' }: {
  company: string | null; companyId: string | null; detectedTag?: string; detectedSide?: 'need' | 'offer';
}) {
  const { toast } = useUI();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [added, setAdded] = useState(false);
  return (
    <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="reco-mini">
        <span style={{ flex: 1, fontSize: 12.5 }}>
          会話から <span className={`chip ${detectedSide}`} style={{ height: 20 }}><span className="mk">{detectedSide === 'offer' ? '提' : '求'}</span>{detectedTag}</span> を検出。「{detectedSide === 'offer' ? '提供できる' : '求めてる'}」に追加？
        </span>
        <button className="btn btn-sm btn-primary" disabled={pending || added || !companyId} onClick={() => start(async () => {
          const r = await addRecoTagAction(companyId!, detectedTag, detectedSide);
          if (r.error) { toast(r.error); return; }
          setAdded(true);
          toast(`「${detectedTag}」を追加 → マッチングに反映`);
        })}>{added ? '追加済み' : '追加'}</button>
      </div>
      <div className="reco-mini">
        <span style={{ flex: 1, fontSize: 12.5 }}>
          <b>{company ?? 'この会社'}</b> の紹介候補（協業）を探す？
        </span>
        <button className="btn btn-sm btn-gold" disabled={!companyId} onClick={() => router.push(`/matching?base=${companyId}`)}>紹介候補を見る</button>
      </div>
    </div>
  );
}
