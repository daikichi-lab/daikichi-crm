import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { searchCompanies, getMasters, listTags } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/icons';
import { TourButton, type GuideTourStep } from '@/components/TourButton';
import { CompanyFilterBar } from '@/components/CompanyFilterBar';
import { StatusBadge, TypeBadge, TagChips, Seal, UserAvatar } from '@/components/ui-bits';

const GUIDE_TOUR: GuideTourStep[] = [
  { sel: '.filterbar', title: '条件で絞り込む',
    body: '種別・業種・エリア・規模・ステータス・<b>求/提タグ</b>を組み合わせて絞り込み（AND）。' },
  { sel: '.table-wrap', title: '行クリックで企業カルテへ',
    body: '行をクリックすると企業詳細（概要・担当者・資料・議事録・紹介履歴）へ移動します。' },
  { sel: '.page-head .actions', title: 'CSV取込・書き出し',
    body: '企業単位で一括登録・エクスポート。書き出しは絞り込んだ結果が対象です。' },
  { title: '求＝青 / 提＝金',
    body: '<b>求</b>めてること・<b>提</b>供できることタグがマッチングの肝。企業登録時に必ず付けましょう。' },
];


type SP = { [k: string]: string | undefined };

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const sp = await searchParams;

  const filters = {
    type: sp.type, industry: sp.industry, area: sp.area, size: sp.size,
    status: sp.status, needs: sp.needs, offers: sp.offers, keyword: sp.q, limit: 100,
  };
  const [res, masters, tagsRes] = await Promise.all([searchCompanies(filters), getMasters(), listTags()]);
  const areas = Object.values(masters.areas).flat();
  const advisory = res.companies.filter((c) => c.status === '顧問中').length;

  const topbar = (
    <>
      <h1>顧客（企業）</h1>
      <div className="spacer" />
      <Link className="btn btn-sm" href="/scan"><Icon name="card" size={15} />名刺スキャン</Link>
      <TourButton steps={GUIDE_TOUR} />
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="companies" topbar={topbar}>
      <div className="page-head">
        <div>
          <h2>顧客（企業）一覧</h2>
          <div className="sub num">{res.count} 社 ・ うち顧問中 {advisory}</div>
        </div>
        <div className="actions">
          <Link className="btn" href="/import"><Icon name="home" size={15} />CSV取込</Link>
          <a className="btn" href={`/api/companies/export?${new URLSearchParams(Object.entries(filters).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString()}`}>CSV書き出し</a>
          <Link className="btn btn-primary" href="/companies/new">＋ 企業を登録</Link>
        </div>
      </div>

      <div className="panel">
        <div className="panel-body">
          <CompanyFilterBar industries={masters.industries} areas={areas} sizes={masters.sizes} tags={tagsRes.tags.map((t) => t.label)} />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>社名</th><th>種別</th><th>業種</th><th>エリア</th><th>規模</th><th>ステータス</th>
                <th>求めてること / 提供できること</th><th>社内担当</th>
              </tr>
            </thead>
            <tbody>
              {res.companies.length === 0 && (
                <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 28 }}>条件に一致する企業がありません。</td></tr>
              )}
              {res.companies.map((c) => (
                <tr key={c.id} className="rowlink">
                  <td className="name">
                    <Link href={`/companies/${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Seal name={c.name} id={c.id} /><span>{c.name}</span>
                    </Link>
                  </td>
                  <td><TypeBadge type={c.type} /></td>
                  <td>{c.industry}</td>
                  <td>{c.area}</td>
                  <td className="num">{c.size}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td><TagChips needs={c.needs} offers={c.offers} /></td>
                  <td className="muted">{c.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tfoot">
          <span className="num">{res.count} 件中 1–{Math.min(res.count, 100)} を表示</span>
          <span className="legend">
            <span className="chip need" style={{ height: 20 }}><span className="mk">求</span>求めてる</span>
            <span className="chip offer" style={{ height: 20 }}><span className="mk">提</span>提供できる</span>
          </span>
        </div>
      </div>
    </AppShell>
  );
}
