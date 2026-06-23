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
import { GuideButton } from '@/components/GuideButton';
import { TypeBadge, StatusBadge, UserAvatar } from '@/components/ui-bits';
import { CompanyTabs, DeleteCompanyButton } from './parts';
import { softDeleteCompanyAction } from './actions';

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
      <GuideButton title="企業詳細の使い方">
        <p>1社の「カルテ」です。タブで情報を切り替えます。</p>
        <ul>
          <li><b>概要／担当者／資料／議事録／紹介履歴</b> をタブで切替。</li>
          <li>担当者タブで <b>★主担当の変更</b>、名刺やSNSの確認。</li>
          <li><b>資料</b>タブで PDF・商品資料・契約書・決算書などをアップロード/プレビュー（非公開バケット＋署名URLで安全に保管）。</li>
          <li>議事録・紹介履歴タブで、この会社の打ち合わせ記録・紹介のやり取りを確認。</li>
        </ul>
      </GuideButton>
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
