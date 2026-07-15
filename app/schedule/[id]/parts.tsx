'use client';
// 課題詳細のクライアント部品（完了・子課題チェック・コメント投稿・削除）。
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useUI } from '@/components/ui';
import { completeScheduleItemAction, updateScheduleItemAction, deleteTaskAction, addTaskCommentAction } from '../actions';

export function CompleteTaskButton({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const { toast } = useUI();
  if (status === '完了') return null;
  return (
    <button
      className="btn btn-sm btn-primary"
      onClick={async () => { await completeScheduleItemAction(id); toast('課題を完了にしました'); router.refresh(); }}
    >
      完了にする
    </button>
  );
}

/** 子課題の丸チェック（完了 ⇄ 取り消し。親の進捗は読み取り時に自動再集計） */
export function ChildCheck({ id, done }: { id: string; done: boolean }) {
  const router = useRouter();
  const { toast } = useUI();
  return (
    <span
      className="chk"
      role="checkbox"
      aria-checked={done}
      title={done ? '完了を取り消す' : '完了にする'}
      onClick={async (e) => {
        e.preventDefault();
        if (!done) {
          await completeScheduleItemAction(id);
          toast('子課題を完了にしました（親の進捗を再集計）');
        } else {
          await updateScheduleItemAction(id, { status: '未対応' });
          toast('完了を取り消しました');
        }
        router.refresh();
      }}
    />
  );
}

export function CommentBox({ id, avatar }: { id: string; avatar: string }) {
  const router = useRouter();
  const { toast } = useUI();
  const [body, setBody] = useState('');
  const post = async () => {
    if (!body.trim()) { toast('コメントを入力してください'); return; }
    const r = await addTaskCommentAction(id, body.trim());
    if (r?.error) { toast(r.error); return; }
    setBody('');
    toast('コメントを投稿しました');
    router.refresh();
  };
  return (
    <div className="row mt8" style={{ gap: 8, alignItems: 'flex-start' }}>
      <span className="av">{avatar}</span>
      <textarea className="input" rows={2} placeholder="コメントを書く…" style={{ flex: 1 }} value={body} onChange={(e) => setBody(e.target.value)} />
      <button className="btn btn-sm btn-primary" onClick={post}>投稿</button>
    </div>
  );
}

export function DeleteTaskButton({ id, title, kids }: { id: string; title: string; kids: number }) {
  const router = useRouter();
  const { confirm } = useUI();
  return (
    <button
      className="btn btn-sm btn-danger"
      onClick={() => confirm({
        title: '課題を削除', confirmLabel: '削除', danger: true,
        body: <p>「{title}」を削除します{kids > 0 ? `（子課題 ${kids} 件も一緒に削除されます）` : ''}。よろしいですか？</p>,
        onConfirm: async () => { await deleteTaskAction(id); router.push('/schedule'); },
      })}
    >
      削除
    </button>
  );
}
