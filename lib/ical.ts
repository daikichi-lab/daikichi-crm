// iCalendar (RFC 5545) の書き出し。外部依存ゼロの純関数。
// 用途: 期限・タスク(VTODO) と 打ち合わせ(VEVENT) を Google/Outlook/Apple カレンダーへ
// 取り込める .ics として出力する（Google連携=OAuthの無料・一方向の代替）。
// タイムゾーンは日本固定（JST=+09:00・DSTなし）。

const PRODID = '-//Daikichi CRM//JP';
const TZID = 'Asia/Tokyo';

// JST の VTIMEZONE（固定オフセット）。DTSTART を TZID 付きで書くために同梱する。
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${TZID}`,
  'BEGIN:STANDARD',
  'DTSTART:19700101T000000',
  'TZOFFSETFROM:+0900',
  'TZOFFSETTO:+0900',
  'TZNAME:JST',
  'END:STANDARD',
  'END:VTIMEZONE',
];

/** RFC 5545 テキスト値のエスケープ（\ ; , と改行）。 */
export function escapeText(v: string): string {
  return String(v ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** 1行を75オクテットで折り返す（UTF-8のマルチバイト境界を割らない）。継続行は先頭スペース。 */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let curBytes = 0;
  let limit = 75; // 先頭行は75、継続行は space 1byte 込みで74相当
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (curBytes + b > limit) {
      out.push(cur);
      cur = ch;
      curBytes = b;
      limit = 74; // 継続行はスペース1つ分を差し引く
    } else {
      cur += ch;
      curBytes += b;
    }
  }
  if (cur) out.push(cur);
  return out.map((s, i) => (i === 0 ? s : ' ' + s)).join('\r\n');
}

/** 'YYYY-MM-DD' → 'YYYYMMDD'（VALUE=DATE 用）。不正は null。 */
function dateOnly(s?: string | null): string | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[1]}${m[2]}${m[3]}` : null;
}

/** 'YYYY-MM-DD HH:MM'（JST・ローカル）→ 'YYYYMMDDTHHMMSS'（TZID=Asia/Tokyo と併用）。 */
function localDateTime(s?: string | null): string | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s);
  return m ? `${m[1]}${m[2]}${m[3]}T${m[4]}${m[5]}00` : null;
}

/** Date → UTC 'YYYYMMDDTHHMMSSZ'（DTSTAMP 用）。 */
export function utcStamp(d: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

/** 'YYYYMMDD' に日数を足す（VTODO の DUE を VALUE=DATE の翌日=終了日にしない用途では未使用）。 */
function addMinutesLocal(dt: string, minutes: number): string {
  // dt: 'YYYYMMDDTHHMMSS'（ローカル）。分を加算して同形式で返す。
  const y = +dt.slice(0, 4), mo = +dt.slice(4, 6), d = +dt.slice(6, 8);
  const h = +dt.slice(9, 11), mi = +dt.slice(11, 13);
  const base = Date.UTC(y, mo - 1, d, h, mi + minutes);
  const b = new Date(base);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${b.getUTCFullYear()}${p(b.getUTCMonth() + 1)}${p(b.getUTCDate())}` +
    `T${p(b.getUTCHours())}${p(b.getUTCMinutes())}00`
  );
}

export type IcalTask = {
  id: string;
  title: string;
  due_date: string | null;
  start_date?: string | null;
  company?: string | null;
  status?: string | null;
  assignee?: string | null;
  kind?: string | null;
};

export type IcalMeeting = {
  id: string;
  title: string;
  start: string | null; // 'YYYY-MM-DD HH:MM'（JST）
  end?: string | null;
  location?: string | null;
  company?: string | null;
  attendees?: string[] | null;
  durationMinutes?: number;
};

type BuildOpts = { now?: Date; domain?: string; calName?: string };

function wrap(lines: string[], calName: string): string {
  const head = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${escapeText(calName)}`),
    `X-WR-TIMEZONE:${TZID}`,
    ...VTIMEZONE,
  ];
  const all = [...head, ...lines, 'END:VCALENDAR'];
  return all.map(foldLine).join('\r\n') + '\r\n';
}

/** 期限・タスクを VTODO の集合として .ics 文字列に。 */
export function tasksToIcal(tasks: IcalTask[], opts: BuildOpts = {}): string {
  const now = opts.now ?? new Date();
  const domain = opts.domain ?? 'daikichi-crm';
  const stamp = utcStamp(now);
  const lines: string[] = [];
  for (const t of tasks) {
    const due = dateOnly(t.due_date);
    const start = dateOnly(t.start_date);
    const done = (t.status ?? '').includes('完了');
    const descParts = [
      t.company ? `顧客: ${t.company}` : null,
      t.assignee ? `担当: ${t.assignee}` : null,
      t.kind ? `区分: ${t.kind}` : null,
    ].filter(Boolean) as string[];
    lines.push('BEGIN:VTODO');
    lines.push(`UID:task-${t.id}@${domain}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(foldLine(`SUMMARY:${escapeText(t.title || '(無題)')}`));
    if (start) lines.push(`DTSTART;VALUE=DATE:${start}`);
    if (due) lines.push(`DUE;VALUE=DATE:${due}`);
    if (descParts.length) lines.push(foldLine(`DESCRIPTION:${escapeText(descParts.join(' / '))}`));
    lines.push(`STATUS:${done ? 'COMPLETED' : 'NEEDS-ACTION'}`);
    if (done) lines.push('PERCENT-COMPLETE:100');
    lines.push('END:VTODO');
  }
  return wrap(lines, opts.calName ?? '大吉CRM 期限・タスク');
}

/** 打ち合わせを VEVENT の集合として .ics 文字列に。 */
export function meetingsToIcal(meetings: IcalMeeting[], opts: BuildOpts = {}): string {
  const now = opts.now ?? new Date();
  const domain = opts.domain ?? 'daikichi-crm';
  const stamp = utcStamp(now);
  const lines: string[] = [];
  for (const m of meetings) {
    const start = localDateTime(m.start);
    if (!start) continue; // 開始未定の予定はスキップ
    const end = localDateTime(m.end) ?? addMinutesLocal(start, m.durationMinutes ?? 60);
    const descParts = [
      m.company ? `顧客: ${m.company}` : null,
      (m.attendees && m.attendees.length) ? `出席: ${m.attendees.join(', ')}` : null,
    ].filter(Boolean) as string[];
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:meeting-${m.id}@${domain}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;TZID=${TZID}:${start}`);
    lines.push(`DTEND;TZID=${TZID}:${end}`);
    lines.push(foldLine(`SUMMARY:${escapeText(m.title || '(打ち合わせ)')}`));
    if (m.location) lines.push(foldLine(`LOCATION:${escapeText(m.location)}`));
    if (descParts.length) lines.push(foldLine(`DESCRIPTION:${escapeText(descParts.join(' / '))}`));
    lines.push('END:VEVENT');
  }
  return wrap(lines, opts.calName ?? '大吉CRM 打ち合わせ');
}
