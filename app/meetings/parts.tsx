'use client';
import { useUI } from '@/components/ui';
import { Icon } from '@/components/icons';

// 打ち合わせの .ics 書き出し（VEVENT）。Google/Outlook/Apple に取り込める一方向書き出し（OAuth不要）。
export function MeetingsExportButton() {
  const { toast } = useUI();
  const exportIcs = () => {
    const a = document.createElement('a');
    a.href = '/api/meetings/ical';
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('打ち合わせを .ics で書き出しました。カレンダーアプリに取り込めます。');
  };
  return (
    <button className="btn" onClick={exportIcs}>
      <Icon name="calendar" size={15} />カレンダーに書き出す
    </button>
  );
}
