'use client';
import { useUI } from '@/components/ui';

export function ImportButton({ small }: { small?: boolean }) {
  const { toast } = useUI();
  const onClick = () =>
    toast('議事録の取り込みを開始しました（Notta テキスト貼り付け／TXT アップロード）');
  if (small) {
    return (
      <button className="btn btn-sm mt8" onClick={onClick}>取り込む</button>
    );
  }
  return (
    <button className="btn btn-sm btn-primary" onClick={onClick}>＋ 議事録を取り込む</button>
  );
}

export function FolderChangeButton() {
  const { toast } = useUI();
  return (
    <button className="btn btn-sm" onClick={() => toast('フォルダを選び直します')}>変更</button>
  );
}
