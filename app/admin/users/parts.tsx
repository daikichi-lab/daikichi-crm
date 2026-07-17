'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useUI } from '@/components/ui';
import { createUserAction, setUserRoleAction, setUserActiveAction, deleteUserAction, restoreUserAction } from './actions';

/** 強いランダム仮パスワードを生成（英大小・数字・記号）。CSPRNG（Web Crypto）を使用。 */
function genPassword(len = 14): string {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%&*?'];
  const all = sets.join('');
  const rnd = new Uint32Array(len);
  crypto.getRandomValues(rnd);
  const chars: string[] = [];
  for (let i = 0; i < sets.length && i < len; i++) chars.push(sets[i][rnd[i] % sets[i].length]); // 各種別を最低1文字
  for (let i = sets.length; i < len; i++) chars.push(all[rnd[i] % all.length]);
  // Fisher–Yates シャッフル（CSPRNG）
  const sh = new Uint32Array(chars.length);
  crypto.getRandomValues(sh);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = sh[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** ユーザー追加フォーム（氏名・メール・仮パスワード・ロール）。バー/モーダル共用。 */
function AddUserForm({ onDone }: { onDone?: () => void }) {
  const { toast } = useUI();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff');
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const res = await createUserAction({ name, email, password, role });
      if (res.error) { toast(`追加できません: ${res.error}`); return; }
      toast(`ユーザーを追加しました（メール・パスワードを本人にお伝えください）`);
      setName(''); setEmail(''); setPassword(''); setRole('staff');
      onDone?.();
    });

  return (
    <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <div className="field"><label>氏名</label>
        <input className="input" placeholder="山田 太郎" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field"><label>メールアドレス <span className="req">*</span></label>
        <input className="input" type="email" placeholder="name@daikichi-accg.co.jp" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="field col-2"><label>仮パスワード <span className="req">*</span></label>
        <div className="row" style={{ gap: 6 }}>
          <input className="input" style={{ flex: 1 }} placeholder="8文字以上" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" className="btn btn-sm" onClick={() => setPassword(genPassword())}>自動生成</button>
        </div>
        <span className="hint">本人が初回ログイン後にアカウント画面で変更できます。このメール＋パスワードを本人にお伝えください。</span>
      </div>
      <div className="field"><label>ロール</label>
        <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="staff">staff（一般スタッフ）</option>
          <option value="admin">admin（管理者）</option>
        </select></div>
      <div className="field" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" disabled={pending} onClick={submit}>ユーザーを追加</button>
      </div>
    </div>
  );
}

/** トップバーの「＋ ユーザーを追加」ボタン（モーダル）。 */
export function AddUserButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>＋ ユーザーを追加</button>
      {open && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 560 }}>
            <div className="m-head"><h3>ユーザーを追加</h3></div>
            <div className="m-body">
              <AddUserForm onDone={() => setOpen(false)} />
            </div>
            <div className="m-foot">
              <button className="btn" onClick={() => setOpen(false)}>とじる</button>
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

/** 論理削除ボタン（退職等）。自分は不可。履歴の担当名は「名前（削除済み）」で保持される。 */
export function DeleteUserButton({ id, name, self }: { id: string; name: string; self?: boolean }) {
  const { confirm, toast } = useUI();
  const router = useRouter();
  const [pending, start] = useTransition();
  if (self) return null;
  return (
    <button
      className="btn btn-sm btn-danger"
      disabled={pending}
      onClick={() =>
        confirm({
          title: 'このユーザーを削除しますか？',
          body: `「${name}」を削除します。ログインできなくなりますが、活動履歴などに残る担当名は「${name}（削除済み）」として保持されます。あとで復元できます。`,
          confirmLabel: '削除する',
          danger: true,
          onConfirm: () => new Promise<void>((resolve) => start(async () => {
            const res = await deleteUserAction(id);
            if (res.error) toast(`削除できません: ${res.error}`);
            else { toast(`「${name}」を削除しました`); router.refresh(); }
            resolve();
          })),
        })
      }
    >
      削除
    </button>
  );
}

/** 削除済みユーザーの復元ボタン。 */
export function RestoreUserButton({ id, name }: { id: string; name: string }) {
  const { toast } = useUI();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="btn btn-sm"
      disabled={pending}
      onClick={() => start(async () => {
        const res = await restoreUserAction(id);
        if (res.error) toast(`復元できません: ${res.error}`);
        else { toast(`「${name}」を復元しました`); router.refresh(); }
      })}
    >
      復元
    </button>
  );
}
