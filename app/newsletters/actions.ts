'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { saveNewsletterDraft, sendNewsletter, duplicateNewsletter, getNewsletterSegment, newsletterRecipientsForSend, markNewsletterFailed } from '@/lib/data/dal';
import { requireUser } from '@/lib/auth/session';
import { sendEmail, isEmailConfigured, renderTemplate, esc } from '@/lib/email';

const PUBLIC_URL = process.env.NEXT_PUBLIC_APP_URL || '';

/** 本文（プレーン）を宛先ごとに差し込み、法令フッタ（送信者情報＋配信停止リンク）を付けたHTML/textを作る。 */
function buildMail(subject: string, body: string, r: { name: string | null; company: string | null; unsubscribe_token?: string | null }) {
  const subj = renderTemplate(subject, r).replace(/<[^>]*>/g, ''); // 件名はタグ除去
  const rendered = renderTemplate(body, r); // 差し込み＋エスケープ済
  const from = process.env.EMAIL_FROM || '大吉会計事務所';
  const unsub = r.unsubscribe_token && PUBLIC_URL ? `${PUBLIC_URL}/unsubscribe?token=${encodeURIComponent(r.unsubscribe_token)}` : '';
  const footHtml =
    `<hr style="margin:24px 0;border:none;border-top:1px solid #ddd">` +
    `<p style="font-size:12px;color:#667">${esc(from)}<br>本メールは配信に同意いただいた方へお送りしています。` +
    (unsub ? ` <a href="${esc(unsub)}">配信停止・設定変更</a>` : '') + `</p>`;
  const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.8;color:#222;white-space:pre-wrap">${rendered}</div>${footHtml}`;
  const text = `${rendered.replace(/<[^>]*>/g, '')}\n\n---\n${from}\n配信停止: ${unsub || '（管理者へご連絡ください）'}`;
  return { subject: subj, html, text };
}

export async function getSegmentAction(opts: {
  topics?: string[];
  status?: string;
  industry?: string;
  area?: string;
}): Promise<{ count: number; sample: { name: string; company: string; email: string }[] }> {
  const r = await getNewsletterSegment({
    topics: opts.topics,
    status: opts.status || undefined,
    industry: opts.industry || undefined,
    area: opts.area || undefined,
  });
  return { count: r.count ?? 0, sample: (r as any).sample ?? [] };
}

export async function duplicateNewsletterAction(id: string): Promise<{ id?: string; error?: string }> {
  const r = await duplicateNewsletter(id);
  revalidatePath('/newsletters');
  return r;
}

export async function saveNewsletterDraftAction(p: {
  id?: string;
  subject: string;
  body: string;
  topic_ids: string[];
  segment: { status?: string; industry?: string; area?: string };
}): Promise<{ id?: string; error?: string }> {
  const r = await saveNewsletterDraft({
    ...(p.id ? { id: p.id } : {}),
    subject: p.subject,
    body: p.body,
    topic_ids: p.topic_ids,
    segment: p.segment,
  });
  revalidatePath('/newsletters');
  return r;
}

export async function sendNewsletterAction(p: {
  id?: string;
  subject: string;
  body: string;
  topic_ids: string[];
  segment: { status?: string; industry?: string; area?: string };
}): Promise<void> {
  await requireUser();
  // 1) セグメント確定＋宛先記録（RLS下のRPC）。停止・非同意は除外して記録される。
  const r = await sendNewsletter({
    ...(p.id ? { id: p.id } : {}),
    subject: p.subject, body: p.body, topic_ids: p.topic_ids, segment: p.segment,
  });
  const id = r && (r as any).id;
  // 2) メール送信が設定済みなら実送信し、失敗を記録。未設定なら宛先記録のみ（縮退）。
  if (id && isEmailConfigured()) {
    const targets = await newsletterRecipientsForSend(String(id));
    const failed: string[] = [];
    for (const t of targets ?? []) {
      const mail = buildMail(p.subject, p.body, t);
      const res = await sendEmail({ to: t.email, subject: mail.subject, html: mail.html, text: mail.text });
      if (!res.ok) failed.push(t.email);
    }
    if (failed.length) await markNewsletterFailed(String(id), failed);
  }
  revalidatePath('/newsletters');
  if (id) redirect(`/newsletters/${id}`);
  redirect('/newsletters');
}

/** テスト送信: 指定アドレスへ本文を1通送る（差し込みはサンプル値）。 */
export async function testSendNewsletterAction(subject: string, body: string, to: string): Promise<{ ok?: boolean; error?: string }> {
  await requireUser();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { error: 'テスト送信先のメールアドレスが正しくありません' };
  if (!isEmailConfigured()) return { error: 'メール送信が未設定です（Cloudflare の EMAIL_API_KEY / EMAIL_FROM を設定してください）' };
  const mail = buildMail(subject || '（件名なし）', body || '', { name: '（テスト）山田 太郎', company: '（テスト）大吉商事' });
  const res = await sendEmail({ to, subject: `[テスト] ${mail.subject}`, html: mail.html, text: mail.text });
  return res.ok ? { ok: true } : { error: res.error };
}
