'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useUI } from '@/components/ui';
import { updateReferralStatusAction } from './actions';

export type ReferralItem = {
  id: string;
  from: string; from_id: string;
  to: string; to_id: string;
  kind: '協業先紹介' | '顧客紹介';
  matched_tags: string[];
  status: string;
  note?: string | null;
  by?: string | null;
  created_at: string;
};

const STATUSES = ['提案', '打診中', '成立', '不成立'];

export function ReferralFilterBar({ status }: { status: string }) {
  const router = useRouter();
  const sp = useSearchParams();

  const update = (v: string) => {
    const params = new URLSearchParams(sp.toString());
    if (v) params.set('status', v); else params.delete('status');
    router.push(`/referrals?${params.toString()}`);
  };

  return (
    <div className="filterbar">
      <select className="select" aria-label="ステータス" value={status} onChange={(e) => update(e.target.value)}>
        <option value="">ステータス: すべて</option>
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <span className="right" />
      {status && (
        <>
          <span className="filter-pill">{status} <span className="x" onClick={() => update('')} style={{ cursor: 'pointer' }}>✕</span></span>
          <a href="#" style={{ fontSize: 12.5 }} onClick={(e) => { e.preventDefault(); update(''); }}>条件をクリア</a>
        </>
      )}
    </div>
  );
}

export function ReferralRowAction({ item }: { item: ReferralItem }) {
  const { toast } = useUI();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(item.status);
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      await updateReferralStatusAction(item.id, value);
      setOpen(false);
      toast('ステータスを更新しました');
    });
  };

  return (
    <>
      <button className="btn btn-sm" onClick={() => { setValue(item.status); setOpen(true); }}>状態を更新</button>
      {open && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="m-head"><h3>ステータスを更新</h3></div>
            <div className="m-body">
              <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>{item.from} → {item.to}</div>
              <div className="field">
                <label>ステータス</label>
                <select className="select" value={value} onChange={(e) => setValue(e.target.value)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="m-foot">
              <button className="btn" onClick={() => setOpen(false)} disabled={pending}>キャンセル</button>
              <button className="btn btn-primary" onClick={save} disabled={pending}>更新</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
