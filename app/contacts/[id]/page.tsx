import './contact-detail.css';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getContact } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { TourButton, type GuideTourStep } from '@/components/TourButton';
import { StatusBadge, UserAvatar } from '@/components/ui-bits';
import { DeleteContactButton, SetPrimaryButton, UnsetPrimaryButton, CardViewer, CardActionButton, CardReplaceButton } from './parts';

const GUIDE_TOUR: GuideTourStep[] = [
  { sel: '.grid-2', title: '先方担当者の詳細',
    body: '左に連絡先・個人SNS・名刺、右に主担当の設定・所属企業・関連情報。' },
  { sel: '.bizset', title: '名刺は表裏を切替・クリックで拡大',
    body: '差し替えや履歴は名刺パネル右上から。' },
  { title: '主担当と関連リンク',
    body: '右カラムで<b>主担当</b>の設定／解除。所属企業のカルテや、出た打ち合わせ・議事録にも移動できます。' },
];


export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;
  const c = await getContact(id, true);
  if (!c || c.error || !c.id) notFound();

  // 所属企業・名刺・SNS は返り値に含まれない可能性があるため防御的に読む
  const company = c.company ?? c.companies ?? {};
  const companyId: string | undefined = c.company_id ?? company.id;
  const companyName: string = company.name ?? c.company_name ?? '所属企業';
  const cards: any[] = c.cards ?? c.business_cards ?? [];
  const extra = c.extra ?? {};
  const sns: { label: string; href: string }[] = [];
  for (const [key, prefix] of [['x', '𝕏'], ['twitter', '𝕏'], ['linkedin', 'in'], ['instagram', 'IG'], ['facebook', 'f']] as const) {
    const v = extra[`sns_${key}`] ?? extra[key];
    if (v) sns.push({ label: `${prefix} ${String(v).replace(/^https?:\/\//, '')}`, href: String(v) });
  }
  const front = cards.find((x) => x.face === 'front') ?? cards[0];
  const back = cards.find((x) => x.face === 'back') ?? cards[1];
  const cardCount = cards.length;

  const topbar = (
    <>
      <div className="crumb">
        <Link href="/companies">顧客</Link>
        {' / '}
        {companyId ? <Link href={`/companies/${companyId}#contacts`}>{companyName}</Link> : <span>{companyName}</span>}
        {' / '}
        <b>{c.name}</b>
      </div>
      <div className="spacer" />
      <Link className="btn btn-sm" href={`/contacts/${id}/edit`}>編集</Link>
      <DeleteContactButton id={id} name={c.name} companyId={companyId} />
      <TourButton steps={GUIDE_TOUR} />
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="people" topbar={topbar}>
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 10 }}>
            <h2>{c.name}</h2>
            {c.is_primary && <span className="badge prospect lg"><span className="dot" />主担当</span>}
          </div>
          <div className="sub">
            {companyId ? <Link href={`/companies/${companyId}#contacts`}>{companyName}</Link> : companyName}
            {(c.department || c.title) && <> ・ {[c.department, c.title].filter(Boolean).join(' ')}</>}
            {c.kana && <> ・ {c.kana}</>}
          </div>
        </div>
        <div className="actions">
          <Link className="btn btn-sm btn-ghost" href={companyId ? `/companies/${companyId}#contacts` : '/companies'}>← 担当者一覧へ</Link>
        </div>
      </div>

      <div className="grid-2">
        <div>
          <div className="panel">
            <div className="panel-head"><h3>連絡先</h3></div>
            <div className="panel-body">
              <dl className="kv">
                <dt>メール</dt><dd>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : <span className="muted">—</span>}</dd>
                <dt>電話</dt><dd className="num">{c.phone || '—'}</dd>
                <dt>携帯</dt><dd className="num">{c.mobile || '—'}</dd>
                <dt>部署</dt><dd>{c.department || '—'}</dd>
                <dt>役職</dt><dd>{c.title || '—'}</dd>
              </dl>
              {sns.length > 0 && (
                <div className="mt16">
                  <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>個人のSNS</div>
                  <div className="row" style={{ gap: 8 }}>
                    {sns.map((s) => (
                      <a key={s.href} className="btn btn-sm" href={s.href} target="_blank" rel="noopener noreferrer">{s.label}</a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>名刺</h3><span className="count">表 / 裏</span>
              <div className="actions">
                <CardReplaceButton contactId={id} companyId={companyId} />
                <CardActionButton label="履歴" msg="過去の名刺（履歴）を表示" />
              </div>
            </div>
            <div className="panel-body">
              <div className="bizset">
                <div className="biz"><div className="lbl">表面</div>
                  <CardViewer path={front?.front_path}>
                    <div className="fakecard"><div className="lines" style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{companyName}</div>
                      <div style={{ marginTop: 5, fontSize: 11 }}>{[c.department, c.title].filter(Boolean).join(' ')}</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</div>
                      <div className="num" style={{ marginTop: 8, fontSize: 9, color: '#5a6b7d' }}>{[c.phone, c.email].filter(Boolean).join(' ／ ')}</div>
                    </div></div>
                  </CardViewer>
                </div>
                {back && (
                  <div className="biz"><div className="lbl">裏面</div>
                    <CardViewer path={back.back_path ?? back.front_path}>
                      <div className="fakecard"><div className="lines" style={{ padding: '14px 16px', color: '#5a6b7d', fontSize: 10 }}>
                        <div style={{ fontWeight: 700, color: '#33414f' }}>裏面</div>
                        <div style={{ marginTop: 5 }}>{back.back_path ?? back.front_path ?? ''}</div>
                      </div></div>
                    </CardViewer>
                  </div>
                )}
              </div>
              <div className="muted mt16" style={{ fontSize: 12 }}>名刺画像は非公開バケットに保管し、閲覧は<b>署名URL</b>のみ（クリックで拡大）。</div>
            </div>
          </div>
        </div>

        <div>
          <div className="panel">
            <div className="panel-head"><h3>主担当</h3></div>
            <div className="panel-body">
              {c.is_primary ? (
                <>
                  <div className="banner ok" style={{ fontSize: 12.5 }}>この担当者が <b>主担当</b> です。窓口・連絡の優先先になります。</div>
                  <UnsetPrimaryButton companyId={companyId} />
                </>
              ) : (
                <>
                  <div className="banner info" style={{ fontSize: 12.5 }}>この担当者は主担当ではありません。窓口にする場合は主担当に設定してください。</div>
                  <SetPrimaryButton id={id} companyId={companyId} />
                </>
              )}
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><h3>所属企業</h3></div>
            <div className="panel-body">
              <dl className="kv">
                <dt>会社</dt><dd>{companyId ? <Link href={`/companies/${companyId}`}>{companyName}</Link> : companyName}</dd>
                <dt>業種</dt><dd>{company.industry || '—'}</dd>
                <dt>エリア</dt><dd>{company.area || '—'}</dd>
                <dt>ステータス</dt><dd>{company.status ? <StatusBadge status={company.status} /> : '—'}</dd>
              </dl>
              {companyId && <Link className="btn btn-sm mt16" href={`/companies/${companyId}`}>会社の詳細を開く</Link>}
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><h3>この担当者</h3></div>
            <div className="panel-body">
              <dl className="kv">
                <dt>名刺</dt><dd className="num">{cardCount} 枚{front ? '（表 / 裏）' : ''}</dd>
                <dt>登録日</dt><dd className="num">{c.created_at || '—'}</dd>
                <dt>最終更新</dt><dd className="num">{c.updated_at || '—'}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
