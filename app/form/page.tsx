import './form-public.css';
import { getPublicFormConfig } from '@/lib/data/dal';
import { PublicForm } from './parts';

export const metadata = {
  title: 'お客様情報のご登録・大吉会計事務所',
};

export default async function PublicFormPage() {
  const config = (await getPublicFormConfig()) ?? {};

  return (
    <div className="pub-wrap">
      <div className="pub-head">
        <span className="seal">大</span>
        <div><h1>大吉会計事務所</h1><div className="sub">お客様情報のご登録フォーム</div></div>
      </div>

      <div className="pub-hero">
        <h2>{config.title ?? '事業の「求めてること」「提供できること」を教えてください'}</h2>
        <p>{config.intro ?? 'いただいた情報は、顧問先・お客様同士のビジネス紹介（協業先・お客様のご紹介）に活用します。送信内容は担当者が確認のうえ登録します。'}</p>
      </div>

      <PublicForm config={config} />

      <div className="muted" style={{ textAlign: 'center', fontSize: 11.5, marginTop: 18 }}>
        大吉会計事務所 ／ このフォームは公開URLです（ログイン不要）。送信内容はスタッフ確認後に登録されます。
      </div>
    </div>
  );
}
