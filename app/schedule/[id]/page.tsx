import '../schedule.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getTask } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { UserAvatar } from '@/components/ui-bits';
import { CalendarExportButton } from '../parts';
import { STATUS_BADGE, kindClass, dueMeta, fmtMD } from '../task-utils';
import { CompleteTaskButton, ChildCheck, CommentBox, DeleteTaskButton } from './parts';

type Child = { id: string; title: string; kind: string; status: string; due_date: string | null; start_date: string | null; assignee: string | null; progress: number };

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;
  const t = await getTask(id);
  if (!t || t.error) redirect('/schedule');

  const done = t.status === '完了';
  const dm = dueMeta(t.due_date, t.today, done);
  const children: Child[] = t.children ?? [];
  const isParent = children.length > 0;
  const extra = (t.extra ?? {}) as { note?: { id?: string; title?: string }; doc?: { id?: string; title?: string }; repeat?: string };

  const topbar = (
    <>
      <div className="crumb"><Link href="/schedule">期限・タスク</Link> / <b>課題 #{String(t.id).slice(0, 8)}</b></div>
      <div className="spacer" />
      {!t.parent && <Link className="btn btn-sm" href={`/schedule/new?parent=${t.id}`}>＋ 子課題を追加</Link>}
      <Link className="btn btn-sm" href={`/schedule/${t.id}/edit`}>編集</Link>
      <CompleteTaskButton id={t.id} status={t.status} />
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="schedule" topbar={topbar}>
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="tid num">#{String(t.id).slice(0, 8)}</span>
            <h2>{t.title}</h2>
            <span className={`t-badge ${kindClass(t.kind)}`}><span className="mk" />{t.kind}</span>
            <span className={`badge ${STATUS_BADGE[t.status] ?? 'dormant'}`}><span className="dot" />{t.status}</span>
          </div>
          <div className="sub">
            {t.scope === 'internal'
              ? <><span className="seal-mini">大</span>大吉会計（所内）</>
              : t.company_id ? <Link href={`/companies/${t.company_id}`}>{t.company}</Link> : '（全顧問先）'}
            {t.due_date && <> ・ 期日 <b className="num">{dm.md}</b>{dm.label ? `（${dm.label.replace(' ', '')}）` : dm.isToday ? '（今日）' : ''}</>}
            {isParent && <> ・ 親課題（子課題 {children.length}）</>}
            {t.parent && <> ・ 親課題: <Link href={`/schedule/${t.parent.id}`}>{t.parent.title}</Link></>}
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* 左: 説明・子課題・コメント・履歴 */}
        <div>
          <div className="panel">
            <div className="panel-head"><h3>説明</h3><div className="actions"><Link className="btn btn-sm btn-ghost" href={`/schedule/${t.id}/edit`}>編集</Link></div></div>
            <div className="panel-body">
              {t.description
                ? <div className="desc-body">{t.description}</div>
                : <div className="muted" style={{ fontSize: 13 }}>説明はまだありません。「編集」から仕事の内容・手順・完了条件を記載できます。</div>}
            </div>
          </div>

          {isParent && (
            <div className="panel">
              <div className="panel-head">
                <h3>子課題</h3><span className="count">{children.length} 件・進捗 {t.progress}%</span>
                <div className="actions"><Link className="btn btn-sm" href={`/schedule/new?parent=${t.id}`}>＋ 子課題を追加</Link></div>
              </div>
              <div className="panel-body" style={{ paddingTop: 4, paddingBottom: 4 }}>
                {children.map((c) => {
                  const cdone = c.status === '完了';
                  const cdm = dueMeta(c.due_date, t.today, cdone);
                  return (
                    <div key={c.id} className={`subrow${cdone ? ' done' : ''}`}>
                      <ChildCheck id={c.id} done={cdone} />
                      <Link className="nm" href={`/schedule/${c.id}`}>{c.title}</Link>
                      <span className="meta">
                        <span className={`num${cdm.cls === 'soon' || cdm.cls === 'over' ? ' due-soon' : ''}`} style={cdm.cls === 'over' ? { color: 'var(--red-600)' } : undefined}>
                          {cdm.md}{cdm.label ? ` ${cdm.label}` : cdm.isToday ? ' 今日' : ''}
                        </span>
                        <span className="av">{c.assignee?.charAt(0) ?? '—'}</span>
                        <span className={`badge ${STATUS_BADGE[c.status] ?? 'dormant'}`} style={{ height: 20 }}><span className="dot" />{c.status}</span>
                        <span className={`pbar${c.progress >= 100 ? ' full' : ''}`}><i style={{ width: `${c.progress}%` }} /></span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="panel">
            <div className="panel-head"><h3>コメント</h3><span className="count">{(t.comments ?? []).length} 件</span></div>
            <div className="panel-body">
              {(t.comments ?? []).map((c: { id: string; body: string; author: string; avatar: string; at: string }) => (
                <div className="cmt" key={c.id}>
                  <span className="av">{c.avatar}</span>
                  <div className="body">
                    <div className="hd"><b>{c.author}</b> ・ <span className="num">{c.at}</span></div>
                    <div className="tx">{c.body}</div>
                  </div>
                </div>
              ))}
              <CommentBox id={t.id} avatar={user.avatar} />
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>変更履歴</h3></div>
            <div className="panel-body">
              {(t.events ?? []).length === 0 && <div className="muted" style={{ fontSize: 12.5 }}>変更履歴はまだありません。</div>}
              <div className="hist">
                {(t.events ?? []).map((e: { id: string; body: string; author: string; at: string }) => (
                  <div className="h" key={e.id}><b>{e.author.split(/\s/)[0]}</b><span>{e.body}</span><span className="tm num">{e.at}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 右: 詳細メタ・操作・関連 */}
        <div>
          <div className="panel">
            <div className="panel-head"><h3>詳細</h3></div>
            <div className="panel-body">
              <dl className="kv">
                <dt>状態</dt><dd><span className={`badge ${STATUS_BADGE[t.status] ?? 'dormant'}`}><span className="dot" />{t.status}</span></dd>
                <dt>進捗</dt><dd><span className={`pbar${t.progress >= 100 ? ' full' : ''}`}><i style={{ width: `${t.progress}%` }} /></span> <b className="num">{t.progress}%</b>{isParent ? '（子課題から自動集計）' : ''}</dd>
                <dt>区分</dt><dd>{t.scope === 'internal' ? '所内の課題' : '顧客の課題'}</dd>
                <dt>企業</dt><dd>{t.scope === 'internal' ? <><span className="seal-mini">大</span>大吉会計（所内）</> : t.company_id ? <Link href={`/companies/${t.company_id}`}>{t.company}</Link> : '（全顧問先）'}</dd>
                <dt>種別</dt><dd>{t.kind}{t.source === '自動' ? '（自動生成）' : ''}</dd>
                <dt>開始日</dt><dd className="num">{t.start_date ?? '—'}</dd>
                <dt>期日</dt><dd className="num">{t.due_date ? `${t.due_date}${dm.label ? `（${dm.label.replace(' ', '')}）` : dm.isToday ? '（今日）' : ''}` : '—'}</dd>
                <dt>担当</dt><dd>{t.assignee ? <><span className="av" style={{ verticalAlign: -5 }}>{t.assignee.charAt(0)}</span> {t.assignee}</> : '（未定）'}</dd>
                <dt>親課題</dt><dd>{t.parent ? <Link href={`/schedule/${t.parent.id}`}>{t.parent.title}</Link> : isParent ? 'なし（この課題が親）' : 'なし'}</dd>
                <dt>作成</dt><dd className="num">{t.created_at}{t.source === '自動' ? ' 自動生成' : ''}</dd>
                <dt>更新</dt><dd className="num">{t.updated_at}</dd>
              </dl>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>操作</h3></div>
            <div className="panel-body side-actions">
              {!t.parent && <Link className="btn btn-sm" href={`/schedule/new?parent=${t.id}`}>＋ 子課題を追加</Link>}
              <Link className="btn btn-sm" href="/schedule?view=board">ボード / ガントで表示</Link>
              <CalendarExportButton />
              {t.source === '手動' && <DeleteTaskButton id={t.id} title={t.title} kids={children.length} />}
            </div>
          </div>

          {(extra.note?.title || extra.doc?.title || extra.repeat) && (
            <div className="panel">
              <div className="panel-head"><h3>関連</h3></div>
              <div className="panel-body">
                <dl className="kv">
                  {extra.note?.title && <><dt>議事録</dt><dd>{extra.note.id ? <Link href={`/notes/${extra.note.id}`}>{extra.note.title}</Link> : extra.note.title}</dd></>}
                  {extra.doc?.title && <><dt>資料</dt><dd><Link href="/documents">{extra.doc.title}</Link></dd></>}
                  {extra.repeat && <><dt>繰り返し</dt><dd>{extra.repeat}</dd></>}
                </dl>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
