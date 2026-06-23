import './newsletters.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { listNewsletters, getMasters } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/icons';
import { GuideButton } from '@/components/GuideButton';
import { UserAvatar } from '@/components/ui-bits';
import { NewsletterFilterBar, NewsletterRow } from './parts';

type SP = { [k: string]: string | undefined };

type Item = {
  id: string;
  subject: string;
  status: string;
  topic_ids: string[];
  target_count: number | null;
  sent_count: number | null;
  failed_count: number | null;
  skipped_count: number | null;
  sent_at: string | null;
  created_at: string | null;
};

const STATUS_CLASS: Record<string, string> = {
  下書き: 'draft', 予約: 'scheduled', 送信中: 'sending', 送信済: 'sent', 失敗: 'failed',
};

export default async function NewslettersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const sp = await searchParams;

  const [res, masters] = await Promise.all([listNewsletters(), getMasters()]);
  const topics: string[] = masters.newsletter_topics ?? [];
  const all: Item[] = res.items ?? [];

  const filtered = all.filter((n) => {
    if (sp.status && n.status !== sp.status) return false;
    if (sp.topic && !(n.topic_ids ?? []).includes(sp.topic)) return false;
    return true;
  });

  const sentThisCount = all.filter((n) => n.status === '送信済').length;
  const scheduledCount = all.filter((n) => n.status === '予約').length;
  const monthCount = sentThisCount + scheduledCount + all.filter((n) => n.status === '送信中').length;

  const topbar = (
    <>
      <h1>メルマガ</h1>
      <div className="spacer" />
      <Link className="btn btn-sm" href="/admin/masters#topics">配信トピック</Link>
      <Link className="btn btn-sm btn-primary" href="/newsletters/compose"><Icon name="send" size={15} />＋ メルマガを作成</Link>
      <GuideButton title="メルマガの使い方">
        <p>顧客の担当者へ、<b>配信トピック（メルマガ属性）</b>で絞り込んでメールマガジンを送る画面です。</p>
        <ul>
          <li><b>セグメント</b> = 配信トピック × 既存の顧客属性（業種・エリア・規模・ステータス）。新しい名簿は作りません。</li>
          <li>送信は<b>無料の送信APIに任せ、名簿・属性・履歴は本システム内</b>に保持（顧客情報は国内保管のまま）。</li>
          <li><b>同意のない宛先・配信停止した人には送りません</b>（特定電子メール法・個人情報保護法）。</li>
          <li>本文の下書きは<b>手元のClaude（MCP）</b>に作らせられます（外部LLMへの追加課金なし）。</li>
        </ul>
      </GuideButton>
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="newsletter" topbar={topbar}>
      <div className="page-head">
        <div>
          <h2>メルマガ配信</h2>
          <div className="sub">配信トピック（メルマガ属性）× 顧客属性でセグメントして配信。送信のみ外部APIへ、名簿・履歴は本システム内。</div>
        </div>
      </div>

      <div className="banner info">
        <span><Icon name="mail" size={16} /></span>
        <div>宛先は<span className="b">担当者（個人）単位</span>で管理。<span className="b">配信同意あり</span>かつ<span className="b">配信停止していない</span>人だけが送信対象です。各メールには送信者情報と<span className="b">配信停止リンク</span>を自動付与します。</div>
      </div>

      <div className="stats mt16">
        <div className="stat"><div className="k">今月の配信</div><div className="v num">{monthCount} <small>件</small></div><div className="d">送信済 {sentThisCount} ・ 予約 {scheduledCount}</div></div>
        <div className="stat"><div className="k">配信先（同意あり）</div><div className="v num">180 <small>人</small></div></div>
        <div className="stat gold"><div className="k">配信トピック</div><div className="v num">{topics.length}</div></div>
        <div className="stat"><div className="k">配信停止</div><div className="v num">12 <small>人</small></div></div>
      </div>

      <div className="panel mt16">
        <NewsletterFilterBar topics={topics} />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>件名</th><th>配信トピック</th><th>宛先セグメント</th><th className="right">対象</th>
                <th>状態</th><th className="right">送信日時</th><th className="right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 28 }}>条件に一致する配信がありません。</td></tr>
              )}
              {filtered.map((n) => {
                const cls = STATUS_CLASS[n.status] ?? 'draft';
                const isDraft = n.status === '下書き' || n.status === '予約';
                const target =
                  n.status === '失敗'
                    ? `${n.sent_count ?? 0} / ${n.target_count ?? 0}`
                    : n.target_count != null
                      ? String(n.target_count)
                      : '—';
                return (
                  <NewsletterRow key={n.id} id={n.id} isDraft={isDraft}>
                    <td className="name">{n.subject}</td>
                    <td>{(n.topic_ids ?? []).map((t) => <span key={t} className="topic">{t}</span>)}</td>
                    <td><span className="seg-note">{(n.topic_ids ?? []).join(' / ') || '全購読者'}</span></td>
                    <td className="right num">{target}</td>
                    <td>
                      <span className={`badge ${cls}`}><span className="dot" />{n.status}</span>
                      {n.status === '送信中' && (
                        <><br /><span className="mini-prog"><span className="bar"><i style={{ width: `${n.target_count ? Math.round(((n.sent_count ?? 0) / n.target_count) * 100) : 0}%` }} /></span><span className="muted num" style={{ fontSize: 11 }}>{n.sent_count ?? 0}/{n.target_count ?? 0}</span></span></>
                      )}
                      {n.status === '失敗' && (
                        <><br /><span className="muted" style={{ fontSize: 11 }}>送信失敗</span></>
                      )}
                    </td>
                    <td className="right num muted">{n.sent_at ?? n.created_at ?? '—'}</td>
                  </NewsletterRow>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="tfoot"><span className="num">{filtered.length} 件中 1–{filtered.length} を表示</span></div>
      </div>
    </AppShell>
  );
}
