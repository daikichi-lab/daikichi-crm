import './compose.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getMasters, getNewsletter } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { GuideButton } from '@/components/GuideButton';
import { UserAvatar } from '@/components/ui-bits';
import { ComposeForm } from './parts';

type SP = { id?: string };

export default async function NewsletterComposePage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const sp = await searchParams;

  const masters = await getMasters();
  const topics: string[] = masters.newsletter_topics ?? [];
  const industries: string[] = masters.industries ?? [];
  const areas: string[] = Object.values(masters.areas ?? {}).flat() as string[];

  let initial = {
    subject: '',
    body: '',
    topics: [] as string[],
    segment: {} as { status?: string; industry?: string; area?: string; type?: string },
  };
  if (sp.id) {
    const n = await getNewsletter(sp.id);
    if (n && n.id) {
      initial = {
        subject: n.subject ?? '',
        body: n.body ?? '',
        topics: n.topic_ids ?? [],
        segment: n.segment ?? {},
      };
    }
  }

  const topbar = (
    <>
      <div className="crumb"><Link href="/newsletters">メルマガ</Link> / <b>新規作成</b></div>
      <div className="spacer" />
      <div className="steps">
        <span className="s on"><span className="n">1</span>内容</span><span className="sep" />
        <span className="s on"><span className="n">2</span>宛先</span><span className="sep" />
        <span className="s"><span className="n">3</span>確認・送信</span>
      </div>
      <GuideButton title="メルマガ作成の使い方">
        <p>本文と宛先を決めてメルマガを送ります。</p>
        <ul>
          <li><b>差し込み変数</b>（{'{{氏名}}'} など）で1通ずつ宛名を差し込めます。</li>
          <li><b>宛先</b>は配信トピックの購読者から、業種・エリア等でさらに絞り込めます。</li>
          <li><b>送信者情報と配信停止リンクは自動で本文末尾に付与</b>されます（法令対応）。</li>
          <li><b>Claudeで下書き</b>＝手元のClaude（MCP）に本文案を作らせます（追加課金なし）。</li>
        </ul>
      </GuideButton>
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="newsletter" topbar={topbar}>
      <ComposeForm draftId={sp.id} initial={initial} topics={topics} industries={industries} areas={areas} />
    </AppShell>
  );
}
