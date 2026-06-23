import './unsubscribe.css';
import { getSubscriptionByToken } from '@/lib/data/dal';
import { SubscriptionForm } from './parts';

export const metadata = {
  title: 'メール配信設定・大吉会計事務所',
};

type SP = { token?: string };

function maskEmail(name?: string): string {
  // get_subscription_by_token はメールを返さないため、宛先表記は氏名/会社で代替。
  return name ?? 'お客様';
}

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<SP> }) {
  const { token } = await searchParams;
  const sub = token ? await getSubscriptionByToken(token) : null;

  if (!token || !sub || !sub.name) {
    return (
      <div className="pub-wrap">
        <div className="pub-head">
          <span className="seal">大</span>
          <div><h1>大吉会計事務所</h1><div className="sub">メールマガジンの配信設定</div></div>
        </div>
        <div className="panel">
          <div className="done-card">
            <div className="ic">!</div>
            <h3>リンクが無効です</h3>
            <p className="muted" style={{ maxWidth: 400, margin: '8px auto 0' }}>
              この配信設定リンクは無効か、有効期限が切れています。お手数ですが配信メール内の最新リンクからお試しいただくか、担当者までご連絡ください。
            </p>
          </div>
        </div>
      </div>
    );
  }

  const subscribed: string[] = Array.isArray(sub.topics) ? sub.topics : [];

  return (
    <div className="pub-wrap">
      <div className="pub-head">
        <span className="seal">大</span>
        <div><h1>大吉会計事務所</h1><div className="sub">メールマガジンの配信設定</div></div>
      </div>

      <div className="pub-hero">
        <h2>メール配信の停止・設定</h2>
        <p>このページは <strong style={{ color: '#fff' }}>{maskEmail(sub.name)}{sub.company ? `（${sub.company}）` : ''}</strong> 宛の配信設定です。受け取るトピックを選ぶか、すべての配信を停止できます。</p>
      </div>

      <SubscriptionForm token={token} subscribed={subscribed} />

      <div className="muted" style={{ textAlign: 'center', fontSize: 11.5, marginTop: 18 }}>
        大吉会計事務所 ／ 〒000-0000 ○○県○○市○○ 1-2-3 ／ TEL 00-0000-0000<br />
        このリンクは受信者ごとに発行された専用URLです（ログイン不要）。設定は即時反映されます。
      </div>
    </div>
  );
}
