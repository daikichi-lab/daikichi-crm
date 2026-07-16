import { describe, it, expect } from 'vitest';
import { escapeCsvCell, companiesToCsv, parseCompaniesCsv } from '@/lib/csv';

describe('escapeCsvCell — フォーミュラインジェクション対策(SEC-6)', () => {
  it('= + - @ 始まりは ' + "' でエスケープ", () => {
    expect(escapeCsvCell('=1+2')).toBe("'=1+2");
    expect(escapeCsvCell('+80012345')).toBe("'+80012345");
    expect(escapeCsvCell('-1')).toBe("'-1");
    expect(escapeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });
  it('通常文字列はそのまま', () => {
    expect(escapeCsvCell('株式会社 大吉商事')).toBe('株式会社 大吉商事');
    expect(escapeCsvCell('集客')).toBe('集客');
  });
  it('カンマ/改行/引用符を含むセルは "" で囲みエスケープ', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('a"b')).toBe('"a""b"');
    expect(escapeCsvCell('a\nb')).toBe('"a\nb"');
  });
  it('null/undefined は空文字', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });
});

describe('companiesToCsv', () => {
  it('BOM・ヘッダ・タグ;区切り・危険セルのエスケープ', () => {
    const csv = companiesToCsv([
      { id: 'x', type: '法人', name: '=evil', industry: '卸売', area: '東京都', size: '1億〜10億', needs: ['集客', 'EC強化'], offers: ['食材卸'], status: '顧問中', notes: 'm', created_at: '2025-01-01' },
    ]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('ID,種別,名称');
    expect(csv).toContain('集客;EC強化');
    expect(csv).toContain("'=evil");
  });
});

describe('parseCompaniesCsv — 取込検証', () => {
  it('正常行を取り込み、種別;区切りタグを配列化', () => {
    const text = '種別,名称,業種,エリア,規模,求めてること,提供できること,ステータス,メモ\n法人,テスト商会,卸売,東京都,1億〜10億,集客;EC強化,食材卸,顧問中,メモ';
    const r = parseCompaniesCsv(text);
    expect(r.errors).toHaveLength(0);
    expect(r.ok).toHaveLength(1);
    expect(r.ok[0]).toMatchObject({ type: '法人', name: 'テスト商会', needs: ['集客', 'EC強化'], offers: ['食材卸'], status: '顧問中' });
  });
  it('名称空・不正種別・不正ステータスはエラー行', () => {
    const text = '種別,名称,ステータス\n法人,,顧問中\nＸ社,会社A,顧問中\n法人,会社B,不明ステータス';
    const r = parseCompaniesCsv(text);
    expect(r.ok.length).toBe(0);
    expect(r.errors.length).toBe(3);
  });
});
