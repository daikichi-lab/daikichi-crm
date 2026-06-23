import './admin-users.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { listUsers } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/icons';
import { GuideButton } from '@/components/GuideButton';
import { UserAvatar } from '@/components/ui-bits';
import { InviteBar, InviteButton, RoleSelect, ActiveToggleButton } from './parts';

type User = { id: string; name: string; email: string; role: 'staff' | 'admin'; active: boolean; avatar_initial: string };

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/dashboard');

  const users: User[] = (await listUsers()) ?? [];
  const activeCount = users.filter((u) => u.active).length;
  const inactiveCount = users.length - activeCount;

  const topbar = (
    <>
      <div className="crumb"><b>管理</b> / ユーザー</div>
      <div className="spacer" />
      <GuideButton title="管理（ユーザー）の使い方">
        <p>スタッフのアカウントを管理します（管理者のみ）。</p>
        <ul>
          <li>上の欄から<b>メールで招待</b>。</li>
          <li>行内の<b>ロール</b>（staff/admin）を変更、<b>無効化／有効化</b>。</li>
        </ul>
      </GuideButton>
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="admin" topbar={topbar}>
      <div className="page-head">
        <div><h2>管理</h2><div className="sub">管理者（admin）のみがアクセスできます。</div></div>
        <div className="actions"><InviteButton /></div>
      </div>

      <nav className="admin-tabs">
        <Link href="/admin/users" className="on">ユーザー</Link>
        <Link href="/admin/masters">タグ・業種マスタ</Link>
      </nav>

      <div className="banner warn">
        <Icon name="gear" size={16} />
        <div><span className="b">多層防御で保護される画面です。</span> admin メニューは非adminには非表示にしたうえで、ルートガード＋サーバー側DAL でも到達制御し、最終的な強制力は RLS が担保します（SEC-11 / G-13）。</div>
      </div>

      <div className="panel mt16">
        <div className="panel-head"><h3>スタッフ</h3><span className="count num">{users.length}名（有効 {activeCount} / 無効 {inactiveCount}）</span></div>
        <InviteBar />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>表示名</th><th>メール</th><th>ロール</th><th>状態</th><th className="right">最終ログイン</th><th className="right">操作</th></tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const self = u.id === user.id;
                return (
                  <tr key={u.id} style={{ cursor: 'default', opacity: u.active ? 1 : 0.7 }}>
                    <td className="name">{u.name}{self && <span className="muted" style={{ fontWeight: 600 }}>（自分）</span>}</td>
                    <td className="num">{u.email}</td>
                    <td>
                      <RoleSelect
                        id={u.id}
                        name={u.name}
                        role={u.role}
                        disabled={self || !u.active}
                        title={self ? '自分のロールは変更できません' : !u.active ? '無効ユーザーのロールは変更できません' : undefined}
                      />
                    </td>
                    <td>
                      {u.active
                        ? <span className="badge active"><span className="dot" />有効</span>
                        : <span className="badge off"><span className="dot" />無効</span>}
                    </td>
                    <td className="right num muted">—</td>
                    <td className="right"><ActiveToggleButton id={u.id} name={u.name} active={u.active} self={self} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="banner info mt16">
        <Icon name="user" size={16} />
        <div>アカウント発行は <span className="b">招待制</span>（サインアップは一般開放しない）。当面は Supabase ダッシュボード運用も可。アプリ内招待画面の提供範囲は要件 §12 で確定予定（FR-A4）。</div>
      </div>
    </AppShell>
  );
}
