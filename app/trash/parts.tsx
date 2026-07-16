'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUI } from '@/components/ui';
import { restoreCompanyAction, restoreContactAction, purgeCompanyAction } from './actions';

export function TrashFilter() {
  const router = useRouter();
  const sp = useSearchParams();
  const kind = sp.get('kind') ?? '';
  const set = (v: string) => {
    const params = new URLSearchParams(sp.toString());
    if (v) params.set('kind', v);
    else params.delete('kind');
    router.push(`/trash${params.toString() ? `?${params.toString()}` : ''}`);
  };
  return (
    <div className="filterbar">
      <select className="select" aria-label="種類" value={kind} onChange={(e) => set(e.target.value)}>
        <option value="">種類: すべて</option>
        <option value="company">企業</option>
        <option value="contact">担当者</option>
      </select>
    </div>
  );
}

type Kind = 'company' | 'contact';

export function RestoreButton({ id, name, kind }: { id: string; name: string; kind: Kind }) {
  const { toast } = useUI();
  const [pending, start] = useTransition();
  return (
    <button
      className="btn btn-sm btn-primary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (kind === 'company') await restoreCompanyAction(id);
          else await restoreContactAction(id);
          toast(`「${name}」を復元しました`);
        })
      }
    >
      復元
    </button>
  );
}

export function PurgeButton({ id, name }: { id: string; name: string }) {
  const { confirm, toast } = useUI();
  return (
    <button
      className="btn btn-sm btn-danger"
      onClick={() =>
        confirm({
          title: '完全に削除しますか？',
          body: 'この操作は取り消せません。関連する担当者・名刺画像もすべて削除されます。',
          confirmLabel: '完全削除',
          danger: true,
          onConfirm: async () => {
            const res = await purgeCompanyAction(id);
            if (res.error) toast(`削除できません: ${res.error}`);
            else toast(`「${name}」を完全に削除しました`);
          },
        })
      }
    >
      完全削除
    </button>
  );
}
