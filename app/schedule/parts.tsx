'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useUI } from '@/components/ui';
import { Icon } from '@/components/icons';
import { createTaskAction, completeScheduleItemAction, updateScheduleItemAction } from './actions';

const ASSIGNEES = ['山田 健太', '佐藤 京子', '田中 一郎'];
const KINDS = ['決算', '申告・納付', '年末調整', '手動タスク'];
const STATUSES = ['未対応', '対応中', '完了'];

/* topbar: カレンダー書出（toast） */
export function CalendarExportButton() {
  const { toast } = useUI();
  return (
    <button className="btn btn-sm" onClick={() => toast('Googleカレンダーへ書き出しました（デモ）')}>
      <Icon name="calendar" size={15} />カレンダー書出
    </button>
  );
}

/* topbar: ＋タスクを追加（モーダルフォーム → createTask） */
export function AddTaskButton() {
  const { confirm, toast } = useUI();
  const router = useRouter();
  const [, start] = useTransition();
  const open = () => {
    const draft: { company: string; title: string; due_date: string; assignee: string } = {
      company: '', title: '', due_date: '', assignee: ASSIGNEES[0],
    };
    confirm({
      title: 'タスクを追加',
      confirmLabel: '追加',
      body: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>企業・内容・期日・担当を入力して手動タスクを追加します。</p>
          <div className="field"><label>企業（任意）</label><input className="input" placeholder="社名" onChange={(e) => (draft.company = e.target.value)} /></div>
          <div className="field"><label>内容</label><input className="input" placeholder="例: 面談フォロー連絡" onChange={(e) => (draft.title = e.target.value)} /></div>
          <div className="field"><label>期日</label><input className="input" type="date" onChange={(e) => (draft.due_date = e.target.value)} /></div>
          <div className="field"><label>担当</label>
            <select className="select" defaultValue={draft.assignee} onChange={(e) => (draft.assignee = e.target.value)}>
              {ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      ),
      onConfirm: async () => {
        if (!draft.title.trim()) { toast('内容を入力してください'); return; }
        start(async () => {
          await createTaskAction({ company: draft.company || undefined, title: draft.title, due_date: draft.due_date || undefined, assignee: draft.assignee, kind: '手動タスク' });
          router.refresh();
        });
      },
    });
  };
  return <button className="btn btn-sm btn-primary" onClick={open}>＋ タスクを追加</button>;
}

/* 絞り込み（担当・種別・未完了のみ）→ URLクエリ */
export function ScheduleFilterBar({ count }: { count: number }) {
  const router = useRouter();
  const sp = useSearchParams();
  const update = (patch: Record<string, string>) => {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) params.set(k, v); else params.delete(k); }
    router.push(`/schedule?${params.toString()}`);
  };
  const openOnly = sp.get('status') === 'open';
  return (
    <div className="filterbar">
      <div className="row" style={{ gap: 6 }}>
        <b className="num" style={{ minWidth: 96, textAlign: 'center' }}>{count} 件</b>
      </div>
      <select className="select" aria-label="担当" value={sp.get('assignee') ?? ''} onChange={(e) => update({ assignee: e.target.value })}>
        <option value="">担当：すべて</option>
        {ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      <select className="select" aria-label="種別" value={sp.get('kind') ?? ''} onChange={(e) => update({ kind: e.target.value })}>
        <option value="">種別：すべて</option>
        {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
      {openOnly
        ? <span className="filter-pill">未完了のみ <span className="x" onClick={() => update({ status: '' })}>×</span></span>
        : <button className="btn btn-sm btn-ghost" onClick={() => update({ status: 'open' })}>未完了のみ</button>}
    </div>
  );
}

/* 各行の操作（完了 / 状態変更）— 自動分は編集不可 */
export function ScheduleRowActions({ id, source, status }: { id: string; source: string; status: string }) {
  const router = useRouter();
  const { toast, confirm } = useUI();
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);
  const isAuto = source === '自動';

  const complete = () => {
    confirm({
      title: 'タスクを完了にする', confirmLabel: '完了',
      body: <p>この項目を完了にします。よろしいですか？</p>,
      onConfirm: async () => { start(async () => { await completeScheduleItemAction(id); router.refresh(); }); },
    });
  };
  const changeStatus = (st: string) => {
    setOpen(false);
    start(async () => { await updateScheduleItemAction(id, { status: st }); router.refresh(); });
  };

  if (isAuto) {
    return (
      <button className="btn btn-sm btn-icon" title="自動生成（編集不可）" onClick={(e) => { e.stopPropagation(); toast('自動生成の期限は編集できません'); }}>
        <Icon name="gear" size={14} />
      </button>
    );
  }
  return (
    <span style={{ position: 'relative', display: 'inline-flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
      {status !== '完了' && <button className="btn btn-sm" title="完了にする" onClick={complete}><Icon name="check" size={14} />完了</button>}
      <button className="btn btn-sm btn-icon" title="状態変更" onClick={() => setOpen((v) => !v)}>⋯</button>
      {open && (
        <div className="menu" style={{ position: 'absolute', right: 0, top: 34, zIndex: 30, background: '#fff', border: '1px solid var(--line-strong)', borderRadius: 8, boxShadow: 'var(--shadow-1)', padding: 6, minWidth: 130 }}>
          {STATUSES.map((st) => (
            <button key={st} className="btn btn-sm btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => changeStatus(st)}>{st}にする</button>
          ))}
        </div>
      )}
    </span>
  );
}
