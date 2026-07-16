import { describe, it, expect } from 'vitest';
import { parseBusinessCard } from '../../app/scan/ocr-parse';

describe('parseBusinessCard', () => {
  it('株式会社名刺から会社・氏名・役職・連絡先を振り分ける', () => {
    const text = [
      '株式会社 大吉商事',
      '営業部 部長',
      '佐藤 太郎',
      '東京都千代田区丸の内1-2-3',
      'TEL 03-1234-5678',
      '携帯 090-1111-2222',
      'sato@daikichi-shoji.co.jp',
      'https://daikichi-shoji.co.jp',
    ].join('\n');
    const p = parseBusinessCard(text);
    expect(p.company).toBe('株式会社 大吉商事');
    expect(p.title).toBe('部長');
    expect(p.name).toBe('佐藤 太郎');
    expect(p.address).toContain('東京都');
    expect(p.phone).toBe('03-1234-5678');
    expect(p.mobile).toBe('090-1111-2222');
    expect(p.email).toBe('sato@daikichi-shoji.co.jp');
    expect(p.url).toBe('https://daikichi-shoji.co.jp');
  });

  it('個人事業主（屋号＋店主）を拾う', () => {
    const text = ['みどり食堂', '店主', '緑川 みどり', '大阪府大阪市中央区…', 'midori@example.co.jp'].join('\n');
    const p = parseBusinessCard(text);
    expect(p.company).toBe('みどり食堂');
    expect(p.title).toBe('店主');
    expect(p.name).toBe('緑川 みどり');
    expect(p.email).toBe('midori@example.co.jp');
  });

  it('FAX行は電話番号に採用しない', () => {
    const text = ['合同会社テック', 'TEL: 06-1000-2000', 'FAX: 06-1000-2001', '田中 次郎'].join('\n');
    const p = parseBusinessCard(text);
    expect(p.phone).toBe('06-1000-2000');
    expect(p.name).toBe('田中 次郎');
  });

  it('空文字・雑テキストでも例外を投げず空に近い結果', () => {
    expect(parseBusinessCard('')).toEqual({});
    const p = parseBusinessCard('ありがとうございました\n1234');
    expect(p.email).toBeUndefined();
    expect(p.company).toBeUndefined();
  });

  it('携帯番号(080始まり)はラベル無しでも mobile に入る', () => {
    const p = parseBusinessCard('山田 花子\n080-3333-4444');
    expect(p.mobile).toBe('080-3333-4444');
    expect(p.phone).toBeUndefined();
    expect(p.name).toBe('山田 花子');
  });
});
