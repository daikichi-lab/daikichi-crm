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
// 電話番号: 市外局番-…-… / 0AB0-… / +81…。ラベル(TEL/FAX/携帯)の後ろも拾う。
const PHONE_RE = /(?:\+81[\s-]?|0)\d{1,4}[\s-]?\d{1,4}[\s-]?\d{3,4}/;

const COMPANY_MARK = /(株式会社|有限会社|合同会社|合名会社|合資会社|一般社団法人|公益社団法人|税理士法人|事務所|商店|商事|工業|製作所|食堂|農園|牧場|クリニック|医院|株)/;
const TITLE_MARK = /(代表取締役|取締役|代表社員|代表理事|理事長|代表|社長|専務|常務|部長|次長|課長|係長|主任|店主|店長|マネージャー|ディレクター|プロデューサー|CEO|COO|CFO|CTO|オーナー|園長|院長|所長|会長)/;
const ADDR_MARK = /(〒|北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/;
const NAME_LABEL = /(氏\s*名|名\s*前|担当)[:：]?\s*(.+)$/;
const MOBILE_HINT = /(携帯|mobile|cell|090|080|070)/i;

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

/** ラベル（TEL: 等）を取り除いた電話番号文字列を返す。 */
function extractPhone(line: string): string | null {
  const m = PHONE_RE.exec(line);
  return m ? cleanLine(m[0]) : null;
}

export function parseBusinessCard(text: string): ParsedCard {
  const out: ParsedCard = {};
  const rawLines = (text || '').split(/\r?\n/).map(cleanLine).filter(Boolean);

  // email / url は全文から最初の一致
  const emailM = EMAIL_RE.exec(text || '');
  if (emailM) out.email = emailM[0];
  const urlM = URL_RE.exec(text || '');
  if (urlM) out.url = urlM[0];

  for (const line of rawLines) {
    // 電話 / 携帯
    const phone = extractPhone(line);
    if (phone) {
      if (MOBILE_HINT.test(line) || /^0[789]0/.test(phone.replace(/[\s-]/g, ''))) {
        if (!out.mobile) out.mobile = phone;
      } else if (!/fax/i.test(line)) {
        if (!out.phone) out.phone = phone;
      }
    }
    // 役職
    if (!out.title && TITLE_MARK.test(line)) {
      const m = TITLE_MARK.exec(line);
      if (m) out.title = m[0];
    }
    // 会社
    if (!out.company && COMPANY_MARK.test(line)) {
      out.company = line;
    }
    // 住所
    if (!out.address && ADDR_MARK.test(line)) {
      out.address = line;
    }
    // 氏名（ラベル付き優先）
    const nameLabel = NAME_LABEL.exec(line);
    if (nameLabel && nameLabel[2] && !out.name) {
      out.name = cleanLine(nameLabel[2]);
    }
  }

  // ラベル無しの氏名推定（会社/役職/住所/連絡先でない、人名らしい行の先頭）
  if (!out.name) {
    for (const line of rawLines) {
      if (line === out.company || line === out.address) continue;
      if (EMAIL_RE.test(line) || URL_RE.test(line) || PHONE_RE.test(line)) continue;
      if (looksLikePersonName(line)) { out.name = line; break; }
    }
  }

  return out;
}
