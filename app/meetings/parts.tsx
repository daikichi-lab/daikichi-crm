'use client';
import { useUI } from '@/components/ui';

export function ResyncButton() {
  const { toast } = useUI();
  return (
    <button className="btn" onClick={() => toast('カレンダーを再同期しました')}>再同期</button>
  );
}
