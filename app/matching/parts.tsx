'use client';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { useUI } from '@/components/ui';
import { TagChip } from '@/components/ui-bits';
import { createReferralAction } from './actions';

export type Reco = {
  key: string;
  kind: '協業先紹介' | '顧客紹介';
  kindNote: string;
  fromId: string; fromName: string;
  toId: string; toName: string;
  matchedTags: string[];
  score: number;
  why: string;
  pairs: { lb: string; need: string; offer: string; who: string }[];
};

type Company = { id: string; name: string; industry: string | null; area: string | null };

// 「求めてること」「提供できる」を太字に（XSSを避けるためHTMLは使わない）
function renderWhy(text: string) {
  const parts = text.split(/(求めてること|提供できる)/g);
  return parts.map((p, i) => (p === '求めてること' || p === '提供できる' ? <b key={i}>{p}</b> : <span key={i}>{p}</span>));
}

export function MatchingBoard({
  base, originName, originNeeds, originOffers, companies, recos,
}: {
  base: string;
  originName: string;
  originNeeds: string[];
  originOffers: string[];
  companies: Company[];
  recos: Reco[];
}) {
  const router = useRouter();
  const { toast, confirm } = useUI();
  const [, startTransition] = useTransition();

  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [issued, setIssued] = useState<Set<string>>(new Set());
  const [showHi, setShowHi] = useState(true);
  const [showMid, setShowMid] = useState(true);
  const [showCollab, setShowCollab] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const [appliedFilter, setAppliedFilter] = useState({ hi: true, mid: true, collab: true, intro: true });

  const isGlobal = !base;

  const visible = useMemo(
    () =>
      recos.filter((r) => {
        if (skipped.has(r.key)) return false;
        const hi = r.score >= 2;
        if (hi && !appliedFilter.hi) return false;
        if (!hi && !appliedFilter.mid) return false;
        if (r.kind === '協業先紹介' && !appliedFilter.collab) return false;
        if (r.kind === '顧客紹介' && !appliedFilter.intro) return false;
        return true;
      }),
    [recos, skipped, appliedFilter],
  );

  const onSelectOrigin = (name: string) => {
    if (name) router.push(`/matching?base=${encodeURIComponent(name)}`);
    else router.push('/matching');
  };

  const toggleMode = () => {
    if (isGlobal) {
      // 会社を選んで探す: 先頭の会社を起点に
      const first = companies[0];
      if (first) router.push(`/matching?base=${encodeURIComponent(first.name)}`);
      else toast('起点にできる会社がありません');
    } else {
      router.push('/matching');
    }
  };

  const issue = (r: Reco) => {
    if (!r.fromId || !r.toId) {
      toast('企業IDを解決できないため起票できません');
      return;
    }
    confirm({
      title: 'この紹介を起票しますか？',
      body: (
        <span>
          「{r.fromName} に {r.toName} を紹介」（根拠: {r.matchedTags.join('・')}）を紹介履歴に登録します。
        </span>
      ),
      confirmLabel: '起票',
      onConfirm: async () => {
        await createReferralAction(r.fromId, r.toId, r.kind, r.matchedTags);
        setIssued((s) => new Set(s).add(r.key));
      },
    });
  };

  const skip = (r: Reco) => {
    setSkipped((s) => new Set(s).add(r.key));
    toast('候補を見送りにしました');
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>
            紹介できる組み合わせ{' '}
            <span className="tag" style={{ fontSize: 11, border: '1px solid var(--line-strong)', padding: '1px 7px', borderRadius: 5, color: 'var(--ink-3)', verticalAlign: 'middle' }}>Phase 2</span>
          </h2>
          <div className="sub">ある会社が「求めてること」を、別の会社が「提供できる」とき、紹介の候補になります。相性の高い順に並んでいます。</div>
        </div>
        <div className="actions">
          <button className="btn" onClick={toggleMode}>{isGlobal ? '会社を選んで探す' : '事務所全体のおすすめ'}</button>
        </div>
      </div>

      {isGlobal ? (
        <div className="banner info" style={{ marginBottom: 14 }}>
          全顧客の「求めてること」↔「提供できること」から、いま成立しやすい組み合わせを上位表示しています。特定の会社を起点にしたいときは{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); toggleMode(); }}>会社を選んで探す</a> へ。
        </div>
      ) : (
        <div className="panel">
          <div className="panel-body" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>どの会社に合う紹介先を探す？</div>
              <select
                className="select"
                style={{ minWidth: 260, marginTop: 6 }}
                value={originName}
                onChange={(e) => onSelectOrigin(e.target.value)}
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}{c.industry ? `（${c.industry}・${c.area ?? ''}）` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ alignSelf: 'stretch', width: 1, background: 'var(--line)' }} />
            <div>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{originName} が求めてる</div>
              <div className="chips">
                {originNeeds.length ? originNeeds.map((t) => <TagChip key={t} label={t} kind="need" />) : <span className="muted" style={{ fontSize: 12 }}>未登録</span>}
              </div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{originName} が提供できる</div>
              <div className="chips">
                {originOffers.length ? originOffers.map((t) => <TagChip key={t} label={t} kind="offer" />) : <span className="muted" style={{ fontSize: 12 }}>未登録</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="page-head mt16" style={{ marginBottom: 10 }}>
        <div><h3 style={{ fontSize: 15 }}>紹介の候補 <span className="num">{visible.length}</span> 件</h3></div>
      </div>

      <div className="match-layout">
        <div id="candList">
          {visible.length === 0 && (
            <div className="panel"><div className="panel-body muted">条件に合う紹介の候補がありません。</div></div>
          )}
          {visible.map((r) => {
            const hi = r.score >= 2;
            return (
              <div className={`panel reco${issued.has(r.key) ? ' skipped' : ''}`} key={r.key}>
                <div className="reco-top">
                  <span className={`fit ${hi ? 'fit-hi' : 'fit-mid'}`}>
                    相性 {hi ? '高い' : '中'} <span className="dots">{hi ? '●●●' : '●●'}</span>
                  </span>
                  <span className="muted" style={{ fontSize: 12 }}>一致タグ {r.matchedTags.length}件</span>
                  <span className="kind">{r.kindNote}</span>
                  <div className="actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => skip(r)}>見送り</button>
                    <button className="btn btn-sm btn-primary" disabled={issued.has(r.key)} onClick={() => issue(r)}>
                      {issued.has(r.key) ? '起票済み' : 'この紹介を起票'}
                    </button>
                  </div>
                </div>
                <div className="reco-flow">
                  <span className="nm">{r.fromName}</span> <span className="lk">に</span>{' '}
                  <span className="bring">{r.toName}</span> <span className="lk">を紹介</span>
                </div>
                <div className="reco-why">{renderWhy(r.why)}</div>
                <div className="reco-pairs">
                  {r.pairs.map((p, i) => (
                    <div className="pp" key={i}>
                      <span className="lb">{p.lb}</span>
                      <TagChip label={p.need} kind="need" />
                      <span className="to">→ 提供できる →</span>
                      <TagChip label={p.offer} kind="offer" />
                      <span className="muted">{p.who}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <aside className="panel match-filter">
          <div className="panel-head"><h3 style={{ fontSize: 13.5 }}>絞り込み</h3></div>
          <div className="panel-body">
            <div className="fgroup">
              <span className="lab">相性</span>
              <label className="ck"><input type="checkbox" checked={showHi} onChange={(e) => setShowHi(e.target.checked)} /> 高い</label>
              <label className="ck"><input type="checkbox" checked={showMid} onChange={(e) => setShowMid(e.target.checked)} /> 中</label>
            </div>
            <div className="fgroup">
              <span className="lab">紹介のしかた</span>
              <label className="ck"><input type="checkbox" checked={showCollab} onChange={(e) => setShowCollab(e.target.checked)} /> 協業先を紹介する</label>
              <label className="ck"><input type="checkbox" checked={showIntro} onChange={(e) => setShowIntro(e.target.checked)} /> 自社顧客を紹介する</label>
            </div>
            <button
              className="btn btn-sm btn-primary"
              style={{ width: '100%' }}
              onClick={() => {
                startTransition(() => setAppliedFilter({ hi: showHi, mid: showMid, collab: showCollab, intro: showIntro }));
                toast('絞り込みました');
              }}
            >適用</button>
          </div>
        </aside>
      </div>

      <div className="muted mt16" style={{ fontSize: 12 }}>※ 相性は「求めてること」と「提供できること」の一致数で決まります。同じ計算をブラウザと手元のClaude（MCP）が共有し、外部API課金はありません。</div>
    </>
  );
}
