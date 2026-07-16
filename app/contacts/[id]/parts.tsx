'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useUI } from '@/components/ui';
import { setPrimaryContactAction, softDeleteContactAction } from './actions';
import { cardSignedUrlAction } from '@/app/storage-actions';

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

/** 名刺画像（クリックで署名URLを発行し新規タブで拡大）。パスはサーバー側で解決（IDOR対策）。 */
export function CardViewer({ children, contactId, face = 'front' }: { children: React.ReactNode; contactId: string; face?: 'front' | 'back' }) {
  const { toast } = useUI();
  const open = async () => {
    toast('名刺を拡大表示（署名URL・期限付き）');
    const r = await cardSignedUrlAction(contactId, face);
    if (r.url && /^https?:\/\//.test(r.url)) window.open(r.url, '_blank', 'noopener');
  };
  return (
    <div className="card" onClick={open}>
      {children}
    </div>
  );
}

/** 名刺の差し替え（実ファイルを Storage へアップロード → business_cards に保存）。 */
export function CardReplaceButton({ contactId }: { contactId: string }) {
  const { toast } = useUI();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const onFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('file', file); fd.set('kind', 'card'); fd.set('contact_id', contactId);
      const res = await fetch('/api/storage/upload', { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { toast(j.error || '名刺のアップロードに失敗しました'); return; }
      toast('名刺を差し替えました');
      router.refresh();
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  return (
    <>
      <input ref={fileRef} type="file" hidden accept=".jpg,.jpeg,.png,.webp,.heic,.heif" onChange={(e) => onFile(e.target.files)} />
      <button className="btn btn-sm" data-icon="card" data-iw="14" disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? 'アップロード中…' : '差し替え'}
      </button>
    </>
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
