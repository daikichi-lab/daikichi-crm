// クライアント専用（ブラウザ DOM が必要）。課題説明HTMLの最終サニタイズ＝XSS の主防御。
// 閲覧者のブラウザで描画直前にかけるため、攻撃者は回避できない（＝サーバ実行不要で Workers 制約と無関係）。
import DOMPurify from 'dompurify';
import { RICH_ALLOWED_TAGS, RICH_ALLOWED_ATTR, RICH_URI_REGEXP } from './richtext';

let hooked = false;
function ensureHook() {
  if (hooked) return;
  hooked = true;
  // 全リンクに安全な target/rel を強制（外部遷移・タブナビング対策）。
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if ((node as Element).nodeName === 'A') {
      const el = node as Element;
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  });
}

/** リッチテキストHTMLを許可リストでサニタイズして返す（描画直前・保存直前に使用）。 */
export function sanitizeRichHtml(html: string): string {
  ensureHook();
  return DOMPurify.sanitize(html ?? '', {
    ALLOWED_TAGS: RICH_ALLOWED_TAGS,
    ALLOWED_ATTR: RICH_ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: RICH_URI_REGEXP,
  });
}
