import './compose.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getMasters, getNewsletter } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { TourButton, type GuideTourStep } from '@/components/TourButton';
import { UserAvatar } from '@/components/ui-bits';
import { ComposeForm } from './parts';

const GUIDE_TOUR: GuideTourStep[] = [
  { sel: 'header.topbar .steps', title: '内容 → 宛先 → 確認・送信',
    body: '本文と宛先を決めて送信します。' },
  { sel: '.merge', title: '差し込み変数',
    body: '{{氏名}}・{{会社名}}などで1通ずつ宛名を差し込み。リンク挿入も横のボタンから。' },
  { sel: '.sticky-side', title: '宛先（セグメント）',
    body: '配信トピックの購読者を業種・エリア等でさらに絞り込み。<b>対象人数はその場で再計算</b>されます。' },
  { title: '下書きと法令対応',
    body: '「Claudeで下書き」で手元のClaude（MCP）に本文案を依頼（追加課金なし）。送信者情報と配信停止リンクは本文末尾に自動付与されます。' },
];


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
      <TourButton steps={GUIDE_TOUR} />
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="newsletter" topbar={topbar}>
      <ComposeForm draftId={sp.id} initial={initial} topics={topics} industries={industries} areas={areas} />
    </AppShell>
  );
}
