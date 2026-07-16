import './admin-masters.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { listTags, getMasters } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { TourButton, type GuideTourStep } from '@/components/TourButton';
import { UserAvatar } from '@/components/ui-bits';
import { TagManager, IndustryAddButton, TopicAddButton } from './parts';

const GUIDE_TOUR: GuideTourStep[] = [
  { sel: '.panel', title: 'タグの名寄せ',
    body: 'リネーム・統合で表記ゆれを防ぎ、マッチング精度を保ちます。似たタグは警告されます。' },
  { sel: '#topics', title: 'メルマガ配信トピック',
    body: '配信トピック（メルマガ属性）はここで管理。メルマガ画面のセグメントと連動します。' },
  { title: '業種は編集可・エリア/規模は固定',
    body: '業種マスタは追加・編集できます。エリア（都道府県）と規模区分は固定マスタです。' },
];


export default async function AdminMastersPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/dashboard');

  const [tagsRes, masters] = await Promise.all([listTags(), getMasters()]);
  const tags = tagsRes.tags ?? [];
  const industries: string[] = masters.industries ?? [];
  const topics: string[] = masters.newsletter_topics ?? [];
  const sizes: string[] = masters.sizes ?? [];
  const areaGroups = Object.keys(masters.areas ?? {});

  const topbar = (
    <>
      <div className="crumb"><b>管理</b> / タグ・業種マスタ</div>
      <div className="spacer" />
      <TourButton steps={GUIDE_TOUR} />
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="admin" topbar={topbar}>
      <div className="page-head">
        <div><h2>管理</h2><div className="sub">表記ゆれを排除し、マッチング精度を保つためのマスタ管理（admin）。</div></div>
      </div>

      <nav className="admin-tabs">
        <Link href="/admin/users">ユーザー</Link>
        <Link href="/admin/masters" className="on">タグ・業種マスタ</Link>
      </nav>

      {/* タグ管理 */}
      <TagManager tags={tags} count={tagsRes.count ?? tags.length} />

      {/* 業種マスタ */}
      <div className="panel mt16">
        <div className="panel-head">
          <h3>業種マスタ</h3><span className="count num">{industries.length} 業種</span>
          <div className="actions"><IndustryAddButton /></div>
        </div>
        <div className="panel-body">
          <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>日本標準産業分類の大分類をベースに、会計事務所の顧客向け実用粒度へ整理（§8.6）。運用しながら admin が増減。</div>
          <div className="master-list">
            {industries.map((label) => (
              <span className="master-item" key={label}>{label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* メルマガ属性（配信トピック）マスタ */}
      <div className="panel mt16" id="topics">
        <div className="panel-head">
          <h3>メルマガ属性（配信トピック）</h3><span className="count num">{topics.length} トピック</span>
          <div className="actions"><TopicAddButton /></div>
        </div>
        <div className="filterbar">
          <span className="muted" style={{ fontSize: 12 }}>担当者（個人）ごとに購読を管理。メルマガ作成時はここから選んだトピックの<b>購読者かつ配信同意あり</b>の人が宛先になります。</span>
        </div>
        <div className="panel-body">
          <div className="master-list">
            {topics.map((label) => (
              <span className="chip need" key={label} style={{ height: 22, background: 'var(--brand-tint)', color: 'var(--brand-700)', borderColor: '#cfe0ef' }}>{label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* 固定マスタ（参考） */}
      <div className="panel mt16">
        <div className="panel-head"><h3>固定マスタ（編集不可）</h3></div>
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>エリア（47都道府県・地方区分付き）</div>
            <div className="row">
              {areaGroups.map((g) => <span className="fixed-note" key={g}>{g}</span>)}
              <span className="muted" style={{ fontSize: 12 }}>近接重み付け（v2）に利用</span>
            </div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>規模区分（売上ベース）</div>
            <div className="row">
              {sizes.map((s) => <span className="fixed-note num" key={s}>{s}</span>)}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
