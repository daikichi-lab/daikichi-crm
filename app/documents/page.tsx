import './documents.css';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { searchDocuments } from '@/lib/data/dal';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/icons';
import { TourButton, type GuideTourStep } from '@/components/TourButton';
import { UserAvatar } from '@/components/ui-bits';
import { DocumentFilterBar, DocRow } from './parts';
import type { DocumentMeta } from '@/lib/data/types';

const GUIDE_TOUR: GuideTourStep[] = [
  { sel: '.stats', title: '全社の保管状況',
    body: '件数と合計容量（無料枠1GBの目安バー）を確認できます。' },
  { sel: '.filterbar', title: '会社横断で検索',
    body: 'ファイル名・種別・会社・登録者で絞り込み。アップロードは各企業詳細の資料タブから。' },
  { sel: '.table-wrap', title: '行クリックでプレビュー',
    body: '閲覧・ダウンロードは有効期限つき<b>署名URL</b>（非公開バケット）で安全に。' },
  { title: 'Claudeからも同じ検索',
    body: '同じ検索は手元のClaude（MCP: search_documents）からも<b>同一結果</b>になります（メタ情報のみ）。' },
];


type SP = { [k: string]: string | undefined };

const CAT_COLOR: Record<string, string> = {
  契約書: 'var(--gold-600)', 決算書: 'var(--brand-600)', ' 商品・サービス資料': 'var(--green-600)',
  '商品・サービス資料': 'var(--green-600)', 提案資料: 'var(--brand-500)', その他: 'var(--ink-3)',
};
function fileType(name: string): { cls: string; label: string } {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return { cls: 'ft-pdf', label: 'PDF' };
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return { cls: 'ft-img', label: ext === 'png' ? 'PNG' : 'JPG' };
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { cls: 'ft-xls', label: 'XLS' };
  if (['doc', 'docx'].includes(ext)) return { cls: 'ft-doc', label: 'DOC' };
  return { cls: 'ft-etc', label: (ext || 'FILE').slice(0, 3).toUpperCase() };
}
function sizeToKb(s: string): number {
  const m = (s || '').match(/([\d.]+)\s*(KB|MB|GB|B)?/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const u = (m[2] || 'KB').toUpperCase();
  return u === 'GB' ? n * 1024 * 1024 : u === 'MB' ? n * 1024 : u === 'B' ? n / 1024 : n;
}

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const sp = await searchParams;

  const [res, all] = await Promise.all([
    searchDocuments({ keyword: sp.keyword, category: sp.category, company: sp.company, limit: 200 }),
    searchDocuments({ limit: 200 }),
  ]);
  let docs: DocumentMeta[] = res.documents ?? [];
  const companies = Array.from(new Set((all.documents ?? []).map((d: DocumentMeta) => d.company))).sort();

  // 並び替え（DALに無いのでここで適用）
  const sort = sp.sort ?? 'new';
  docs = [...docs].sort((a: DocumentMeta, b: DocumentMeta) => {
    if (sort === 'old') return a.created_at < b.created_at ? -1 : 1;
    if (sort === 'size') return sizeToKb(b.size) - sizeToKb(a.size);
    if (sort === 'company') return a.company.localeCompare(b.company, 'ja');
    return a.created_at < b.created_at ? 1 : -1; // new
  });

  // 容量バー（無料枠 ~1GB）
  const totalKb = (all.documents ?? []).reduce((s: number, d: DocumentMeta) => s + sizeToKb(d.size), 0);
  const capPct = Math.min(100, (totalKb / (1024 * 1024)) * 100);
  const catCount = new Set((all.documents ?? []).map((d: DocumentMeta) => d.category)).size;

  const topbar = (
    <>
      <h1>資料（全社横断）</h1>
      <form className="search" action="/documents">
        <span className="mag"><Icon name="search" size={16} /></span>
        <input name="keyword" placeholder="ファイル名で検索…（例: 商品カタログ / 決算書）" defaultValue={sp.keyword ?? ''} />
      </form>
      <div className="spacer" />
      <TourButton steps={GUIDE_TOUR} />
      <UserAvatar initial={user.avatar} />
    </>
  );

  return (
    <AppShell active="documents" topbar={topbar}>
      <div className="page-head">
        <div>
          <h2>資料（全社横断）</h2>
          <div className="sub">会社をまたいで保管資料を検索・閲覧 — UIからもClaude（MCP）からも同じ結果</div>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="k">総資料数</div><div className="v num">{all.count ?? 0} <small>件</small></div><div className="d muted" style={{ color: 'var(--ink-3)' }}>{companies.length} 社に保管</div></div>
        <div className="stat gold"><div className="k">合計容量</div><div className="v num">{all.total_size} <small>/ 1GB</small></div><div className="progress" style={{ marginTop: 9 }}><i style={{ width: `${capPct.toFixed(1)}%` }} /></div></div>
        <div className="stat"><div className="k">表示中</div><div className="v num">{res.count ?? docs.length} <small>件</small></div><div className="d muted" style={{ color: 'var(--ink-3)' }}>絞り込み結果</div></div>
        <div className="stat"><div className="k">種別</div><div className="v num">{catCount} <small>分類</small></div><div className="d muted" style={{ color: 'var(--ink-3)' }}>契約/決算/商品/提案/他</div></div>
      </div>

      <div className="banner info mt16">
        <span>ⓘ</span>
        <div>検索ロジックは1か所（DB側RPC）に集約し、<b>この画面</b>と<b>Claude（MCP <code>search_documents</code>）</b>が同じ結果を返します。Claude にはメタデータのみ（ファイル本体・署名URLは渡さない＝SEC-12）。アップロード/削除は各企業の<b>資料タブ</b>から。</div>
      </div>

      <div className="panel mt16">
        <div className="panel-head"><h3>検索結果</h3><span className="count num">{res.count ?? docs.length} 件 ・ {res.total_size}</span></div>
        <DocumentFilterBar companies={companies} />
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>ファイル</th><th>会社</th><th>種別</th><th className="right">サイズ</th><th>登録日</th><th>登録者</th><th className="right">操作</th></tr></thead>
            <tbody>
              {docs.length === 0 && (
                <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 28 }}>条件に一致する資料がありません。</td></tr>
              )}
              {docs.map((d) => {
                const ft = fileType(d.file_name);
                return (
                  <DocRow
                    key={d.id}
                    id={d.id}
                    fileName={d.file_name} ftClass={ft.cls} ftLabel={ft.label}
                    company={d.company} companyId={d.company_id}
                    catColor={CAT_COLOR[d.category] ?? 'var(--ink-3)'} category={d.category}
                    size={d.size} createdAt={d.created_at} uploadedBy={d.uploaded_by}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="tfoot">
          <span>全 {all.count ?? 0} 件中 {docs.length} 件を表示 ・ アップロード/削除は各企業の資料タブから</span>
        </div>
      </div>
    </AppShell>
  );
}
