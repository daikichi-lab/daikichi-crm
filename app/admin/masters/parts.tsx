'use client';

import { useMemo, useState, useTransition } from 'react';
import { useUI } from '@/components/ui';
import { addTagAction, renameTagAction, mergeTagsAction, addIndustryAction, addNewsletterTopicAction } from './actions';

export type Tag = { label: string; used_in_needs: number; used_in_offers: number };

/** タグ管理（検索・追加・統合・一覧/リネーム/統合） */
export function TagManager({ tags, count }: { tags: Tag[]; count: number }) {
  const { toast, confirm } = useUI();
  const [keyword, setKeyword] = useState('');
  const [pending, start] = useTransition();

  const labels = useMemo(() => tags.map((t) => t.label), [tags]);
  const shown = useMemo(
    () => (keyword ? tags.filter((t) => t.label.includes(keyword)) : tags),
    [tags, keyword],
  );

  const addTag = () => {
    const label = window.prompt('追加するタグ名');
    if (label == null) return;
    start(async () => {
      const res = await addTagAction(label);
      if (res.error) toast(res.error);
      else toast(`タグ「${label.trim()}」を追加しました`);
    });
  };

  const mergeDialog = () => {
    const from = window.prompt('統合する（消す）タグ名');
    if (from == null || !from.trim()) return;
    const to = window.prompt(`「${from.trim()}」をどのタグに名寄せしますか？（統合先）`);
    if (to == null || !to.trim()) return;
    confirm({
      title: 'タグを統合しますか？',
      body: `「${from.trim()}」を「${to.trim()}」に名寄せします。${from.trim()} を使う企業の値が ${to.trim()} に置換されます。`,
      confirmLabel: '統合する',
      onConfirm: () => new Promise<void>((resolve) => start(async () => {
        const res = await mergeTagsAction(from.trim(), to.trim());
        if (res.error) toast(res.error);
        else toast(`「${from.trim()}」を「${to.trim()}」に統合しました`);
        resolve();
      })),
    });
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>タグ（求 / 提 の共通語彙）</h3><span className="count num">{count} タグ</span>
        <div className="actions">
          <button className="btn btn-sm" disabled={pending} onClick={mergeDialog}>＋ 別名を統合</button>
          <button className="btn btn-sm btn-primary" disabled={pending} onClick={addTag}>＋ タグを追加</button>
        </div>
      </div>
      <div className="filterbar">
        <input className="input" placeholder="タグを検索…" style={{ minWidth: 220 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <span className="right" />
        <span className="muted" style={{ fontSize: 12 }}>needs / offers は<b>同一語彙</b>を共有（FR-T3）。使用件数が多いタグは要注意で名寄せ。</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>タグ</th><th className="right">求で使用</th><th className="right">提で使用</th><th className="right">企業数</th><th className="right">操作</th></tr></thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 24 }}>タグがありません。</td></tr>
            )}
            {shown.map((t) => {
              const side: 'need' | 'offer' = t.used_in_offers > t.used_in_needs ? 'offer' : 'need';
              return (
                <tr key={t.label} style={{ cursor: 'default' }}>
                  <td>
                    <span className={`chip ${side}`} style={{ height: 22 }}>
                      <span className="mk">{side === 'offer' ? '提' : '求'}</span>{t.label}
                    </span>
                  </td>
                  <td className="right num">{t.used_in_needs}</td>
                  <td className="right num">{t.used_in_offers}</td>
                  <td className="right num">{t.used_in_needs + t.used_in_offers}</td>
                  <td className="right" style={{ whiteSpace: 'nowrap' }}>
                    <TagRowActions label={t.label} labels={labels} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TagRowActions({ label, labels }: { label: string; labels: string[] }) {
  const { toast, confirm } = useUI();
  const [pending, start] = useTransition();

  const rename = () => {
    const to = window.prompt(`「${label}」の新しい名前`, label);
    if (to == null || to.trim() === label) return;
    start(async () => {
      const res = await renameTagAction(label, to);
      if (res.error) toast(res.error);
      else toast(`「${label}」を「${to.trim()}」にリネームしました`);
    });
  };

  const merge = () => {
    const others = labels.filter((l) => l !== label);
    const to = window.prompt(`「${label}」を統合する先のタグ名（候補: ${others.slice(0, 8).join(' / ')}）`);
    if (to == null || !to.trim()) return;
    confirm({
      title: 'タグを統合しますか？',
      body: `「${label}」を「${to.trim()}」に名寄せします。${label} を使う企業の値が ${to.trim()} に置換されます。`,
      confirmLabel: '統合する',
      onConfirm: () => new Promise<void>((resolve) => start(async () => {
        const res = await mergeTagsAction(label, to.trim());
        if (res.error) toast(res.error);
        else toast(`「${label}」を「${to.trim()}」に統合しました`);
        resolve();
      })),
    });
  };

  return (
    <>
      <button className="btn btn-sm" disabled={pending} onClick={rename}>リネーム</button>{' '}
      <button className="btn btn-sm btn-gold" disabled={pending} onClick={merge}>統合</button>
    </>
  );
}

/** 業種マスタ：追加ボタン */
export function IndustryAddButton() {
  const { toast } = useUI();
  const [pending, start] = useTransition();
  return (
    <button
      className="btn btn-sm btn-primary"
      disabled={pending}
      onClick={() => {
        const label = window.prompt('追加する業種名');
        if (label == null) return;
        start(async () => {
          const res = await addIndustryAction(label);
          if (res.error) toast(res.error);
          else toast(`業種「${label.trim()}」を追加しました`);
        });
      }}
    >
      ＋ 業種を追加
    </button>
  );
}

/** メルマガ属性（配信トピック）：追加ボタン */
export function TopicAddButton() {
  const { toast } = useUI();
  const [pending, start] = useTransition();
  return (
    <button
      className="btn btn-sm btn-primary"
      disabled={pending}
      onClick={() => {
        const label = window.prompt('追加する配信トピック名');
        if (label == null) return;
        start(async () => {
          const res = await addNewsletterTopicAction(label);
          if (res.error) toast(res.error);
          else toast(`配信トピック「${label.trim()}」を追加しました`);
        });
      }}
    >
      ＋ トピックを追加
    </button>
  );
}
