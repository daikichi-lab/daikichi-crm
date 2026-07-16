import './dashboard.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getDashboard } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/icons';
import { TourButton, type GuideTourStep } from '@/components/TourButton';
import { StatusBadge, UserAvatar } from '@/components/ui-bits';

const GUIDE_TOUR: GuideTourStep[] = [
  { sel: '.stats', title: '事務所のいまを数字で把握',
    body: '顧客数・顧問中・見込み・名刺化率の件数カード。毎朝ここが起点です。' },
  { sel: '.dash-row', title: '「対応が必要」から今日の仕事へ',
    body: '要フォローの紹介・期限・名刺未登録などを集約。<b>クイック操作</b>から名刺スキャン・企業登録・CSV取込へ1クリックで移動できます。' },
  { sel: '.panel.mt16', title: '最近更新した企業',
    body: '直近で動きのあった顧客をすぐ開けます。行クリックで企業カルテへ。' },
  { sel: 'header.topbar form.search', title: '検索はどこからでも',
    body: '社名・メモで横断検索できます。' },
  { title: 'ホームは「次にやること」の入口',
    body: '左のサイドバーから各機能へ。それぞれの画面にもこの案内人（使い方）がいます。' },
];


export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const d = await getDashboard();

  const todos = [
    { n: d.overdue, color: 'red', href: '/schedule', title: '期限の遅延・今週の締切', sub: `遅延 ${d.overdue} ・ 今週の期限 ${d.this_week} ・ 未完了タスク ${d.open_tasks}` },
    { n: d.referrals_followup, color: 'amber', href: '/referrals', title: '打診中の紹介を要フォロー', sub: '7日以上ステータス更新なし' },
    { n: d.cards_missing, color: 'brand', href: '/scan', title: '名刺未登録の担当者', sub: '名刺画像が未保存の担当者' },
    { n: d.forms_pending, color: 'green', href: '/forms/inbox', title: 'フォーム回答が未取込', sub: '公開フォームからの新規問い合わせ' },
  ].filter((t) => t.n > 0);
  const colorBg: Record<string, string> = { red: 'var(--red-50)', amber: 'var(--amber-50)', brand: 'var(--brand-50)', green: 'var(--green-50)' };
  const colorFg: Record<string, string> = { red: 'var(--red-600)', amber: 'var(--amber-600)', brand: 'var(--brand-700)', green: 'var(--green-700)' };

  const topbar = (
    <>
      <h1>ホーム</h1>
      <form className="search" action="/companies">
        <span className="mag"><Icon name="search" size={16} /></span>
        <input name="q" placeholder="社名・メモを検索…" />
      </form>
      <div className="spacer" />
      <Link className="btn btn-sm" href="/scan"><Icon name="card" size={15} />名刺スキャン</Link>
      <Link className="btn btn-sm btn-primary" href="/companies/new">＋ 企業を登録</Link>
      <TourButton steps={GUIDE_TOUR} />
      <UserAvatar initial={user.avatar} />
    </>
  );

  const cardRate = d.contacts_total ? Math.round((d.cards_total / d.contacts_total) * 100) : 0;

  return (
    <AppShell active="home" topbar={topbar}>
      <div className="page-head">
        <div>
          <h2>おはようございます、{user.name.split(' ')[0]}さん</h2>
          <div className="sub">大吉会計事務所</div>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="k">顧客（企業）</div><div className="v num">{d.companies_total}</div><div className="d muted" style={{ color: 'var(--ink-3)' }}>全{d.companies_total}社</div></div>
        <div className="stat"><div className="k">顧問中</div><div className="v num">{d.advisory}</div><div className="d muted" style={{ color: 'var(--ink-3)' }}>見込み {d.prospect} ・ 休眠 {d.dormant}</div></div>
        <div className="stat"><div className="k">見込み</div><div className="v num">{d.prospect}</div><div className="d muted" style={{ color: 'var(--ink-3)' }}>商談化を促進</div></div>
        <div className="stat gold"><div className="k">担当者 / 名刺</div><div className="v num">{d.contacts_total} <small>/ {d.cards_total}枚</small></div><div className="d muted" style={{ color: 'var(--ink-3)' }}>名刺化率 {cardRate}%</div></div>
      </div>

      <div className="dash-row mt16">
        <div className="panel">
          <div className="panel-head"><h3>対応が必要</h3><span className="badge prospect" style={{ marginLeft: 'auto' }}>{todos.length}件</span></div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {todos.length === 0 && <div className="muted">いま対応が必要な項目はありません。</div>}
            {todos.map((t) => (
              <Link key={t.title} href={t.href} className="todo-card">
                <span className="n num" style={{ background: colorBg[t.color], color: colorFg[t.color] }}>{t.n}</span>
                <span style={{ flex: 1 }}><span className="b">{t.title}</span><br /><span className="muted" style={{ fontSize: 12 }}>{t.sub}</span></span>
                <span style={{ color: 'var(--ink-3)' }}>›</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>クイック操作</h3></div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link className="btn btn-primary" href="/scan" style={{ justifyContent: 'flex-start' }}><Icon name="card" size={16} />名刺スキャン</Link>
            <Link className="btn" href="/companies/new" style={{ justifyContent: 'flex-start' }}><Icon name="building" size={16} />企業を登録</Link>
            <Link className="btn" href="/import" style={{ justifyContent: 'flex-start' }}><Icon name="home" size={16} />CSV取込</Link>
          </div>
        </div>
      </div>

      <div className="panel mt16">
        <div className="panel-head"><h3>最近更新した企業</h3><Link className="right" href="/companies">一覧へ</Link></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>社名</th><th>業種</th><th>エリア</th><th>ステータス</th><th>社内担当</th><th className="right">更新</th></tr></thead>
            <tbody>
              {d.recent.map((c) => (
                <tr key={c.id} style={{ cursor: 'pointer' }}>
                  <td className="name"><Link href={`/companies/${c.id}`}>{c.name}</Link></td>
                  <td>{c.industry}</td>
                  <td>{c.area}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td className="muted">{c.owner}</td>
                  <td className="right num muted">{c.updated_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel mt16">
        <div className="panel-head"><h3>種別 × ステータス</h3><Link className="right" href="/companies">一覧で絞り込む</Link></div>
        <div className="panel-body" style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          {Object.entries(d.by_type).map(([type, total]) => (
            <div key={type}>
              <div className="b">{type} <span className="num muted" style={{ fontWeight: 600 }}>{total} 社</span></div>
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                {(['顧問中', '見込み', '休眠'] as const).map((st) => {
                  const cls = st === '顧問中' ? 'active' : st === '見込み' ? 'prospect' : 'dormant';
                  const row = d.by_type_status.find((x) => x.type === type && x.status === st);
                  return (
                    <span key={st} className={`badge ${cls}`}>
                      <span className="dot" />{st} <span className="num">{row?.count ?? 0}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
