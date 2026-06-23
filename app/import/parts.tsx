'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useUI } from '@/components/ui';
import { StatusBadge, TypeBadge, TagChips } from '@/components/ui-bits';
import { importAction, type ImportRow } from './actions';

const HEADERS = ['種別', '名称', '業種', 'エリア', '規模', '求めてること', '提供できること', 'ステータス', 'メモ'] as const;
const TEMPLATE =
  '﻿' +
  HEADERS.join(',') +
  '\n' +
  '法人,株式会社 山田製作所,製造,東京都,1億〜10億,販路拡大,金属加工,見込み,初回面談済み\n' +
  '個人事業主,さくら美容室,美容・理容,大阪府,〜1千万,集客,,見込み,\n';

type Props = {
  industries: string[];
  areas: string[];
  sizes: string[];
  statuses: string[];
  types: string[];
};

type GoodRow = ImportRow & { line: number };
type BadRow = { line: number; name: string; column: string; value: string; reason: string };

// 1行ぶんの CSV をパース（簡易・ダブルクォート対応）
function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else q = false;
      } else cur += ch;
    } else {
      if (ch === '"') q = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function splitTags(s: string): string[] {
  return s
    .split(';')
    .map((t) => t.trim())
    .filter(Boolean);
}

export function ImportFlow({ industries, areas, sizes, statuses, types }: Props) {
  const router = useRouter();
  const { toast, confirm } = useUI();
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ rows: number; cols: number; bytes: number } | null>(null);
  const [good, setGood] = useState<GoodRow[]>([]);
  const [bad, setBad] = useState<BadRow[]>([]);
  const [done, setDone] = useState(false);

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '顧客台帳_テンプレート.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast('テンプレCSVをダウンロードしました');
  };

  const onPick = (file: File) => {
    setFileName(file.name);
    setDone(false);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '').replace(/^﻿/, '');
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
      const g: GoodRow[] = [];
      const b: BadRow[] = [];
      const header = lines.length ? parseLine(lines[0]) : [];
      const headerOk = HEADERS.every((h, i) => header[i] === h);
      for (let i = 1; i < lines.length; i++) {
        const cells = parseLine(lines[i]);
        const line = i + 1;
        const get = (idx: number) => (cells[idx] ?? '').trim();
        const name = get(1);
        if (cells.length !== HEADERS.length) {
          b.push({ line, name: name || '—', column: '（列数）', value: '列ずれ', reason: `列数が一致しません（${HEADERS.length}列必要）` });
          continue;
        }
        const type = get(0);
        if (!name) {
          b.push({ line, name: '—', column: '名称', value: '（空）', reason: '必須項目が空です' });
          continue;
        }
        if (!type) {
          b.push({ line, name, column: '種別', value: '（空）', reason: '必須項目が空です' });
          continue;
        }
        if (!types.includes(type)) {
          b.push({ line, name, column: '種別', value: type, reason: `種別が不正です（${types.join(' / ')}）` });
          continue;
        }
        const industry = get(2);
        const area = get(3);
        const size = get(4);
        const status = get(7);
        // マスタ照合は緩く: 値があってマスタ外なら警告行（スキップ対象）にする。空は許容。
        if (area && areas.length && !areas.includes(area)) {
          b.push({ line, name, column: 'エリア', value: area, reason: 'マスタ外の値' });
          continue;
        }
        if (size && sizes.length && !sizes.includes(size)) {
          b.push({ line, name, column: '規模', value: size, reason: '区分に存在しません' });
          continue;
        }
        if (status && statuses.length && !statuses.includes(status)) {
          b.push({ line, name, column: 'ステータス', value: status, reason: 'マスタ外の値' });
          continue;
        }
        g.push({
          line,
          type,
          name,
          industry: industry || undefined,
          area: area || undefined,
          size: size || undefined,
          needs: splitTags(get(5)),
          offers: splitTags(get(6)),
          status: status || undefined,
          notes: get(8) || undefined,
        });
      }
      if (!headerOk) {
        b.unshift({ line: 1, name: '—', column: 'ヘッダ', value: header.join(' / ') || '（空）', reason: `ヘッダが不正です（必要: ${HEADERS.join(',')}）` });
      }
      setMeta({ rows: Math.max(0, lines.length - 1), cols: header.length, bytes: file.size });
      setGood(g);
      setBad(b);
    };
    reader.readAsText(file, 'utf-8');
  };

  const runImport = () => {
    if (!good.length) {
      toast('取込可能な行がありません');
      return;
    }
    confirm({
      title: `${good.length} 件を取り込みますか？`,
      body: `検証OKの ${good.length} 行を登録します。${bad.length ? `エラー ${bad.length} 行はスキップされます。` : ''}`,
      confirmLabel: '取込実行',
      onConfirm: () =>
        new Promise<void>((resolve) => {
          start(async () => {
            const rows: ImportRow[] = good.map(({ line: _l, ...r }) => r);
            const res = await importAction(rows);
            setDone(true);
            toast(`${res.ok} 件を取り込みました${res.failed ? `（${res.failed} 件失敗）` : ''}`);
            setTimeout(() => router.push('/companies'), 900);
            resolve();
          });
        }),
    });
  };

  const fmtKB = (b: number) => `${Math.max(1, Math.round(b / 1024))} KB`;
  const preview = good.slice(0, 5);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>CSV取込（企業単位）</h2>
          <div className="sub">UTF-8（BOM付）・日本語ヘッダ。検証OKの行だけ取り込み、NG行はスキップします。</div>
        </div>
        <div className="actions">
          <button className="btn" onClick={downloadTemplate}>テンプレCSVをダウンロード</button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
        }}
      />

      <div className="panel">
        <div className="panel-body row" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <div className="avatar" style={{ background: 'var(--green-50)', color: 'var(--green-600)', width: 40, height: 40, borderRadius: 8 }}>CSV</div>
            <div>
              {fileName ? (
                <>
                  <div className="b">{fileName}</div>
                  <div className="muted num" style={{ fontSize: 12.5 }}>{meta ? `${meta.rows} 行 ・ ${meta.cols} 列 ・ ${fmtKB(meta.bytes)}` : ''}</div>
                </>
              ) : (
                <>
                  <div className="b">CSVファイルを選択してください</div>
                  <div className="muted" style={{ fontSize: 12.5 }}>ヘッダ: {HEADERS.join('・')}（求/提タグは「;」区切り）</div>
                </>
              )}
            </div>
          </div>
          <div className="row">
            <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>{fileName ? 'ファイルを変更' : 'ファイルを選択'}</button>
          </div>
        </div>
      </div>

      {fileName && (
        <>
          <div className="row mt16" style={{ gap: 10 }}>
            <div className="banner ok" style={{ flex: 1 }}><span><b>{good.length} 行</b> が取込可能</span></div>
            <div className="banner warn" style={{ flex: 1 }}><span><b>{bad.length} 行</b> にエラー（スキップ対象）</span></div>
          </div>

          <div className="panel mt16">
            <div className="panel-head"><h3>取り込まれる内容（先頭プレビュー）</h3><span className="count num">{good.length} 行のうち先頭 {preview.length} 行</span></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>名称</th><th>種別</th><th>業種</th><th>エリア</th><th>規模</th><th>ステータス</th><th>求 / 提</th></tr></thead>
                <tbody>
                  {preview.length === 0 && (
                    <tr style={{ cursor: 'default' }}><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 24 }}>取込可能な行がありません。</td></tr>
                  )}
                  {preview.map((r) => (
                    <tr key={r.line} style={{ cursor: 'default' }}>
                      <td className="name">{r.name}</td>
                      <td><TypeBadge type={r.type} /></td>
                      <td>{r.industry || '—'}</td>
                      <td>{r.area || '—'}</td>
                      <td className="num">{r.size || '—'}</td>
                      <td>{r.status ? <StatusBadge status={r.status} /> : <span className="muted">見込み</span>}</td>
                      <td><TagChips needs={r.needs} offers={r.offers} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="tfoot"><span className="muted">未知の求/提タグは取込時にタグマスタへ追加されます。</span></div>
          </div>

          {bad.length > 0 && (
            <div className="panel mt16">
              <div className="panel-head"><h3>エラー（スキップ対象）</h3><span className="count num">{bad.length} 件</span></div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>行</th><th>名称</th><th>列</th><th>内容</th><th>エラー理由</th></tr></thead>
                  <tbody>
                    {bad.map((r, i) => (
                      <tr key={i} style={{ cursor: 'default' }}>
                        <td className="num">{r.line}</td>
                        <td>{r.name}</td>
                        <td>{r.column}</td>
                        <td className="muted">{r.value}</td>
                        <td style={{ color: 'var(--red-600)' }}>{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="tfoot"><span className="muted">未知の求/提タグは取込時にマスタへ追加されます。</span></div>
            </div>
          )}

          <div className="row mt16" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => router.push('/companies')}>キャンセル</button>
            <button className="btn btn-primary" disabled={pending || done || good.length === 0} onClick={runImport}>
              {pending ? '取込中…' : `${good.length} 件を取り込む`}
            </button>
          </div>
        </>
      )}
    </>
  );
}
