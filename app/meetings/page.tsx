import './meetings.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { listMeetings } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/icons';
import { TourButton, type GuideTourStep } from '@/components/TourButton';
import { UserAvatar } from '@/components/ui-bits';
import { ResyncButton } from './parts';

const GUIDE_TOUR: GuideTourStep[] = [
  { sel: '.banner.ok', title: 'Googleカレンダー連携',
    body: '予定を自動で取り込み、出席者の<b>メール一致</b>で会社・担当者に自動リンクします。' },
  { sel: '.grid-2 .panel', title: '今日／今後の打ち合わせ',
    body: '相手の会社をすぐ開けます。名前しか無い予定は既存顧客に手動で紐付け（または新規作成）。' },
  { title: '会議のあとは議事録へ',
    body: 'Nottaの議事録が自動保存され、この打ち合わせ・顧客に紐付きます（議事録画面で確認）。' },
];


type Meeting = {
  id: string;
  title: string;
  company: string | null;
  company_id: string | null;
  start: string; // 'YYYY-MM-DD HH:MM'
  location: string | null;
  attendees: string[];
  note_status: string; // 未取込 / 取込済
};

const TODAY = '2026-06-24';

function MeetingCard({ m }: { m: Meeting }) {
  const [date, time] = (m.start || '').split(' ');
  const linked = !!m.company_id;
  return (
    <div className="mtg">
      <div className="when">
        <div className="t num">{time ?? '--:--'}</div>
        <div className="dur num">{date?.replaceAll('-', '/').slice(5) ?? ''}</div>
      </div>
      <div className="body">
        <div className="title">{m.title}</div>
        <div className="meta">
          {m.location && <span className="platform">{m.location}</span>}
        </div>
        <div className="meta" style={{ marginTop: 3 }}>
          {linked ? (
            <span className="cust-pill">
              顧客: <Link href={`/companies/${m.company_id}`}><b style={{ color: 'var(--ink)' }}>{m.company}</b></Link>{' '}
              <span className="muted">（メールから自動リンク）</span>
            </span>
          ) : (
            <span className="cust-pill">
              顧客: <span className="muted">未指定</span>{' '}
              <span style={{ color: 'var(--amber-600)', fontSize: 11 }}>⚠ カレンダーは名前のみ</span>
            </span>
          )}
        </div>
        <div style={{ marginTop: 4 }}>
          {(m.attendees ?? []).map((a) => (
            <span key={a} className={`attendee ${linked ? 'linked' : 'unlinked'}`}>
              <span className="a" style={linked ? undefined : { background: 'var(--ink-3)' }}>{a.trim().charAt(0)}</span>
              {a}
              {linked && m.company && <span className="muted"> · {m.company}</span>}
              {!linked && <span> · 未リンク</span>}
            </span>
          ))}
        </div>
      </div>
      <div className="side">
        <span className={`rec-badge ${m.note_status === '取込済' ? 'done' : 'wait'}`}>
          {m.note_status === '取込済' ? '議事録: 取込済' : '議事録: 終了後に自動保存'}
        </span>
        {linked && <Link className="btn btn-sm btn-ghost" href={`/companies/${m.company_id}`}>顧客を開く</Link>}
        {linked && <Link className="btn btn-sm btn-ghost" href="/notes">議事録</Link>}
      </div>
    </div>
  );
}

export default async function MeetingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const res = await listMeetings();
  const meetings: Meeting[] = res.items ?? [];

  const today = meetings.filter((m) => (m.start || '').slice(0, 10) === TODAY);
  const upcoming = meetings.filter((m) => (m.start || '').slice(0, 10) > TODAY);
  const past = meetings.filter((m) => (m.start || '').slice(0, 10) < TODAY);

  const topbar = (
    <>
      <h1>打ち合わせ</h1>
      <form className="search" action="/meetings">
        <span className="mag"><Icon name="search" size={16} /></span>
        <input name="q" placeholder="打ち合わせ・出席者を検索…" />
      </form>
      <div className="spacer" />
      <TourButton steps={GUIDE_TOUR} />
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="meetings" topbar={topbar}>
      <div className="page-head">
        <div>
          <h2>打ち合わせ <span className="tag" style={{ fontSize: 11, border: '1px solid var(--line-strong)', padding: '1px 7px', borderRadius: 5, color: 'var(--ink-3)', verticalAlign: 'middle' }}>Phase 2-3</span></h2>
          <div className="sub">Google カレンダーと連携し、打ち合わせの相手を顧客（CRM）につなげます。<b>カレンダーに名前しか無い予定は、ここから顧客を手動で指定</b>できます。終了後の議事録は <Link href="/notes">議事録</Link> に残ります。</div>
        </div>
        <div className="actions">
          <ResyncButton />
        </div>
      </div>

      <div className="banner ok">
        <span><Icon name="user" size={16} /></span>
        <div>
          <span className="b">スタッフが Google カレンダーを連携中</span>。事務所はチームで動くので、<b>自分以外の予定も見られます</b>。出席者メールを担当者と突合し、会社・担当者へ自動リンク。
        </div>
      </div>

      <div className="grid-2 mt16">
        <div>
          <div className="panel">
            <div className="panel-head"><h3>今日の打ち合わせ</h3><span className="count num">{today.length}件 ・ {TODAY.replaceAll('-', '/')}</span></div>
            {today.length === 0 && <div className="panel-body muted">今日の打ち合わせはありません。</div>}
            {today.map((m) => <MeetingCard key={m.id} m={m} />)}
          </div>

          <div className="panel">
            <div className="panel-head"><h3>今後の予定</h3><span className="count num">{upcoming.length}件</span></div>
            {upcoming.length === 0 && <div className="panel-body muted">今後の予定はありません。</div>}
            {upcoming.map((m) => <MeetingCard key={m.id} m={m} />)}
          </div>

          {past.length > 0 && (
            <div className="panel">
              <div className="panel-head"><h3>これまでの打ち合わせ</h3><span className="count num">{past.length}件</span></div>
              {past.map((m) => <MeetingCard key={m.id} m={m} />)}
            </div>
          )}
        </div>

        <div>
          <div className="panel">
            <div className="panel-head"><h3>連携の仕組み</h3></div>
            <div className="panel-body" style={{ fontSize: 13, color: 'var(--ink-2)' }}>
              <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <li>Google カレンダーの予定を読み取り（無料・Calendar API）。</li>
                <li>出席者メールを <span className="b">contacts.email</span> と突合し、会社・担当者に自動リンク。</li>
                <li><span className="b">カレンダーに名前しか無い／メール不一致の場合は、「顧客を指定」で手動リンク</span>（既存から選ぶ or 新規作成）。</li>
                <li>会議終了 → <Link href="/notes">議事録</Link>（Notta）を自動保存し、この打ち合わせ・顧客に紐付け。</li>
              </ol>
              <div className="banner info mt16" style={{ fontSize: 12 }}>トークンはサーバー側のみで保持（ブラウザに出さない）。出席者メール＝個人情報は Tokyo リージョン保管（C-7）。</div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
