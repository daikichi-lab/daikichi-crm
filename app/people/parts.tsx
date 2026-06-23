'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState } from 'react';

export function PeopleFilterBar({ companies, count, total }: { companies: string[]; count: number; total: number }) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const [q, setQ] = useState(sp.get('q') ?? '');

  const update = (patch: Record<string, string>) => {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v); else params.delete(k);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <>
      <div className="filterbar">
        <form className="search" style={{ maxWidth: 220 }} onSubmit={(e) => { e.preventDefault(); update({ q }); }}>
          <span className="mag" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="名前・会社・フリガナで検索…" aria-label="検索" />
        </form>
        <select className="select btn-sm" style={{ height: 32 }} aria-label="会社で絞り込み" value={sp.get('company') ?? ''} onChange={(e) => update({ company: e.target.value })}>
          <option value="">すべての会社</option>
          {companies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="select btn-sm" style={{ height: 32 }} aria-label="並び替え" value={sp.get('sort') ?? 'recent'} onChange={(e) => update({ sort: e.target.value === 'recent' ? '' : e.target.value })}>
          <option value="recent">最近会った順</option>
          <option value="kana">名前順（フリガナ）</option>
        </select>
        <label className="row" style={{ gap: 6, fontSize: 12, color: 'var(--ink-2)', marginLeft: 'auto' }}>
          <input type="checkbox" checked={sp.get('primary') === '1'} onChange={(e) => update({ primary: e.target.checked ? '1' : '' })} /> 主担当のみ
        </label>
      </div>
      <div className="panel-head" style={{ background: 'var(--surface-2)' }}>
        <span className="count"><b className="num">{count}</b> 名 <span className="muted">/ 全 {total}名</span></span>
      </div>
    </>
  );
}
