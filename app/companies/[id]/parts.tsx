'use client';

import Link from 'next/link';
import { Fragment, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useUI } from '@/components/ui';
import { Icon } from '@/components/icons';
import { StatusBadge, TagChip } from '@/components/ui-bits';
import { setPrimaryContactAction, createCompanyTaskAction } from './actions';

type Contact = {
  id: string; name: string; kana: string | null; title: string | null; department: string | null;
  is_primary: boolean; email: string | null; phone: string | null; mobile: string | null;
};
type Doc = { company: string; company_id: string; file_name: string; category: string; size: string; uploaded_by: string | null; created_at: string };
type ScheduleItem = { id: string; title: string; due_date: string | null; assignee: string | null; source: string; bucket: string; kind: string };
type TimelineItem = { when: string; kind: string; title: string; status: string | null; contact: string | null; actor: string | null; source: string };
type NoteRow = { id: string; title: string; summary: string | null; occurred_at: string; source: string };
type ReferralItem = { id: string; from: string; from_id: string; to: string; to_id: string; kind: string; matched_tags: string[]; status: string; by: string | null; created_at: string };

type Tab = 'overview' | 'contacts' | 'files' | 'notes' | 'referrals';

const FT: Record<string, { cls: string; label: string }> = {
  pdf: { cls: 'ft-pdf', label: 'PDF' }, jpg: { cls: 'ft-img', label: 'JPG' }, jpeg: { cls: 'ft-img', label: 'JPG' },
  png: { cls: 'ft-img', label: 'PNG' }, xlsx: { cls: 'ft-xls', label: 'XLS' }, xls: { cls: 'ft-xls', label: 'XLS' },
  docx: { cls: 'ft-doc', label: 'DOC' }, doc: { cls: 'ft-doc', label: 'DOC' },
};
function fileType(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return FT[ext] ?? { cls: 'ft-etc', label: ext ? ext.slice(0, 3).toUpperCase() : 'FILE' };
}

const CAT_DOT: Record<string, string> = {
  契約書: 'var(--gold-600)', 決算書: 'var(--brand-600)', '商品・サービス資料': 'var(--green-600)',
  提案資料: 'var(--brand-500)', その他: 'var(--ink-3)',
};

type Overview = {
  industry: string | null; area: string | null; size: string | null; status: string; owner: string | null;
  needs: string[]; offers: string[]; notes: string | null; extra: Record<string, unknown>; fiscalMonth: number | null;
  idLabel: string;
  summary: { contacts: number; cards: number; documents: number; documentsSize: string; notes: number; referrals: number; registered: string; updated: string };
  nextMeeting: { title: string; start: string; location: string | null; id: string } | null;
};

export function CompanyTabs(props: {
  companyId: string; companyName: string;
  contacts: Contact[]; cardsCount: number;
  documents: Doc[]; documentsCount: number; documentsSize: string;
  schedule: ScheduleItem[]; timeline: TimelineItem[]; notes: NoteRow[]; referrals: ReferralItem[];
  documentCategories: string[]; overview: Overview;
}) {
  const initial = (typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '') as Tab;
  const valid: Tab[] = ['overview', 'contacts', 'files', 'notes', 'referrals'];
  const [tab, setTab] = useState<Tab>(valid.includes(initial) ? initial : 'overview');
  const [cat, setCat] = useState<string>('すべて');

  const show = (t: Tab) => { setTab(t); try { history.replaceState(null, '', '#' + t); } catch {} };

  const tabBtn = (t: Tab, label: string, count?: number) => (
    <button className={tab === t ? 'on' : ''} onClick={() => show(t)}>
      {label}{count != null && <span className="ct num">{count}</span>}
    </button>
  );

  return (
    <>
      <nav className="tabs">
        {tabBtn('overview', '概要')}
        {tabBtn('contacts', '担当者', props.contacts.length)}
        {tabBtn('files', '資料', props.documentsCount)}
        {tabBtn('notes', '議事録', props.notes.length)}
        {tabBtn('referrals', '紹介履歴', props.referrals.length)}
      </nav>

      {tab === 'overview' && (
        <OverviewPane companyId={props.companyId} overview={props.overview} schedule={props.schedule} timeline={props.timeline} />
      )}

      {tab === 'contacts' && (
        <ContactsPane companyId={props.companyId} companyName={props.companyName} contacts={props.contacts} />
      )}

      {tab === 'files' && (
        <FilesPane documents={props.documents} count={props.documentsCount} size={props.documentsSize} cat={cat} setCat={setCat} categories={props.documentCategories} />
      )}

      {tab === 'notes' && <NotesPane notes={props.notes} />}

      {tab === 'referrals' && <ReferralsPane companyName={props.companyName} referrals={props.referrals} />}
    </>
  );
}

const BUCKET_BADGE: Record<string, { label: string; style: React.CSSProperties; cls?: string }> = {
  overdue: { label: '遅延', style: { background: 'var(--red-50)', color: 'var(--red-700)', borderColor: '#f0c9c4', flex: 'none' } },
  week: { label: '今週', style: { flex: 'none' }, cls: 'prospect' },
  month: { label: '今月', style: { flex: 'none' }, cls: 'dormant' },
  later: { label: '予定', style: { flex: 'none' }, cls: 'dormant' },
  done: { label: '完了', style: { flex: 'none' }, cls: 'active' },
};

function OverviewPane({ companyId, overview: o, schedule, timeline }: { companyId: string; overview: Overview; schedule: ScheduleItem[]; timeline: TimelineItem[] }) {
  const website = (o.extra?.website as string | undefined) ?? undefined;
  const sns = (o.extra?.sns as Record<string, string> | undefined) ?? undefined;
  const extraEntries = Object.entries(o.extra ?? {}).filter(([k]) => k !== 'website' && k !== 'sns');
  return (
    <div className="grid-2">
      <div>
        <div className="panel">
          <div className="panel-head"><h3>企業情報</h3><span className="count num">ID {o.idLabel}</span></div>
          <div className="panel-body">
            <div className="ledger">
              <dl className="kv">
                <dt>業種</dt><dd>{o.industry ?? '—'}</dd>
                <dt>エリア</dt><dd>{o.area ?? '—'}</dd>
                <dt>規模</dt><dd className="num">{o.size ?? '—'}</dd>
                <dt>社内担当</dt><dd>{o.owner ?? '—'}</dd>
                <dt>ステータス</dt><dd><StatusBadge status={o.status} /></dd>
              </dl>
              <div className="mt16">
                <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>求めてること / 提供できること</div>
                <div className="chips">
                  {o.needs.map((t) => <TagChip key={'n' + t} label={t} kind="need" />)}
                  {o.offers.map((t) => <TagChip key={'o' + t} label={t} kind="offer" />)}
                  {o.needs.length === 0 && o.offers.length === 0 && <span className="muted">未設定</span>}
                </div>
              </div>
              {o.notes && (
                <div className="mt16">
                  <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>メモ</div>
                  <div>{o.notes}</div>
                </div>
              )}
              {(website || sns) && (
                <div className="mt16">
                  <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Web・SNS</div>
                  <div className="row" style={{ gap: 8 }}>
                    {website && <a className="btn btn-sm" href={website} target="_blank" rel="noopener">🌐 公式サイト</a>}
                    {sns && Object.entries(sns).map(([k, v]) => <a key={k} className="btn btn-sm" href={v} target="_blank" rel="noopener">{k}</a>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="panel">
          <div className="panel-head"><h3>サマリ</h3></div>
          <div className="panel-body">
            <dl className="kv">
              <dt>担当者</dt><dd className="num">{o.summary.contacts} 名</dd>
              <dt>名刺</dt><dd className="num">{o.summary.cards} 枚</dd>
              <dt>資料</dt><dd className="num">{o.summary.documents} 件 <span className="muted">/ {o.summary.documentsSize}</span></dd>
              <dt>議事録</dt><dd className="num">{o.summary.notes} 件</dd>
              <dt>紹介履歴</dt><dd className="num">{o.summary.referrals} 件</dd>
              <dt>登録日</dt><dd className="num">{o.summary.registered}</dd>
              <dt>最終更新</dt><dd className="num">{o.summary.updated}</dd>
            </dl>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h3>期限・タスク</h3><Link className="right" href={`/schedule?company=${companyId}`}>すべて見る</Link></div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
            {schedule.length === 0 && <div className="muted">この企業の期限・タスクはありません。</div>}
            {schedule.slice(0, 5).map((s) => {
              const b = BUCKET_BADGE[s.bucket] ?? BUCKET_BADGE.later;
              return (
                <div key={s.id} className="row" style={{ gap: 8, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                  <span className={`badge ${b.cls ?? ''}`} style={b.style}>{b.cls && <span className="dot" />}{b.label}</span>
                  <span style={{ flex: 1, minWidth: 0 }}><span className="b">{s.title}</span><br /><span className="muted" style={{ fontSize: 12 }}>期日 {s.due_date ?? '未設定'} ・ 担当 {s.assignee ?? '—'}（{s.source === 'auto' ? '自動生成' : '手動タスク'}）</span></span>
                </div>
              );
            })}
            <AddTaskButton companyId={companyId} />
          </div>
        </div>
        {extraEntries.length > 0 && (
          <div className="panel">
            <div className="panel-head"><h3>追加項目（extra）</h3></div>
            <div className="panel-body">
              <dl className="kv">
                {extraEntries.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{String(v)}</dd></Fragment>)}
              </dl>
              <Link className="btn btn-sm btn-ghost mt8" href={`/companies/${companyId}/edit`}>＋ 項目を追加</Link>
            </div>
          </div>
        )}
        <div className="panel">
          <div className="panel-head"><h3>この企業のタイムライン</h3><Link className="right" href={`/activities?company=${companyId}`}>すべて見る</Link></div>
          <div className="panel-body" style={{ padding: 0 }}>
            <div className="timeline">
              {timeline.length === 0 && <div className="panel-body"><span className="muted">活動の記録がまだありません。</span></div>}
              {timeline.slice(0, 6).map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-3)', color: 'var(--ink-2)', display: 'grid', placeItems: 'center', fontSize: 15, flex: 'none' }}>{t.source === 'auto' ? '⚡' : '🗓'}</span>
                  <span style={{ flex: 1 }}><span className="b">{t.title}</span><br /><span className="muted" style={{ fontSize: 12 }}>{t.when}{t.contact ? ` ・ ${t.contact}` : ''}</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {o.nextMeeting && (
          <div className="panel">
            <div className="panel-head"><h3>次回の打ち合わせ</h3></div>
            <div className="panel-body" style={{ fontSize: 13 }}>
              <div className="row" style={{ gap: 8 }}><span className="num b">{o.nextMeeting.start}</span>{o.nextMeeting.location && <span>🎥 {o.nextMeeting.location}</span>}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{o.nextMeeting.title}</div>
              <Link className="btn btn-sm mt8" href="/meetings">打ち合わせを開く</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ContactsPane({ companyId, companyName, contacts }: { companyId: string; companyName: string; contacts: Contact[] }) {
  const { toast } = useUI();
  const [pending, start] = useTransition();
  const router = useRouter();

  const makePrimary = (c: Contact) => start(async () => {
    await setPrimaryContactAction(c.id, companyId);
    toast(`主担当を ${c.name} に変更しました`);
    router.refresh();
  });

  return (
    <div className="panel">
      <div className="panel-head"><h3>担当者</h3><span className="count num">{contacts.length}名</span>
        <div className="actions"><Link className="btn btn-sm btn-primary" href={`/companies/${companyId}/contacts/new`}><Icon name="user" size={14} />＋ 担当者を追加</Link></div>
      </div>
      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {contacts.length === 0 && <div className="muted">担当者がまだ登録されていません。</div>}
        {contacts.map((c) => (
          <div className="contact-card" key={c.id}>
            <div className="thumb" style={{ background: 'var(--surface-3)', display: 'grid', placeItems: 'center', color: 'var(--ink-3)', fontSize: 11 }}>
              <div className="fakecard" style={{ display: 'grid', placeItems: 'center' }}>
                <div className="lines" style={{ padding: '8px 10px', fontSize: 8, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700 }}>{companyName}</div>
                  <div>{[c.department, c.title].filter(Boolean).join(' ')} {c.name}</div>
                  {c.phone && <div>{c.phone}</div>}
                </div>
              </div>
            </div>
            <div>
              <div className="who"><Link href={`/contacts/${c.id}`}>{c.name}</Link>{c.is_primary && <span className="badge prospect" style={{ height: 18, fontSize: 10 }}>主担当</span>}</div>
              <div className="role">{[c.department, c.title].filter(Boolean).join(' ') || '—'}</div>
              <div className="meta">
                {c.email && <span>✉ {c.email}</span>}
                {c.phone && <span className="num">☎ {c.phone}</span>}
              </div>
            </div>
            <div className="ops">
              {!c.is_primary && <button className="btn btn-sm" disabled={pending} onClick={() => makePrimary(c)}>★ 主担当にする</button>}
              <Link className="btn btn-sm" href={`/contacts/${c.id}`}>詳細</Link>
              <Link className="btn btn-sm" href={`/contacts/${c.id}/edit`}>編集</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilesPane({ documents, count, size, cat, setCat, categories }: { documents: Doc[]; count: number; size: string; cat: string; setCat: (c: string) => void; categories: string[] }) {
  const { toast, confirm } = useUI();
  const cats = ['すべて', ...categories];
  const catCount = (c: string) => c === 'すべて' ? documents.length : documents.filter((d) => d.category === c).length;
  const shown = cat === 'すべて' ? documents : documents.filter((d) => d.category === cat);

  return (
    <div className="panel">
      <div className="panel-head"><h3>資料・ファイル</h3><span className="count num">{count}件 ・ {size}</span>
        <div className="actions"><button className="btn btn-sm btn-primary" onClick={() => toast('ファイルを選択してアップロード（デモ）')}><Icon name="doc" size={14} />＋ アップロード</button></div>
      </div>
      <div className="panel-body">
        <label className="dropzone" onClick={() => toast('ファイル選択ダイアログ（デモ）')}>
          <div className="big">⤓</div>
          <div><b>ファイルをドラッグ＆ドロップ</b> または クリックして選択</div>
          <div className="muted" style={{ fontSize: 12 }}>PDF / JPG / PNG / Excel / Word ・ 1ファイル最大 20MB</div>
        </label>

        <div className="catfilter">
          {cats.map((c) => (
            <button key={c} className={`cf ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c} <span className="num">{catCount(c)}</span></button>
          ))}
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>ファイル</th><th>種別</th><th className="right">サイズ</th><th>登録日</th><th>登録者</th><th className="right">操作</th></tr></thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>該当する資料がありません。</td></tr>}
              {shown.map((d, i) => {
                const ft = fileType(d.file_name);
                return (
                  <tr key={i} onClick={() => confirm({ title: 'プレビュー: ' + d.file_name, body: '署名URL（短い有効期限）で取得したファイルをビューア表示します（PDF・画像）。デモのため本文プレビューは省略しています。', confirmLabel: 'ダウンロード', onConfirm: () => toast('署名URLを発行しました（ダウンロード開始）') })}>
                    <td><div className="fname"><span className={`ft ${ft.cls}`}>{ft.label}</span><span className="nm">{d.file_name}</span></div></td>
                    <td><span className="cat"><span className="d" style={{ background: CAT_DOT[d.category] ?? 'var(--ink-3)' }} />{d.category}</span></td>
                    <td className="right num">{d.size}</td>
                    <td className="num muted">{d.created_at}</td>
                    <td className="muted">{d.uploaded_by ?? '—'}</td>
                    <td className="right" style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); confirm({ title: 'プレビュー: ' + d.file_name, body: '署名URLで取得したファイルをビューア表示します。', confirmLabel: 'ダウンロード', onConfirm: () => toast('署名URLを発行しました（ダウンロード開始）') }); }}>プレビュー</button>
                      <button className="btn btn-sm btn-icon" title="ダウンロード" onClick={(e) => { e.stopPropagation(); toast('署名URLを発行しました（ダウンロード開始）'); }}>⤓</button>
                      <button className="btn btn-sm btn-icon btn-danger" title="削除" onClick={(e) => { e.stopPropagation(); confirm({ title: '資料を削除しますか？', body: `「${d.file_name}」をゴミ箱へ移動します。発行済みの署名URLは無効化されます。`, confirmLabel: '削除', danger: true, onConfirm: () => toast('資料を削除しました') }); }}>🗑</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="banner info mt16"><span>ⓘ</span><div>資料は<b>非公開バケット</b>に保存し、閲覧・ダウンロードは<b>有効期限つき署名URL</b>でのみ取得します（名刺画像と同じ仕組み・SEC-9/12）。企業を削除すると配下の資料も非表示になります。ストレージは無料枠（約1GB）で運用し、上限接近時に警告します。</div></div>
      </div>
    </div>
  );
}

function NotesPane({ notes }: { notes: NoteRow[] }) {
  return (
    <div className="panel">
      <div className="panel-head"><h3>議事録</h3><span className="count num">{notes.length}件</span>
        <div className="actions"><Link className="btn btn-sm" href="/notes">議事録一覧へ</Link><Link className="btn btn-sm btn-primary" href="/notes"><Icon name="doc" size={14} />＋ 取り込む</Link></div>
      </div>
      {notes.length === 0 && <div className="panel-body"><div className="muted">議事録がまだありません。</div></div>}
      {notes.map((n) => (
        <Link key={n.id} href={`/notes/${n.id}`} className="nrow" style={{ color: 'inherit' }}>
          <div className={`ic ${n.source === 'auto' ? 'auto' : 'manual'}`}>{n.source === 'auto' ? '⚡' : '📋'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="b">{n.title}</div>
            {n.summary && <div className="sum">{n.summary}</div>}
            <div className="foot"><span className="num">{n.occurred_at}</span><span>・ {n.source === 'auto' ? '自動保存' : '手で取込'}</span></div>
          </div>
          <span className="muted" style={{ alignSelf: 'center' }}>›</span>
        </Link>
      ))}
    </div>
  );
}

function ReferralsPane({ companyName, referrals }: { companyName: string; referrals: ReferralItem[] }) {
  const router = useRouter();
  const statusBadge = (s: string) => {
    const cls = s === '成立' ? 'active' : s === '打診中' ? 'talking' : 'dormant';
    return <span className={`badge ${cls}`}><span className="dot" />{s}</span>;
  };
  const me = companyName.replace(/^株式会社\s*|^合同会社\s*/, '');
  return (
    <div className="panel">
      <div className="panel-head"><h3>紹介履歴</h3><span className="count num">{referrals.length}件</span>
        <div className="actions"><Link className="btn btn-sm" href="/referrals">紹介一覧へ</Link><Link className="btn btn-sm btn-primary" href="/matching"><Icon name="link" size={14} />マッチングから起票</Link></div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>紹介（from → to）</th><th>種別</th><th>根拠タグ</th><th>ステータス</th><th>起票者</th><th className="right">起票日</th></tr></thead>
          <tbody>
            {referrals.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>紹介履歴がありません。</td></tr>}
            {referrals.map((r) => {
              const fromMe = r.from === companyName;
              return (
                <tr key={r.id} onClick={() => router.push('/referrals')} style={{ cursor: 'pointer' }}>
                  <td><span className="flow">
                    <span className={fromMe ? 'me' : 'linkish'}>{fromMe ? me : r.from}</span>
                    <span className="arr">→</span>
                    <span className={!fromMe ? 'me' : 'linkish'}>{!fromMe ? me : r.to}</span>
                  </span></td>
                  <td><span className={`kind-pill ${r.kind === '顧客紹介' ? 'intro' : 'collab'}`}>{r.kind}</span></td>
                  <td><div className="chips">{r.matched_tags.map((t, i) => <span key={i} className="chip need" style={{ height: 20 }}><span className="mk">求</span>{t}</span>)}</div></td>
                  <td>{statusBadge(r.status)}</td>
                  <td>{r.by ?? '—'}</td>
                  <td className="right num muted">{r.created_at}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="tfoot"><span className="legend"><span className="kind-pill collab" style={{ height: 18 }}>協業先紹介＝相手を紹介してもらう</span><span className="kind-pill intro" style={{ height: 18 }}>顧客紹介＝自社の顧客を紹介する</span></span></div>
    </div>
  );
}

export function DeleteCompanyButton({ id, name, action }: { id: string; name: string; action: (id: string) => Promise<void> }) {
  const { confirm } = useUI();
  return (
    <button className="btn btn-sm btn-danger" onClick={() => confirm({
      title: 'ゴミ箱へ移動しますか？',
      body: `「${name}」と配下の担当者・名刺を非表示にします。ゴミ箱からいつでも復元できます。`,
      confirmLabel: 'ゴミ箱へ移動', danger: true,
      onConfirm: async () => { await action(id); },
    })}>削除</button>
  );
}

export function AddTaskButton({ companyId }: { companyId: string }) {
  const { confirm, toast } = useUI();
  const [, start] = useTransition();
  return (
    <button className="btn btn-sm btn-ghost" onClick={() => confirm({
      title: 'タスクを追加',
      body: <TaskForm />,
      confirmLabel: '追加',
      onConfirm: () => {
        const title = (document.getElementById('task-title') as HTMLInputElement | null)?.value?.trim() ?? '';
        const due = (document.getElementById('task-due') as HTMLInputElement | null)?.value ?? '';
        if (!title) { toast('内容を入力してください'); return; }
        start(async () => { await createCompanyTaskAction(companyId, title, due); toast('タスクを追加しました'); });
      },
    })}>＋ タスクを追加</button>
  );
}
function TaskForm() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="muted" style={{ fontSize: 12 }}>この企業に紐づく手動タスク（内容・期日）を追加します。</div>
      <div className="field"><label htmlFor="task-title">内容</label><input id="task-title" className="input" placeholder="例: 試算表の確認・送付" /></div>
      <div className="field"><label htmlFor="task-due">期日</label><input id="task-due" className="input" type="date" /></div>
    </div>
  );
}
