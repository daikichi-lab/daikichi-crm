'use client';
// 期限・タスクの4ビュー（一覧ツリー / ボード看板 / ガント / 月カレンダー）＋スコープタブ＋行メニュー。
// mockups/schedule.html の React 移植。スコープ・ビュー・月は画面内状態、担当/種別/未完了は URL クエリ。
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useUI } from '@/components/ui';
import { startTour, endTour, type TourStep } from '@/components/tour';
import { completeScheduleItemAction, updateScheduleItemAction, deleteTaskAction } from './actions';
import {
  type TaskItem, type ScheduleCounts, KINDS, STATUS_BADGE,
  kindClass, ganttKind, dayNum, dayInfo, fmtMD, dueMeta, shortCo,
} from './task-utils';

type User = { id: string; name: string; avatar_initial?: string };
type ViewKey = 'list' | 'board' | 'gantt' | 'cal';
type Scope = 'all' | 'client' | 'internal';

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: 'list', label: '一覧' },
  { key: 'board', label: 'ボード' },
  { key: 'gantt', label: 'ガントチャート' },
  { key: 'cal', label: 'カレンダー' },
];
const BOARD_COLS: { st: string; key: 'todo' | 'doing' | 'done' }[] = [
  { st: '未対応', key: 'todo' }, { st: '対応中', key: 'doing' }, { st: '完了', key: 'done' },
];
const BOARD_SEEN_KEY = 'daikichi.schedule.board.v1';
const GANTT_DAYS = 47;
const GANTT_TODAY_IDX = 8;

export function ScheduleViews({ items, counts, today, users, initialView }: {
  items: TaskItem[]; counts: ScheduleCounts; today: string; users: User[]; initialView: ViewKey;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const { toast, confirm } = useUI();
  const [view, setView] = useState<ViewKey>(initialView);
  const [scope, setScope] = useState<Scope>('all');
  const [closedIds, setClosedIds] = useState<Set<string>>(new Set());
  const [menuId, setMenuId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const dragLane = useRef<string | null>(null);
  const justDragged = useRef(false);
  const [calYM, setCalYM] = useState(() => ({ y: +today.slice(0, 4), m: +today.slice(5, 7) }));

  // ---- ツリー構築（絞り込みで親が消えた子はトップレベル扱い） ----
  const filtered = useMemo(() => (scope === 'all' ? items : items.filter((i) => i.scope === scope)), [items, scope]);
  const byId = useMemo(() => new Map(filtered.map((i) => [i.id, i])), [filtered]);
  const kidsOf = useMemo(() => {
    const m = new Map<string, TaskItem[]>();
    for (const i of filtered) {
      if (i.parent_id && byId.has(i.parent_id)) {
        const arr = m.get(i.parent_id) ?? [];
        arr.push(i);
        m.set(i.parent_id, arr);
      }
    }
    return m;
  }, [filtered, byId]);
  const tops = useMemo(() => filtered.filter((i) => !i.parent_id || !byId.has(i.parent_id)), [filtered, byId]);

  // ---- 操作（server actions → refresh） ----
  const refresh = useCallback(() => router.refresh(), [router]);
  const go = useCallback((href: string) => { setMenuId(null); router.push(href); }, [router]);

  const toggleDone = useCallback(async (it: TaskItem) => {
    if (it.status !== '完了') {
      await completeScheduleItemAction(it.id);
      toast('課題を完了にしました');
    } else {
      await updateScheduleItemAction(it.id, { status: '未対応' });
      toast('完了を取り消しました');
    }
    refresh();
  }, [refresh, toast]);

  const setStatus = useCallback(async (it: TaskItem, st: string) => {
    await updateScheduleItemAction(it.id, { status: st });
    toast(`ステータスを「${st}」に変更しました${it.parent_id ? '（親の進捗を再集計）' : ''}`);
    refresh();
  }, [refresh, toast]);

  const changeAssignee = (it: TaskItem) => {
    const draft = { v: it.assignee_id ?? '' };
    confirm({
      title: '担当を変更', confirmLabel: '変更',
      body: (
        <div className="field">
          <label>「{it.title}」の担当スタッフ</label>
          <select className="select" defaultValue={draft.v} onChange={(e) => (draft.v = e.target.value)}>
            <option value="">（未定）</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      ),
      onConfirm: async () => { await updateScheduleItemAction(it.id, { assignee: draft.v }); refresh(); },
    });
  };

  const changeDue = (it: TaskItem) => {
    const draft = { start: it.start_date ?? '', due: it.due_date ?? '' };
    confirm({
      title: '期日を変更', confirmLabel: '変更',
      body: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>「{it.title}」の開始日・期日を変更します。</p>
          <div className="field"><label>開始日</label><input className="input" type="date" defaultValue={draft.start} onChange={(e) => (draft.start = e.target.value)} /></div>
          <div className="field"><label>期日</label><input className="input" type="date" defaultValue={draft.due} onChange={(e) => (draft.due = e.target.value)} /></div>
        </div>
      ),
      onConfirm: async () => { await updateScheduleItemAction(it.id, { start_date: draft.start, due_date: draft.due }); refresh(); },
    });
  };

  const removeTask = (it: TaskItem) => {
    confirm({
      title: '課題を削除', confirmLabel: '削除', danger: true,
      body: <p>「{it.title}」を削除します{it.kids > 0 ? `（子課題 ${it.kids} 件も一緒に削除されます）` : ''}。よろしいですか？</p>,
      onConfirm: async () => { await deleteTaskAction(it.id); refresh(); },
    });
  };

  // ---- 行メニュー（⋯）: 外側クリックで閉じる ----
  useEffect(() => {
    if (!menuId) return;
    const close = () => setMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuId]);

  // ---- URL フィルタ（担当・種別・未完了のみ） ----
  const updateQuery = (patch: Record<string, string>) => {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) params.set(k, v); else params.delete(k); }
    router.push(`/schedule?${params.toString()}`);
  };
  const openOnly = sp.get('status') === 'open';

  // ---- 使い方ツアー（トップバーの「使い方」→ CustomEvent 経由で起動） ----
  const runTour = useCallback(() => {
    const steps: TourStep[] = [
      { sel: '.scope-tabs', title: '顧客と所内の課題を切り替える',
        body: '企業に紐づく仕事と、大吉会計の所内業務（月次締め・メルマガなど）をタブで分けて見られます。どのビューにも絞り込みが効きます。' },
      { sel: '#view-tabs', title: '4つの見え方を切り替える',
        body: '一覧は期日順のツリー、ボードはカンバン、ガントチャートは期間バー、カレンダーは月表示。同じ課題をどの見え方でも扱えます。' },
      { before: () => setView('board'), sel: '#view-board .klane', title: 'カードをドラッグして進める',
        body: '子課題のカードを「未対応 → 対応中 → 完了」の列へドラッグするとステータスが変わり、親課題の進捗が自動で再集計されます。' },
      { before: () => setView('list'), sel: '#view-list tbody tr', title: '行からすぐ操作する',
        body: '左の丸チェックで完了。行のクリックで課題詳細（説明・コメント・履歴）へ。右端の ⋯ から子課題の追加・編集・削除ができます。' },
      { sel: '#add-task-btn', title: '課題を追加する',
        body: '顧客の課題は、先に企業を検索して選んでから入力します。親課題を指定すると子課題として作成されます。' },
      { title: '準備ができました',
        body: 'このツアーは右上の「使い方」からいつでも見直せます。まずはボードでカードを1枚動かしてみましょう。' },
    ];
    startTour(steps);
  }, []);

  useEffect(() => {
    window.addEventListener('daikichi:schedule-tour', runTour);
    return () => { window.removeEventListener('daikichi:schedule-tour', runTour); endTour(); };
  }, [runTour]);

  // 新機能のお知らせ（ボードビュー）: 初回のみ（Miro/Canva風）
  useEffect(() => {
    try {
      if (localStorage.getItem(BOARD_SEEN_KEY)) return;
      localStorage.setItem(BOARD_SEEN_KEY, '1');
    } catch { return; }
    const t = setTimeout(() => {
      startTour([{
        sel: '#tab-board',
        title: 'ボードビューが使えるようになりました',
        body: '課題をカードで並べ、ドラッグで「未対応 → 対応中 → 完了」へ動かせます。親課題ごとのレーンで進み具合がひと目で分かります。',
        cta: '試してみる',
        onCta: () => setView('board'),
      }], { mode: 'feature' });
    }, 600);
    return () => clearTimeout(t);
  }, []);

  // ================= 一覧（親子ツリー） =================
  const renderRow = (it: TaskItem, isChild: boolean) => {
    const done = it.status === '完了';
    const dm = dueMeta(it.due_date, today, done);
    const cls = [
      done ? 'done' : '',
      isChild ? 'child' : '',
      !done && dm.cls === 'over' ? 'overdue-row' : '',
      dm.isToday ? 'today-row' : '',
      closedIds.has(it.id) ? 'closed' : '',
    ].filter(Boolean).join(' ');
    return (
      <tr key={it.id} className={cls || undefined} style={{ cursor: 'pointer' }} onClick={() => router.push(`/schedule/${it.id}`)}>
        <td className="done-cell" onClick={(e) => e.stopPropagation()}>
          <span className="chk" role="checkbox" aria-checked={done} title={done ? '完了を取り消す' : '完了にする'} onClick={() => toggleDone(it)} />
        </td>
        <td className="ttl">
          <span className="tin">
            {it.kids > 0
              ? <button className="tw" title="子課題を開閉" onClick={(e) => { e.stopPropagation(); setClosedIds((s) => { const n = new Set(s); if (n.has(it.id)) n.delete(it.id); else n.add(it.id); return n; }); }} />
              : isChild ? <span className="tguide">└</span> : <span className="tsp" />}
            <span className="tname">{it.title}</span>
            {it.kids > 0 && <span className="tsub">子課題 {it.kids}</span>}
          </span>
        </td>
        <td className={isChild ? 'muted co' : it.scope === 'internal' ? 'co office-co' : 'name co'} onClick={(e) => e.stopPropagation()}>
          {it.scope === 'internal'
            ? <><span className="seal-mini">大</span>大吉会計（所内）</>
            : it.company_id
              ? <Link href={`/companies/${it.company_id}`}>{isChild ? shortCo(it.company) : it.company}</Link>
              : <span className="muted">（全顧問先）</span>}
        </td>
        <td><span className={`t-badge ${kindClass(it.kind)}`}><span className="mk" />{it.kind}</span></td>
        <td className={`num due-cell${done ? ' muted' : ' b'}`} style={!done && dm.cls === 'over' ? { color: 'var(--red-700)' } : undefined}>
          {dm.md}
          {dm.isToday && <span className="today-pill">今日</span>}
          {!dm.isToday && dm.label && <span className={`due ${dm.cls}`}>{dm.label}</span>}
        </td>
        <td className="who">{it.assignee ? <><span className="av">{it.assignee.charAt(0)}</span>{it.assignee}</> : '—'}</td>
        <td className="st">
          <span className={`badge ${!done && dm.cls === 'over' ? 'overdue' : STATUS_BADGE[it.status] ?? 'dormant'}`}><span className="dot" />{it.status}</span>
        </td>
        <td className="prog">
          <span className={`pbar${it.progress >= 100 ? ' full' : ''}`}><i style={{ width: `${it.progress}%` }} /></span>
          <span className="pv num">{it.progress}%</span>
        </td>
        <td className="act" onClick={(e) => e.stopPropagation()}>
          <button className="kebab" title="操作" onClick={() => setMenuId((m) => (m === it.id ? null : it.id))}>⋯</button>
          {menuId === it.id && (
            <div className="rowmenu">
              {!it.parent_id && <button onClick={() => go(`/schedule/new?parent=${it.id}`)}>＋ 子課題を追加</button>}
              <button onClick={() => go(`/schedule/${it.id}/edit`)}>課題を編集</button>
              {!done && <button onClick={() => { setMenuId(null); toggleDone(it); }}>完了にする</button>}
              <button onClick={() => { setMenuId(null); changeAssignee(it); }}>担当を変更</button>
              {it.source === '手動' && <button onClick={() => { setMenuId(null); changeDue(it); }}>期日を変更</button>}
              {it.source === '手動' && <><hr /><button className="danger" onClick={() => { setMenuId(null); removeTask(it); }}>削除</button></>}
            </div>
          )}
        </td>
      </tr>
    );
  };

  const listView = (
    <div id="view-list">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th style={{ width: 34 }} /><th>題名</th><th>企業</th><th style={{ width: 104 }}>種別</th><th style={{ width: 96 }}>期日</th><th>担当</th><th>状態</th><th style={{ width: 110 }}>進捗</th><th style={{ width: 36 }} /></tr>
          </thead>
          <tbody>
            {tops.length === 0 && (
              <tr><td colSpan={9} className="muted" style={{ textAlign: 'center', padding: 28 }}>条件に一致する課題がありません。</td></tr>
            )}
            {tops.map((t) => (
              <Fragment key={t.id}>
                {renderRow(t, false)}
                {!closedIds.has(t.id) && (kidsOf.get(t.id) ?? []).map((c) => renderRow(c, true))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tfoot">
        <span>期限は各企業の決算月・登録情報から自動生成（手動タスク・所内業務を除く）・親課題の進捗は子課題から自動集計</span>
      </div>
    </div>
  );

  // ================= ボード（看板） =================
  const renderCard = (it: TaskItem, laneKey: string) => {
    const done = it.status === '完了';
    const dm = dueMeta(it.due_date, today, done);
    return (
      <article
        key={it.id}
        className={`kcard${done ? ' kdone' : ''}${dragId === it.id ? ' dragging' : ''}`}
        draggable
        onDragStart={(e) => { setDragId(it.id); dragLane.current = laneKey; e.dataTransfer.effectAllowed = 'move'; }}
        onDragEnd={() => { setDragId(null); dragLane.current = null; setOverCol(null); justDragged.current = true; setTimeout(() => { justDragged.current = false; }, 150); }}
        onClick={() => { if (!justDragged.current) router.push(`/schedule/${it.id}`); }}
      >
        <div className="kc-top">
          <span className={`t-badge ${kindClass(it.kind)}`}><span className="mk" />{it.kind}</span>
          <span className={`kc-due num${dm.cls === 'over' ? ' over' : dm.cls === 'soon' || dm.isToday ? ' soon' : ''}`}>
            {dm.md}{dm.isToday ? ' 今日' : dm.label ? ` ${dm.label.replace(' ', '')}` : ''}
          </span>
        </div>
        <div className="kc-title">{it.title}</div>
        <div className="kc-foot">
          <span className="kc-co">{it.scope === 'internal' ? '大吉会計（所内）' : shortCo(it.company) || '（全顧問先）'}</span>
          <span className="kav">{it.assignee?.charAt(0) ?? '—'}</span>
        </div>
      </article>
    );
  };

  const renderLane = (laneKey: string, cards: TaskItem[], parent: TaskItem | null) => (
    <section className="klane" key={laneKey}>
      <div className="klane-head">
        <span className="ldot" style={parent ? undefined : { background: 'var(--ink-3)' }} />
        {parent
          ? <Link className="lt" href={`/schedule/${parent.id}`}>{parent.title}</Link>
          : <span className="lt">単独の課題（親課題なし）</span>}
        {parent
          ? <span className="lsub">{parent.scope === 'internal' ? <><span className="seal-mini">大</span>大吉会計（所内）</> : parent.company} ・ 期日 {fmtMD(parent.due_date) || '未定'}</span>
          : <span className="lsub">顧客・所内の単発の仕事</span>}
        {parent && (
          <span className="lprog"><span className="pbar"><i style={{ width: `${parent.progress}%` }} /></span>{parent.progress}%</span>
        )}
      </div>
      <div className="kcols">
        {BOARD_COLS.map(({ st, key }) => {
          const colCards = cards.filter((c) => c.status === st);
          const colKey = `${laneKey}:${key}`;
          return (
            <div
              key={key}
              className={`kcol${overCol === colKey ? ' over' : ''}`}
              data-st={key}
              onDragOver={(e) => { if (!dragId || dragLane.current !== laneKey) return; e.preventDefault(); setOverCol(colKey); }}
              onDragLeave={() => setOverCol((c) => (c === colKey ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setOverCol(null);
                if (!dragId || dragLane.current !== laneKey) return;
                const card = byId.get(dragId);
                if (card && card.status !== st) setStatus(card, st);
              }}
            >
              <div className="kcol-head"><span className="kdot" />{st} <span className="kcount num">{colCards.length}</span></div>
              <div className="kcards">{colCards.map((c) => renderCard(c, laneKey))}</div>
            </div>
          );
        })}
      </div>
    </section>
  );

  const singles = tops.filter((t) => !(kidsOf.get(t.id)?.length));
  const boardView = (
    <div id="view-board">
      <div className="board">
        {tops.filter((t) => kidsOf.get(t.id)?.length).map((t) => renderLane(t.id, kidsOf.get(t.id)!, t))}
        {singles.length > 0 && renderLane('singles', singles, null)}
      </div>
      <div className="khint">カードをドラッグして「未対応 → 対応中 → 完了」へ移動できます（同じレーン内）。カードのクリックで課題詳細へ。</div>
    </div>
  );

  // ================= ガントチャート =================
  const tnum = dayNum(today);
  const gStart = tnum - GANTT_TODAY_IDX;
  const gDays = Array.from({ length: GANTT_DAYS }, (_, i) => dayInfo(gStart + i));
  const gMonths: { label: string; span: number }[] = [];
  for (const d of gDays) {
    const label = gMonths.length === 0 || d.d === 1 ? (gMonths.length === 0 ? `${d.y}年 ${d.m}月` : `${d.m}月`) : null;
    if (label) gMonths.push({ label, span: 1 });
    else gMonths[gMonths.length - 1].span += 1;
  }
  const gIdx = (s: string) => dayNum(s) - gStart;
  const clamp = (n: number) => Math.max(0, Math.min(GANTT_DAYS - 1, n));

  const renderGanttRow = (it: TaskItem, isChild: boolean, summary: boolean) => {
    const done = it.status === '完了';
    const kindCls = summary ? 'summary' : done ? 'gdone' : ganttKind(it.kind, it.scope);
    let s: number | null = null;
    let e: number | null = null;
    if (summary) {
      const children = kidsOf.get(it.id) ?? [];
      const nums = children.flatMap((c) => [c.start_date, c.due_date].filter(Boolean).map((d) => dayNum(d!)));
      if (it.start_date) nums.push(dayNum(it.start_date));
      if (it.due_date) nums.push(dayNum(it.due_date));
      if (nums.length) { s = Math.min(...nums) - gStart; e = Math.max(...nums) - gStart; }
    } else if (it.start_date || it.due_date) {
      s = gIdx(it.start_date ?? it.due_date!);
      e = gIdx(it.due_date ?? it.start_date!);
    }
    const milestone = !summary && !it.start_date && !!it.due_date;
    const visible = s !== null && e !== null && e >= 0 && s <= GANTT_DAYS - 1;
    const cs = visible ? clamp(s!) : 0;
    const ce = visible ? clamp(e!) : 0;
    const overdueDays = !done && it.due_date && dayNum(it.due_date) < tnum ? tnum - dayNum(it.due_date) : 0;
    const lateS = overdueDays ? clamp(e! + 1) : 0;
    const lateE = overdueDays ? GANTT_TODAY_IDX : 0;
    const label = done ? '完了' : milestone ? `${fmtMD(it.due_date)} 期限` : summary || it.progress > 0 ? `${it.progress}%` : it.due_date ? `${fmtMD(it.due_date)} 期日` : '';
    const pre = ce >= GANTT_DAYS - 8;
    const gco = [
      it.scope === 'internal' ? '所内' : shortCo(it.company),
      it.assignee ? it.assignee.split(/\s/)[0] : '',
    ].filter(Boolean).join(' / ');
    return (
      <div key={it.id} className={`g-row${isChild ? ' child' : ''}`} style={{ cursor: 'pointer' }} onClick={() => router.push(`/schedule/${it.id}`)}>
        <div className="g-side">
          <span className={`gdot ${summary ? 'summary' : ganttKind(it.kind, it.scope)}`} />
          <span className="gname">{it.title}</span>
          <span className="gco">{gco}</span>
        </div>
        <div className="g-lane">
          {visible && milestone && !overdueDays && <div className={`gdia ${ganttKind(it.kind, it.scope)}`} style={{ '--d': ce } as CSSProperties} />}
          {visible && (!milestone || overdueDays > 0) && (
            <div className={`gbar ${kindCls}`} style={{ '--s': cs, '--e': ce } as CSSProperties}>
              {!summary && <i style={{ width: `${it.progress}%` }} />}
            </div>
          )}
          {overdueDays > 0 && lateS <= lateE && <div className="glate" style={{ '--s': lateS, '--e': lateE } as CSSProperties} />}
          {visible && label && (
            overdueDays > 0
              ? <span className="glabel red" style={{ '--e': lateE } as CSSProperties}>{overdueDays}日 超過</span>
              : <span className={`glabel${pre ? ' pre' : ''}`} style={{ '--e': ce, '--s': cs } as CSSProperties}>{label}</span>
          )}
        </div>
      </div>
    );
  };

  const ganttView = (
    <div id="view-gantt">
      <div className="gantt-wrap">
        <div className="gantt">
          <div className="g-today" />
          <div className="g-head">
            <div className="g-side">課題</div>
            <div className="g-scale">
              <div className="g-months">{gMonths.map((m, i) => <b key={i} style={{ width: `calc(var(--day-w)*${m.span})` }}>{m.label}</b>)}</div>
              <div className="g-dnums">
                {gDays.map((d, i) => (
                  <i key={i} className={i === GANTT_TODAY_IDX ? 'tdy' : d.wd === 6 ? 'sat' : d.wd === 0 ? 'sun' : undefined}>{d.d}</i>
                ))}
              </div>
            </div>
          </div>
          {tops.map((t) => {
            const children = kidsOf.get(t.id) ?? [];
            return (
              <Fragment key={t.id}>
                {renderGanttRow(t, false, children.length > 0)}
                {children.map((c) => renderGanttRow(c, true, false))}
              </Fragment>
            );
          })}
        </div>
      </div>
      <div className="g-foot">
        <span className="li"><span className="sw" style={{ background: 'var(--brand-800)' }} />親課題（子課題の期間を集約）</span>
        <span className="li"><span className="sw" style={{ background: 'var(--gold-600)' }} />決算</span>
        <span className="li"><span className="sw" style={{ background: 'var(--red-600)' }} />申告・納付</span>
        <span className="li"><span className="sw" style={{ background: 'var(--ink-3)' }} />手動タスク</span>
        <span className="li"><span className="sw" style={{ background: 'var(--brand-600)' }} />所内業務</span>
        <span className="li"><span className="sw" style={{ background: 'var(--red-600)', transform: 'rotate(45deg)', width: 9, height: 9 }} />期限（マイルストーン）</span>
        <span className="li"><span className="sw line" style={{ background: 'var(--brand-600)' }} />今日（{fmtMD(today)}）</span>
      </div>
    </div>
  );

  // ================= 月カレンダー =================
  const ymStr = `${calYM.y}-${String(calYM.m).padStart(2, '0')}`;
  const firstWd = new Date(Date.UTC(calYM.y, calYM.m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(calYM.y, calYM.m, 0)).getUTCDate();
  const calEvents = useMemo(() => {
    const m = new Map<number, { it: TaskItem; type: 'due' | 'start' }[]>();
    const push = (day: number, ev: { it: TaskItem; type: 'due' | 'start' }) => {
      const arr = m.get(day) ?? [];
      arr.push(ev);
      m.set(day, arr);
    };
    for (const it of filtered) {
      if (it.start_date?.startsWith(ymStr) && it.start_date !== it.due_date) push(+it.start_date.slice(8, 10), { it, type: 'start' });
      if (it.due_date?.startsWith(ymStr)) push(+it.due_date.slice(8, 10), { it, type: 'due' });
    }
    return m;
  }, [filtered, ymStr]);

  const calView = (
    <div id="view-cal">
      <div className="panel-body">
        <div className="cal">
          <div className="dow" style={{ color: 'var(--red-600)' }}>日</div><div className="dow">月</div><div className="dow">火</div><div className="dow">水</div><div className="dow">木</div><div className="dow">金</div><div className="dow" style={{ color: 'var(--brand-500)' }}>土</div>
          {Array.from({ length: firstWd }, (_, i) => <div key={`e${i}`} className="cell empty" />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = i + 1;
            const wd = (firstWd + i) % 7;
            const isToday = today === `${ymStr}-${String(d).padStart(2, '0')}`;
            const cls = ['cell', isToday ? 'today' : '', wd === 0 ? 'sun' : wd === 6 ? 'sat' : ''].filter(Boolean).join(' ');
            return (
              <div key={d} className={cls}>
                {d}
                {(calEvents.get(d) ?? []).map(({ it, type }, j) => {
                  const done = it.status === '完了';
                  const late = !done && type === 'due' && dayNum(it.due_date!) < tnum;
                  return (
                    <span
                      key={`${it.id}${type}${j}`}
                      className={`ev ${done && type === 'due' ? 'evdone' : ganttKind(it.kind, it.scope)}${late ? ' late' : ''}`}
                      title={`${it.title}${type === 'start' ? '（開始）' : ''}`}
                      onClick={() => router.push(`/schedule/${it.id}`)}
                    >
                      {type === 'start' ? `${it.title} 開始` : it.title}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="leg mt16">
          <span className="li"><span className="sw" style={{ background: 'var(--gold-600)' }} />決算（決算期・準備リマインド）</span>
          <span className="li"><span className="sw" style={{ background: 'var(--red-600)' }} />申告・納付</span>
          <span className="li"><span className="sw" style={{ background: 'var(--ink-3)' }} />手動タスク</span>
          <span className="li"><span className="sw" style={{ background: 'var(--brand-600)' }} />所内業務（大吉会計）</span>
          <span className="li"><span className="sw" style={{ background: 'var(--red-600)', width: 3, borderRadius: 0 }} />遅延</span>
        </div>
      </div>
    </div>
  );

  // ================= 枠（タブ・フィルタ） =================
  return (
    <div className="panel mt16">
      <div className="panel-head">
        <h3>課題</h3>
        <span className="count">{counts.count} 件（親課題 {counts.parents}・子課題 {counts.children}）</span>
        <div className="actions" id="view-tabs">
          {VIEWS.map((v) => (
            <button key={v.key} id={`tab-${v.key}`} className={`btn btn-sm${view === v.key ? '' : ' btn-ghost'}`} onClick={() => setView(v.key)}>
              {v.label}
              {v.key === 'board' && <span className="new-pip">NEW</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="filterbar">
        <div className="scope-tabs">
          <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>すべて <small className="num">{counts.scope_all}</small></button>
          <button className={scope === 'client' ? 'on' : ''} onClick={() => setScope('client')}>顧客の課題 <small className="num">{counts.scope_client}</small></button>
          <button className={scope === 'internal' ? 'on' : ''} onClick={() => setScope('internal')}>所内の課題 <small className="num">{counts.scope_internal}</small></button>
        </div>
        {view === 'cal' && (
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-sm btn-icon" aria-label="前月" onClick={() => setCalYM(({ y, m }) => (m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }))}>‹</button>
            <b className="num" style={{ minWidth: 96, textAlign: 'center' }}>{calYM.y}年 {calYM.m}月</b>
            <button className="btn btn-sm btn-icon" aria-label="翌月" onClick={() => setCalYM(({ y, m }) => (m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }))}>›</button>
            <button className="btn btn-sm" onClick={() => setCalYM({ y: +today.slice(0, 4), m: +today.slice(5, 7) })}>今日</button>
          </div>
        )}
        <select className="select" aria-label="担当" value={sp.get('assignee') ?? ''} onChange={(e) => updateQuery({ assignee: e.target.value })}>
          <option value="">担当：すべて</option>
          {users.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
        </select>
        <select className="select" aria-label="種別" value={sp.get('kind') ?? ''} onChange={(e) => updateQuery({ kind: e.target.value })}>
          <option value="">種別：すべて</option>
          {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        {openOnly
          ? <span className="filter-pill">未完了のみ <span className="x" onClick={() => updateQuery({ status: '' })}>×</span></span>
          : <button className="btn btn-sm btn-ghost" onClick={() => updateQuery({ status: 'open' })}>未完了のみ</button>}
      </div>
      {view === 'list' && listView}
      {view === 'board' && boardView}
      {view === 'gantt' && ganttView}
      {view === 'cal' && calView}
    </div>
  );
}
