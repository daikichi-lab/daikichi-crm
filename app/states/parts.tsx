'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons';
import { useUI } from '@/components/ui';

export function ClearFilterDemo() {
  const { toast } = useUI();
  return (
    <button className="btn" onClick={() => toast('絞り込みをクリアしました')}>条件をクリア</button>
  );
}

export function RetryDemo() {
  const { toast } = useUI();
  return <button className="btn" onClick={() => toast('再読み込みしました')}>再試行</button>;
}

export function CrossInteractions() {
  const { toast, confirm } = useUI();
  const [viewer, setViewer] = useState(false);
  return (
    <>
      <button className="btn" onClick={() => setViewer(true)}>
        <Icon name="card" size={15} />名刺ビューア（表/裏切替・署名URL）
      </button>
      <button
        className="btn btn-danger"
        onClick={() =>
          confirm({
            title: 'ゴミ箱へ移動しますか？',
            body: '「株式会社 大吉商事」と配下の担当者・名刺を非表示にします。ゴミ箱からいつでも復元できます。',
            confirmLabel: 'ゴミ箱へ移動',
            danger: true,
          })
        }
      >
        確認ダイアログ（破壊的操作）
      </button>
      <button className="btn btn-primary" onClick={() => toast('保存しました')}>トースト通知</button>
      {viewer && <CardViewer onClose={() => setViewer(false)} />}
    </>
  );
}

function CardViewer({ onClose }: { onClose: () => void }) {
  const { toast } = useUI();
  const [face, setFace] = useState<'front' | 'back'>('front');
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal card-viewer" role="dialog" aria-modal="true">
        <div className="m-head"><h3>名刺 — 佐藤 太郎（株式会社 大吉商事）</h3></div>
        <div className="m-body">
          <div className="face-tabs">
            <button className={`btn btn-sm${face === 'front' ? ' on' : ''}`} onClick={() => setFace('front')}>表面</button>
            <button className={`btn btn-sm${face === 'back' ? ' on' : ''}`} onClick={() => setFace('back')}>裏面</button>
            <span className="right" />
            <span className="muted" style={{ fontSize: 11.5, alignSelf: 'center' }}>署名URL（残り 9:42）</span>
          </div>
          <div className="shot">
            {face === 'front' ? (
              <div className="fakecard" style={{ width: '100%', height: '100%' }}>
                <div className="lines" style={{ padding: '18px 22px' }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>株式会社 大吉商事</div>
                  <div style={{ marginTop: 6, fontSize: 13 }}>営業部 部長</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>佐藤 太郎</div>
                  <div style={{ marginTop: 10, fontSize: 11, color: '#5a6b7d' }}>〒100-0001 東京都千代田区… ／ 03-1234-5678 ／ sato@daikichi-shoji.co.jp</div>
                </div>
              </div>
            ) : (
              <div className="fakecard" style={{ width: '100%', height: '100%' }}>
                <div className="lines" style={{ padding: '18px 22px', color: '#5a6b7d', fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: '#33414f' }}>事業内容</div>
                  <div style={{ marginTop: 6 }}>食材卸 ／ 業務用パッケージ ／ EC支援</div>
                  <div style={{ marginTop: 12 }}>https://daikichi-shoji.co.jp</div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="m-foot">
          <button className="btn" onClick={() => toast('署名URLを再発行しました')}>URL再発行</button>
          <button className="btn btn-primary" onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
}
