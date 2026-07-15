import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { getMasters, listTags, listUsers } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { UserAvatar } from '@/components/ui-bits';
import { TourButton, type GuideTourStep } from '@/components/TourButton';
import { CompanyForm } from './CompanyForm';
import { createCompanyAction } from './actions';

const GUIDE_TOUR: GuideTourStep[] = [
  { sel: '.form-grid', title: '必須は名称と種別だけ',
    body: '残りの項目は後からでOK。まず登録して、運用しながら育てる台帳です。' },
  { sel: '.tag-suggest', title: '求／提タグがマッチングの肝',
    body: 'マスタ候補から選ぶか、その場で追加。ここが顧客同士の紹介の材料になります。' },
  { title: '試験的な項目は extra へ',
    body: '「メモ・追加項目」の extra はマイグレーション無しで増やせます。絞り込みで多用するようになったら正式な列へ昇格します。' },
];


export default async function NewCompanyPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [masters, tagsRes, users] = await Promise.all([getMasters(), listTags(), listUsers()]);
  const areas = Object.values(masters.areas ?? {}).flat();
  const owners = (users as any[]).filter((u) => u.active).map((u) => ({ id: u.id, name: u.name }));

  const topbar = (
    <>
      <div className="crumb"><Link href="/companies">顧客</Link> / <b>新規登録</b></div>
      <div className="spacer" />
      <Link className="btn btn-sm" href="/companies">キャンセル</Link>
      <TourButton steps={GUIDE_TOUR} />
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="companies" topbar={topbar}>
      <div className="content" style={{ maxWidth: 1120, padding: 0 }}>
        <div className="page-head"><div><h2>企業を登録</h2><div className="sub">必須は <span className="b" style={{ color: 'var(--red-600)' }}>*</span> のみ。残りは運用しながら追加できます。</div></div></div>
        <CompanyForm
          mode="new"
          values={{ type: '法人', name: '', industry: null, area: null, size: null, status: '見込み', owner_id: null, notes: null, needs: [], offers: [], extra: {} }}
          industries={masters.industries ?? []}
          areas={areas}
          sizes={masters.sizes ?? []}
          tags={tagsRes.tags.map((t) => t.label)}
          owners={owners}
          action={createCompanyAction}
        />
      </div>
    </AppShell>
  );
}
