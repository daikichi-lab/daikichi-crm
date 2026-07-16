'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useUI } from '@/components/ui';
import { documentSignedUrlAction } from '@/app/storage-actions';

/** 署名URLを取得して開く（実URLのみ新規タブ。dev擬似URLはトーストのみ）。 */
async function openSigned(id: string, toast: (m: string) => void, label: string) {
  const r = await documentSignedUrlAction(id);
  if (r.error) { toast('署名URLの発行に失敗しました'); return; }
  toast(label);
  if (r.url && /^https?:\/\//.test(r.url)) window.open(r.url, '_blank', 'noopener');
}

const CATEGORIES = ['契約書', '決算書', '商品・サービス資料', '提案資料', 'その他'];
const SORTS: { value: string; label: string }[] = [
  { value: 'new', label: '新しい順' }, { value: 'old', label: '古い順' },
  { value: 'size', label: 'サイズが大きい順' }, { value: 'company', label: '会社順' },
];

/* 検索・絞り込み・並び替え → URLクエリ */
export function DocumentFilterBar({ companies }: { companies: string[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [kw, setKw] = useState(sp.get('keyword') ?? '');
  const update = (patch: Record<string, string>) => {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) params.set(k, v); else params.delete(k); }
    router.push(`/documents?${params.toString()}`);
  };
  return (
    <div className="filterbar">
      <form onSubmit={(e) => { e.preventDefault(); update({ keyword: kw }); }} style={{ display: 'contents' }}>
        <input className="input" placeholder="ファイル名で検索…" style={{ minWidth: 220 }} value={kw} onChange={(e) => setKw(e.target.value)} aria-label="ファイル名で検索" />
      </form>
      <select className="select" aria-label="種別" value={sp.get('category') ?? ''} onChange={(e) => update({ category: e.target.value })}>
        <option value="">種別：すべて</option>
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select className="select" aria-label="会社" value={sp.get('company') ?? ''} onChange={(e) => update({ company: e.target.value })}>
        <option value="">会社：すべて</option>
        {companies.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select className="select" aria-label="並び替え" value={sp.get('sort') ?? 'new'} onChange={(e) => update({ sort: e.target.value })}>
        {SORTS.map((s) => <option key={s.value} value={s.value}>並び替え：{s.label}</option>)}
      </select>
    </div>
  );
}

/* 行クリック・プレビュー・DL → toast（署名URL発行のデモ） */
export function DocRow({
  id, fileName, ftClass, ftLabel, company, companyId, catColor, category, size, createdAt, uploadedBy,
}: {
  id: string; fileName: string; ftClass: string; ftLabel: string; company: string; companyId: string | null;
  catColor: string; category: string; size: string; createdAt: string; uploadedBy: string | null;
}) {
  const { toast } = useUI();
  const preview = () => openSigned(id, toast, `プレビュー: ${fileName}（署名URLを発行しました）`);
  const download = () => openSigned(id, toast, '署名URLを発行しました');
  return (
    <tr onClick={preview} style={{ cursor: 'pointer' }}>
      <td><div className="fname"><span className={`ft ${ftClass}`}>{ftLabel}</span><span className="nm">{fileName}</span></div></td>
      <td>
        {companyId
          ? <a className="co-link" href={`/companies/${companyId}`} onClick={(e) => e.stopPropagation()}>{company}</a>
          : <span className="co-link">{company}</span>}
      </td>
      <td><span className="cat"><span className="d" style={{ background: catColor }} />{category}</span></td>
      <td className="right num">{size}</td>
      <td className="num muted">{createdAt}</td>
      <td className="muted">{uploadedBy}</td>
      <td className="right" style={{ whiteSpace: 'nowrap' }}>
        <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); preview(); }}>プレビュー</button>
        <button className="btn btn-sm btn-icon" title="ダウンロード" onClick={(e) => { e.stopPropagation(); download(); }}>⤓</button>
      </td>
    </tr>
  );
}
