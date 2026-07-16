import './scan.css';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getMasters } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { TourButton, type GuideTourStep } from '@/components/TourButton';
import { UserAvatar } from '@/components/ui-bits';
import { ScanWizard } from './ScanWizard';

const GUIDE_TOUR: GuideTourStep[] = [
  { sel: '[data-scan-steps]', title: '4ステップで顧客化',
    body: '①取り込み → ②読み取り → ③確認・補正 → ④作成。' },
  { sel: '.scan-preview', title: '名刺を取り込む',
    body: '撮影またはファイル選択。読み取りは<b>ブラウザ内 Tesseract.js</b> — 画像を外部サービスに送信しません。' },
  { sel: '.form-grid', title: '結果は必ず人が確認',
    body: '抽出結果を確認・補正してから作成。似た企業が見つかると<b>既存へ担当者追加</b>か<b>新規作成</b>かを選べます（重複防止）。' },
];


export default async function ScanPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const masters = await getMasters();
  const areas = Object.values(masters.areas).flat();

  const topbar = (
    <>
      <h1>名刺スキャン</h1>
      <div className="spacer" />
      <TourButton steps={GUIDE_TOUR} />
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="scan" topbar={topbar}>
      <ScanWizard masters={{ industries: masters.industries, areas, sizes: masters.sizes }} />
    </AppShell>
  );
}
