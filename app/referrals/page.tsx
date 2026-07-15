import './referrals.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { listReferrals } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/icons';
import { TourButton, type GuideTourStep } from '@/components/TourButton';
import { UserAvatar } from '@/components/ui-bits';
import { ReferralFilterBar, ReferralRowAction, type ReferralItem } from './parts';

const GUIDE_TOUR: GuideTourStep[] = [
  { sel: '.stats', title: '紹介の進み具合',
    body: '提案 → 打診中 → 成立／不成立 の件数をひと目で。' },
  { sel: '.filterbar', title: 'ステータスで絞り込み',
    body: '打診中で7日以上動きがないものは<b>要フォロー</b>として強調されます。' },
  { sel: '.table-wrap', title: '「状態を更新」で進める',
    body: 'from→to・根拠タグ・起票者を記録。行のボタンから進捗を更新します。' },
  { sel: 'header.topbar a.btn-primary', title: '起票はマッチングから',
    body: '新しい紹介はマッチング画面の候補から起票します。' },
];


type SP = { status?: string };

export default async function ReferralsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const sp = await searchParams;
  const status = sp.status?.trim() || '';

  const res = await listReferrals({ status: status || undefined });
  const items: ReferralItem[] = res.items ?? [];
  const by: Record<string, number> = res.by_status ?? {};

  const topbar = (
    <>
      <h1>紹介</h1>
      <div className="spacer" />
      <Link className="btn btn-sm btn-primary" href="/matching"><Icon name="link" size={14} />マッチングから起票</Link>
      <TourButton steps={GUIDE_TOUR} />
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="referrals" topbar={topbar}>
      <div className="page-head">
        <div>
          <h2>紹介履歴</h2>
          <div className="sub">提案 → 打診中 → 成立 / 不成立。マッチング候補から起票した紹介を追跡します。</div>
        </div>
      </div>

      <div className="stats" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="stat"><div className="k">提案</div><div className="v num">{by['提案'] ?? 0}</div></div>
        <div className="stat"><div className="k">打診中</div><div className="v num">{by['打診中'] ?? 0}</div></div>
        <div className="stat gold"><div className="k">成立</div><div className="v num">{by['成立'] ?? 0}</div></div>
        <div className="stat"><div className="k">不成立</div><div className="v num">{by['不成立'] ?? 0}</div></div>
      </div>

      <div className="panel mt16">
        <ReferralFilterBar status={status} />

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>紹介（from → to）</th><th>種別</th><th>根拠タグ</th>
                <th>ステータス</th><th>起票者</th><th className="right">起票日</th><th className="right">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 28 }}>該当する紹介がありません。</td></tr>
              )}
              {items.map((r) => {
                const kindCls = r.kind === '顧客紹介' ? 'intro' : 'collab';
                const chipKind = r.kind === '顧客紹介' ? 'offer' : 'need';
                const chipMk = chipKind === 'offer' ? '提' : '求';
                const stCls = r.status === '提案' ? 'proposed' : r.status === '打診中' ? 'talking' : r.status === '成立' ? 'active' : 'failed';
                return (
                  <tr key={r.id}>
                    <td>
                      <span className="flow">
                        <Link className="name linkish" href={`/companies/${r.from_id}`}>{r.from}</Link>
                        <span className="arr">→</span>
                        <Link className="name linkish" href={`/companies/${r.to_id}`}>{r.to}</Link>
                      </span>
                    </td>
                    <td><span className={`kind-pill ${kindCls}`}>{r.kind}</span></td>
                    <td>
                      <div className="chips">
                        {(r.matched_tags ?? []).map((t) => (
                          <span key={t} className={`chip ${chipKind}`} style={{ height: 20 }}><span className="mk">{chipMk}</span>{t}</span>
                        ))}
                      </div>
                    </td>
                    <td><span className={`badge ${stCls}`}><span className="dot" />{r.status}</span></td>
                    <td>{r.by ?? '—'}</td>
                    <td className="right num muted">{r.created_at}</td>
                    <td className="right"><ReferralRowAction item={r} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="tfoot">
          <span>{res.count ?? items.length} 件中 1–{items.length} を表示</span>
          <span className="legend">
            <span className="kind-pill collab" style={{ height: 18 }}>協業先紹介</span>
            <span className="kind-pill intro" style={{ height: 18 }}>顧客紹介</span>
          </span>
        </div>
      </div>

      <div className="muted mt16" style={{ fontSize: 12 }}>※ 紹介レコードは <span className="b">referrals</span>（from_company / to_company / kind / matched_tags / status / created_by）。起票者を記録し、ステータスは 提案→打診中→成立/不成立 で追跡します（FR-R1〜R3）。</div>
    </AppShell>
  );
}
