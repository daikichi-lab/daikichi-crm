import './notes.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { listNotes, searchCompanies } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/icons';
import { TourButton, type GuideTourStep } from '@/components/TourButton';
import { UserAvatar } from '@/components/ui-bits';
import { ImportButton, FolderChangeButton } from './parts';

const GUIDE_TOUR: GuideTourStep[] = [
  { sel: '.ways', title: '議事録の入れ方は2つ',
    body: '<b>その場で取り込む</b>（Notta貼り付け／TXTアップロード）か、<b>自動で入る</b>（会議終了→Notta→Googleドライブ→自動取込）。' },
  { sel: '.panel.mt16', title: '最近の議事録',
    body: '会社名・要点・ソースを一覧。行クリックで詳細（全文・要点・次アクション）へ。' },
  { sel: 'details.setup', title: '自動連携の設定',
    body: '保存先フォルダの変更などはここから。' },
];


type Note = {
  id: string;
  title: string;
  company: string | null;
  company_id: string | null;
  summary: string | null;
  source: string;
  occurred_at: string; // 'YYYY-MM-DD HH:MM'
};

export default async function NotesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const res = await listNotes();
  const notes: Note[] = res.items ?? [];
  const cos = await searchCompanies({ limit: 100 });
  const companies = (cos?.companies ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }));

  const topbar = (
    <>
      <h1>議事録</h1>
      <form className="search" action="/notes">
        <span className="mag"><Icon name="search" size={16} /></span>
        <input name="q" placeholder="議事録・発言内容を検索…" />
      </form>
      <div className="spacer" />
      <TourButton steps={GUIDE_TOUR} />
      <ImportButton companies={companies} />
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="notes" topbar={topbar}>
      <div className="page-head">
        <div>
          <h2>議事録 <span className="tag" style={{ fontSize: 11, border: '1px solid var(--line-strong)', padding: '1px 7px', borderRadius: 5, color: 'var(--ink-3)', verticalAlign: 'middle' }}>Phase 2-3</span></h2>
          <div className="sub">打ち合わせの議事録を、その会社のカルテに残します。要点と「次にやること」は自動でまとまります。</div>
        </div>
        <div className="actions"><span className="conn"><span className="d" />会議終了で自動保存 ON</span></div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>議事録の入れ方は2つ</h3></div>
        <div className="panel-body">
          <div className="ways">
            <div className="way">
              <div className="ic b">📋</div>
              <div style={{ flex: 1 }}>
                <h4>その場で取り込む</h4>
                <p>Nottaの議事録テキストを貼り付け、または TXT をアップロード。会社を選んで保存。</p>
                <ImportButton small companies={companies} />
              </div>
            </div>
            <div className="way">
              <div className="ic a">⚡</div>
              <div style={{ flex: 1 }}>
                <h4>会議が終わると自動で入る</h4>
                <p>Notta が Google ドライブに保存した議事録を、当システムが自動で取り込み、会社に紐付けます（設定済み・Zapier不要）。</p>
                <a className="muted" href="#setup" style={{ fontSize: 12, display: 'inline-block', marginTop: 8 }}>自動連携の設定を見る ›</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel mt16">
        <div className="panel-head"><h3>最近の議事録</h3><span className="count num">{notes.length}件</span></div>
        {notes.length === 0 && <div className="panel-body muted">議事録はまだありません。</div>}
        {notes.map((n) => {
          const auto = (n.source || '').includes('Notta');
          return (
            <Link key={n.id} href={`/notes/${n.id}`} className="note">
              <div className={`ic ${auto ? 'auto' : 'manual'}`} title={auto ? '会議終了で自動保存' : '手で取り込み'}>{auto ? '⚡' : '📋'}</div>
              <div className="body">
                <div className="title">{n.title}</div>
                <div className="cust">{n.company ?? '（未紐付け）'}</div>
                {n.summary && <div className="sum">{n.summary}</div>}
                <div className="foot">
                  <span className="num">{n.occurred_at}</span>
                  <span className="pill">{n.source}</span>
                  <span className="pill">{auto ? '自動保存' : '手で取込'}</span>
                </div>
              </div>
              <div className="go">›</div>
            </Link>
          );
        })}
      </div>

      <details className="setup" id="setup">
        <summary>⚙ 自動連携（Notta → Google ドライブ）の設定 <span className="chev">›</span></summary>
        <div className="inner">
          <p className="muted" style={{ fontSize: 12.5, margin: '12px 0' }}>Notta を <b>Google ドライブ</b> に連携すると、会議の議事録が自動でドライブに保存されます。当システムは<b>その保存先フォルダ</b>を監視し、新しい議事録を自動で取り込みます（<b>Zapier不要</b>）。一度設定すれば以後は自動です。</p>
          <div className="row" style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <span className="conn"><span className="d" />Google ドライブ 連携中</span>
            <span className="muted" style={{ fontSize: 12 }}>カレンダーと同じ Google アカウントでOK</span>
          </div>
          <div className="field">
            <label>議事録の保存先フォルダ（Notta が保存する場所）</label>
            <div className="row" style={{ gap: 6 }}>
              <input className="input" style={{ flex: 1 }} value="マイドライブ / Notta / 議事録" readOnly />
              <FolderChangeButton />
            </div>
          </div>
          <div className="b mt16" style={{ fontSize: 12.5, marginBottom: 6 }}>流れ</div>
          <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--ink-2)', fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>Notta 側で「Google ドライブに自動保存」をON（Notta の公式連携）</li>
            <li>会議終了 → 議事録(TXT/DOCX)が上のフォルダに保存される</li>
            <li>当システムがフォルダを監視し、新しいファイルを自動取り込み（Google Drive API・無料）</li>
            <li>ファイル名・会議名を <Link href="/meetings">打ち合わせ（カレンダー）</Link> と突合し、会社・担当者へ自動で紐付け</li>
          </ol>
          <div className="banner info mt16" style={{ fontSize: 12 }}>Zapier のような外部の自動化ツールは不要。カレンダー連携と同じ Google アカウントを使い回せます。議事録は当システムの Tokyo 保管・RLS で保護します。</div>
        </div>
      </details>
    </AppShell>
  );
}
