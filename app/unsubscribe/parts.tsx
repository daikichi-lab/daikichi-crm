'use client';

import { useState, useTransition } from 'react';
import { updateSubscriptionAction, unsubscribeAllAction } from './actions';

// 標準トピックの説明（公開ページは anon のためマスタを取得できない＝説明文は静的）。
const TOPIC_DESC: Record<string, string> = {
  税制改正ニュース: '税制改正・申告の最新トピック（月1回程度）',
  'セミナー・勉強会案内': 'セミナーや勉強会のご案内',
  経営お役立ち情報: '資金繰り・補助金など経営のヒント',
  '年末調整・決算のお知らせ': '季節の手続きリマインド',
  年末調整のお知らせ: '年末調整・季節手続きのリマインド',
  決算前リマインド: '決算月に向けた早めの対策案内',
};
const STANDARD_TOPICS = ['税制改正ニュース', 'セミナー・勉強会案内', '経営お役立ち情報', '年末調整・決算のお知らせ'];

export function SubscriptionForm({ token, subscribed }: { token: string; subscribed: string[] }) {
  // 表示するトピック = 標準トピック ∪ 現在購読中のトピック（重複排除）
  const catalog = Array.from(new Set([...STANDARD_TOPICS, ...subscribed]));
  const [selected, setSelected] = useState<Set<string>>(new Set(subscribed));
  const [view, setView] = useState<'form' | 'saved' | 'all'>('form');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const toggle = (t: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const save = () => {
    setError('');
    start(async () => {
      const res = await updateSubscriptionAction(token, Array.from(selected));
      if (res.error) setError(res.error);
      else { setView('saved'); window.scrollTo(0, 0); }
    });
  };

  const stopAll = () => {
    setError('');
    start(async () => {
      const res = await unsubscribeAllAction(token);
      if (res.error) setError(res.error);
      else { setView('all'); window.scrollTo(0, 0); }
    });
  };

  if (view === 'saved') {
    return (
      <div className="panel">
        <div className="done-card">
          <div className="ic" style={{ background: 'var(--green-50)', color: 'var(--green-600)' }}>✓</div>
          <h3>配信設定を保存しました</h3>
          <p className="muted" style={{ maxWidth: 400, margin: '8px auto 0' }}>選択いただいたトピックのみお送りします。設定はいつでもこのページから変更できます。</p>
        </div>
      </div>
    );
  }
  if (view === 'all') {
    return (
      <div className="panel">
        <div className="done-card">
          <div className="ic">✕</div>
          <h3>すべての配信を停止しました</h3>
          <p className="muted" style={{ maxWidth: 400, margin: '8px auto 0' }}>以後、メールマガジンはお送りしません。再開をご希望の場合はお手数ですが担当者までご連絡ください。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel" id="formCard">
      <div className="panel-head"><h3>受け取る配信トピック</h3></div>
      <div className="panel-body">
        {catalog.map((t) => (
          <div className="sub-row" key={t}>
            <div><div className="t">{t}</div><div className="d">{TOPIC_DESC[t] ?? 'メールマガジンの配信トピック'}</div></div>
            <label className="switch"><input type="checkbox" checked={selected.has(t)} onChange={() => toggle(t)} /><span className="track" /></label>
          </div>
        ))}

        {error && <div className="banner warn mt16" style={{ fontSize: 12.5 }}><span>{error}</span></div>}

        <button className="btn btn-primary" style={{ width: '100%', marginTop: 18, height: 44 }} disabled={pending} onClick={save}>
          {pending ? '保存中…' : '設定を保存する'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <a
            href="#"
            style={{ color: 'var(--red-600)', fontWeight: 600, fontSize: 13 }}
            onClick={(e) => { e.preventDefault(); stopAll(); }}
          >
            すべてのメール配信を停止する
          </a>
        </div>
      </div>
    </div>
  );
}
