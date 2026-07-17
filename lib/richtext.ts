// 課題の説明欄（リッチテキスト）の共有ユーティリティ。
// ここは **サーバ安全**（DOM/DOMPurify に依存しない純JS）。Cloudflare Workers でも動く。
// XSS の最終防御は描画時のクライアント DOMPurify（lib/richtext-client.ts の sanitizeRichHtml）で行い、
// このファイルの stripDangerousHtml は保存時の多層防御（危険な構造の除去）に使う。

// DOMPurify の許可リスト（TipTap StarterKit が出力し得るタグ集合）。richtext-client.ts と共有。
export const RICH_ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr', 'a',
];
export const RICH_ALLOWED_ATTR = ['href', 'target', 'rel'];
// href に許すスキーム（それ以外＝javascript: 等は除去）。
export const RICH_URI_REGEXP = /^(?:https?:|mailto:|tel:)/i;

/** HTML タグらしきものを含むか（＝TipTap出力か、旧プレーンテキストかの判定）。 */
export function looksLikeHtml(s: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(s ?? '');
}

/** HTML 特殊文字をエスケープ（テキストとして安全に埋め込む）。 */
export function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** URL 末尾に付きがちな句読点・閉じ括弧をリンクから分離（表示の見栄え）。';' は含めない＝&amp; を壊さない。 */
export function splitUrlTrailingPunct(url: string): { href: string; tail: string } {
  const m = url.match(/[)\].,、。，．）】」』]+$/);
  return m ? { href: url.slice(0, -m[0].length), tail: m[0] } : { href: url, tail: '' };
}

function linkifyEscaped(escaped: string): string {
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    const { href, tail } = splitUrlTrailingPunct(url);
    return `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow">${href}</a>${tail}`;
  });
}

/** プレーンテキスト → 安全なHTML（エスケープ→URLリンク化→改行を<br>/段落に）。旧データの表示・編集初期値に使う。 */
export function plainTextToHtml(text: string): string {
  const t = String(text ?? '');
  if (!t.trim()) return '';
  return t
    .split(/\n{2,}/)
    .map((block) => `<p>${linkifyEscaped(escapeHtml(block)).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** HTML → 表示用プレーンテキスト（SSRフォールバック・空判定用。厳密なサニタイズではない）。 */
export function htmlToPlainText(html: string): string {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 実質的に中身が無い説明か（TipTap の空出力 <p></p> 等を空とみなす）。 */
export function isRichEmpty(html: string | null | undefined): boolean {
  return htmlToPlainText(html ?? '').length === 0;
}

/**
 * 保存時の多層防御（サーバ側・純JS）。危険な要素/属性/URIスキームを除去する。
 * これは *ブロックリスト* であり最終防御ではない（最終防御は描画時の DOMPurify 許可リスト）。
 */
export function stripDangerousHtml(html: string | null | undefined): string {
  if (!html) return '';
  let s = String(html);
  // コメント除去
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  // 危険要素は中身ごと除去
  s = s.replace(/<(script|style|iframe|object|embed|svg|math|template|noscript|form|input|button|link|meta|base|head|title)\b[\s\S]*?<\/\1\s*>/gi, '');
  // 危険要素の開始/自己終了タグ（閉じ忘れ対策）
  s = s.replace(/<\/?(script|style|iframe|object|embed|svg|math|template|noscript|form|input|button|link|meta|base)\b[^>]*>/gi, '');
  // イベントハンドラ属性（on...=）を除去
  s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // href/src の危険スキームを無害化
  s = s.replace(/((?:href|src|xlink:href)\s*=\s*)(["']?)\s*(?:javascript|vbscript|data)\s*:[^"'>\s]*/gi, '$1$2#');
  return s;
}
