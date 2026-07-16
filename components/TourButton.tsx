'use client';
import { Icon } from './icons';
import { startTour } from './tour';

/** 案内人ツアーの1ステップ（サーバーコンポーネントから渡せる純データ）。
    sel なし＝中央カード（締め）。body は開発者定義の静的HTML（<b>等可・ユーザー入力禁止）。 */
export type GuideTourStep = { sel?: string; title: string; body: string; note?: string };

/** 画面の「使い方」ボタン＝案内人ツアーを起動（旧 GuideButton の静的モーダルを置き換え）。
    ビュー切替など before が要る画面（/schedule）は専用ボタンを使う。 */
export function TourButton({ steps, label = '使い方' }: { steps: GuideTourStep[]; label?: string }) {
  return (
    <button className="btn btn-sm" onClick={() => startTour(steps)}>
      <Icon name="help" size={15} />
      {label}
    </button>
  );
}
