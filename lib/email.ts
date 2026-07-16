import 'server-only';

// メール送信アダプタ（送信APIの薄いラッパ＝N-1）。既定は Resend の HTTP API（fetch のみで Cloudflare Workers 可）。
// 環境変数:
//   EMAIL_API_KEY    … Resend の API キー（未設定なら送信は行わず「未設定」を返す＝安全に縮退）
//   EMAIL_FROM       … 送信元（例: "大吉会計事務所 <noreply@daikichi-accg.co.jp>"）。要 SPF/DKIM/DMARC。
//   EMAIL_PROVIDER   … 既定 'resend'（将来他プロバイダに差し替え可能）
// 名簿・属性・履歴は本システム内に持ち、外部SaaSへ同期しない（C-7 と同思想）。

export type Mail = { to: string; subject: string; html: string; text?: string };
export type SendResult = { ok: true } | { ok: false; error: string; unconfigured?: boolean };

export function isEmailConfigured(): boolean {
  return !!(process.env.EMAIL_API_KEY && process.env.EMAIL_FROM);
}

/** 1通送信。未設定なら unconfigured=true を返す（呼び出し側で縮退表示）。 */
export async function sendEmail(mail: Mail): Promise<SendResult> {
  const key = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: false, error: 'メール送信は未設定です（EMAIL_API_KEY / EMAIL_FROM）', unconfigured: true };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, html: mail.html, ...(mail.text ? { text: mail.text } : {}) }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: `送信APIエラー (${res.status}) ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '送信に失敗しました' };
  }
}

const AMP = /&/g, LT = /</g, GT = />/g, QUOT = /"/g;
/** 差し込み値をHTMLエスケープ（メール本文への差し込み時のXSS/崩れ防止）。 */
export function esc(s: string): string {
  return String(s ?? '').replace(AMP, '&amp;').replace(LT, '&lt;').replace(GT, '&gt;').replace(QUOT, '&quot;');
}

/** 差し込み変数を宛先ごとに置換（{{氏名}}/{{会社名}} と英語別名）。値はHTMLエスケープ。 */
export function renderTemplate(tpl: string, vars: { name?: string | null; company?: string | null }): string {
  const name = esc(vars.name || 'ご担当者');
  const company = esc(vars.company || '');
  return String(tpl ?? '')
    .replace(/\{\{\s*(氏名|name)\s*\}\}/g, name)
    .replace(/\{\{\s*(会社名|company)\s*\}\}/g, company);
}
