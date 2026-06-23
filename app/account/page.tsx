import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { AppShell } from '@/components/AppShell';
import { GuideButton } from '@/components/GuideButton';
import { UserAvatar } from '@/components/ui-bits';
import { ProfileForm, PasswordForm, LogoutButton } from './parts';

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const roleLabel = user.role === 'admin' ? '管理者' : '一般スタッフ';

  const topbar = (
    <>
      <h1>アカウント</h1>
      <div className="spacer" />
      <GuideButton title="アカウントの使い方">
        <p>自分のアカウント設定です。</p>
        <ul>
          <li>表示名の変更、<b>パスワード変更</b>、<b>ログアウト</b>。</li>
          <li>メールアドレスの変更は管理者へ依頼します。</li>
        </ul>
      </GuideButton>
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="account" topbar={topbar}>
      <div style={{ maxWidth: 720 }}>
        <div className="page-head">
          <div>
            <h2>アカウント設定</h2>
            <div className="sub">プロフィールとパスワードを管理します。</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>プロフィール</h3></div>
          <div className="panel-body">
            <div className="row" style={{ gap: 16, marginBottom: 16 }}>
              <div className="avatar" style={{ width: 56, height: 56, fontSize: 20 }}>{user.avatar}</div>
              <div>
                <div className="b" style={{ fontSize: 16 }}>{user.name}</div>
                <div className="muted num">{user.email}</div>
                <span className="badge prospect" style={{ marginTop: 6 }}>権限: {roleLabel}</span>
              </div>
            </div>
            <ProfileForm initialName={user.name} email={user.email} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>パスワード変更</h3></div>
          <div className="panel-body">
            <PasswordForm />
          </div>
        </div>

        <div className="panel">
          <div className="panel-body row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div className="b">ログアウト</div>
              <div className="muted" style={{ fontSize: 12.5 }}>この端末からサインアウトします。</div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
