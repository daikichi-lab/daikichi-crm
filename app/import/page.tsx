import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getMasters } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { GuideButton } from '@/components/GuideButton';
import { UserAvatar } from '@/components/ui-bits';
import { ImportFlow } from './parts';

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
      <GuideButton title="CSV取込の使い方">
        <p>企業を一括登録します。テンプレCSVに沿って作成してください。</p>
        <ul>
          <li>ヘッダ: <b>種別,名称,業種,エリア,規模,求めてること,提供できること,ステータス,メモ</b>。</li>
          <li><b>種別・名称</b>は必須。求/提タグは「;」区切りで複数指定できます。</li>
          <li>検証OKの行だけ取り込み、NG行はスキップします。</li>
        </ul>
      </GuideButton>
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="companies" topbar={topbar}>
      <ImportFlow industries={masters.industries} areas={areas} sizes={masters.sizes} statuses={STATUSES} types={TYPES} />
    </AppShell>
  );
}
