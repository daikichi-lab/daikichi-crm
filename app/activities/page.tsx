import './activities.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { listActivities, listUsers } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/icons';
import { TourButton, type GuideTourStep } from '@/components/TourButton';
import { UserAvatar } from '@/components/ui-bits';
import { RecordActivityButton, ActivityFilterBar } from './parts';

const GUIDE_TOUR: GuideTourStep[] = [
  { sel: '.stats', title: '接点の全体量とフォロー待ち',
    body: '今週の活動量・自動記録の件数・フォロー待ちを把握します。' },
  { sel: '.grid-2 .panel', title: 'すべての接点が時系列に',
    body: '電話・面談・メール・議事録・紹介・メルマガ・フォーム・名刺…。行クリックで元のレコードへ。右上で期間・種別・担当を絞り込み。' },
  { sel: 'header.topbar button.btn-primary', title: '「＋活動を記録」で手動記録',
    body: '電話・訪問・メモはここから。ほかの操作は各画面から<b>自動で記録</b>されます。' },
  { title: 'フォロー漏れを防ぐ',
    body: '企業詳細には「その会社だけのタイムライン」もあります。最近何をしたかを即把握できます。' },
];


type SP = { [k: string]: string | undefined };
type Act = { id: string; company: string | null; company_id: string | null; contact?: string; contact_id?: string | null; kind: string; title: string; status?: string; actor: string; source: string; source_kind: string; source_id?: string; when: string; day: string };

/* 種別 → a-tag クラス / nub背景 / nubアイコン */
const KIND_STYLE: Record<string, { tag: string; bg: string; icon: string }> = {
  電話: { tag: 'c-blue', bg: 'var(--brand-600)', icon: 'phone' },
  'メール': { tag: 'c-blue', bg: 'var(--brand-500)', icon: 'mail' },
  '面談・訪問': { tag: 'c-gold', bg: 'var(--gold-600)', icon: 'users' },
  '議事録': { tag: 'c-dark', bg: 'var(--ink-2)', icon: 'doc' },
  '紹介': { tag: 'c-gold', bg: 'var(--gold-700)', icon: 'handshake' },
  'メルマガ': { tag: 'c-blue', bg: 'var(--brand-700)', icon: 'send' },
  'フォーム': { tag: 'c-green', bg: 'var(--green-600)', icon: 'inbox' },
  '名刺': { tag: 'c-gray', bg: 'var(--ink-3)', icon: 'card' },
  'タスク': { tag: 'c-green', bg: 'var(--green-600)', icon: 'check' },
  'メモ': { tag: 'c-gray', bg: 'var(--ink-3)', icon: 'doc' },
  '資料': { tag: 'c-gray', bg: 'var(--ink-3)', icon: 'folder' },
};
const STATUS_LABEL: Record<string, string> = { 対応中: 'タスク完了', 未対応: '未対応' };

/* source_kind → 遷移先 */
function hrefFor(a: Act): string {
  switch (a.source_kind) {
    case 'note': return '/notes';
    case 'referral': return '/referrals';
    case 'newsletter': return '/newsletters';
    case 'form': return '/forms/inbox';
    case 'card': return a.contact_id ? `/contacts/${a.contact_id}` : a.company_id ? `/companies/${a.company_id}` : '/people';
    case 'task': return a.source_id ? `/schedule/${a.source_id}` : '/schedule';
    default: return a.company_id ? `/companies/${a.company_id}` : '/activities';
  }
}

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const sp = await searchParams;

  const period = sp.period ?? 'week';
  const [res, usersRaw] = await Promise.all([
    listActivities({ kind: sp.kind, actor: sp.actor, period }),
    listUsers(),
  ]);
  const items: Act[] = res.items ?? [];
  const users = (Array.isArray(usersRaw) ? usersRaw : []) as { id: string; name: string }[];

  // 日別グルーピング（itemsの day を順序維持で）
  const days: { day: string; rows: Act[] }[] = [];
  for (const it of items) {
    let g = days.find((d) => d.day === it.day);
    if (!g) { g = { day: it.day, rows: [] }; days.push(g); }
    g.rows.push(it);
  }

  const byKind: { kind: string; count: number }[] = res.by_kind ?? [];
  const maxKind = Math.max(1, ...byKind.map((b) => b.count));

  const topbar = (
    <>
      <h1>活動履歴</h1>
      <form className="search" action="/activities">
        <span className="mag"><Icon name="search" size={16} /></span>
        <input name="q" placeholder="企業・内容で絞り込み…" defaultValue={sp.q ?? ''} />
      </form>
      <div className="spacer" />
      <RecordActivityButton users={users} me={user.name} />
      <TourButton steps={GUIDE_TOUR} />
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="activities" topbar={topbar}>
      <div className="page-head">
        <div>
          <h2>活動履歴</h2>
          <div className="sub">顧客との接点を時系列で横断表示</div>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="k">今週の活動</div><div className="v num">{res.count ?? items.length} <small>件</small></div><div className="d muted" style={{ color: 'var(--ink-3)' }}>期間で絞り込み</div></div>
        <div className="stat"><div className="k">種別数</div><div className="v num">{byKind.length} <small>分類</small></div><div className="d muted" style={{ color: 'var(--ink-3)' }}>電話・議事録・タスクほか</div></div>
        <div className="stat"><div className="k">直接接触（電話・面談）</div><div className="v num">{byKind.filter((b) => b.kind === '電話' || b.kind === '面談・訪問').reduce((s, b) => s + b.count, 0)} <small>件</small></div><div className="d muted" style={{ color: 'var(--ink-3)' }}>直接接触</div></div>
        <div className="stat gold"><div className="k">フォロー待ち</div><div className="v num">{res.follow_up ?? 0} <small>件</small></div><div className="d" style={{ color: 'var(--gold-700)' }}>未対応の接点</div></div>
      </div>

      <div className="grid-2 mt16">
        {/* 左：タイムライン */}
        <div className="panel">
          <div className="panel-head">
            <h3>タイムライン</h3>
            <span className="count">最近の活動</span>
            <ActivityFilterBar users={users} />
          </div>
          <div className="panel-body">
            {items.length === 0 && <div className="muted" style={{ padding: 20, textAlign: 'center' }}>この期間に活動はありません。</div>}
            {days.map((d) => (
              <div key={d.day}>
                <div className="day"><h4>{d.day}</h4><span className="ln" /></div>
                <div className="tl">
                  {d.rows.map((a) => {
                    const st = KIND_STYLE[a.kind] ?? { tag: 'c-gray', bg: 'var(--ink-3)', icon: 'pulse' };
                    const href = hrefFor(a);
                    return (
                      <Link key={a.id} href={href} className="ev" style={{ display: 'block', textDecoration: 'none' }}>
                        <span className="nub" style={{ background: st.bg }}><Icon name={st.icon} size={12} /></span>
                        <div className="ev-card">
                          <div className="ev-top">
                            <span className={`a-tag ${st.tag}`}>{a.kind}</span>
                            <span className="ev-co">{a.company ?? '（全社向け）'}</span>
                            <span className="ev-when num">{a.when}</span>
                          </div>
                          <div className="ev-body">{a.title}</div>
                          <div className="ev-foot">
                            <span>担当 {a.actor}</span>
                            {a.contact && <span>· {a.contact}</span>}
                            {a.status && <span className={`badge ${a.status === '未対応' ? 'dormant' : 'prospect'}`} style={{ height: 18 }}><span className="dot" />{STATUS_LABEL[a.status] ?? a.status}</span>}
                            {a.source === '自動' && a.source_kind !== 'company' && <span>· 元レコードへ ›</span>}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="tfoot" style={{ padding: '4px 0 0' }}>
              <span>活動は各画面の操作・連携から自動記録（手動メモを含む）</span>
            </div>
          </div>
        </div>

        {/* 右：今週の内訳＋種別凡例 */}
        <div className="side-col">
          <div className="panel">
            <div className="panel-head"><h3>今週の内訳</h3><span className="count" style={{ marginLeft: 'auto' }}>{res.count ?? items.length} 件</span></div>
            <div className="panel-body">
              <div className="brk">
                {byKind.map((b) => {
                  const stl = KIND_STYLE[b.kind] ?? { bg: 'var(--ink-3)' };
                  return (
                    <div className="r" key={b.kind}>
                      <span>{b.kind}</span>
                      <span className="bar"><i style={{ width: `${Math.round((b.count / maxKind) * 100)}%`, background: stl.bg }} /></span>
                      <span className="n num">{b.count}</span>
                    </div>
                  );
                })}
                {byKind.length === 0 && <div className="muted">この期間の内訳はありません。</div>}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>種別</h3></div>
            <div className="panel-body">
              <div className="leg">
                <div className="li"><span className="sw" style={{ background: 'var(--brand-600)' }} />電話・メール（連絡）</div>
                <div className="li"><span className="sw" style={{ background: 'var(--gold-600)' }} />面談・訪問</div>
                <div className="li"><span className="sw" style={{ background: 'var(--gold-700)' }} />紹介（協業先・顧客）</div>
                <div className="li"><span className="sw" style={{ background: 'var(--ink-2)' }} />議事録（Notta連携）</div>
                <div className="li"><span className="sw" style={{ background: 'var(--brand-700)' }} />メルマガ配信</div>
                <div className="li"><span className="sw" style={{ background: 'var(--green-600)' }} />フォーム受信・タスク完了</div>
                <div className="li"><span className="sw" style={{ background: 'var(--ink-3)' }} />名刺取込</div>
              </div>
              <div className="banner info mt16">
                <span>ⓘ</span>
                <div>活動は各操作・連携から<b>自動で記録</b>されます。<b>企業詳細</b>にはその会社だけのタイムラインを表示します。</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
