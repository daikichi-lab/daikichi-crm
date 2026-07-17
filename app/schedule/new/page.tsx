import '../schedule.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { listUsers, searchCompanies, getTask, getCompany } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { UserAvatar } from '@/components/ui-bits';
import { TaskForm, type ParentPreset } from '../task-form';

type SP = { [k: string]: string | undefined };

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const sp = await searchParams;

  const [users, cos] = await Promise.all([listUsers(), searchCompanies({ limit: 100 })]);
  const companies = (cos?.companies ?? []).map((c: { id: string; name: string; industry: string | null }) => ({ id: c.id, name: c.name, industry: c.industry }));

  // ?parent=<id> → その課題の子課題として作成（区分・企業は親から引き継いで固定）
  let parentPreset: ParentPreset | null = null;
  if (sp.parent) {
    const p = await getTask(sp.parent);
    if (p && !p.error && !p.parent) {
      parentPreset = { id: p.id, title: p.title, scope: p.scope, company_id: p.company_id, company: p.company };
    }
  }

  // ?company=<id> → その企業を初期選択（顧客の課題として。企業欄は変更可）
  let companyPreset: { id: string; name: string } | null = null;
  if (sp.company && !parentPreset) {
    const c = await getCompany(sp.company);
    if (c && !('error' in c)) companyPreset = { id: c.id, name: c.name };
  }

  const topbar = (
    <>
      <div className="crumb"><Link href="/schedule">期限・タスク</Link> / <b>{parentPreset ? '子課題を作成' : '課題を作成'}</b></div>
      <div className="spacer" />
      <Link className="btn btn-sm" href="/schedule">キャンセル</Link>
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="schedule" topbar={topbar}>
      <div style={{ maxWidth: 920 }}>
        <div className="page-head">
          <div>
            <h2>{parentPreset ? '子課題を作成' : '課題を作成'}</h2>
            <div className="sub">
              {parentPreset
                ? <>親課題「<b>{parentPreset.title}</b>」の子課題として作成します。</>
                : <>必須は <b style={{ color: 'var(--red-600)' }}>*</b> のみ。親課題を選ぶと子課題として作成されます。</>}
            </div>
          </div>
        </div>
        <TaskForm users={users ?? []} companies={companies} mode="create" parentPreset={parentPreset} companyPreset={companyPreset} />
      </div>
    </AppShell>
  );
}
