'use client';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { useUI } from '@/components/ui';
import { duplicateNewsletterAction } from '../actions';

export type Recipient = { name: string; company: string; email: string; status: string };

const RCLASS: Record<string, string> = { 送信: 'sent', 失敗: 'failed', 停止スキップ: 'skip', バウンス: 'bounce' };
const RLABEL: Record<string, string> = { 送信: '送信済', 失敗: '失敗', 停止スキップ: '配信停止スキップ', バウンス: 'バウンス' };

// CSVフォーミュラインジェクション対策（=,+,-,@ 始まりをエスケープ）
function csvCell(v: string): string {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function NewsletterDetailActions({ id, subject, recipients }: { id: string; subject: string; recipients: Recipient[] }) {
  const router = useRouter();
  const { toast } = useUI();
  const [, startTransition] = useTransition();

  const duplicate = () => {
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

  const exportCsv = () => {
    const header = ['担当者', '会社', 'メール', '状態'].map(csvCell).join(',');
    const rows = recipients.map((r) => [r.name, r.company, r.email, RLABEL[r.status] ?? r.status].map(csvCell).join(','));
    const csv = '﻿' + [header, ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${subject || 'newsletter'}_recipients.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('配信先をCSVで書き出しました（エスケープ済み）');
  };

  return (
    <>
      <button type="button" className="btn btn-sm" onClick={duplicate}>複製して再利用</button>
      <button type="button" className="btn btn-sm" onClick={exportCsv}>CSV書き出し</button>
    </>
  );
}

export function RecipientTable({ recipients }: { recipients: Recipient[] }) {
  const [filter, setFilter] = useState('');
  const rows = useMemo(
    () => recipients.filter((r) => !filter || r.status === filter),
    [recipients, filter],
  );

  return (
    <div className="panel mt16">
      <div className="panel-head"><h3>配信明細（宛先ごと）</h3><span className="count num">{recipients.length} 件</span>
        <div className="actions">
          <select className="select btn-sm" style={{ height: 32 }} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="状態で絞り込み">
            <option value="">状態: すべて</option>
            <option value="送信">送信済</option>
            <option value="失敗">失敗</option>
            <option value="バウンス">バウンス</option>
            <option value="停止スキップ">配信停止スキップ</option>
          </select>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>担当者</th><th>会社</th><th>メール</th><th>状態</th></tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 24 }}>該当する宛先がありません。</td></tr>
            )}
            {rows.map((r, i) => {
              const cls = RCLASS[r.status] ?? 'skip';
              const bg = r.status === '失敗' ? 'var(--red-50)' : r.status === '停止スキップ' ? 'var(--surface-2)' : undefined;
              return (
                <tr key={i} style={{ cursor: 'default', background: bg }}>
                  <td className="name">{r.name}</td>
                  <td>{r.company}</td>
                  <td className="num muted" style={{ fontSize: 12 }}>{r.email}</td>
                  <td><span className={`badge ${cls}`}><span className="dot" />{RLABEL[r.status] ?? r.status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="tfoot"><span>{recipients.length} 件中 {rows.length} 件を表示</span></div>
    </div>
  );
}
