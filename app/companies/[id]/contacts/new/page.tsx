import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getCompany } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { UserAvatar } from '@/components/ui-bits';
import { ContactForm } from '@/app/contacts/[id]/edit/ContactForm';

export default async function NewContactPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;
  const company = await getCompany(id);
  const companyName: string = (company && 'name' in company ? company.name : undefined) ?? '所属企業';

  const topbar = (
    <>
      <div className="crumb">
        <Link href="/companies">顧客</Link>
        {' / '}
        <Link href={`/companies/${id}#contacts`}>{companyName}</Link>
        {' / '}
        <b>担当者を追加</b>
      </div>
      <div className="spacer" />
      <Link className="btn btn-sm" href={`/companies/${id}#contacts`}>キャンセル</Link>
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="people" topbar={topbar}>
      <div style={{ maxWidth: 1120 }}>
        <ContactForm mode="create" companyId={id} companyName={companyName} />
      </div>
    </AppShell>
  );
}
