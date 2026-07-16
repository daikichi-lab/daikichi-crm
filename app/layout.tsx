import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '大吉CRM — 顧客管理・紹介',
  description: '大吉会計 顧客管理＋ビジネスマッチング',
};

// 認証必須のCRM。全ルートをサーバー描画（動的）に固定し、静的プリレンダを無効化する。
// これによりビルド時(env未設定)と本番実行時(env有)で静的/動的判定がズレる問題を防ぐ
// （Cloudflare/OpenNext での "Page changed from static to dynamic at runtime: cookies" 500 対策）。
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+JP:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
