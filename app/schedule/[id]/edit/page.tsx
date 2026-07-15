import '../../schedule.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { listUsers, searchCompanies, getTask } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { UserAvatar } from '@/components/ui-bits';
import { TaskForm } from '../../task-form';

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;

  const [t, users, cos] = await Promise.all([getTask(id), listUsers(), searchCompanies({ limit: 100 })]);
  if (!t || t.error) redirect('/schedule');
  const companies = (cos?.companies ?? []).map((c: { id: string; name: string; industry: string | null }) => ({ id: c.id, name: c.name, industry: c.industry }));

  const topbar = (
    <>
      <div className="crumb">
        <Link href="/schedule">期限・タスク</Link> / <Link href={`/schedule/${t.id}`}>課題 #{String(t.id).slice(0, 8)}</Link> / <b>編集</b>
      </div>
      <div className="spacer" />
      <Link className="btn btn-sm" href={`/schedule/${t.id}`}>キャンセル</Link>
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="schedule" topbar={topbar}>
      <div style={{ maxWidth: 920 }}>
        <div className="page-head">
          <div>
            <h2>課題を編集</h2>
            <div className="sub">
              {t.source === '自動'
                ? <>自動生成の課題のため、<b>題名・種別・日付は変更できません</b>（担当・状態・進捗・説明は変更可）。</>
                : <>「{t.title}」を編集します。</>}
            </div>
          </div>
        </div>
        <TaskForm users={users ?? []} companies={companies} mode="edit" initial={t} />
      </div>
    </AppShell>
  );
}
