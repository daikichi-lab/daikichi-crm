import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { listTrash } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { GuideButton } from '@/components/GuideButton';
import { UserAvatar } from '@/components/ui-bits';
import { TrashFilter, RestoreButton, PurgeButton } from './parts';

type SP = { kind?: string };

export default async function TrashPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const sp = await searchParams;
  const data = await listTrash();
  const companies: { id: string; name: string; type: string; deleted_at: string }[] = data.companies ?? [];
  const contacts: { id: string; name: string; company: string; deleted_at: string }[] = data.contacts ?? [];

  const showCompanies = sp.kind !== 'contact';
  const showContacts = sp.kind !== 'company';
  const total = (showCompanies ? companies.length : 0) + (showContacts ? contacts.length : 0);
  const isAdmin = user.role === 'admin';

  const topbar = (
    <>
      <h1>ゴミ箱</h1>
      <div className="spacer" />
      <GuideButton title="ゴミ箱の使い方">
        <p>削除した項目の置き場です。完全には消えていません。</p>
        <ul>
          <li><b>復元</b>でいつでも元に戻せます。</li>
          <li><b>完全削除</b>は取り消せません（管理者のみ）。</li>
        </ul>
      </GuideButton>
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="trash" topbar={topbar}>
      <div className="page-head">
        <div>
          <h2>ゴミ箱 / 復元</h2>
          <div className="sub">論理削除した項目。いつでも復元できます。完全削除は管理者のみ。</div>
        </div>
      </div>

      <div className="banner info" style={{ marginBottom: 16 }}>
        <span>削除しても物理削除はしません（<b>deleted_at</b> を立てるだけ）。一覧・検索・マッチングからは除外されます。</span>
      </div>

      <div className="panel">
        <TrashFilter />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>名称</th><th>種類</th><th>付帯</th><th>削除日</th><th className="right">操作</th></tr>
            </thead>
            <tbody>
              {total === 0 && (
                <tr style={{ cursor: 'default' }}><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 28 }}>ゴミ箱は空です。</td></tr>
              )}
              {showCompanies && companies.map((c) => (
                <tr key={`co-${c.id}`} style={{ cursor: 'default' }}>
                  <td className="name">{c.name}</td>
                  <td><span className="badge type">企業</span></td>
                  <td className="muted">{c.type}</td>
                  <td className="num muted">{c.deleted_at}</td>
                  <td className="right">
                    <RestoreButton id={c.id} name={c.name} kind="company" />{' '}
                    {isAdmin && <PurgeButton id={c.id} name={c.name} />}
                  </td>
                </tr>
              ))}
              {showContacts && contacts.map((c) => (
                <tr key={`ct-${c.id}`} style={{ cursor: 'default' }}>
                  <td className="name">{c.name}</td>
                  <td><span className="badge type">担当者</span></td>
                  <td className="muted">{c.company}</td>
                  <td className="num muted">{c.deleted_at}</td>
                  <td className="right">
                    <RestoreButton id={c.id} name={c.name} kind="contact" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tfoot"><span className="num">{total} 件</span></div>
      </div>
    </AppShell>
  );
}
