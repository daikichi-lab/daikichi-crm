import { Fragment } from 'react';
import { splitUrlTrailingPunct } from '@/lib/richtext';

// プレーンテキストを安全に表示：改行を保持（white-space:pre-wrap）し、URL をクリック可能なリンクに。
// dangerouslySetInnerHTML を使わず React ノードで組み立てるため XSS の心配がない（コメント等の素テキスト向け）。
export function LinkedText({ text, className }: { text: string; className?: string }) {
  // 偶数index=通常テキスト / 奇数index=URL（キャプチャグループで分割）
  const parts = String(text ?? '').split(/(https?:\/\/[^\s]+)/g);
  return (
    <div className={className} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        const { href, tail } = splitUrlTrailingPunct(part);
        return (
          <Fragment key={i}>
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">{href}</a>{tail}
          </Fragment>
        );
      })}
    </div>
  );
}
