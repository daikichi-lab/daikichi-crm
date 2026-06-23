import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { getMasters, listTags, listUsers } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { UserAvatar } from '@/components/ui-bits';
import { GuideButton } from '@/components/GuideButton';
import { CompanyForm } from './CompanyForm';
import { createCompanyAction } from './actions';

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
      <GuideButton title="企業登録の使い方">
        <p>新しい顧客企業（事業者）を登録します。</p>
        <ul>
          <li>必須は <b>名称</b> と <b>種別</b> のみ。残りは運用しながら追加できます。</li>
          <li><b>求／提タグ</b>はマッチングの肝。マスタ候補から選ぶか、その場で追加できます。</li>
          <li>試験的な項目は <b>extra</b> として、マイグレーションなしで足せます。</li>
        </ul>
      </GuideButton>
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
