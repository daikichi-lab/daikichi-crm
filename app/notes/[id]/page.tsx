import './note-detail.css';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getNote } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/icons';
import { TourButton, type GuideTourStep } from '@/components/TourButton';
import { UserAvatar } from '@/components/ui-bits';
import { NoteActions, TodoChecklist, RecoButtons, SummaryPanel } from './parts';

const GUIDE_TOUR: GuideTourStep[] = [
  { sel: '.grid-2', title: '1件の議事録',
    body: '左に要点・次にやること・文字起こし全文。<b>要点は人が編集・補正</b>できます。' },
  { sel: '.transcript', title: '文字起こし（全文）',
    body: '検索や見返しに。要約と食い違うときは全文が正です。' },
  { title: '次のアクションへ',
    body: '右カラムの「次のアクション（おすすめ）」から、求/提タグの追加や紹介の起票へ進めます。' },
];


type Note = {
  id: string;
  title: string;
  company: string | null;
  company_id: string | null;
  summary: string | null;
  next_actions: string[];
  full_text: string | null;
  source: string;
  occurred_at: string; // 'YYYY-MM-DD HH:MM'
};

export default async function NoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;

  const note = (await getNote(id)) as Note | { error: string };
  if (!note || 'error' in note) notFound();
  const n = note as Note;

  const auto = (n.source || '').includes('Notta');
  const company = n.company_id ? `/companies/${n.company_id}` : '/companies';

  const topbar = (
    <>
      <div className="crumb"><Link href="/notes">議事録</Link> / <b>{n.title}</b></div>
      <div className="spacer" />
      <NoteActions fullText={n.full_text ?? ''} />
      <Link className="btn btn-sm" href={company}>会社を開く</Link>
      <TourButton steps={GUIDE_TOUR} />
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="notes" topbar={topbar}>
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 10 }}>
            <h2>{n.title}</h2>
            <span className={`src-badge ${auto ? 'auto' : 'manual'}`}>
              {auto ? '⚡ 自動保存（Notta → Google ドライブ）' : '📋 手で取込'}
            </span>
          </div>
          <div className="sub">
            <Link href={company}>{n.company ?? '（未紐付け）'}</Link> ・ <span className="num">{n.occurred_at}</span>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div>
          <div className="panel">
            <div className="panel-head">
              <h3>要点（自動でまとめ）</h3>
              <span className="tag right" style={{ fontSize: 10.5, border: '1px solid var(--line-strong)', padding: '1px 6px', borderRadius: 4, color: 'var(--ink-3)' }}>手元のClaudeが要約・外部課金なし</span>
            </div>
            <SummaryPanel id={n.id} summary={n.summary} />
          </div>

          <div className="panel">
            <div className="panel-head"><h3>次にやること</h3><span className="count num">{n.next_actions.length}件</span></div>
            <TodoChecklist id={n.id} todos={n.next_actions} />
          </div>

          <div className="panel">
            <div className="panel-head"><h3>文字起こし（全文）</h3></div>
            <div className="panel-body">
              <div className="transcript">
                {n.full_text
                  ? <div className="num" style={{ fontSize: 12.5, color: 'var(--ink-2)', whiteSpace: 'pre-wrap', lineHeight: 1.7, borderLeft: '3px solid var(--line-strong)', paddingLeft: 12 }}>{n.full_text}</div>
                  : <div className="muted">全文はまだありません。</div>}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="panel">
            <div className="panel-head"><h3>この打ち合わせ</h3></div>
            <div className="panel-body">
              <dl className="kv">
                <dt>会社</dt><dd><Link href={company}>{n.company ?? '（未紐付け）'}</Link></dd>
                <dt>日時</dt><dd className="num">{n.occurred_at}</dd>
                <dt>取り込み</dt><dd>{auto ? '自動（Google ドライブ経由）' : '手で取込'}</dd>
                <dt>ソース</dt><dd>{n.source}</dd>
              </dl>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>次のアクション（おすすめ）</h3></div>
            <RecoButtons company={n.company} companyId={n.company_id} />
          </div>

          <div className="panel">
            <div className="panel-head"><h3>関連</h3></div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <Link href="/meetings" className="row" style={{ gap: 8, color: 'inherit' }}><span><Icon name="calendar" size={15} /></span><span style={{ flex: 1 }}>この打ち合わせ（カレンダー）</span><span className="muted">›</span></Link>
              <Link href="/referrals" className="row" style={{ gap: 8, color: 'inherit' }}><span><Icon name="handshake" size={15} /></span><span style={{ flex: 1 }}>関連する紹介（協業先紹介）</span><span className="muted">›</span></Link>
              {n.company_id && (
                <Link href={company} className="row" style={{ gap: 8, color: 'inherit' }}><span><Icon name="building" size={15} /></span><span style={{ flex: 1 }}>{n.company} の詳細</span><span className="muted">›</span></Link>
              )}
            </div>
          </div>

          <div className="banner ok" style={{ fontSize: 12 }}>会議の発言録は機微情報のため Tokyo 保管・RLS で保護。閲覧は権限のあるスタッフのみ。</div>
        </div>
      </div>
    </AppShell>
  );
}
