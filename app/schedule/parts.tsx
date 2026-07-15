'use client';
import { useUI } from '@/components/ui';
import { Icon } from '@/components/icons';

/* topbar: カレンダー書出（toast・連携は今後） */
export function CalendarExportButton() {
  const { toast } = useUI();
  return (
    <button className="btn btn-sm" onClick={() => toast('Googleカレンダーへ書き出しました（デモ）')}>
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
