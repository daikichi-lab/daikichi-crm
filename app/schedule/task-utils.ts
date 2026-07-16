// 期限・タスク v2 の共有型・表示ヘルパ（クライアント/サーバ両用の純関数）。
// 日付は 'YYYY-MM-DD' 文字列で受け、TZ差異を避けるため UTC 日数で計算する。

export type TaskItem = {
  id: string;
  parent_id: string | null;
  company: string | null;
  company_id: string | null;
  kind: string;
  title: string;
  due_date: string | null;
  start_date: string | null;
  source: string;
  status: string;
  assignee: string | null;
  assignee_id: string | null;
  scope: 'client' | 'internal';
  progress: number;
  kids: number;
  bucket: string;
};

export type ScheduleCounts = {
  count: number; parents: number; children: number;
  overdue: number; week: number; week_due: number; month: number; tax_month: number;
  open: number; done_month: number;
  scope_all: number; scope_client: number; scope_internal: number;
  today: string;
};

export const KINDS = ['決算準備', '申告・納付', '年末調整', '手動タスク', '所内業務'];
export const STATUSES = ['未対応', '対応中', '完了'];
export const STATUS_BADGE: Record<string, string> = { 未対応: 'dormant', 対応中: 'prospect', 完了: 'active' };

export function kindClass(kind: string) {
  if (kind.includes('決算')) return 't-kessan';
  if (kind.includes('申告') || kind.includes('納付') || kind.includes('源泉')) return 't-shinkoku';
  if (kind.includes('年末') || kind.includes('調書')) return 't-nencho';
  if (kind.includes('所内')) return 't-office';
  return 't-task';
}

/** ガント/カレンダーの色クラス（kessan/shinkoku/office/task） */
export function ganttKind(kind: string, scope: string) {
  if (scope === 'internal' || kind.includes('所内')) return 'office';
  if (kind.includes('決算')) return 'kessan';
  if (kind.includes('申告') || kind.includes('納付') || kind.includes('源泉') || kind.includes('年末')) return 'shinkoku';
  return 'task';
}

/** 'YYYY-MM-DD' → 通算日数（UTC基準） */
export function dayNum(s: string): number {
  return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
}

/** 通算日数 → {y,m,d,wd}（wd: 0=日） */
export function dayInfo(n: number): { y: number; m: number; d: number; wd: number } {
  const dt = new Date(n * 86400000);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), wd: dt.getUTCDay() };
}

/** 'YYYY-MM-DD' → 'M/D' */
export function fmtMD(s?: string | null): string {
  return s ? `${+s.slice(5, 7)}/${+s.slice(8, 10)}` : '';
}

export type DueMeta = { md: string; diff: number | null; isToday: boolean; label: string; cls: 'over' | 'soon' | 'later' | '' };

/** 期日の残り日数表示（「あと◯日」「◯日 超過」「今日」） */
export function dueMeta(due: string | null, today: string, done: boolean): DueMeta {
  if (!due) return { md: '—', diff: null, isToday: false, label: '', cls: '' };
  const diff = dayNum(due) - dayNum(today);
  const md = fmtMD(due);
  if (done) return { md, diff, isToday: false, label: '', cls: '' };
  if (diff < 0) return { md, diff, isToday: false, label: `${-diff}日 超過`, cls: 'over' };
  if (diff === 0) return { md, diff, isToday: true, label: '今日', cls: '' };
  if (diff <= 3) return { md, diff, isToday: false, label: `あと${diff}日`, cls: 'soon' };
  return { md, diff, isToday: false, label: `あと${diff}日`, cls: 'later' };
}

/** 会社名の短縮（ボード/ガントの詰め表示用） */
export function shortCo(name?: string | null): string {
  if (!name) return '';
  return name.replace(/^(株式会社|合同会社|有限会社)\s*/, '').replace(/\s*(株式会社|合同会社|有限会社)$/, '');
}
