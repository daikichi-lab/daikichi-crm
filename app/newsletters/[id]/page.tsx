import '../newsletters.css';
import './detail.css';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getNewsletter } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/icons';
import { UserAvatar } from '@/components/ui-bits';
import { NewsletterDetailActions, RecipientTable, type Recipient } from './parts';

const STATUS_CLASS: Record<string, string> = {
  下書き: 'draft', 予約: 'scheduled', 送信中: 'sending', 送信済: 'sent', 失敗: 'failed',
};

export default async function NewsletterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;

  const n = await getNewsletter(id);
  if (!n || !n.id) notFound();

  const recipients: Recipient[] = n.recipients ?? [];
  const topics: string[] = n.topic_ids ?? [];
  const statusCls = STATUS_CLASS[n.status] ?? 'draft';
  const bounce = recipients.filter((r) => r.status === 'バウンス').length;

  const bodyPreview = String(n.body ?? '').slice(0, 400);

  const topbar = (
    <>
      <div className="crumb"><Link href="/newsletters">メルマガ</Link> / <b>配信の結果</b></div>
      <div className="spacer" />
      <NewsletterDetailActions id={n.id} subject={n.subject} recipients={recipients} />
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="newsletter" topbar={topbar}>
      <div className="page-head">
        <div>
          <h2>{n.subject}</h2>
          <div className="sub">
            {n.sent_at ? `${n.sent_at} に送信` : '未送信'} ・{' '}
            <span className={`badge ${statusCls}`} style={{ verticalAlign: 'middle' }}><span className="dot" />{n.status}</span>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div>
          <div className="stats" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
            <div className="stat"><div className="k">対象</div><div className="v num">{n.target_count ?? 0}</div></div>
            <div className="stat" style={{ ['--c' as any]: 'var(--green-600)' }}><div className="k">送信済</div><div className="v num" style={{ color: 'var(--green-700)' }}>{n.sent_count ?? 0}</div></div>
            <div className="stat"><div className="k">失敗</div><div className="v num" style={{ color: 'var(--red-600)' }}>{n.failed_count ?? 0}</div></div>
            <div className="stat"><div className="k">バウンス</div><div className="v num">{bounce}</div></div>
            <div className="stat gold"><div className="k">配信停止スキップ</div><div className="v num">{n.skipped_count ?? 0}</div></div>
          </div>

          <div className="banner info mt16">
            <span><Icon name="help" size={16} /></span>
            <div><b>開封・クリックの計測</b>は拡張フェーズで対応予定です。現在は送信成否（送信済 / 失敗 / バウンス / 配信停止スキップ）を記録します。</div>
          </div>

          <RecipientTable recipients={recipients} />
        </div>

        <div>
          <div className="panel">
            <div className="panel-head"><h3>この配信について</h3></div>
            <div className="panel-body ledger">
              <dl className="kv">
                <dt>状態</dt><dd><span className={`badge ${statusCls}`}><span className="dot" />{n.status}</span></dd>
                <dt>配信トピック</dt><dd>{topics.length ? topics.map((t) => <span key={t} className="topic">{t}</span>) : <span className="muted">指定なし（全購読者）</span>}</dd>
                <dt>セグメント</dt><dd>{topics.join(' / ') || '全購読者'}<br /><span className="muted" style={{ fontSize: 12 }}>＋ 同意なし・配信停止を自動除外</span></dd>
                <dt>送信者</dt><dd>大吉会計事務所</dd>
                <dt>返信先</dt><dd className="num" style={{ fontSize: 12.5 }}>info@daikichi-kaikei.example.jp</dd>
                <dt>作成者</dt><dd>{user.name}</dd>
                <dt>送信日時</dt><dd className="num">{n.sent_at ?? '—'}</dd>
                <dt>送信基盤</dt><dd>送信API（日次上限内でスロットル配信）</dd>
              </dl>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>本文プレビュー</h3></div>
            <div className="panel-body" style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.7 }}>
              <div className="b" style={{ color: 'var(--ink)' }}>{n.subject}</div>
              <div className="muted" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{bodyPreview || '（本文なし）'}</div>
              <div className="muted" style={{ marginTop: 12, borderTop: '1px dashed var(--line-strong)', paddingTop: 10, fontSize: 11.5 }}>
                大吉会計事務所 ／ 〒000-0000 … ／ 配信を停止する（このリンクは受信者ごとに自動生成されます）
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
