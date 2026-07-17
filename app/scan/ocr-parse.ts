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
};

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const URL_RE = /\bhttps?:\/\/[^\s<>"']+/i;
// 電話番号: 市外局番-…-… / 0AB0-… / +81…。1行に複数（Tel/Fax等）あるので g で全件走査する。
const PHONE_G = /(?:\+81[\s-]?|0)\d{1,4}[\s-]?\d{1,4}[\s-]?\d{3,4}/g;

const COMPANY_MARK = /(株式会社|有限会社|合同会社|合名会社|合資会社|一般社団法人|公益社団法人|税理士法人|事務所|商店|商事|工業|製作所|食堂|農園|牧場|クリニック|医院|株)/;
// 役職キーワードは「長い＝具体的」を先に置き、最長一致を優先（代表取締役 > 代表）。
const TITLE_KEYWORDS = [
  '代表取締役', '代表社員', '代表理事', '取締役', '理事長',
  'マネージャー', 'ディレクター', 'プロデューサー', 'オーナー',
  '会長', '社長', '専務', '常務', '部長', '次長', '課長', '係長', '主任',
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

/** 「田中 太郎」「山田　花子」等の人名らしさ。数字・記号・会社標識を含まない2〜4語の日本語行。 */
function looksLikePersonName(line: string): boolean {
  const s = cleanLine(line);
  if (!s || s.length > 20) return false;
  if (/[0-9@/]/.test(s)) return false;
  if (COMPANY_MARK.test(s) || TITLE_MARK.test(s) || ADDR_MARK.test(s)) return false;
  // 姓名の区切り（空白）があり、日本語主体
  const jp = /[぀-ヿ一-龯]/;
  if (!jp.test(s)) return false;
  const parts = s.split(' ').filter(Boolean);
  return parts.length >= 1 && parts.length <= 3 && s.replace(/\s/g, '').length <= 8;
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
    .replace(new RegExp(`(${JP_CHAR.source})\\s+`, 'g'), '$1')       // 日本語の直後の空白を詰める
    .replace(new RegExp(`\\s+(${JP_CHAR.source})`, 'g'), '$1')       // 日本語の直前の空白を詰める
    .replace(/[\s|/<>~^]+$/g, '');                          // 末尾のOCRノイズ
  return cleanLine(s);
}

/** 会社名候補のうち「化け」が少ない行を選ぶためのスコア（小さいほど綺麗）。 */
function companyGarbageScore(line: string): number {
  const brackets = (line.match(/[()[\]{}|\\<>~^`_]/g) || []).length;
  const isolatedLatin = line.split(/\s+/).filter((t) => /^[A-Za-z]$/.test(t)).length;
  const digits = (line.match(/[0-9]/g) || []).length;
  return brackets * 3 + isolatedLatin * 2 + digits;
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

  // email / url は全文から最初の一致（メールはラベル剥がし）
  const emailM = EMAIL_RE.exec(full);
  if (emailM) out.email = stripEmailLabel(emailM[0]);
  const urlM = URL_RE.exec(full);
  if (urlM) out.url = urlM[0];

  // 役職: 最長キーワード優先で全文から
  for (const kw of TITLE_KEYWORDS) {
    if (full.includes(kw)) { out.title = kw; break; }
  }

  // 会社名: COMPANY_MARK を含む（住所でない）行から、最も「綺麗」な候補を選ぶ
  const companyCands = rawLines.filter((l) => COMPANY_MARK.test(l) && !ADDR_MARK.test(l));
  if (companyCands.length) {
    out.company = companyCands
      .map((l) => ({ l, score: companyGarbageScore(l), len: l.length }))
      .sort((a, b) => a.score - b.score || a.len - b.len)[0].l;
  }

  // 電話/携帯: 各行の各番号を、直前のラベル文脈で分類（同一行に Tel と Fax が混在しても正しく分ける）
  for (const line of rawLines) {
    PHONE_G.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = PHONE_G.exec(line)) !== null) {
      const before = line.slice(Math.max(0, m.index - 8), m.index);
      const num = cleanLine(m[0]);
      const kind = classifyPhone(before, num);
      if (kind === 'fax') continue;
      if (kind === 'mobile') { if (!out.mobile) out.mobile = num; }
      else if (kind === 'phone') { if (!out.phone) out.phone = num; }
      else if (!out.phone && !/fax/i.test(line)) { out.phone = num; } // ラベル無しは保守的に
    }
  }

  // 住所 / ラベル付き氏名
  for (const line of rawLines) {
    if (!out.address && ADDR_MARK.test(line)) out.address = cleanAddress(line);
    const nameLabel = NAME_LABEL.exec(line);
    if (nameLabel && nameLabel[2] && !out.name) out.name = cleanLine(nameLabel[2]);
  }

  // ラベル無しの氏名推定（会社/役職/住所/連絡先でない、人名らしい行の先頭）
  if (!out.name) {
    for (const line of rawLines) {
      if (line === out.company || line === out.address) continue;
      if (EMAIL_RE.test(line) || URL_RE.test(line)) continue;
      PHONE_G.lastIndex = 0;
      if (PHONE_G.test(line)) continue;
      if (looksLikePersonName(line)) { out.name = line; break; }
    }
  }

  return out;
}
