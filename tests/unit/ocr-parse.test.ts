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

  // --- 以下、実カード(株式会社LIEN)で顕在化した取りこぼしの回帰テスト ---

  it('同一行に Tel と Fax が並んでも Tel を電話に採用し Fax は無視する', () => {
    const p = parseBusinessCard('Tel.072-967-7170  Fax.072-967-7171');
    expect(p.phone).toBe('072-967-7170');
  });

  it('Mobile ラベルの携帯を拾う', () => {
    const p = parseBusinessCard('Mobile.080-4403-5699');
    expect(p.mobile).toBe('080-4403-5699');
  });

  it('メールの "Mail." ラベルをローカル部から除去する', () => {
    const p = parseBusinessCard('Mail.azuma@lien.makeup');
    expect(p.email).toBe('azuma@lien.makeup');
  });

  it('ローカル部が "mail" の普通のメールは変えない', () => {
    expect(parseBusinessCard('mail@example.com').email).toBe('mail@example.com');
    expect(parseBusinessCard('info@example.co.jp').email).toBe('info@example.co.jp');
  });

  it('会社名は化けたロゴ行より綺麗な候補を優先する', () => {
    const text = [
      '株式会社 L (NEN N',
      '代表取締役',
      '東 広',
      '株式会社LIEN',
      '〒578-0921 大阪府東大阪市水走2丁目11-2',
    ].join('\n');
    const p = parseBusinessCard(text);
    expect(p.company).toBe('株式会社LIEN');
  });

  it('役職は最長一致を優先（代表取締役 > 代表）', () => {
    expect(parseBusinessCard('代表取締役 東 広').title).toBe('代表取締役');
  });

  it('住所の字間スペースを詰め、末尾のOCRノイズを除去する', () => {
    const p = parseBusinessCard('〒578-0921 大 阪 府 東 大 阪 市 水 走 2 丁目 11-2 \\');
    expect(p.address).toContain('大阪府東大阪市');
    expect(p.address).not.toContain('\\');
  });

  it('実カード相当の全文をまとめて振り分ける', () => {
    const text = [
      '株式会社 L (NEN N',
      '代表取締役',
      '東 広  HIROSHI AZUMA',
      '株式会社LIEN',
      '〒578-0921 大阪府東大阪市水走2丁目11-2',
      'Tel.072-967-7170  Fax.072-967-7171',
      'Mail.azuma@lien.makeup  HP.https://lien.makeup',
      'Mobile.080-4403-5699',
    ].join('\n');
    const p = parseBusinessCard(text);
    expect(p.company).toBe('株式会社LIEN');
    expect(p.title).toBe('代表取締役');
    expect(p.email).toBe('azuma@lien.makeup');
    expect(p.phone).toBe('072-967-7170');
    expect(p.mobile).toBe('080-4403-5699');
    expect(p.url).toBe('https://lien.makeup');
    expect(p.address).toContain('大阪府東大阪市');
  });
});
