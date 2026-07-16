'use client';
import { useState, useTransition } from 'react';
import { useUI } from '@/components/ui';
import { updateNoteTodosAction } from './actions';

/** topbar の操作ボタン（全文コピー・編集） */
export function NoteActions({ fullText }: { fullText: string }) {
  const { toast } = useUI();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      toast('全文をコピーしました');
    } catch {
      toast('全文をコピーしました');
    }
  };
  return (
    <>
      <button className="btn btn-sm" onClick={copy}>全文コピー</button>
      <button className="btn btn-sm btn-primary" onClick={() => toast('要点を編集できます（人が補正）')}>編集</button>
    </>
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

/** 次のアクション（おすすめ）の起票ボタン */
export function RecoButtons({ company }: { company: string | null }) {
  const { toast } = useUI();
  return (
    <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="reco-mini">
        <span style={{ flex: 1, fontSize: 12.5 }}>
          会話から <span className="chip offer" style={{ height: 20 }}><span className="mk">提</span>配送代行</span> を検出。「提供できる」に追加？
        </span>
        <button className="btn btn-sm btn-primary" onClick={() => toast('「配送代行」を追加 → マッチングに反映')}>追加</button>
      </div>
      <div className="reco-mini">
        <span style={{ flex: 1, fontSize: 12.5 }}>
          <b>{company ?? 'この会社'}</b> への紹介（協業）を起票？
        </span>
        <button className="btn btn-sm btn-gold" onClick={() => toast('紹介を「打診中」で起票しました')}>紹介を起票</button>
      </div>
    </div>
  );
}
