import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getCurrentUser } from '@/lib/auth/session';

export const runtime = 'nodejs';

// 公開フォームURLのQRコード（SVG）。名刺・チラシ・掲示などから案内する用途。
// 外部サービスに一切問い合わせず、サーバ内でSVGを生成（オフライン・無料）。
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/login', req.url));

  // 公開フォームの絶対URL。デプロイ先のオリジンから組み立てる（環境変数不要）。
  const base = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const target = new URL('/form', base).toString();

  const svg = await QRCode.toString(target, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
  });

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Content-Disposition': 'inline; filename="daikichi-form-qr.svg"',
      'Cache-Control': 'no-store',
    },
  });
}
