import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getMasters } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { TourButton, type GuideTourStep } from '@/components/TourButton';
import { UserAvatar } from '@/components/ui-bits';
import { ImportFlow } from './parts';

const GUIDE_TOUR: GuideTourStep[] = [
  { sel: 'header.topbar .steps', title: 'ファイル → 検証 → 確定',
    body: 'テンプレCSVに沿って作成し、検証OKの行だけを取り込みます。' },
  { sel: '.page-head .actions', title: 'テンプレCSVをダウンロード',
    body: 'ヘッダ: 種別,名称,業種,エリア,規模,求めてること,提供できること,ステータス,メモ。<b>種別・名称は必須</b>、求/提タグは「;」区切り。' },
  { sel: '.panel', title: 'ファイルを選ぶと自動検証',
    body: 'エラー行はスキップ対象として一覧に出ます。正しい行だけ確定して取り込めます。' },
];


const STATUSES = ['顧問中', '見込み', '休眠'];
const TYPES = ['法人', '個人事業主'];

export default async function ImportPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const masters = await getMasters();
  const areas = Object.values(masters.areas).flat() as string[];

  const topbar = (
    <>
      <div className="crumb"><Link href="/companies">顧客</Link> / <b>CSV取込</b></div>
      <div className="spacer" />
      <div className="steps">
        <span className="s on"><span className="n num">1</span>ファイル</span><span className="sep" />
        <span className="s on"><span className="n num">2</span>検証</span><span className="sep" />
        <span className="s"><span className="n num">3</span>確定</span>
      </div>
      <TourButton steps={GUIDE_TOUR} />
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="companies" topbar={topbar}>
      <ImportFlow industries={masters.industries} areas={areas} sizes={masters.sizes} statuses={STATUSES} types={TYPES} />
    </AppShell>
  );
}
