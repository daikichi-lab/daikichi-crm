import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getContact } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { UserAvatar } from '@/components/ui-bits';
import { ContactForm, type ContactInitial } from './ContactForm';

export default async function ContactEditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;
  const c = await getContact(id, true);

  const company = c.company ?? c.companies ?? {};
  const companyId: string | undefined = c.company_id ?? company.id;
  const companyName: string = company.name ?? c.company_name ?? '所属企業';
  const cards: any[] = c.cards ?? c.business_cards ?? [];
  const extra = c.extra ?? {};

  const initial: ContactInitial = {
    name: c.name,
    kana: c.kana,
    title: c.title,
    department: c.department,
    email: c.email,
    phone: c.phone,
    mobile: c.mobile,
    is_primary: c.is_primary,
    sns_x: extra.sns_x ?? extra.x ?? extra.twitter,
    sns_linkedin: extra.sns_linkedin ?? extra.linkedin,
    sns_instagram: extra.sns_instagram ?? extra.instagram,
    sns_other: extra.sns_other ?? extra.facebook,
    has_front_card: cards.length > 0,
  };

  const topbar = (
    <>
      <div className="crumb">
        <Link href="/companies">顧客</Link>
        {' / '}
        {companyId ? <Link href={`/companies/${companyId}#contacts`}>{companyName}</Link> : <span>{companyName}</span>}
        {' / '}
        <b>{c.name} を編集</b>
      </div>
      <div className="spacer" />
      <Link className="btn btn-sm" href={`/contacts/${id}`}>キャンセル</Link>
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="people" topbar={topbar}>
      <div style={{ maxWidth: 1120 }}>
        <ContactForm mode="edit" companyId={companyId} companyName={companyName} contactId={id} initial={initial} />
      </div>
    </AppShell>
  );
}
