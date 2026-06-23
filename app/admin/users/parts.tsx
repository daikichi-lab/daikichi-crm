'use client';

import { useState, useTransition } from 'react';
import { useUI } from '@/components/ui';
import { inviteUserAction, setUserRoleAction, setUserActiveAction } from './actions';

export function InviteBar() {
  const { toast } = useUI();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const res = await inviteUserAction(email, email, role);
      if (res.error) toast(`招待できません: ${res.error}`);
      else { toast('招待メールを送信しました'); setEmail(''); }
    });

  return (
    <div className="filterbar">
      <span className="b" style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>メールで招待</span>
      <input
        className="input"
        placeholder="name@daikichi-accg.co.jp"
        style={{ minWidth: 260, flex: 1, maxWidth: 340 }}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
      />
      <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="staff">staff</option>
        <option value="admin">admin</option>
      </select>
      <button className="btn btn-sm btn-primary" disabled={pending} onClick={submit}>招待を送信</button>
      <span className="right" />
      <span className="muted" style={{ fontSize: 11.5 }}>招待リンクからパスワードを設定（Supabase Auth）</span>
    </div>
  );
}

export function InviteButton() {
  const { toast } = useUI();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const res = await inviteUserAction(email, email, role);
      if (res.error) toast(`招待できません: ${res.error}`);
      else { toast('招待メールを送信しました'); setOpen(false); setEmail(''); }
    });

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>＋ スタッフを招待</button>
      {open && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="m-head"><h3>スタッフを招待</h3></div>
            <div className="m-body">
              <div className="field"><label>メールアドレス<span className="req">*</span></label>
                <input className="input" placeholder="name@daikichi-accg.co.jp" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="field mt8"><label>ロール</label>
                <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="staff">staff（一般スタッフ）</option>
                  <option value="admin">admin（管理者）</option>
                </select></div>
              <div className="banner info mt16" style={{ fontSize: 12 }}>招待メールのリンクからパスワードを設定してもらいます（Supabase Auth）。</div>
            </div>
            <div className="m-foot">
              <button className="btn" onClick={() => setOpen(false)}>キャンセル</button>
              <button className="btn btn-primary" disabled={pending} onClick={submit}>招待を送信</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function RoleSelect({ id, name, role, disabled, title }: { id: string; name: string; role: string; disabled?: boolean; title?: string }) {
  const { toast } = useUI();
  const [value, setValue] = useState(role);
  const [pending, start] = useTransition();
  return (
    <select
      className="select"
      style={{ height: 30, padding: '0 24px 0 9px', fontSize: 12.5 }}
      value={value}
      disabled={disabled || pending}
      title={title}
      onChange={(e) => {
        const next = e.target.value;
        setValue(next);
        start(async () => {
          const res = await setUserRoleAction(id, next);
          if (res.error) { toast(`変更できません: ${res.error}`); setValue(role); }
          else toast(`「${name}」のロールを ${next} に変更しました`);
        });
      }}
    >
      <option value="admin">admin</option>
      <option value="staff">staff</option>
    </select>
  );
}

export function ActiveToggleButton({ id, name, active, self }: { id: string; name: string; active: boolean; self?: boolean }) {
  const { confirm, toast } = useUI();
  const [pending, start] = useTransition();

  if (self) return <button className="btn btn-sm" disabled>自分</button>;

  if (active)
    return (
      <button
        className="btn btn-sm btn-danger"
        disabled={pending}
        onClick={() =>
          confirm({
            title: 'このユーザーを無効化しますか？',
            body: `「${name}」はログインできなくなります。データは保持され、再び有効化できます。`,
            confirmLabel: '無効化する',
            danger: true,
            onConfirm: () => new Promise<void>((resolve) => start(async () => {
              const res = await setUserActiveAction(id, false);
              if (res.error) toast(`無効化できません: ${res.error}`);
              else toast(`「${name}」を無効化しました`);
              resolve();
            })),
          })
        }
      >
        無効化
      </button>
    );

  return (
    <button
      className="btn btn-sm"
      disabled={pending}
      onClick={() => start(async () => {
        const res = await setUserActiveAction(id, true);
        if (res.error) toast(`有効化できません: ${res.error}`);
        else toast(`「${name}」を有効化しました`);
      })}
    >
      有効化
    </button>
  );
}
