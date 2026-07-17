import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { listMeetings } from '@/lib/data/dal';
import { meetingsToIcal, type IcalMeeting } from '@/lib/ical';

export const runtime = 'nodejs';

// 打ち合わせの .ics 書き出し（VEVENT）。出席者メール等を含むため要ログイン。
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/login', req.url));

  const res = await listMeetings();
  const items: IcalMeeting[] = (res.items ?? []).map((m: Record<string, unknown>) => ({
    id: String(m.id),
    title: String(m.title ?? ''),
    start: (m.start as string) ?? null,
    location: (m.location as string) ?? null,
    company: (m.company as string) ?? null,
    attendees: Array.isArray(m.attendees) ? (m.attendees as string[]) : [],
  }));
  const ics = meetingsToIcal(items);

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="daikichi-meetings_${new Date().toISOString().slice(0, 10)}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}
