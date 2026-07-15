import './people.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { listContacts, getContact, searchCompanies, getCompanyTimeline } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/icons';
import { TourButton, type GuideTourStep } from '@/components/TourButton';
import { UserAvatar } from '@/components/ui-bits';
import { PeopleFilterBar } from './parts';

const GUIDE_TOUR: GuideTourStep[] = [
  { sel: '.plist', title: '左の一覧から人を選ぶ',
    body: '名刺交換・打ち合わせで会った先方担当者を会社横断で一覧。名前・会社・フリガナ検索、主担当のみ、並び替えで絞り込めます。' },
  { sel: '.pdetail', title: '右に詳細',
    body: '連絡先・名刺・所属企業・最近の接点。担当者の編集や所属企業への移動もここから。' },
  { sel: 'header.topbar a[href="/scan"]', title: '登録は名刺スキャンから',
    body: '名刺を取り込むと、ここに自動で並びます。' },
];


const PAV_COLORS = ['#1b4d72', '#2f8056', '#b7861f', '#7a3e8e', '#c0392f', '#2e78b0'];
function pavColor(seed: string) {
  const ch = (seed || '？').charCodeAt(seed.length ? seed.length - 1 : 0);
  return PAV_COLORS[ch % PAV_COLORS.length];
}

type SP = { q?: string; company?: string; sort?: string; primary?: string; c?: string };

export default async function PeoplePage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const sp = await searchParams;

  const [res, allRes] = await Promise.all([
    listContacts({ keyword: sp.q, company: sp.company, primaryOnly: sp.primary === '1', limit: 200 }),
    listContacts({ limit: 1 }),
    // companiesfor filter dropdown below
  ]);

  let contacts = [...(res.contacts ?? [])];
  if (sp.sort === 'kana') contacts.sort((a, b) => (a.kana ?? a.name).localeCompare(b.kana ?? b.name, 'ja'));

  const companiesRes = await searchCompanies({ limit: 200 });
  const companyNames = Array.from(new Set(companiesRes.companies.map((c) => c.name)));

  const selectedId = sp.c ?? contacts[0]?.id;
  const detail = selectedId ? await getContact(selectedId, true) : null;
  const timeline = detail && !('error' in detail) && detail.company_id
    ? await getCompanyTimeline(detail.company_id, { limit: 5 })
    : { timeline: [] };

  const carry = new URLSearchParams();
  if (sp.q) carry.set('q', sp.q);
  if (sp.company) carry.set('company', sp.company);
  if (sp.sort) carry.set('sort', sp.sort);
  if (sp.primary) carry.set('primary', sp.primary);
  const rowHref = (id: string) => { const p = new URLSearchParams(carry); p.set('c', id); return `/people?${p.toString()}`; };

  const topbar = (
    <>
      <h1>会った人</h1>
      <div className="spacer" />
      <Link className="btn btn-sm" href="/scan"><Icon name="card" size={15} />名刺スキャン</Link>
      <TourButton steps={GUIDE_TOUR} />
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="people" topbar={topbar}>
      <div className="page-head">
        <div>
          <h2>会った人</h2>
          <div className="sub">名刺・打ち合わせで会った先方の担当者を、会社をまたいで一覧。選ぶと右に詳細が出ます。</div>
        </div>
        <div className="actions">
          <span className="legend"><span className="pav" style={{ width: 18, height: 18, fontSize: 10, background: 'var(--brand-600)' }}>主</span> = 主担当</span>
        </div>
      </div>

      <div className="people">
        <div className="panel plist">
          <PeopleFilterBar companies={companyNames} count={res.count} total={allRes.count} />
          <div className="list-scroll">
            {contacts.length === 0 && <div className="pempty"><div style={{ fontSize: 26 }}>🔍</div><h3>該当なし</h3><div>条件を変えてください。</div></div>}
            {contacts.map((p) => (
              <Link key={p.id} href={rowHref(p.id)} className={`prow ${p.id === selectedId ? 'on' : ''}`}>
                <span className="pav" style={{ background: pavColor(p.id) }}>{p.name.charAt(0)}</span>
                <div className="who">
                  <div className="nm">{p.name}{p.is_primary && <span className="pin"> 主</span>}{p.kana && <span className="kana">{p.kana}</span>}</div>
                  <div className="meta">{p.company} ・ {[p.department, p.title].filter(Boolean).join(' ') || '—'}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="pdetail">
          {detail && !('error' in detail) ? <PersonDetail p={detail} timeline={(timeline as any).timeline ?? []} /> : (
            <div className="panel"><div className="panel-body"><div className="pempty"><div style={{ fontSize: 26 }}>👤</div><h3>担当者を選択</h3><div>左の一覧から人を選ぶと詳細が表示されます。</div></div></div></div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function PersonDetail({ p, timeline }: { p: any; timeline: any[] }) {
  const cards = p.cards ?? [];
  const role = [p.department, p.title].filter(Boolean).join(' ') || '—';
  return (
    <>
      <div className="panel">
        <div className="panel-body">
          <div className="phero">
            <span className="pav lg" style={{ background: pavColor(p.id) }}>{p.name.charAt(0)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row" style={{ gap: 10 }}>
                <span className="nm">{p.name}</span>
                {p.is_primary && <span className="badge prospect lg"><span className="dot" />主担当</span>}
              </div>
              <div className="role"><Link href={`/companies/${p.company_id}`}>{p.company}</Link> ・ {role}{p.kana && <> ・ <span className="muted">{p.kana}</span></>}</div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <Link className="btn btn-sm" href={`/contacts/${p.id}/edit`}>編集</Link>
              <Link className="btn btn-sm btn-ghost" href={`/companies/${p.company_id}`}>会社を開く</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div>
          <div className="panel">
            <div className="panel-head"><h3>連絡先</h3>
              {p.email && <div className="actions"><a className="btn btn-sm" href={`mailto:${p.email}`}>メール</a></div>}
            </div>
            <div className="panel-body">
              <dl className="kv">
                <dt>メール</dt><dd>{p.email ? <a href={`mailto:${p.email}`}>{p.email}</a> : '—'}</dd>
                <dt>電話</dt><dd className="num">{p.phone ?? '—'}</dd>
                <dt>携帯</dt><dd className="num">{p.mobile ?? '—'}</dd>
                <dt>役職</dt><dd>{role}</dd>
              </dl>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>名刺</h3><span className="count">{cards.length ? '表 / 裏' : '未登録'}</span></div>
            <div className="panel-body">
              <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
                <div className="biz"><div className="lbl">表面</div>
                  {cards[0] ? (
                    <div className="card"><div className="fakecard"><div className="lines" style={{ padding: '13px 15px' }}>
                      <div style={{ fontWeight: 800, fontSize: 12 }}>{p.company}</div>
                      <div style={{ marginTop: 4, fontSize: 10, color: '#5a6b7d' }}>{role}</div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                      {(p.phone || p.email) && <div className="num" style={{ marginTop: 7, fontSize: 8.5, color: '#5a6b7d' }}>{[p.phone, p.email].filter(Boolean).join(' ／ ')}</div>}
                    </div></div></div>
                  ) : <div className="card-slot"><span className="big">＋</span><span style={{ fontSize: 11 }}>名刺を追加</span></div>}
                </div>
                <div className="biz"><div className="lbl">裏面</div>
                  {cards[0]?.back_path ? (
                    <div className="card"><div className="fakecard"><div className="lines" style={{ padding: '13px 15px', color: '#5a6b7d', fontSize: 9.5 }}><div style={{ fontWeight: 700, color: '#33414f' }}>裏面</div></div></div></div>
                  ) : <div className="card-slot"><span className="big">＋</span><span style={{ fontSize: 11 }}>裏面を追加</span></div>}
                </div>
              </div>
              <div className="muted mt16" style={{ fontSize: 11.5 }}>名刺画像は非公開バケットに保管し、閲覧は<b>署名URL</b>のみ。</div>
            </div>
          </div>
        </div>

        <div>
          <div className="panel ledger" style={{ borderRadius: '0 var(--radius) var(--radius) 0' }}>
            <div className="panel-head" style={{ borderLeft: 0 }}><h3>所属企業</h3></div>
            <div className="panel-body">
              <dl className="kv">
                <dt>会社</dt><dd><Link href={`/companies/${p.company_id}`}>{p.company}</Link></dd>
                {p.opt_in != null && <><dt>メルマガ</dt><dd>{p.opt_in ? '受信する' : '配信停止'}</dd></>}
              </dl>
              <Link className="btn btn-sm mt16" href={`/companies/${p.company_id}`}>会社の詳細を開く</Link>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>最近の接点</h3><span className="count num">{timeline.length}件</span></div>
            <div className="panel-body" style={{ padding: 0 }}>
              <div className="timeline">
                {timeline.length === 0 && <div style={{ padding: 16 }} className="muted">記録がまだありません。</div>}
                {timeline.map((m, i) => (
                  <Link key={i} href={`/companies/${p.company_id}`}>
                    <span className="ic2">{m.source === 'auto' ? '⚡' : '🗓'}</span>
                    <span style={{ flex: 1 }}><span className="b">{m.title}</span><br /><span className="muted" style={{ fontSize: 12 }}>{m.when}</span></span>
                    <span className="muted">›</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>この担当者</h3></div>
            <div className="panel-body">
              <dl className="kv">
                <dt>名刺</dt><dd className="num">{cards.length} 枚</dd>
                <dt>主担当</dt><dd>{p.is_primary ? 'はい' : 'いいえ'}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
