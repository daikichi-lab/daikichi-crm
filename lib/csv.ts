// CSV ユーティリティ。SEC-6: 書き出し時のフォーミュラインジェクション対策、取込時の検証。

/** CSV式インジェクション対策: =,+,-,@ や制御文字始まりのセルを ' でエスケープ。 */
export function escapeCsvCell(value: unknown): string {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCsvRow(cells: unknown[]): string {
  return cells.map(escapeCsvCell).join(',');
}

export const CSV_HEADERS = ['ID', '種別', '名称', '業種', 'エリア', '規模', '求めてること', '提供できること', 'ステータス', 'メモ', '登録日'] as const;
export const CSV_IMPORT_HEADERS = ['種別', '名称', '業種', 'エリア', '規模', '求めてること', '提供できること', 'ステータス', 'メモ'] as const;

type CompanyRow = {
  id: string; type: string; name: string; industry: string | null; area: string | null; size: string | null;
  needs: string[]; offers: string[]; status: string; notes?: string | null; created_at?: string | null;
};

/** 企業一覧を CSV 文字列へ（UTF-8 BOM 付き想定・タグは ; 区切り）。 */
export function companiesToCsv(rows: CompanyRow[]): string {
  const lines = [toCsvRow([...CSV_HEADERS])];
  for (const c of rows) {
    lines.push(toCsvRow([
      c.id, c.type, c.name, c.industry ?? '', c.area ?? '', c.size ?? '',
      (c.needs ?? []).join(';'), (c.offers ?? []).join(';'), c.status, c.notes ?? '', c.created_at ?? '',
    ]));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

// ---- 取込（パース＋検証） ----
export type ParsedCompany = {
  type: string; name: string; industry?: string; area?: string; size?: string;
  needs: string[]; offers: string[]; status?: string; notes?: string;
};
export type ParseResult = {
  ok: ParsedCompany[];
  errors: { line: number; message: string; raw: string }[];
};

/** 1行をフィールド配列へ（簡易CSV: ダブルクォート対応）。 */
export function splitCsvLine(line: string): string[] {
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
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const TYPES = ['法人', '個人事業主'];
const STATUSES = ['顧問中', '見込み', '休眠'];

/** 取込CSXをパース・検証。種別/名称は必須、種別/ステータスは区分照合。 */
export function parseCompaniesCsv(text: string): ParseResult {
  const ok: ParsedCompany[] = [];
  const errors: ParseResult['errors'] = [];
  const clean = text.replace(/^﻿/, '');
  const rows = clean.split(/\r?\n/).filter((r) => r.trim() !== '');
  if (rows.length === 0) return { ok, errors };
  const header = splitCsvLine(rows[0]).map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const iType = idx('種別'), iName = idx('名称');
  for (let r = 1; r < rows.length; r++) {
    const cells = splitCsvLine(rows[r]);
    const get = (name: string) => { const i = idx(name); return i >= 0 ? (cells[i] ?? '').trim() : ''; };
    const type = iType >= 0 ? (cells[iType] ?? '').trim() : '';
    const name = iName >= 0 ? (cells[iName] ?? '').trim() : '';
    if (!name) { errors.push({ line: r + 1, message: '名称が空です', raw: rows[r] }); continue; }
    if (type && !TYPES.includes(type)) { errors.push({ line: r + 1, message: `種別が不正: ${type}`, raw: rows[r] }); continue; }
    const status = get('ステータス');
    if (status && !STATUSES.includes(status)) { errors.push({ line: r + 1, message: `ステータスが不正: ${status}`, raw: rows[r] }); continue; }
    ok.push({
      type: type || '法人', name,
      industry: get('業種') || undefined, area: get('エリア') || undefined, size: get('規模') || undefined,
      needs: get('求めてること').split(';').map((s) => s.trim()).filter(Boolean),
      offers: get('提供できること').split(';').map((s) => s.trim()).filter(Boolean),
      status: status || '見込み', notes: get('メモ') || undefined,
    });
  }
  return { ok, errors };
}
