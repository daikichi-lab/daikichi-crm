import './company-detail.css';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import {
  getCompany, companyOverview, searchDocuments, getCompanyTimeline,
  listSchedule, listReferrals, listNotes, getMasters,
} from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/icons';
import { TourButton, type GuideTourStep } from '@/components/TourButton';
import { TypeBadge, StatusBadge, UserAvatar } from '@/components/ui-bits';
import { CompanyTabs, DeleteCompanyButton } from './parts';
import { softDeleteCompanyAction } from './actions';

const GUIDE_TOUR: GuideTourStep[] = [
  { sel: 'nav.tabs', title: 'タブで1社のカルテを切替',
    body: '概要／担当者／資料／議事録／紹介履歴。この企業に関するすべてがここに集まります。' },
  { sel: '.grid-2', title: '概要タブ',
    body: '企業情報・求/提タグ・期限・タスク・タイムラインをひと目で確認できます。' },
  { sel: '.page-head .actions', title: '担当者追加・議事録取込',
    body: '担当者の追加や議事録の取り込みはここから。' },
  { sel: 'header.topbar a[href*="matching"]', title: '紹介候補を見る',
    body: 'この会社の求/提タグに合う紹介相手（協業先・顧客）を探せます。' },
  { title: '資料は安全に保管',
    body: '資料タブでPDF等をアップロード。閲覧・ダウンロードは有効期限つき<b>署名URL</b>（非公開バケット）です。' },
];


export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;

  const company = await getCompany(id);
  if (!company || 'error' in company) notFound();

  const [overview, docsRes, timelineRes, scheduleRes, referralsRes, notesRes, masters] = await Promise.all([
    companyOverview(id), searchDocuments({ company: id, limit: 200 }), getCompanyTimeline(id, { limit: 30 }),
    listSchedule({ company: id }), listReferrals({ company: id }), listNotes(), getMasters(),
  ]);

  const notes = (notesRes.items ?? []).filter((n: any) => n.company_id === company.id);
  const idLabel = String(company.id).replace(/-/g, '').slice(-6).toUpperCase();

  const topbar = (
    <>
      <div className="crumb"><Link href="/companies">顧客</Link> / <b>{company.name}</b></div>
      <div className="spacer" />
      <Link className="btn btn-sm" href={`/matching?base=${company.id}`}><Icon name="link" size={14} />紹介候補を見る</Link>
      <Link className="btn btn-sm" href={`/companies/${company.id}/edit`}>編集</Link>
      <DeleteCompanyButton id={company.id} name={company.name} action={softDeleteCompanyAction} />
      <TourButton steps={GUIDE_TOUR} />
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="companies" topbar={topbar}>
      <div className="page-head">
        <div className="row">
          <h2>{company.name}</h2>
          <span className="badge type lg">{company.type}</span>
          <StatusBadge status={company.status} />
        </div>
        <div className="actions">
          <Link className="btn btn-sm" href={`/companies/${company.id}/contacts/new`}><Icon name="card" size={14} />担当者を追加</Link>
          <Link className="btn btn-sm btn-primary" href="/notes"><Icon name="doc" size={14} />議事録を取り込む</Link>
        </div>
      </div>

      <CompanyTabs
        companyId={company.id}
        companyName={company.name}
        contacts={company.contacts}
        cardsCount={overview.cards ?? 0}
        documents={docsRes.documents ?? []}
        documentsCount={overview.documents ?? (docsRes.documents?.length ?? 0)}
        documentsSize={overview.documents_size ?? docsRes.total_size ?? '0 B'}
        schedule={scheduleRes.items ?? []}
        timeline={timelineRes.timeline ?? []}
        notes={notes}
        referrals={referralsRes.items ?? []}
        documentCategories={masters.document_categories ?? []}
        overview={{
          industry: company.industry, area: company.area, size: company.size, status: company.status, owner: company.owner,
          needs: company.needs ?? [], offers: company.offers ?? [], notes: company.notes,
          extra: company.extra ?? {}, fiscalMonth: company.fiscal_month, idLabel,
          summary: {
            contacts: overview.contacts ?? 0, cards: overview.cards ?? 0,
            documents: overview.documents ?? 0, documentsSize: overview.documents_size ?? '0 B',
            notes: overview.notes ?? 0, referrals: overview.referrals ?? 0,
            registered: overview.registered ?? '—', updated: overview.updated ?? '—',
          },
          nextMeeting: overview.next_meeting ?? null,
        }}
      />
    </AppShell>
  );
}
