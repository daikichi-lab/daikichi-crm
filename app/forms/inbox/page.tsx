import './forms-inbox.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { listFormSubmissions, detectDuplicateCompany } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/icons';
import { GuideButton } from '@/components/GuideButton';
import { TypeBadge, TagChips, UserAvatar } from '@/components/ui-bits';
import { InboxFilter, ImportButton, DiscardButton, CopyUrlButton } from './parts';

type SP = { [k: string]: string | undefined };

const PUBLIC_FORM_URL = '/form';
const STATUS_LABEL: Record<string, string> = { 未対応: '未確認', 取込済: '取込済', 破棄: '対応不要' };

type Submission = {
  id: string;
  payload: Record<string, any>;
  status: string;
  matched_company_id: string | null;
  created_at: string;
};

export default async function FormInboxPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const sp = await searchParams;

  const res = await listFormSubmissions(sp.status || undefined);
  let items: Submission[] = res.items ?? [];

  // 種別での絞り込み（payload.type）
  if (sp.type) items = items.filter((s) => (s.payload?.type ?? '法人') === sp.type);

  // 未対応の各回答について重複検出（既存企業との突合）
  const dupChecks = await Promise.all(
    items.map((s) =>
      s.status === '未対応'
        ? detectDuplicateCompany(String(s.payload?.name ?? ''), s.payload?.email)
        : Promise.resolve([]),
    ),
  );
  const dupCount = dupChecks.filter((d) => Array.isArray(d) && d.length > 0).length;

  // 今月の取込件数
  const ym = new Date().toISOString().slice(0, 7).replace('-', '-');
  const importedThisMonth = items.filter((s) => s.status === '取込済' && (s.created_at ?? '').startsWith(ym.slice(0, 7))).length;

  const topbar = (
    <>
      <h1>フォーム</h1>
      <div className="spacer" />
      <Link className="btn btn-sm btn-primary" href="/forms/edit"><Icon name="gear" size={15} />フォームを編集</Link>
      <Link className="btn btn-sm" href={PUBLIC_FORM_URL} target="_blank">プレビュー ↗</Link>
      <CopyUrlButton url={PUBLIC_FORM_URL} />
      <GuideButton title="フォーム回答の使い方">
        <p>公開フォームからの回答を確認し、顧客に取り込む画面です。</p>
        <ul>
          <li>回答は<b>いったん受信箱に貯まり</b>、直接は顧客データに入りません（安全）。</li>
          <li><b>取込</b>で企業＋担当者として登録。似た会社は<b>重複の可能性</b>として警告します。</li>
          <li>右上から<b>公開フォームのプレビュー／URLコピー</b>。</li>
        </ul>
      </GuideButton>
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="forms" topbar={topbar}>
      <div className="page-head">
        <div>
          <h2>顧客情報フォーム — 回答受信箱</h2>
          <div className="sub">公開フォームの回答を確認し、顧客（企業＋担当者）として取り込みます。直接DBには書き込まれません（スタッフ確認制）。</div>
        </div>
      </div>

      <nav className="admin-tabs">
        <Link href="/forms/inbox" className="on">回答受信箱</Link>
        <Link href="/forms/edit">フォーム編集</Link>
        <Link href={PUBLIC_FORM_URL} target="_blank">公開フォームを開く ↗</Link>
      </nav>

      <div className="banner info">
        <Icon name="building" size={16} />
        <div>回答は <span className="b">form_submissions</span>（anon INSERT のみ許可・RLSで保護）に入り、<span className="b">companies へ直書きしません</span>。スタッフが「取込」すると重複検出のうえ企業＋担当者を作成します。スパム対策にCAPTCHA／レート制限。</div>
      </div>

      <div className="stats mt16" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="stat"><div className="k">未確認</div><div className="v num">{res.pending}</div></div>
        <div className="stat gold"><div className="k">重複の可能性</div><div className="v num">{dupCount}</div></div>
        <div className="stat"><div className="k">今月の取込</div><div className="v num">{importedThisMonth}</div></div>
      </div>

      <div className="panel mt16">
        <InboxFilter />
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>受信</th><th>会社 / 担当者</th><th>種別</th><th>連絡先</th><th>求 / 提</th><th>状態</th><th className="right">操作</th></tr></thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 28 }}>該当する回答がありません。</td></tr>
              )}
              {items.map((s, i) => {
                const p = s.payload ?? {};
                const dup = Array.isArray(dupChecks[i]) && dupChecks[i].length > 0;
                const type = p.type ?? '法人';
                const isPending = s.status === '未対応';
                return (
                  <tr key={s.id} style={dup && isPending ? { cursor: 'default', background: 'var(--amber-50)' } : { cursor: 'default' }}>
                    <td className="num muted">{s.created_at}</td>
                    <td><span className="name">{p.name ?? '(無名)'}</span><br /><span className="muted" style={{ fontSize: 12 }}>{p.contact ?? ''}</span></td>
                    <td><TypeBadge type={type} /></td>
                    <td className="num" style={{ fontSize: 12 }}>{p.email ?? ''}{p.phone ? <><br />{p.phone}</> : null}</td>
                    <td><TagChips needs={p.needs ?? []} offers={p.offers ?? []} /></td>
                    <td>
                      {s.status === '取込済' ? (
                        <span className="badge done2"><span className="dot" />取込済</span>
                      ) : dup && isPending ? (
                        <span className="badge dup"><span className="dot" />重複の可能性</span>
                      ) : s.status === '破棄' ? (
                        <span className="badge off"><span className="dot" />対応不要</span>
                      ) : (
                        <span className="badge new"><span className="dot" />未確認</span>
                      )}
                    </td>
                    <td className="right" style={{ whiteSpace: 'nowrap' }}>
                      {s.status === '取込済' ? (
                        s.matched_company_id
                          ? <Link className="btn btn-sm" href={`/companies/${s.matched_company_id}`}>顧客を開く</Link>
                          : <span className="muted" style={{ fontSize: 12 }}>取込済</span>
                      ) : s.status === '破棄' ? (
                        <span className="muted" style={{ fontSize: 12 }}>—</span>
                      ) : (
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <ImportButton id={s.id} name={p.name ?? '(無名)'} contact={p.contact ?? ''} duplicate={dup} />
                          <DiscardButton id={s.id} name={p.name ?? '(無名)'} />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="tfoot"><span className="num">{res.count} 件中 1–{items.length} を表示</span></div>
      </div>
    </AppShell>
  );
}
