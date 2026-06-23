import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { getCompany, getMasters, listTags, listUsers } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { UserAvatar } from '@/components/ui-bits';
import { GuideButton } from '@/components/GuideButton';
import { CompanyForm } from '@/app/companies/new/CompanyForm';
import { updateCompanyAction } from '@/app/companies/new/actions';

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;

  const [company, masters, tagsRes, users] = await Promise.all([getCompany(id), getMasters(), listTags(), listUsers()]);
  if (!company || 'error' in company) notFound();

  const areas = Object.values(masters.areas ?? {}).flat();
  const userList = users as any[];
  const owners = userList.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name }));
  const ownerId = company.owner ? (userList.find((u) => u.name === company.owner)?.id ?? '') : '';

  const updateAction = updateCompanyAction.bind(null, company.id);

  const topbar = (
    <>
      <div className="crumb"><Link href="/companies">顧客</Link> / <Link href={`/companies/${company.id}`}>{company.name}</Link> / <b>編集</b></div>
      <div className="spacer" />
      <Link className="btn btn-sm" href={`/companies/${company.id}`}>キャンセル</Link>
      <GuideButton title="企業編集の使い方">
        <p>企業情報を編集します。必須は名称と種別のみ。</p>
        <ul>
          <li><b>求／提タグ</b>はマスタ候補から選ぶか、その場で追加できます。</li>
          <li>試験的な項目は <b>extra</b> として足せます（多用されれば正式な列へ昇格）。</li>
        </ul>
      </GuideButton>
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="companies" topbar={topbar}>
      <div className="content" style={{ maxWidth: 1120, padding: 0 }}>
        <div className="page-head"><div><h2>企業を編集</h2><div className="sub">必須は <span className="b" style={{ color: 'var(--red-600)' }}>*</span> のみ。残りは運用しながら追加できます。</div></div></div>
        <CompanyForm
          mode="edit"
          values={{
            id: company.id, type: company.type, name: company.name, industry: company.industry,
            area: company.area, size: company.size, status: company.status, owner_id: ownerId,
            notes: company.notes, needs: company.needs ?? [], offers: company.offers ?? [], extra: company.extra ?? {},
          }}
          industries={masters.industries ?? []}
          areas={areas}
          sizes={masters.sizes ?? []}
          tags={tagsRes.tags.map((t) => t.label)}
          owners={owners}
          action={updateAction}
        />
      </div>
    </AppShell>
  );
}
