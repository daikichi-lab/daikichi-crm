import './forms-edit.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getFormConfig } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { GuideButton } from '@/components/GuideButton';
import { UserAvatar } from '@/components/ui-bits';
import { FormEditor, TopbarActions } from './parts';

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
      <GuideButton title="フォーム編集の使い方">
        <p>公開フォームの見出し・説明・項目・公開設定を編集します。</p>
        <ul>
          <li>各項目の<b>表示</b>トグルで公開フォームに出す/出さないを切替（基本項目は固定）。</li>
          <li><b>保存</b>で公開フォームに即時反映。回答は受信箱に貯まります。</li>
        </ul>
      </GuideButton>
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
