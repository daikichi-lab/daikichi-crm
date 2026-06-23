'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { useUI } from '@/components/ui';
import { duplicateNewsletterAction } from './actions';

const STATUSES = ['下書き', '予約', '送信中', '送信済', '失敗'];

export function NewsletterFilterBar({ topics }: { topics: string[] }) {
  const router = useRouter();
  const sp = useSearchParams();

  const update = (patch: Record<string, string>) => {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.push(`/newsletters?${params.toString()}`);
  };

  return (
    <div className="filterbar">
      <select
        className="select"
        aria-label="状態"
        value={sp.get('status') ?? ''}
        onChange={(e) => update({ status: e.target.value })}
      >
        <option value="">状態: すべて</option>
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select
        className="select"
        aria-label="トピック"
        value={sp.get('topic') ?? ''}
        onChange={(e) => update({ topic: e.target.value })}
      >
        <option value="">トピック: すべて</option>
        {topics.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <span className="right" />
      <span className="muted" style={{ fontSize: 12 }}>送信は日次上限内で自動スロットル配信されます。</span>
    </div>
  );
}

export function NewsletterRow({
  id,
  isDraft,
  children,
}: {
  id: string;
  isDraft: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { toast } = useUI();
  const [, startTransition] = useTransition();

  const open = () => router.push(isDraft ? `/newsletters/compose?id=${id}` : `/newsletters/${id}`);

  const duplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const r = await duplicateNewsletterAction(id);
      if (r && (r as any).id) {
        toast('内容を複製しました');
        router.push(`/newsletters/compose?id=${(r as any).id}`);
      } else {
        toast('複製に失敗しました');
      }
    });
  };

  return (
    <tr onClick={open} style={{ cursor: 'pointer' }}>
      {children}
      <td className="right">
        <button type="button" className="btn btn-sm btn-ghost" onClick={duplicate}>複製</button>
      </td>
    </tr>
  );
}
