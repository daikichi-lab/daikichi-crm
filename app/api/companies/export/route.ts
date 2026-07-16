import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { searchCompanies } from '@/lib/data/dal';
import { companiesToCsv } from '@/lib/csv';

export const runtime = 'nodejs';

// 顧客一覧CSV書き出し（絞り込み条件を引き継ぐ）。SEC-6: フォーミュラインジェクション対策は companiesToCsv 側。
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/login', req.url));

  const sp = req.nextUrl.searchParams;
  const res = await searchCompanies({
    type: sp.get('type') ?? undefined,
    industry: sp.get('industry') ?? undefined,
    area: sp.get('area') ?? undefined,
    size: sp.get('size') ?? undefined,
    status: sp.get('status') ?? undefined,
    needs: sp.get('needs') ?? undefined,
    offers: sp.get('offers') ?? undefined,
    keyword: sp.get('keyword') ?? sp.get('q') ?? undefined,
    limit: 10000,
  });
  // 詳細(notes/登録日)は一覧RPCに無いため最小列で出力（companyPublic）。
  const csv = companiesToCsv(res.companies.map((c) => ({ ...c, notes: '', created_at: '' })));

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="companies_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
