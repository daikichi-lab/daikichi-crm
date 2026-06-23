'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

type Props = {
  industries: string[];
  areas: string[];
  sizes: string[];
  tags: string[];
};

const STATUSES = ['顧問中', '見込み', '休眠'];
const TYPES = ['法人', '個人事業主'];

export function CompanyFilterBar({ industries, areas, sizes, tags }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');

  const update = (patch: Record<string, string>) => {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.push(`/companies?${params.toString()}`);
  };

  const sel = (name: string, label: string, options: string[]) => (
    <select
      className="select"
      aria-label={label}
      value={sp.get(name) ?? ''}
      onChange={(e) => update({ [name]: e.target.value })}
    >
      <option value="">{label}: すべて</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );

  const hasFilters = ['type', 'industry', 'area', 'size', 'status', 'needs', 'offers', 'q'].some((k) => sp.get(k));

  return (
    <div className="filterbar">
      <form
        onSubmit={(e) => { e.preventDefault(); update({ q }); }}
        className="search"
        style={{ maxWidth: 280 }}
      >
        <span className="mag" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="社名・メモを検索…" aria-label="検索" />
      </form>
      {sel('type', '種別', TYPES)}
      {sel('industry', '業種', industries)}
      {sel('area', 'エリア', areas)}
      {sel('size', '規模', sizes)}
      {sel('status', 'ステータス', STATUSES)}
      {sel('needs', '求', tags)}
      {sel('offers', '提', tags)}
      {hasFilters && (
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => router.push('/companies')}>
          条件をクリア
        </button>
      )}
    </div>
  );
}
