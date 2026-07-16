import './schedule.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { listSchedule, listUsers } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/icons';
import { UserAvatar } from '@/components/ui-bits';
import { CalendarExportButton, TourHelpButton } from './parts';
import { ScheduleViews } from './views';
import type { TaskItem } from './task-utils';

type SP = { [k: string]: string | undefined };
const VIEW_KEYS = ['list', 'board', 'gantt', 'cal'] as const;

export default async function SchedulePage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const sp = await searchParams;

  const res = await listSchedule({ status: sp.status, assignee: sp.assignee, kind: sp.kind, q: sp.q });
  const users = (await listUsers()) ?? [];
  const items: TaskItem[] = res.items ?? [];
  const view = (VIEW_KEYS as readonly string[]).includes(sp.view ?? '') ? (sp.view as (typeof VIEW_KEYS)[number]) : 'list';

  const topbar = (
    <>
      <h1>期限・タスク</h1>
      <form className="search" action="/schedule">
        <span className="mag"><Icon name="search" size={16} /></span>
        <input name="q" placeholder="企業・内容で絞り込み…" defaultValue={sp.q ?? ''} />
      </form>
      <div className="spacer" />
      <CalendarExportButton />
      <Link id="add-task-btn" className="btn btn-sm btn-primary" href="/schedule/new">＋ 課題を追加</Link>
      <TourHelpButton />
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="schedule" topbar={topbar}>
      <div className="page-head">
        <div>
          <h2>期限・タスク</h2>
          <div className="sub">顧客の期限と所内業務の課題を横断で管理</div>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="k">今週やること</div><div className="v num">{res.week ?? 0} <small>件</small></div><div className="d muted" style={{ color: 'var(--ink-3)' }}>今週が期日の未完了</div></div>
        <div className="stat"><div className="k">今月の税務期限</div><div className="v num">{res.tax_month ?? 0} <small>件</small></div><div className="d muted" style={{ color: 'var(--ink-3)' }}>申告・納付・決算準備</div></div>
        <div className="stat red"><div className="k">遅延（要対応）</div><div className="v num">{res.overdue ?? 0} <small>件</small></div><div className="d" style={{ color: 'var(--red-600)' }}>至急 対応</div></div>
        <div className="stat"><div className="k">未完了の課題</div><div className="v num">{res.open ?? 0} <small>件</small></div><div className="d">今月 完了 {res.done_month ?? 0} 件</div></div>
      </div>

      <ScheduleViews items={items} counts={res} today={res.today} users={users} initialView={view} />

      <div className="panel mt16">
        <div className="panel-head"><h3>自動生成のルール</h3></div>
        <div className="panel-body">
          <ul className="rulelist">
            <li><span style={{ color: 'var(--gold-600)' }}>●</span><span><b>決算月</b>から逆算し、決算準備（3ヶ月前）・申告期限（2ヶ月後）を親課題＋子課題のテンプレートで生成。</span></li>
            <li><span style={{ color: 'var(--red-600)' }}>●</span><span><b>消費税</b>の中間申告・納付を課税区分に応じて生成。</span></li>
            <li><span style={{ color: 'var(--brand-600)' }}>●</span><span><b>年末調整・法定調書・償却資産申告</b>（1/31）を毎年生成。</span></li>
            <li><span style={{ color: 'var(--brand-600)' }}>●</span><span><b>所内の定例業務</b>（月次締め・メルマガ・研修など）は課題として登録して管理（メルマガ画面と連動）。</span></li>
            <li><span style={{ color: 'var(--ink-3)' }}>●</span><span>源泉所得税の納付（毎月10日／納期特例）をリマインド。</span></li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
