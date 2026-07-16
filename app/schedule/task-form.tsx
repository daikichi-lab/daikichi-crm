'use client';
// 課題の作成/編集フォーム（mockups/task-form.html の React 移植）。
// 顧客の課題＝企業を選ぶまで他の欄をロック（gated）。所内の課題＝最初から入力可。
// 親課題・議事録・資料は選択した企業/スコープのものだけに絞る（app_task_form_lookup）。
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useUI } from '@/components/ui';
import { Icon } from '@/components/icons';
import { createTaskAction, updateScheduleItemAction, taskFormLookupAction } from './actions';
import { KINDS, STATUSES } from './task-utils';

type User = { id: string; name: string };
type Company = { id: string; name: string; industry: string | null };
type Opt = { id: string; title: string };
type Lookup = { parents: Opt[]; notes: Opt[]; docs: Opt[] };
type Scope = 'client' | 'internal';

export type TaskFormInitial = {
  id: string; title: string; scope: Scope; kind: string; status: string; source: string;
  company_id: string | null; company: string | null;
  parent: { id: string; title: string } | null;
  assignee_id: string | null; start_date: string | null; due_date: string | null;
  own_progress: number; description: string | null;
  extra?: { note?: Opt; doc?: Opt; repeat?: string };
};

export type ParentPreset = { id: string; title: string; scope: Scope; company_id: string | null; company: string | null };

const EMPTY_LOOKUP: Lookup = { parents: [], notes: [], docs: [] };
const PROGRESS_OPTS = [0, 25, 50, 75, 100];
const REPEAT_OPTS = ['なし', '毎週', '毎月', '毎年'];

export function TaskForm({ users, companies, mode, initial, parentPreset }: {
  users: User[]; companies: Company[]; mode: 'create' | 'edit';
  initial?: TaskFormInitial; parentPreset?: ParentPreset | null;
}) {
  const router = useRouter();
  const { toast } = useUI();
  const isEdit = mode === 'edit';
  const locked = isEdit && initial?.source === '自動'; // 自動生成は題名・種別・日付を変更不可（RPC側でも強制）

  const [scope, setScope] = useState<Scope>(initial?.scope ?? parentPreset?.scope ?? 'client');
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(
    initial?.company_id ? { id: initial.company_id, name: initial.company ?? '' }
      : parentPreset?.company_id ? { id: parentPreset.company_id, name: parentPreset.company ?? '' } : null,
  );
  const [query, setQuery] = useState(picked?.name ?? '');
  const [comboOpen, setComboOpen] = useState(false);
  const [lookup, setLookup] = useState<Lookup>(EMPTY_LOOKUP);
  const [busy, setBusy] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [f, setF] = useState({
    title: initial?.title ?? '',
    parent_id: initial?.parent?.id ?? parentPreset?.id ?? '',
    kind: initial?.kind ?? (scope === 'internal' ? '所内業務' : '手動タスク'),
    assignee: initial?.assignee_id ?? '',
    start_date: initial?.start_date ?? '',
    due_date: initial?.due_date ?? '',
    status: initial?.status ?? '未対応',
    progress: initial?.own_progress ?? 0,
    repeat: initial?.extra?.repeat ?? 'なし',
    description: initial?.description ?? '',
    note_id: initial?.extra?.note?.id ?? '',
    doc_id: initial?.extra?.doc?.id ?? '',
  });
  const set = (patch: Partial<typeof f>) => setF((s) => ({ ...s, ...patch }));

  const gateOpen = scope === 'internal' || !!picked;
  const parentFixed = !!parentPreset || isEdit;

  // 企業/スコープが決まったら、親課題・議事録・資料をその範囲に絞って取得
  useEffect(() => {
    let alive = true;
    const company = scope === 'client' ? picked?.id : undefined;
    if (scope === 'client' && !company) { setLookup(EMPTY_LOOKUP); return; }
    taskFormLookupAction(company, scope).then((r) => { if (alive) setLookup({ ...EMPTY_LOOKUP, ...r }); });
    return () => { alive = false; };
  }, [scope, picked?.id]);

  const hits = companies.filter((c) => !query.trim() || c.name.includes(query.trim()));

  const pickCompany = (c: Company) => {
    setPicked({ id: c.id, name: c.name });
    setQuery(c.name);
    setComboOpen(false);
    if (!parentFixed) set({ parent_id: '' });
    toast(`${c.name} を選択しました`);
  };

  const switchScope = (s: Scope) => {
    if (parentFixed) return;
    setScope(s);
    set({ kind: s === 'internal' ? '所内業務' : '手動タスク', parent_id: '', note_id: '', doc_id: '' });
    if (s === 'internal') setComboOpen(false);
  };

  const submit = async () => {
    if (scope === 'client' && !picked && !parentPreset) { toast('先に企業を選択してください'); return; }
    if (!f.title.trim()) { toast('題名を入力してください'); return; }
    setBusy(true);
    const extra: Record<string, unknown> = {};
    const note = lookup.notes.find((n) => n.id === f.note_id) ?? (f.note_id ? initial?.extra?.note : undefined);
    const doc = lookup.docs.find((d) => d.id === f.doc_id) ?? (f.doc_id ? initial?.extra?.doc : undefined);
    if (note) extra.note = note;
    if (doc) extra.doc = doc;
    if (f.repeat && f.repeat !== 'なし') extra.repeat = f.repeat;
    const payload = {
      title: f.title.trim(), kind: f.kind, description: f.description,
      start_date: f.start_date, due_date: f.due_date,
      assignee: f.assignee, status: f.status, progress: f.progress, extra,
    };
    try {
      if (isEdit) {
        const r = await updateScheduleItemAction(initial!.id, payload);
        if (r?.error) { toast(r.error); return; }
        toast('課題を更新しました');
        router.push(`/schedule/${initial!.id}`);
      } else {
        const r = await createTaskAction({
          ...payload,
          scope,
          company_id: scope === 'client' ? picked?.id : undefined,
          parent_id: f.parent_id || undefined,
        });
        if (r?.error) { toast(r.error); return; }
        toast('課題を作成しました');
        router.push(r?.id ? `/schedule/${r.id}` : '/schedule');
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const companyHint = scope === 'internal'
    ? '所内の課題は企業に紐づきません（大吉会計（所内）として登録）'
    : picked
      ? `${picked.name} の課題として作成します${parentFixed ? '' : '（変更するときは入力し直し）'}`
      : '先に企業を選択すると、残りの項目が入力できます（顧客名簿から検索）';

  return (
    <>
      <div className="panel">
        <div className="panel-head"><h3>区分</h3></div>
        <div className="panel-body">
          <div className="scope-pick" style={parentFixed ? { opacity: .6, pointerEvents: 'none' } : undefined}>
            <label className={scope === 'client' ? 'on' : ''}>
              <input type="radio" name="scope" checked={scope === 'client'} onChange={() => switchScope('client')} />
              <span><span className="tt">顧客の課題</span><span className="dd">企業(顧問先・見込み客)に紐づく仕事。決算・申告・資料回収・フォロー連絡など。</span></span>
            </label>
            <label className={scope === 'internal' ? 'on' : ''}>
              <input type="radio" name="scope" checked={scope === 'internal'} onChange={() => switchScope('internal')} />
              <span><span className="tt"><span className="seal-mini">大</span>所内の課題</span><span className="dd">大吉会計の所内業務。月次締め・メルマガ・研修・採用など、企業に紐づかない仕事。</span></span>
            </label>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>基本情報</h3></div>
        <div className="panel-body">
          <div className="field col-2" style={{ marginBottom: 16, opacity: scope === 'internal' ? .5 : 1 }}>
            <label>企業 {scope === 'client' && <span className="req">*</span>}</label>
            <div className={`combo${picked ? ' done' : ''}`}>
              <div className="cbx-in">
                <span className="mag"><Icon name="search" size={14} /></span>
                <input
                  className="input"
                  placeholder="企業名で検索…（例: 海風 / みどり / 北斗）"
                  autoComplete="off"
                  disabled={scope === 'internal' || parentFixed || isEdit}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPicked(null); setComboOpen(true); }}
                  onFocus={() => { if (scope === 'client') setComboOpen(true); }}
                  onBlur={() => { blurTimer.current = setTimeout(() => setComboOpen(false), 140); }}
                />
                <span className="picked">✓</span>
              </div>
              {comboOpen && scope === 'client' && (
                <div className="cbx-list">
                  {hits.length === 0
                    ? <div className="cbx-empty">該当する企業がありません（<Link href="/companies/new">＋ 新規企業を登録</Link>）</div>
                    : hits.map((c) => (
                      <div key={c.id} className="cbx-item" onMouseDown={() => pickCompany(c)}>
                        <b>{c.name}</b><span className="sub">{c.industry ?? ''}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
            <span className="hint">{companyHint}</span>
          </div>

          <div className={`gated${gateOpen ? '' : ' off'}`}>
            <div className="form-grid">
              <div className="field col-2">
                <label>題名 <span className="req">*</span></label>
                <input className="input" placeholder="例: 法人税・消費税 申告（4月決算）／ 5月分 記帳資料の回収" value={f.title} disabled={locked} onChange={(e) => set({ title: e.target.value })} />
              </div>
              <div className="field">
                <label>親課題</label>
                {parentFixed
                  ? <input className="input" value={initial?.parent?.title ?? parentPreset?.title ?? 'なし（トップレベルの課題）'} disabled />
                  : (
                    <select className="select" value={f.parent_id} onChange={(e) => set({ parent_id: e.target.value })}>
                      <option value="">なし（トップレベルの課題）</option>
                      {lookup.parents.length === 0
                        ? <option disabled>{scope === 'internal' ? '所内の親課題はまだありません' : 'この企業の親課題はまだありません'}</option>
                        : lookup.parents.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  )}
                <span className="hint">選ぶと<b>子課題</b>として作成。{scope === 'internal' ? '所内' : 'この企業'}の課題だけが選べます</span>
              </div>
              <div className="field">
                <label>種別</label>
                <select className="select" value={f.kind} disabled={locked} onChange={(e) => set({ kind: e.target.value })}>
                  {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div className="field">
                <label>担当</label>
                <select className="select" value={f.assignee} onChange={(e) => set({ assignee: e.target.value })}>
                  <option value="">（未定）</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>状態</label>
                <select className="select" value={f.status} onChange={(e) => set({ status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label>開始日</label>
                <input className="input num" type="date" value={f.start_date} disabled={locked} onChange={(e) => set({ start_date: e.target.value })} />
              </div>
              <div className="field">
                <label>期日</label>
                <input className="input num" type="date" value={f.due_date} disabled={locked} onChange={(e) => set({ due_date: e.target.value })} />
                <span className="hint">一覧・ボード・ガント・カレンダーに反映。「あと◯日」を自動表示</span>
              </div>
              <div className="field">
                <label>進捗</label>
                <select className="select" value={String(f.progress)} onChange={(e) => set({ progress: +e.target.value })}>
                  {PROGRESS_OPTS.map((p) => <option key={p} value={p}>{p}%</option>)}
                </select>
                <span className="hint">子課題を持つ親課題では自動集計のため入力不要</span>
              </div>
              <div className="field">
                <label>繰り返し</label>
                <select className="select" value={f.repeat} onChange={(e) => set({ repeat: e.target.value })}>
                  {REPEAT_OPTS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <span className="hint">月次締め・源泉納付などの定例業務の目印（自動生成は今後対応）</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>詳細（説明）</h3></div>
        <div className={`panel-body gated${gateOpen ? '' : ' off'}`}>
          <div className="field col-2" style={{ marginBottom: 14 }}>
            <label>説明</label>
            <textarea
              className="input" rows={7}
              placeholder={'仕事の内容・手順・注意点・完了の条件などを記載します。\n\n例:\n・4月決算の法人税・消費税の申告一式。\n・電子申告は e-Tax / eLTAX。納付書の送付は不要（ダイレクト納付設定済み）。\n・完了条件: 受信通知の保存＋お客様への納付案内メール送信まで。'}
              value={f.description}
              onChange={(e) => set({ description: e.target.value })}
            />
            <span className="hint">チェックリストや関連資料のURLも書けます。議事録・資料は下の関連リンクで紐付け</span>
          </div>
          <div className="form-grid">
            <div className="field">
              <label>関連する議事録</label>
              <select className="select" value={f.note_id} onChange={(e) => set({ note_id: e.target.value })}>
                <option value="">（なし）</option>
                {lookup.notes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
              </select>
              <span className="hint">{scope === 'internal' ? '所内' : 'この企業'}に保存されている議事録だけが選べます</span>
            </div>
            <div className="field">
              <label>関連する資料</label>
              <select className="select" value={f.doc_id} onChange={(e) => set({ doc_id: e.target.value })}>
                <option value="">（なし）</option>
                {lookup.docs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
              <span className="hint">{scope === 'internal' ? '所内' : 'この企業'}に保存されている資料だけが選べます</span>
            </div>
          </div>
          <div className="banner info mt16">
            <span>ⓘ</span>
            <div>決算・申告の課題は<b>決算月から自動生成</b>もされます（親課題＋子課題のテンプレート）。ここでは自動生成に無い課題を手動で追加します。</div>
          </div>
        </div>
      </div>

      <div className="row mt16" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <Link className="btn" href={isEdit ? `/schedule/${initial!.id}` : '/schedule'}>キャンセル</Link>
        <button className="btn btn-primary" disabled={busy} onClick={submit}>{isEdit ? '保存' : '作成'}</button>
      </div>
    </>
  );
}
