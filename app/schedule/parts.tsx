'use client';
import { useUI } from '@/components/ui';
import { Icon } from '@/components/icons';

/* topbar: カレンダー書出（.ics ダウンロード・現在の絞り込みを引き継ぐ）。
   Google/Outlook/Apple カレンダーへ取り込める（OAuth不要の一方向書き出し）。 */
export function CalendarExportButton() {
  const { toast } = useUI();
  const exportIcs = () => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const url = `/api/schedule/ical${search}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('カレンダー（.ics）を書き出しました。Google/Outlook/Apple に取り込めます。');
  };
  return (
    <button className="btn btn-sm" onClick={exportIcs}>
      <Icon name="calendar" size={15} />カレンダー書出
    </button>
  );
}

/* topbar: 使い方（スポットライト・ツアーを起動。ステップ定義はビュー切替が要るため views.tsx 側） */
export function TourHelpButton() {
  return (
    <button className="btn btn-sm" onClick={() => window.dispatchEvent(new CustomEvent('daikichi:schedule-tour'))}>
      <Icon name="help" size={15} />使い方
    </button>
  );
}
