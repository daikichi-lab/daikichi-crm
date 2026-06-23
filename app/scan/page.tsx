import './scan.css';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getMasters } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { GuideButton } from '@/components/GuideButton';
import { UserAvatar } from '@/components/ui-bits';
import { ScanWizard } from './ScanWizard';

export default async function ScanPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const masters = await getMasters();
  const areas = Object.values(masters.areas).flat();

  const topbar = (
    <>
      <h1>名刺スキャン</h1>
      <div className="spacer" />
      <GuideButton title="名刺スキャンの使い方">
        <p>名刺を取り込み、OCRで読み取った内容を確認・補正してから顧客を作成します。</p>
        <ul>
          <li><b>①取り込み</b>→<b>②読み取り</b>（ブラウザ内Tesseract.js・外部送信なし）→<b>③確認・補正</b>→<b>④作成</b>。</li>
          <li>似た企業が見つかると、<b>既存企業へ担当者追加</b>か<b>新規企業作成</b>を選べます（重複防止）。</li>
          <li>読み取り結果は必ず人が確認してから保存します。</li>
        </ul>
      </GuideButton>
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="scan" topbar={topbar}>
      <ScanWizard masters={{ industries: masters.industries, areas, sizes: masters.sizes }} />
    </AppShell>
  );
}
