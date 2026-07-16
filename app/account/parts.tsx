'use client';

import { useState, useTransition } from 'react';
import { useUI } from '@/components/ui';
import { updateMyProfileAction, changePasswordAction, signOutAction } from './actions';

export function ProfileForm({ initialName, email }: { initialName: string; email: string }) {
  const { toast } = useUI();
  const [name, setName] = useState(initialName);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const res = await updateMyProfileAction(name);
      if (res.error) toast(`保存できません: ${res.error}`);
      else toast('プロフィールを保存しました');
    });
  return (
    <>
      <div className="form-grid">
        <div className="field">
          <label>表示名</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>メール</label>
          <input className="input num" value={email} disabled />
          <span className="hint">変更は管理者へ依頼してください</span>
        </div>
      </div>
      <div className="row mt16" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" disabled={pending} onClick={save}>{pending ? '保存中…' : '保存'}</button>
      </div>
    </>
  );
}

export function PasswordForm() {
  const { toast } = useUI();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [conf, setConf] = useState('');
  const [pending, start] = useTransition();
  const submit = () => {
    if (!cur) {
      toast('現在のパスワードを入力してください');
      return;
    }
    if (!next || !conf) {
      toast('新しいパスワードを入力してください');
      return;
    }
    if (next.length < 8) {
      toast('新しいパスワードは8文字以上にしてください');
      return;
    }
    if (next !== conf) {
      toast('新しいパスワードが一致しません');
      return;
    }
    start(async () => {
      const res = await changePasswordAction(cur, next);
      if (res.error) { toast(`変更できません: ${res.error}`); return; }
      setCur('');
      setNext('');
      setConf('');
      toast('パスワードを変更しました');
    });
  };
  return (
    <>
      <div className="form-grid">
        <div className="field col-2"><label>現在のパスワード</label><input className="input" type="password" placeholder="••••••••" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
        <div className="field"><label>新しいパスワード</label><input className="input" type="password" placeholder="8文字以上" value={next} onChange={(e) => setNext(e.target.value)} /></div>
        <div className="field"><label>新しいパスワード（確認）</label><input className="input" type="password" placeholder="再入力" value={conf} onChange={(e) => setConf(e.target.value)} /></div>
      </div>
      <div className="row mt16" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" disabled={pending} onClick={submit}>パスワードを変更</button>
      </div>
    </>
  );
}

export function LogoutButton() {
  const { confirm } = useUI();
  const [pending, start] = useTransition();
  return (
    <button
      className="btn btn-danger"
      disabled={pending}
      onClick={() =>
        confirm({
          title: 'ログアウトしますか？',
          body: '再度ログインが必要になります。',
          confirmLabel: 'ログアウト',
          onConfirm: () =>
            new Promise<void>((resolve) => {
              start(async () => {
                await signOutAction();
                resolve();
              });
            }),
        })
      }
    >
      ログアウト
    </button>
  );
}
