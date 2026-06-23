import './schedule.css';
import { Fragment } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { listSchedule } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/icons';
import { GuideButton } from '@/components/GuideButton';
import { UserAvatar } from '@/components/ui-bits';
import { AddTaskButton, CalendarExportButton, ScheduleFilterBar, ScheduleRowActions } from './parts';

type SP = { [k: string]: string | undefined };
type Item = { id: string; company: string; company_id: string | null; kind: string; title: string; due_date: string; source: string; status: string; assignee: string; bucket: string };

const KIND_BADGE: Record<string, string> = { 決算: 't-kessan', 決算準備: 't-kessan', '申告・納付': 't-shinkoku', 年末調整: 't-nencho', 法定調書: 't-nencho', 手動タスク: 't-task' };
const STATUS_BADGE: Record<string, string> = { 未対応: 'dormant', 対応中: 'prospect', 完了: 'active' };

function kindClass(kind: string) {
  if (KIND_BADGE[kind]) return KIND_BADGE[kind];
  if (kind.includes('決算')) return 't-kessan';
  if (kind.includes('申告') || kind.includes('納付') || kind.includes('源泉')) return 't-shinkoku';
  if (kind.includes('年末') || kind.includes('調書')) return 't-nencho';
  return 't-task';
}

export default async function SchedulePage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const sp = await searchParams;

  const res = await listSchedule({ status: sp.status, assignee: sp.assignee, kind: sp.kind });
  const items: Item[] = res.items ?? [];

  const groups: { key: string; label: string; rows: Item[] }[] = [
    { key: 'overdue', label: '遅延', rows: items.filter((i) => i.bucket === 'overdue') },
    { key: 'week', label: '今週', rows: items.filter((i) => i.bucket === 'week') },
    { key: 'month', label: '今月のその他', rows: items.filter((i) => i.bucket === 'month') },
    { key: 'later', label: '来月以降', rows: items.filter((i) => i.bucket === 'later') },
  ].filter((g) => g.rows.length > 0);

  const colspan = 7;

  const topbar = (
    <>
      <h1>期限・タスク</h1>
      <form className="search" action="/schedule">
        <span className="mag"><Icon name="search" size={16} /></span>
        <input name="q" placeholder="企業・内容で絞り込み…" defaultValue={sp.q ?? ''} />
      </form>
      <div className="spacer" />
      <CalendarExportButton />
      <AddTaskButton />
      <GuideButton title="期限・タスクの使い方">
        <p>会計事務所の業務サイクル（決算・申告・納付・年末調整）と、社内の手動タスクを<b>1つの期限ハブ</b>でまとめて把握します。</p>
        <h4>期限はどこから来る？</h4>
        <ul>
          <li>各企業の<b>決算月・登録情報から自動生成</b>（申告期限・中間納付・決算準備リマインド・年末調整など）。</li>
          <li>面談フォローや資料回収などは<b>手動タスク</b>として追加。</li>
          <li>担当（社内スタッフ）で絞り込み、自分の「今週やること」を確認。</li>
        </ul>
        <h4>連携</h4>
        <ul>
          <li><b>Googleカレンダー</b>へ書き出して外出先でも確認（打ち合わせ画面と連動）。</li>
          <li>期日超過は<b>遅延</b>として上部にまとめ、放置を防止。</li>
        </ul>
      </GuideButton>
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="schedule" topbar={topbar}>
      <div className="page-head">
        <div>
          <h2>期限・タスク</h2>
          <div className="sub">決算・申告・納付の期限と手動タスクを横断で管理</div>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="k">今週やること</div><div className="v num">{res.week ?? 0} <small>件</small></div><div className="d muted" style={{ color: 'var(--ink-3)' }}>期限あり {res.week ?? 0} 件</div></div>
        <div className="stat"><div className="k">今月の税務期限</div><div className="v num">{res.month ?? 0} <small>件</small></div><div className="d muted" style={{ color: 'var(--ink-3)' }}>申告・納付・決算準備</div></div>
        <div className="stat gold"><div className="k">遅延（要対応）</div><div className="v num">{res.overdue ?? 0} <small>件</small></div><div className="d" style={{ color: 'var(--red-600)' }}>至急 対応</div></div>
        <div className="stat"><div className="k">未完了タスク</div><div className="v num">{res.open ?? 0} <small>件</small></div><div className="d">遅延・未完了を含む</div></div>
      </div>

      <div className="panel mt16">
        <div className="panel-head">
          <h3>期限・タスク一覧</h3>
          <span className="count">{res.count ?? items.length} 件</span>
        </div>
        <ScheduleFilterBar count={res.count ?? items.length} />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th style={{ width: 74 }}>期日</th><th style={{ width: 104 }}>種別</th><th>企業</th><th>内容</th><th>担当</th><th>状態</th><th className="right">操作</th></tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={colspan} className="muted" style={{ textAlign: 'center', padding: 28 }}>条件に一致する期限・タスクがありません。</td></tr>
              )}
              {groups.map((g) => (
                <Fragment key={g.key}>
                  <tr className="grp"><td colSpan={colspan}>{g.label} <span className="cnt num">{g.rows.length}</span></td></tr>
                  {g.rows.map((it) => {
                    const due = (it.due_date || '').slice(5).replace('-', '/');
                    const overdueRow = it.bucket === 'overdue';
                    return (
                      <tr key={it.id} className={overdueRow ? 'overdue-row' : undefined}>
                        <td className="num b" style={overdueRow ? { color: 'var(--red-700)' } : undefined}>{due}</td>
                        <td><span className={`t-badge ${kindClass(it.kind)}`}><span className="mk" />{it.kind}</span></td>
                        <td className="name">
                          {it.company_id ? <Link href={`/companies/${it.company_id}`}>{it.company}</Link> : <span className="muted">{it.company || '（全顧問先）'}</span>}
                        </td>
                        <td>{it.title}</td>
                        <td className="muted">{it.assignee || '—'}</td>
                        <td><span className={`badge ${STATUS_BADGE[it.status] ?? 'dormant'}`}><span className="dot" />{it.status}</span></td>
                        <td className="right"><ScheduleRowActions id={it.id} source={it.source} status={it.status} /></td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tfoot">
          <span>期限は各企業の決算月・登録情報から自動生成（手動タスクを除く）。自動分は編集不可。</span>
        </div>
      </div>
    </AppShell>
  );
}
