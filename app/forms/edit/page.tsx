import './forms-edit.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getFormConfig } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { TourButton, type GuideTourStep } from '@/components/TourButton';
import { UserAvatar } from '@/components/ui-bits';
import { FormEditor, TopbarActions } from './parts';

const GUIDE_TOUR: GuideTourStep[] = [
  { sel: '.form-grid', title: '見出し・説明を編集',
    body: '公開フォームの見出し・説明文をここで変更します。' },
  { sel: '.fcards', title: '項目の表示／必須を切替',
    body: '各項目カードのトグルで公開フォームに出す/出さないを切替（基本項目は固定）。プレビューで見え方を確認できます。' },
  { title: '保存で即時反映',
    body: '「保存」で公開フォームに即時反映。回答は受信箱に貯まります。CAPTCHA・レート制限などの公開設定は右カラムから。' },
];


const PUBLIC_FORM_URL = '/form';

export default async function FormEditPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const config = (await getFormConfig()) ?? {};

  const topbar = (
    <>
      <div className="crumb"><b>フォーム</b> / 編集</div>
      <div className="spacer" />
      <TopbarActions publicUrl={PUBLIC_FORM_URL} />
      <TourButton steps={GUIDE_TOUR} />
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="forms" topbar={topbar}>
      <nav className="admin-tabs">
        <Link href="/forms/inbox">回答受信箱</Link>
        <Link href="/forms/edit" className="on">フォーム編集</Link>
        <Link href={PUBLIC_FORM_URL} target="_blank">公開フォームを開く ↗</Link>
      </nav>

      <FormEditor config={config} publicUrl={PUBLIC_FORM_URL} />
    </AppShell>
  );
}
