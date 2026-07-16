import './states.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/icons';
import { UserAvatar } from '@/components/ui-bits';
import { ClearFilterDemo, RetryDemo, CrossInteractions } from './parts';

export default async function StatesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const topbar = (
    <>
      <h1>共通UI / 状態カタログ</h1>
      <div className="spacer" />
      <Link className="btn btn-sm" href="/dashboard">ホームへ戻る</Link>
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell topbar={topbar}>
      <div className="page-head">
        <div>
          <h2>共通UI・状態</h2>
          <div className="sub">全画面で使い回す「空 / 読込中 / エラー / 403 / 404」と、名刺ビューア・確認ダイアログ・トースト（FR-U2 / G-19 / SEC-9）。</div>
        </div>
      </div>

      <div className="state-grid">
        {/* 空（全体0） */}
        <div className="panel state-box">
          <div className="panel-head"><h3>空（全体が 0 件）</h3><span className="count">オンボーディング誘導</span></div>
          <div className="empty">
            <div className="ic"><Icon name="building" size={34} /></div>
            <h3>まだ顧客が登録されていません</h3>
            <p>最初の顧客を登録するか、名刺をスキャンして始めましょう。</p>
            <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
              <Link className="btn btn-primary" href="/companies/new">＋ 企業を登録</Link>
              <Link className="btn" href="/scan"><Icon name="card" size={15} />名刺スキャン</Link>
            </div>
          </div>
        </div>

        {/* 空（条件ヒット0） */}
        <div className="panel state-box">
          <div className="panel-head"><h3>空（条件にヒット 0 件）</h3><span className="count">絞り込みクリア導線</span></div>
          <div className="empty">
            <div className="ic"><Icon name="search" size={34} /></div>
            <h3>条件に一致する顧客がありません</h3>
            <p>絞り込み条件を見直すか、クリアしてください。</p>
            <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
              <ClearFilterDemo />
            </div>
          </div>
        </div>

        {/* 読込中（スケルトン） */}
        <div className="panel state-box">
          <div className="panel-head"><h3>読込中</h3><span className="count">スケルトン</span></div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="sk" style={{ width: '40%', height: 16 }} />
            <div className="sk" style={{ width: '100%' }} />
            <div className="sk" style={{ width: '92%' }} />
            <div className="sk" style={{ width: '96%' }} />
            <div className="sk" style={{ width: '60%' }} />
            <div className="row" style={{ gap: 10 }}>
              <div className="sk" style={{ width: 84, height: 51 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="sk" style={{ width: '50%' }} />
                <div className="sk" style={{ width: '70%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* エラー */}
        <div className="panel state-box">
          <div className="panel-head"><h3>エラー</h3><span className="count">原因＋再試行</span></div>
          <div className="panel-body">
            <div className="banner warn" style={{ marginBottom: 14 }}><span><b>読み込みに失敗しました。</b> 通信状態を確認して、もう一度お試しください。</span></div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>保存系の操作では入力値を保持したまま再試行できます（フォームは破棄しません）。</div>
            <RetryDemo />
          </div>
        </div>

        {/* 403 */}
        <div className="panel state-box">
          <div className="panel-head"><h3>403 権限なし</h3><span className="count">admin専用ページ等</span></div>
          <div className="big-state">
            <div className="code warn num">403</div>
            <h3 style={{ margin: '8px 0 4px' }}>このページにアクセスする権限がありません</h3>
            <p>管理機能は管理者（admin）のみ利用できます。強制力は RLS ＋ サーバー側DAL（SEC-11）。</p>
            <Link className="btn mt8" href="/dashboard">ホームへ戻る</Link>
          </div>
        </div>

        {/* 404 */}
        <div className="panel state-box">
          <div className="panel-head"><h3>404 / 削除済み</h3><span className="count">存在しない・論理削除</span></div>
          <div className="big-state">
            <div className="code num">404</div>
            <h3 style={{ margin: '8px 0 4px' }}>お探しの企業が見つかりません</h3>
            <p>URLが変更されたか、ゴミ箱へ移動された可能性があります。</p>
            <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
              <Link className="btn" href="/companies">顧客一覧へ</Link>
              <Link className="btn btn-ghost" href="/trash">ゴミ箱を確認</Link>
            </div>
          </div>
        </div>
      </div>

      {/* 横断インタラクション */}
      <div className="panel mt16">
        <div className="panel-head"><h3>横断インタラクション</h3><span className="count">クリックで挙動を確認</span></div>
        <div className="panel-body row" style={{ gap: 10 }}>
          <CrossInteractions />
        </div>
        <div className="panel-body" style={{ borderTop: '1px solid var(--line)' }}>
          <div className="muted" style={{ fontSize: 12 }}>名刺画像は非公開バケットに保存し、閲覧は<span className="b">有効期限付き署名URL</span>を都度発行。期限切れはサーバー経由で再発行します（SEC-9 / G-15）。</div>
        </div>
      </div>
    </AppShell>
  );
}
