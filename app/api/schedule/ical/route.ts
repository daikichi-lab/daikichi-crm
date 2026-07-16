import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { listSchedule } from '@/lib/data/dal';
import { tasksToIcal, type IcalTask } from '@/lib/ical';

export const runtime = 'nodejs';

// 期限・タスクの .ics 書き出し（VTODO）。絞り込み条件を引き継ぐ。
// 顧客名・担当を含むため要ログイン。
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/login', req.url));

  const sp = req.nextUrl.searchParams;
  const res = await listSchedule({
    status: sp.get('status') ?? undefined,
    assignee: sp.get('assignee') ?? undefined,
    kind: sp.get('kind') ?? undefined,
    company: sp.get('company') ?? undefined,
    scope: sp.get('scope') ?? undefined,
    q: sp.get('q') ?? undefined,
  });
  const items: IcalTask[] = (res.items ?? []).map((t: Record<string, unknown>) => ({
    id: String(t.id),
    title: String(t.title ?? ''),
    due_date: (t.due_date as string) ?? null,
    start_date: (t.start_date as string) ?? null,
    company: (t.company as string) ?? null,
    status: (t.status as string) ?? null,
    assignee: (t.assignee as string) ?? null,
    kind: (t.kind as string) ?? null,
  }));
  const ics = tasksToIcal(items);

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="daikichi-tasks_${new Date().toISOString().slice(0, 10)}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}
