'use client';
import { useTransition } from 'react';
import { useUI } from '@/components/ui';
import { setPrimaryContactAction, softDeleteContactAction } from './actions';

/** topbar の削除ボタン（確認ダイアログ → soft delete） */
export function DeleteContactButton({ id, name, companyId }: { id: string; name: string; companyId?: string }) {
  const { confirm } = useUI();
  return (
    <button
      className="btn btn-sm btn-danger"
      onClick={() =>
        confirm({
          title: '担当者をゴミ箱へ移動しますか？',
          body: `「${name}」と名刺を非表示にします。いつでも復元できます。`,
          confirmLabel: 'ゴミ箱へ移動',
          danger: true,
          onConfirm: async () => { await softDeleteContactAction(id, companyId); },
        })
      }
    >
      削除
    </button>
  );
}

/** 主担当にする（非主担当のとき） */
export function SetPrimaryButton({ id, companyId }: { id: string; companyId?: string }) {
  const { toast } = useUI();
  const [pending, start] = useTransition();
  return (
    <button
      className="btn btn-sm btn-primary mt16"
      style={{ width: '100%' }}
      disabled={pending}
      onClick={() => start(async () => { await setPrimaryContactAction(id, companyId); toast('主担当に設定しました'); })}
    >
      この担当者を主担当にする
    </button>
  );
}

/** 主担当を解除（別の担当者を指定するよう促す） */
export function UnsetPrimaryButton({ companyId }: { companyId?: string }) {
  const { confirm } = useUI();
  return (
    <button
      className="btn btn-sm mt16"
      style={{ width: '100%' }}
      onClick={() =>
        confirm({
          title: '主担当を解除しますか？',
          body: '別の担当者を主担当に指定してください。担当者一覧から設定できます。',
          confirmLabel: '担当者一覧へ',
          onConfirm: async () => {
            if (companyId) window.location.href = `/companies/${companyId}#contacts`;
          },
        })
      }
    >
      主担当を解除
    </button>
  );
}

/** 名刺画像（クリックで拡大＝署名URLのデモ）。dev は擬似カードを表示 */
export function CardViewer({ children }: { children: React.ReactNode }) {
  const { toast } = useUI();
  return (
    <div className="card" onClick={() => toast('名刺を拡大表示（署名URL・期限付き）')}>
      {children}
    </div>
  );
}

export function CardActionButton({ label, msg, icon }: { label: string; msg: string; icon?: boolean }) {
  const { toast } = useUI();
  return (
    <button className="btn btn-sm" {...(icon ? { 'data-icon': 'card', 'data-iw': '14' } : {})} onClick={() => toast(msg)}>
      {label}
    </button>
  );
}
