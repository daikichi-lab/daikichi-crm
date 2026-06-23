import './login.css';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { loginAction } from '@/app/actions/auth';
import { ForgotPasswordLink } from '@/components/ForgotPasswordLink';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (await getCurrentUser()) redirect('/dashboard');
  const { e } = await searchParams;

  return (
    <div className="auth">
      <div className="auth-brand">
        <span className="seal">大</span>
        <h1>顧客を、つなぐ台帳。</h1>
        <p>顧問先・見込み客を一元管理し、求めること（needs）と提供できること（offers）から、顧客同士のビジネス紹介を見つけます。</p>
        <div className="ledger">
          <div style={{ fontWeight: 700, color: '#fff' }}>求 ↔ 提 で縁を結ぶ</div>
          <div className="chips">
            <span className="chip need"><span className="mk">求</span>集客</span>
            <span className="match-conn" style={{ flexDirection: 'row', gap: 4 }}><span className="arr" style={{ color: 'var(--gold-500)' }}>↔</span></span>
            <span className="chip offer"><span className="mk">提</span>Web広告</span>
          </div>
        </div>
      </div>

      <div className="auth-form">
        <form className="auth-card" action={loginAction}>
          <h2>ログイン</h2>
          <div className="lead">大吉会計事務所 顧客管理システム</div>

          {e && (
            <div className="banner warn mt8" style={{ fontSize: 12 }}>
              <span>{e === 'notfound' ? 'そのメールのユーザーが見つかりません（dev: 例 yamada@daikichi.example）' : 'ログインに失敗しました'}</span>
            </div>
          )}

          <div className="field">
            <label htmlFor="email">メールアドレス</label>
            <input id="email" name="email" className="input" type="email" placeholder="you@daikichi.example" defaultValue="yamada@daikichi.example" />
          </div>
          <div className="field">
            <div className="row-between">
              <label htmlFor="password" style={{ margin: 0 }}>パスワード</label>
              <ForgotPasswordLink />
            </div>
            <input id="password" name="password" className="input" type="password" placeholder="••••••••" defaultValue="password" style={{ marginTop: 6 }} />
          </div>

          <button className="btn btn-primary" type="submit">ログイン</button>

          <div className="banner info mt16" style={{ fontSize: 12 }}>
            <span>アカウントは管理者が発行します（招待制）。サインアップは開放していません。</span>
          </div>
        </form>
      </div>
    </div>
  );
}
