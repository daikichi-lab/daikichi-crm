'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { useUI } from '@/components/ui';
import { recordActivityAction } from './actions';

const ACTORS = ['山田 健太', '佐藤 京子', '田中 一郎'];
const KINDS = ['電話', '面談・訪問', 'メール', '議事録', '紹介', 'メルマガ', 'フォーム', '名刺', 'メモ'];
const PERIODS: { value: string; label: string }[] = [
  { value: 'today', label: '今日' }, { value: 'week', label: '今週' }, { value: 'month', label: '今月' },
];

/* topbar: ＋活動を記録（モーダルフォーム → recordActivity） */
export function RecordActivityButton() {
  const { confirm, toast } = useUI();
  const router = useRouter();
  const [, start] = useTransition();
  const open = () => {
    const draft = { kind: '電話', company: '', title: '', actor: ACTORS[0] };
    confirm({
      title: '活動を記録',
      confirmLabel: '記録',
      body: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>電話・訪問・メモなどの活動を手動で記録します（種別・企業・内容・担当）。</p>
          <div className="field"><label>種別</label>
            <select className="select" defaultValue={draft.kind} onChange={(e) => (draft.kind = e.target.value)}>
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="field"><label>企業（任意）</label><input className="input" placeholder="社名" onChange={(e) => (draft.company = e.target.value)} /></div>
          <div className="field"><label>内容</label><input className="input" placeholder="例: 初回提案のフォロー連絡" onChange={(e) => (draft.title = e.target.value)} /></div>
          <div className="field"><label>担当</label>
            <select className="select" defaultValue={draft.actor} onChange={(e) => (draft.actor = e.target.value)}>
              {ACTORS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      ),
      onConfirm: async () => {
        if (!draft.title.trim()) { toast('内容を入力してください'); return; }
        start(async () => {
          await recordActivityAction({ kind: draft.kind, company: draft.company || undefined, title: draft.title, actor: draft.actor });
          router.refresh();
        });
      },
    });
  };
  return <button className="btn btn-sm btn-primary" onClick={open}>＋ 活動を記録</button>;
}

/* 絞り込み（期間・種別・担当）→ URLクエリ */
export function ActivityFilterBar() {
  const router = useRouter();
  const sp = useSearchParams();
  const update = (patch: Record<string, string>) => {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) params.set(k, v); else params.delete(k); }
    router.push(`/activities?${params.toString()}`);
  };
  return (
    <div className="actions">
      <select className="select btn-sm" style={{ height: 32 }} aria-label="期間" value={sp.get('period') ?? 'week'} onChange={(e) => update({ period: e.target.value })}>
        {PERIODS.map((p) => <option key={p.value} value={p.value}>期間：{p.label}</option>)}
      </select>
      <select className="select btn-sm" style={{ height: 32 }} aria-label="種別" value={sp.get('kind') ?? ''} onChange={(e) => update({ kind: e.target.value })}>
        <option value="">種別：すべて</option>
        {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
      <select className="select btn-sm" style={{ height: 32 }} aria-label="担当" value={sp.get('actor') ?? ''} onChange={(e) => update({ actor: e.target.value })}>
        <option value="">担当：すべて</option>
        {ACTORS.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
    </div>
  );
}
