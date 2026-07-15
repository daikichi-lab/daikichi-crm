import './matching.css';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { findMatches, suggestMatches, getCompany, searchCompanies } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { TourButton, type GuideTourStep } from '@/components/TourButton';
import { UserAvatar } from '@/components/ui-bits';
import { MatchingBoard, type Reco } from './parts';

const GUIDE_TOUR: GuideTourStep[] = [
  { sel: '.page-head .actions', title: '探し方を切り替える',
    body: '「会社を選んで探す」（起点企業に合う相手）と「事務所全体のおすすめ」を切替できます。' },
  { sel: '#candList', title: '候補は紹介文で読む',
    body: '「A社 に B社 を紹介」＋なぜ紹介できるか（<b>求↔提</b>の一致タグ）。相性の高い・中は一致タグ数です。' },
  { sel: '.match-filter', title: '絞り込み',
    body: '相性や紹介のしかた（協業先紹介／顧客紹介）で候補を絞り込めます。' },
  { title: '起票して追跡へ',
    body: '「この紹介を起票」で紹介履歴に登録。以降の進捗（提案→打診中→成立）は紹介履歴画面で追跡します。' },
];


type SP = { base?: string };

export default async function MatchingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const sp = await searchParams;
  const base = sp.base?.trim() || '';

  // 起点選択用の会社リスト（社名→idの解決にも使う）
  const all = await searchCompanies({ limit: 200 });
  const companies = all.companies.map((c) => ({ id: c.id, name: c.name, industry: c.industry, area: c.area }));
  const idByName = new Map(companies.map((c) => [c.name, c.id] as const));

  let recos: Reco[] = [];
  let originName = '';
  let originNeeds: string[] = [];
  let originOffers: string[] = [];
  let originId = '';

  if (base) {
    const res = await findMatches(base, 50);
    if (!('error' in res) || !res.error) {
      originName = res.base;
      const od = await getCompany(base);
      if (!('error' in od)) {
        originId = od.id;
        originNeeds = od.needs ?? [];
        originOffers = od.offers ?? [];
      }
      for (const m of res.matches) {
        // 協業先紹介: 起点が求めてることを相手が提供 → 起点 に 相手 を紹介（from=起点, to=相手）
        if (m.kyogyo_tags.length > 0) {
          recos.push({
            key: `k:${m.company_id}`,
            kind: '協業先紹介',
            kindNote: `協業先紹介（${originName}の困りごとを解決）`,
            fromId: originId, fromName: originName,
            toId: m.company_id, toName: m.company,
            matchedTags: m.kyogyo_tags,
            score: m.kyogyo_tags.length,
            why: `${originName}が求めてることを、${m.company}が提供できるから紹介できます。`,
            pairs: m.kyogyo_tags.map((t) => ({ lb: `${originName}の求めてる`, need: t, offer: t, who: m.company })),
          });
        }
        // 顧客紹介: 起点が提供できることを相手が求めてる → 相手 に 起点 を紹介（from=相手, to=起点）
        if (m.kokyaku_tags.length > 0) {
          recos.push({
            key: `o:${m.company_id}`,
            kind: '顧客紹介',
            kindNote: `顧客紹介（${originName}の強みが役立つ）`,
            fromId: m.company_id, fromName: m.company,
            toId: originId, toName: originName,
            matchedTags: m.kokyaku_tags,
            score: m.kokyaku_tags.length,
            why: `${m.company}が探していることを、${originName}が提供できます。${originName}の顧客づくりにもつながります。`,
            pairs: m.kokyaku_tags.map((t) => ({ lb: `${m.company}の求めてる`, need: t, offer: t, who: originName })),
          });
        }
      }
      recos.sort((a, b) => b.score - a.score);
    }
  } else {
    const res = await suggestMatches(20);
    for (const t of res.top) {
      const fromId = idByName.get(t.a) ?? '';
      const toId = idByName.get(t.b) ?? '';
      recos.push({
        key: `s:${t.a}:${t.b}`,
        kind: '協業先紹介',
        kindNote: `協業先紹介（${t.a}の困りごとを解決）`,
        fromId, fromName: t.a,
        toId, toName: t.b,
        matchedTags: t.matched_tags,
        score: t.score,
        why: `${t.a}と${t.b}は「求めてること」と「提供できること」が一致しています。`,
        pairs: t.matched_tags.map((tag) => ({ lb: `${t.a}の求めてる`, need: tag, offer: tag, who: t.b })),
      });
    }
  }

  const topbar = (
    <>
      <h1>マッチング</h1>
      <div className="spacer" />
      <TourButton steps={GUIDE_TOUR} />
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="matching" topbar={topbar}>
      <MatchingBoard
        base={base}
        originName={originName}
        originNeeds={originNeeds}
        originOffers={originOffers}
        companies={companies}
        recos={recos}
      />
    </AppShell>
  );
}
