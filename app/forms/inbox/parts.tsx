'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUI } from '@/components/ui';
import { importSubmissionAction, discardSubmissionAction } from './actions';

const STATUSES = ['未対応', '取込済', '破棄'];
const STATUS_LABEL: Record<string, string> = { 未対応: '未確認', 取込済: '取込済', 破棄: '対応不要' };
const TYPES = ['法人', '個人事業主'];

export function InboxFilter() {
  const router = useRouter();
  const sp = useSearchParams();
  const status = sp.get('status') ?? '';
  const type = sp.get('type') ?? '';

  const update = (patch: Record<string, string>) => {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.push(`/forms/inbox${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <div className="filterbar">
      <select className="select" aria-label="ステータス" value={status} onChange={(e) => update({ status: e.target.value })}>
        <option value="">ステータス: すべて</option>
        {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </select>
      <select className="select" aria-label="種別" value={type} onChange={(e) => update({ type: e.target.value })}>
        <option value="">種別: すべて</option>
        {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <span className="right" />
      {status && (
        <span className="filter-pill">
          {STATUS_LABEL[status]} <span className="x" onClick={() => update({ status: '' })}>✕</span>
        </span>
      )}
    </div>
  );
}

export function ImportButton({ id, name, contact, duplicate }: { id: string; name: string; contact: string; duplicate?: boolean }) {
  const { confirm, toast } = useUI();
  const [pending, start] = useTransition();
  const label = duplicate ? '確認' : '取込';
  return (
    <button
      className={`btn btn-sm ${duplicate ? 'btn-gold' : 'btn-primary'}`}
      disabled={pending}
      onClick={() =>
        confirm({
          title: duplicate ? '既存企業にマージしますか？' : '顧客として取り込みますか？',
          body: duplicate
            ? `既存の「${name}」が見つかりました。担当者の追加 / 情報の更新を行えます。`
            : `「${name}${contact ? ` / ${contact}` : ''}」を企業＋担当者として作成します。タグはマスタに追加されます。`,
          confirmLabel: duplicate ? '既存にマージ' : '取り込む',
          onConfirm: () =>
            new Promise<void>((resolve) =>
              start(async () => {
                const res = await importSubmissionAction(id);
                if (res.error) toast(`取込できません: ${res.error}`);
                else toast(`「${name}」を顧客として取り込みました`);
                resolve();
              }),
            ),
        })
      }
    >
      {label}
    </button>
  );
}

export function DiscardButton({ id, name }: { id: string; name: string }) {
  const { confirm, toast } = useUI();
  const [pending, start] = useTransition();
  return (
    <button
      className="btn btn-sm btn-danger"
      disabled={pending}
      onClick={() =>
        confirm({
          title: 'この回答を破棄しますか？',
          body: `「${name}」を対応不要として破棄します。回答データは残りますが受信箱の未確認から外れます。`,
          confirmLabel: '破棄する',
          danger: true,
          onConfirm: () =>
            new Promise<void>((resolve) =>
              start(async () => {
                await discardSubmissionAction(id);
                toast(`「${name}」を破棄しました`);
                resolve();
              }),
            ),
        })
      }
    >
      破棄
    </button>
  );
}

export function CopyUrlButton({ url }: { url: string }) {
  const { toast } = useUI();
  return (
    <button
      className="btn btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
        } catch { /* ignore */ }
        toast('公開フォームのURLをコピーしました');
      }}
    >
      URLをコピー
    </button>
  );
}
