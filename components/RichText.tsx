'use client';
// 課題説明の表示。閲覧者のブラウザで DOMPurify サニタイズしてから innerHTML に流す（XSS 主防御）。
// SSR / ハイドレーション前は「タグを除いた素テキスト」を描画（React が自動エスケープ＝安全）。
// 旧データ（プレーンテキスト）は URL をクリック可能なリンクに変換して表示する。
import { useEffect, useState } from 'react';
import { looksLikeHtml, plainTextToHtml, htmlToPlainText } from '@/lib/richtext';
import { sanitizeRichHtml } from '@/lib/richtext-client';

export function RichText({ html, className }: { html: string; className?: string }) {
  const [clean, setClean] = useState<string | null>(null);

  useEffect(() => {
    const asHtml = looksLikeHtml(html) ? html : plainTextToHtml(html);
    setClean(sanitizeRichHtml(asHtml));
  }, [html]);

  if (clean === null) {
    // マウント前の安全フォールバック（未サニタイズHTMLをサーバで注入しない）。
    return <div className={className} style={{ whiteSpace: 'pre-wrap' }}>{htmlToPlainText(html)}</div>;
  }
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
