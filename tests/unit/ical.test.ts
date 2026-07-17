import { describe, it, expect } from 'vitest';
import {
  escapeText,
  foldLine,
  utcStamp,
  tasksToIcal,
  meetingsToIcal,
} from '../../lib/ical';

const NOW = new Date('2026-07-17T01:02:03Z');

describe('escapeText', () => {
  it('escapes backslash, semicolon, comma and newlines', () => {
    expect(escapeText('a;b,c\\d')).toBe('a\\;b\\,c\\\\d');
    expect(escapeText('line1\nline2')).toBe('line1\\nline2');
    expect(escapeText('a\r\nb')).toBe('a\\nb');
  });
});

describe('foldLine', () => {
  it('keeps short lines intact', () => {
    expect(foldLine('SUMMARY:hi')).toBe('SUMMARY:hi');
  });
  it('folds long lines with a leading space and CRLF, without splitting multibyte chars', () => {
    const long = 'DESCRIPTION:' + 'あ'.repeat(60); // 3 bytes each → well over 75 octets
    const folded = foldLine(long);
    expect(folded).toContain('\r\n ');
    // every continuation starts with a single space
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (let i = 1; i < parts.length; i++) expect(parts[i].startsWith(' ')).toBe(true);
    // no mojibake: rejoining (dropping fold) recovers the original
    const rejoined = parts.map((p, i) => (i === 0 ? p : p.slice(1))).join('');
    expect(rejoined).toBe(long);
    // each physical line ≤ 75 octets
    const enc = new TextEncoder();
    for (const p of parts) expect(enc.encode(p).length).toBeLessThanOrEqual(75);
  });
});

describe('utcStamp', () => {
  it('formats a Date as UTC basic form with Z', () => {
    expect(utcStamp(NOW)).toBe('20260717T010203Z');
  });
});

describe('tasksToIcal', () => {
  const ics = tasksToIcal(
    [
      { id: 't1', title: '決算準備; 5月', due_date: '2026-08-31', start_date: '2026-06-01', company: 'みどり食堂', status: '未対応', assignee: '山田', kind: '決算準備' },
      { id: 't2', title: '完了タスク', due_date: '2026-07-01', status: '完了' },
      { id: 't3', title: '期日なし', due_date: null },
    ],
    { now: NOW, domain: 'test' },
  );

  it('wraps with a VCALENDAR envelope and JST timezone', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('BEGIN:VTIMEZONE');
    expect(ics).toContain('TZID:Asia/Tokyo');
  });
  it('emits one VTODO per task with escaped summary and stable UID', () => {
    expect(ics.match(/BEGIN:VTODO/g)?.length).toBe(3);
    expect(ics).toContain('UID:task-t1@test');
    expect(ics).toContain('SUMMARY:決算準備\\; 5月');
    expect(ics).toContain('DUE;VALUE=DATE:20260831');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260601');
    expect(ics).toContain('DESCRIPTION:顧客: みどり食堂 / 担当: 山田 / 区分: 決算準備');
  });
  it('marks completed tasks COMPLETED and open tasks NEEDS-ACTION', () => {
    expect(ics).toContain('STATUS:COMPLETED');
    expect(ics).toContain('PERCENT-COMPLETE:100');
    expect(ics).toContain('STATUS:NEEDS-ACTION');
  });
  it('uses CRLF line endings', () => {
    expect(ics.includes('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '').includes('\n')).toBe(false);
  });

  it('長い日本語タイトル(>75オクテット)を二重折返しせず、unfoldで完全復元できる', () => {
    const title = '決算準備' + 'あ'.repeat(40); // 3B×多数 → 余裕で75オクテット超
    const out = tasksToIcal([{ id: 'long', title, due_date: '2026-08-31' }], { now: NOW, domain: 'test' });
    // 物理行はすべて75オクテット以内、裸のCRは無い（\r は必ず \r\n の一部）
    const enc = new TextEncoder();
    const physical = out.split('\r\n');
    for (const p of physical) {
      expect(enc.encode(p).length).toBeLessThanOrEqual(75);
      expect(p.includes('\r')).toBe(false);
      expect(p.includes('\n')).toBe(false);
    }
    // RFC5545 unfold（CRLF+先頭スペースを除去）→ SUMMARY 論理行が元タイトルを復元
    const unfolded = out.replace(/\r\n[ \t]/g, '');
    const summaryLine = unfolded.split('\r\n').find((l) => l.startsWith('SUMMARY:'));
    expect(summaryLine).toBe(`SUMMARY:${title}`);
  });
});

describe('meetingsToIcal', () => {
  const ics = meetingsToIcal(
    [
      { id: 'm1', title: '定例MTG', start: '2026-07-20 14:30', location: 'Zoom', company: 'ABC商事', attendees: ['田中', '佐藤'] },
      { id: 'm2', title: '開始未定', start: null },
    ],
    { now: NOW, domain: 'test' },
  );

  it('emits a VEVENT for scheduled meetings and skips undated ones', () => {
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(1);
    expect(ics).toContain('UID:meeting-m1@test');
    expect(ics).toContain('DTSTART;TZID=Asia/Tokyo:20260720T143000');
    // default 60min duration → 15:30
    expect(ics).toContain('DTEND;TZID=Asia/Tokyo:20260720T153000');
    expect(ics).toContain('LOCATION:Zoom');
    expect(ics).toContain('SUMMARY:定例MTG');
    // commas inside text values are RFC-escaped
    expect(ics).toContain('DESCRIPTION:顧客: ABC商事 / 出席: 田中\\, 佐藤');
  });

  it('rolls the end time across the hour/day boundary', () => {
    const late = meetingsToIcal([{ id: 'x', title: '夜間', start: '2026-07-20 23:45' }], { now: NOW, domain: 'test' });
    expect(late).toContain('DTSTART;TZID=Asia/Tokyo:20260720T234500');
    expect(late).toContain('DTEND;TZID=Asia/Tokyo:20260721T004500');
  });
});
