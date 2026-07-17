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

  it('@の前後に空白が入ったメールも詰めて拾う', () => {
    expect(parseBusinessCard('katayama @ sonylife.co.jp').email).toBe('katayama@sonylife.co.jp');
    expect(parseBusinessCard('E-mail: taro @example.co.jp').email).toBe('taro@example.co.jp');
  });

  it('@がaに誤読されmailラベルがある場合は復元する（, は _ に）', () => {
    expect(parseBusinessCard('E-mail!kazuhiro,katayamaasonylife.co.jp').email).toBe('kazuhiro_katayama@sonylife.co.jp');
  });

  it('mailラベルが無ければ@無しテキストからメールを捏造しない', () => {
    expect(parseBusinessCard('会社案内は当社ウェブへ').email).toBeUndefined();
  });

  it('郵便番号＋市区の行を住所と判定（〒・都道府県が無くても）', () => {
    const p = parseBusinessCard('220-8128横浜市西区みなとみらい2-2-1\n横浜ランドマークタワー28F\nTel 045-345-1840');
    expect(p.address).toContain('横浜市西区');
    expect(p.address).toContain('タワー');
  });

  it('社名に法人格があれば企業分類を法人に自動判定', () => {
    expect(parseBusinessCard('ソニー生命保険株式会社').type).toBe('法人');
    expect(parseBusinessCard('税理士法人 大吉会計').type).toBe('法人');
    expect(parseBusinessCard('みどり食堂').type).toBeUndefined(); // 屋号（個人事業主のまま既定）
  });

  it('吹き出し名刺: 次行がローマ字の氏名を優先し、別行の郵便番号から住所を組む', () => {
    const text = [
      'そ一だ', '西村に', '相談しよう',
      '株式会社Y･SK.DOB',
      'ネット事業部営業部長',
      '西村建郎',
      'TATSURONISHIMURA',
      '元607-8011',
      '京都市山科区安朱南屋敷町8-4',
      'ESTACION京都山科2階',
      'TEL:080-3101-5386',
    ].join('\n');
    const p = parseBusinessCard(text);
    expect(p.name).toBe('西村建郎');       // 「西村に」(吹き出し)ではなく本名
    expect(p.title).toBe('営業部長');
    expect(p.phone).toBe('080-3101-5386');
    expect(p.type).toBe('法人');
    expect(p.address).toContain('京都市山科区'); // 〒誤読(元)＋市区別行でも住所化
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

  it('字間スペースが入った役職も詰めてから最長一致（代表 取 締 役 → 代表取締役）', () => {
    expect(parseBusinessCard('代表 取 締 役\n東 広').title).toBe('代表取締役');
  });

  it('日本語氏名の後ろにローマ字が続くレイアウトから氏名を抽出（東 広 HIROSHI AZUMA）', () => {
    expect(parseBusinessCard('東 広  HIROSHI AZUMA').name).toBe('東 広');
    expect(parseBusinessCard('佐藤 太郎  TARO SATO').name).toBe('佐藤 太郎');
  });

  it('住所の字間スペースを詰め、末尾のOCRノイズを除去する', () => {
    const p = parseBusinessCard('〒578-0921 大 阪 府 東 大 阪 市 水 走 2 丁目 11-2 \\');
    expect(p.address).toContain('大阪府東大阪市');
    expect(p.address).not.toContain('\\');
  });

  it('郵便番号(〒607-8011)を電話に採用せず、本来のTEL(11桁)を拾う', () => {
    const p = parseBusinessCard('〒607-8011 京都市山科区安朱南屋敷町8-4\nTEL:080-3101-5386');
    expect(p.phone).toBe('080-3101-5386');
    expect(p.phone).not.toBe('07-8011');
  });

  it('住所は郵便番号行に続く市区町村・階の行も連結する', () => {
    const p = parseBusinessCard(
      ['〒607-8011', '京都市山科区安朱南屋敷町8-4', 'ESTACION京都山科 2階', 'TEL:080-3101-5386'].join('\n'),
    );
    expect(p.address).toContain('京都市山科区');
    expect(p.address).toContain('8-4');
  });

  it('営業部長を役職に採用（部長より優先）', () => {
    expect(parseBusinessCard('ネット事業部 営業部長\n西村 建郎').title).toBe('営業部長');
  });

  it('会社名の字間スペースを詰め、末尾のOCRノイズを除去する', () => {
    expect(parseBusinessCard('株 式 会 社 LIEN "%').company).toBe('株式会社 LIEN');
  });

  it('氏名が3トークンに割れても（西村 建 認）姓＋名に寄せて抽出する', () => {
    expect(parseBusinessCard('西村 建 認\nTATSURO NISHIMURA').name).toBe('西村 建認');
  });

  it('吹き出し/見出しのかな断片や見出しは氏名に採用しない（姓は漢字始まり）', () => {
    expect(parseBusinessCard('を 拓 に に ) (N').name).toBeUndefined();
    expect(parseBusinessCard('お 気軽 に お 問い 合わ せ').name).toBeUndefined();
    expect(parseBusinessCard('ネッ ト 事 業 部 営業 部 長').name).toBeUndefined();
  });

  it('「職種(カタカナ) 氏名(漢字) ロゴ」の1行から埋もれた氏名を拾う', () => {
    // PaddleOCR は役職・氏名・ロゴを1行にまとめがち。ローマ字を含む行に限り漢字氏名を抽出。
    expect(parseBusinessCard('フアイナンシャルプランナー 片山一弘 SonyLife').name).toBe('片山一弘');
  });

  it('ローマ字を含まない散文行からは埋もれた漢字語を氏名にしない', () => {
    expect(parseBusinessCard('お 気軽 に 問題 の ご 相談 を').name).toBeUndefined();
  });

  it('装飾名刺(写真/吹き出し/QR)の生OCRでも氏名・役職・電話・住所を拾う', () => {
    const text = [
      'k ャ ー に',
      'を 拓 に に ) (N',
      '\\ 相談 し よう  ]',
      '株 式 会 社 Y\'SK.DOB "%',
      'ネッ ト 事 業 部 営業 部 長',
      '西村 建 認',
      'TATSURO NISHIMURA',
      '〒607-8011',
      '| 京都 市 山科 区 安 朱 南 屋 敷 町 8-4',
      'ESTACION 京 都 山 科 2 階',
      '9 TEL:080-3101-5386',
    ].join('\n');
    const p = parseBusinessCard(text);
    expect(p.name).toBe('西村 建認');       // 「認」は「郎」のOCR誤読（人が補正）だが氏名欄は埋まる
    expect(p.title).toBe('営業部長');
    expect(p.phone).toBe('080-3101-5386');   // 郵便番号(07-8011)は電話にしない
    expect(p.company).toContain("Y'SK.DOB");
    expect(p.address).toContain('京都市山科区');
  });

  it('実カード相当の全文をまとめて振り分ける（字間スペース・ローマ字併記あり）', () => {
    const text = [
      '株式会社 L (NEN N',
      '代表 取締役',
      '東 広  HIROSHI AZUMA',
      '株式会社LIEN',
      '〒578-0921 大阪府東大阪市水走2丁目11-2 ;',
      'Tel.072-967-7170  Fax.072-967-7171',
      'Mail.azuma@lien.makeup  HP.https://lien.makeup',
      'Mobile.080-4403-5699',
    ].join('\n');
    const p = parseBusinessCard(text);
    expect(p.company).toBe('株式会社LIEN');
    expect(p.title).toBe('代表取締役');
    expect(p.name).toBe('東 広');
    expect(p.email).toBe('azuma@lien.makeup');
    expect(p.phone).toBe('072-967-7170');
    expect(p.mobile).toBe('080-4403-5699');
    expect(p.url).toBe('https://lien.makeup');
    expect(p.address).toContain('大阪府東大阪市');
    expect(p.address).not.toContain(';');
  });
});
