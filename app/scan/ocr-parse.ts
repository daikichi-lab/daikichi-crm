// 名刺OCRテキスト → 項目の振り分け（ヒューリスティクス・純関数）。
// Tesseract.js の抽出結果は必ず人が確認・補正する前提（C: 抽出結果は人が確認）。
// 外部依存なし・決定的なので単体テストできる。

export type ParsedCard = {
  company?: string;
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  url?: string;
  type?: '法人' | '個人事業主';
};

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const URL_RE = /\bhttps?:\/\/[^\s<>"']+/i;
// 電話番号: 市外局番-…-… / 0AB0-… / +81…。1行に複数（Tel/Fax等）あるので g で全件走査する。
const PHONE_G = /(?:\+81[\s-]?|0)\d{1,4}[\s-]?\d{1,4}[\s-]?\d{3,4}/g;

const COMPANY_MARK = /(株式会社|有限会社|合同会社|合名会社|合資会社|一般社団法人|公益社団法人|税理士法人|事務所|商店|商事|工業|製作所|食堂|農園|牧場|クリニック|医院|株)/;
// 法人格（これを含む社名は「法人」と自動判定）。
const CORP_MARK = /(株式会社|有限会社|合同会社|合名会社|合資会社|相互会社|一般社団法人|一般財団法人|公益社団法人|公益財団法人|税理士法人|弁護士法人|司法書士法人|行政書士法人|医療法人|社会福祉法人|学校法人|宗教法人|特定非営利活動法人|協同組合|信用金庫|信用組合)/;
// 役職キーワードは「長い＝具体的」を先に置き、最長一致を優先（代表取締役 > 代表）。
const TITLE_KEYWORDS = [
  '代表取締役', '代表社員', '代表理事', '取締役', '理事長', '執行役員',
  '事業本部長', '統括本部長', '営業本部長', '事業部長', '営業部長',
  '本部長', '部門長', '副部長', '支店長', '工場長', '室長',
  'マネージャー', 'ディレクター', 'プロデューサー', 'オーナー',
  '会長', '社長', '専務', '常務', '部長', '次長', '課長', '係長', '主幹', '主査', '主任',
  '店主', '店長', '所長', '園長', '院長',
  'CEO', 'COO', 'CFO', 'CTO', '代表',
];
const TITLE_MARK = new RegExp(`(${TITLE_KEYWORDS.join('|')})`);
const ADDR_MARK = /(〒|北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/;
const NAME_LABEL = /(氏\s*名|名\s*前|担当)[:：]?\s*(.+)$/;
// 日本語（漢字・かな）の1文字クラス（住所の字間スペース詰め等に使う）。
const JP_CHAR = /[一-龯ぁ-ゟ゠-ヿ々〆〤]/;

function cleanLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** 日本語文字どうしの間に入った空白を詰める（OCRは「代 表 取 締 役」等と字間を空けがち）。 */
function despaceJp(s: string): string {
  return s.replace(new RegExp(`(${JP_CHAR.source})\\s+(?=${JP_CHAR.source})`, 'g'), '$1');
}

/** 行から日本語氏名を抽出する。
 *  - 「東 広  HIROSHI AZUMA」のようにローマ字併記、「西村 建 認」のように名が字間分割
 *    されるOCRに対応（先頭からの連続日本語トークンを姓＋名に寄せる）。
 *  - 吹き出し/見出しのかな断片（「を 拓 に に」「お 気軽に…」）を除くため、姓は漢字始まりに限定。 */
/** 日本語トークン列を氏名に整形（姓は漢字始まり・2〜6字）。該当なしは null。 */
function nameFromTokens(jp: string[]): string | null {
  if (jp.length === 0) return null;
  if (!/^[一-龯]/.test(jp[0])) return null; // 姓は漢字始まり（かな断片・見出しを除外）
  const joined = jp.join('');
  if (joined.length < 2 || joined.length > 6) return null; // 日本語氏名は概ね2〜6字
  if (/^[一-龯]+[はがのにへとでもをやねよわ]$/.test(joined)) return null; // 「西村に」等の助詞終わり（吹き出し）を除外
  // 「西村 建 認」→ 姓(先頭) + 名(残り連結) に寄せる。「佐藤 太郎」は「佐藤 太郎」のまま。
  return jp.length >= 2 ? `${jp[0]} ${jp.slice(1).join('')}` : jp[0];
}

function extractPersonName(line: string): string | null {
  const s = cleanLine(line);
  if (!s || /[@/]/.test(s)) return null;
  if (COMPANY_MARK.test(s) || ADDR_MARK.test(s)) return null;
  if (TITLE_MARK.test(despaceJp(s))) return null; // 字間スペース入りの役職も弾く
  const isJpToken = new RegExp(`^${JP_CHAR.source}+$`);
  const tokens = s.split(/\s+/);
  // (a) 先頭からの連続日本語トークン（「姓 名 [ローマ字]」レイアウト）
  const lead: string[] = [];
  for (const t of tokens) {
    if (isJpToken.test(t)) lead.push(t);
    else break; // 最初の非日本語トークン（ローマ字/数字/記号）で打ち切り
  }
  const byLead = nameFromTokens(lead);
  if (byLead) return byLead;
  // (b) 行にローマ字/ロゴを含む「職種(カタカナ) 氏名(漢字) Logo」型は、埋もれた漢字氏名トークンを拾う。
  //     （ローマ字を含む行に限定＝「お気軽にお問い合わせ」等の散文での誤検出を避ける）
  if (/[A-Za-z]/.test(s)) {
    for (const t of tokens) {
      if (!isJpToken.test(t)) continue;
      const n = nameFromTokens([t]);
      if (n) return n;
    }
  }
  return null;
}

/** メール正規表現は "Mail." 等のラベルをローカル部に巻き込むことがある。
 *  ラベル＋区切りの後ろに本来のローカル部が続く場合だけ、ラベルを剥がす。 */
function stripEmailLabel(email: string): string {
  return email.replace(/^(?:e-?mail|mailto|mail|メール)[._:\-]+(?=[^@]+@)/i, '');
}

/** OCRで字間に空白が入りがちな住所を整形。日本語字間の空白を詰め、末尾ノイズ(\ | / 等)を除去。 */
function cleanAddress(line: string): string {
  const s = line
    .replace(/\\+/g, '')                                    // 迷い込んだバックスラッシュ
    .replace(/^[\s|/<>「」『』｜]+/g, '')                    // 先頭のOCRノイズ（| 等）
    .replace(new RegExp(`(${JP_CHAR.source})\\s+`, 'g'), '$1')       // 日本語の直後の空白を詰める
    .replace(new RegExp(`\\s+(${JP_CHAR.source})`, 'g'), '$1')       // 日本語の直前の空白を詰める
    .replace(/[\s|/<>~^;；:：,，、・]+$/g, '');               // 末尾のOCRノイズ（; 等の記号も）
  return cleanLine(s);
}

/** 会社名候補のうち「化け」が少ない行を選ぶためのスコア（小さいほど綺麗）。 */
function companyGarbageScore(line: string): number {
  const brackets = (line.match(/[()[\]{}|\\<>~^`_]/g) || []).length;
  const isolatedLatin = line.split(/\s+/).filter((t) => /^[A-Za-z]$/.test(t)).length;
  const digits = (line.match(/[0-9]/g) || []).length;
  return brackets * 3 + isolatedLatin * 2 + digits;
}

/** 会社名の整形: 末尾のOCRノイズ(" % 等)を除去し、「株 式 会 社」のような字間空きは詰める。 */
function tidyCompany(s: string): string {
  const stripEdges = (v: string) => v.replace(/^[\s"'’%*#|\\/<>~^`.,;:!?＂％・]+|[\s"'’%*#|\\/<>~^`.,;:!?＂％・]+$/g, '').trim();
  let out = stripEdges(s);
  const singleJp = out.split(/\s+/).filter((t) => new RegExp(`^${JP_CHAR.source}$`).test(t)).length;
  if (singleJp >= 3) out = despaceJp(out); // 「株 式 会 社」→「株式会社」
  return stripEdges(out);
}

type PhoneKind = 'phone' | 'mobile' | 'fax' | 'unknown';
function classifyPhone(before: string, num: string): PhoneKind {
  if (/fax/i.test(before)) return 'fax';
  if (/(携帯|mobile|mob|cell)/i.test(before)) return 'mobile';
  if (/(tel|電話|代表|phone|直通|ダイヤル)/i.test(before)) return 'phone';
  const digits = num.replace(/[\s-]/g, '');
  if (/^0[789]0/.test(digits)) return 'mobile'; // 070/080/090 は携帯
  return 'unknown';
}

export function parseBusinessCard(text: string): ParsedCard {
  const out: ParsedCard = {};
  const full = text || '';
  const rawLines = full.split(/\r?\n/).map(cleanLine).filter(Boolean);

  // email: @前後の空白・全角＠を詰めてから照合（メールはラベル剥がし）。
  const emailM = EMAIL_RE.exec(full.replace(/\s*[@＠]\s*/g, '@'));
  if (emailM) {
    out.email = stripEmailLabel(emailM[0]);
  } else if (/(e-?mail|メール|mail)/i.test(full)) {
    // @ を 'a' 等に誤読し、かつ mail ラベルがある時のみ復元（「local a domain.tld」の a を @ とみなす）。
    const m = full.match(/(?:e-?mail|メール|mail)[\s!:.,]*([a-z0-9._,%+-]+)[a＠]([a-z0-9-]+(?:\.[a-z]{2,}){1,2})/i);
    if (m) out.email = `${m[1].replace(/,/g, '_').replace(/[.,]+$/, '')}@${m[2]}`;
  }
  const urlM = URL_RE.exec(full);
  if (urlM) out.url = urlM[0];

  // 役職: 最長キーワード優先で全文から（OCRの字間スペースを詰めてから照合＝「代表 取締役」も拾う）
  const compact = despaceJp(full);
  for (const kw of TITLE_KEYWORDS) {
    if (compact.includes(kw)) { out.title = kw; break; }
  }

  // 会社名: COMPANY_MARK を含む（住所でない）行から、最も「綺麗」な候補を選ぶ
  const companyCands = rawLines.filter((l) => COMPANY_MARK.test(l) && !ADDR_MARK.test(l));
  if (companyCands.length) {
    const best = companyCands
      .map((l) => ({ l, score: companyGarbageScore(l), len: l.length }))
      .sort((a, b) => a.score - b.score || a.len - b.len)[0].l;
    out.company = tidyCompany(best);
    if (CORP_MARK.test(out.company)) out.type = '法人'; // 法人格を含む社名は法人と自動判定
  }

  // 電話/携帯: 各行の各番号を、直前のラベル文脈で分類（同一行に Tel と Fax が混在しても正しく分ける）
  for (const line of rawLines) {
    PHONE_G.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = PHONE_G.exec(line)) !== null) {
      const before = line.slice(Math.max(0, m.index - 8), m.index);
      const num = cleanLine(m[0]);
      // 郵便番号(〒607-8011=7桁)や断片を電話にしない。日本の電話は概ね10〜11桁。
      if (num.replace(/\D/g, '').length < 9) continue;
      if (/〒/.test(before)) continue; // 郵便番号マーカー直後は除外
      const kind = classifyPhone(before, num);
      if (kind === 'fax') continue;
      if (kind === 'mobile') { if (!out.mobile) out.mobile = num; }
      else if (kind === 'phone') { if (!out.phone) out.phone = num; }
      else if (!out.phone && !/fax/i.test(line)) { out.phone = num; } // ラベル無しは保守的に
    }
  }

  // 住所: 〒/都道府県、または「郵便番号＋市区」の行を起点に、続く住所らしい行も連結する。
  // （〒が読めず都道府県も無い「220-8128横浜市西区…」型に対応）
  const ADDR_CONT = /(市|区|郡|町|村|丁目|番地|番|号|階|Ｆ|ビル|マンション|タワー|ハイツ|コーポ|荘|棟)/;
  // 郵便番号のみの行（〒/元 等の誤読プレフィックス許容）＝住所起点。市区行が別行でも拾える。
  const POSTAL_LINE = /^[^\d\s]{0,2}\s*\d{3}-?\d{4}\s*$/;
  const isAddrStart = (l: string) =>
    ADDR_MARK.test(l) ||
    POSTAL_LINE.test(l) ||
    (/[市区郡]/.test(l) && /(丁目|番地|\d+-\d+|\d+番)/.test(l) && !COMPANY_MARK.test(l));
  const addrIdx = rawLines.findIndex(isAddrStart);
  if (addrIdx >= 0) {
    const parts = [rawLines[addrIdx]];
    for (let i = addrIdx + 1; i < rawLines.length && i <= addrIdx + 2; i++) {
      const l = rawLines[i];
      if (EMAIL_RE.test(l) || URL_RE.test(l) || COMPANY_MARK.test(l)) break;
      if (ADDR_CONT.test(l)) parts.push(l);
      else break;
    }
    out.address = cleanAddress(parts.join(' '));
  }

  // ラベル付き氏名
  for (const line of rawLines) {
    const nameLabel = NAME_LABEL.exec(line);
    if (nameLabel && nameLabel[2] && !out.name) out.name = cleanLine(nameLabel[2]);
  }

  // ラベル無しの氏名推定。
  if (!out.name) {
    const cand = (i: number): string | null => {
      const line = rawLines[i];
      if (!line || line === out.company || line === out.address) return null;
      if (EMAIL_RE.test(line) || URL_RE.test(line)) return null;
      PHONE_G.lastIndex = 0;
      if (PHONE_G.test(line)) return null;
      return extractPersonName(line);
    };
    // ローマ字読み行（「TATSURO NISHIMURA」等・URL/メールは除く）。
    const isRomajiLine = (l?: string) =>
      !!l && /^[A-Za-z][A-Za-z\s.]{3,}$/.test(l) && !/[@]/.test(l) && !/\.(com|jp|net|org|co)\b/i.test(l);
    // ① 次行がローマ字読みの氏名を最優先（吹き出し・見出しの誤検出に強い）
    for (let i = 0; i < rawLines.length - 1 && !out.name; i++) {
      const nm = cand(i);
      if (nm && isRomajiLine(rawLines[i + 1])) out.name = nm;
    }
    // ② フォールバック: 先頭から最初の人名らしい行
    for (let i = 0; i < rawLines.length && !out.name; i++) {
      const nm = cand(i);
      if (nm) out.name = nm;
    }
  }

  return out;
}
