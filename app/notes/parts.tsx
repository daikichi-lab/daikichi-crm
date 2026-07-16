'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useUI } from '@/components/ui';
import { importNoteAction } from './actions';

type Company = { id: string; name: string };

/** 議事録の手動取込（Notta貼り付け／TXTアップロード → create_note）。 */
export function ImportButton({ small, companies = [] }: { small?: boolean; companies?: Company[] }) {
  const { toast } = useUI();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [summary, setSummary] = useState('');
  const [fullText, setFullText] = useState('');
  const [todos, setTodos] = useState('');
  const [pending, start] = useTransition();

  const loadTxt = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.text();
    setFullText(text.slice(0, 100000));
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  };

  const submit = () => start(async () => {
    const r = await importNoteAction({
      title, company_id: companyId || undefined, summary: summary || undefined,
      full_text: fullText || undefined,
      next_actions: todos.split('\n').map((s) => s.replace(/^[-・*\s]+/, '')).filter(Boolean),
    });
    if (r.error) { toast(r.error); return; }
    toast('議事録を取り込みました');
    setOpen(false);
    if (r.id) router.push(`/notes/${r.id}`); else router.refresh();
  });

  return (
    <>
      <button className={small ? 'btn btn-sm mt8' : 'btn btn-sm btn-primary'} onClick={() => setOpen(true)}>
        {small ? '取り込む' : '＋ 議事録を取り込む'}
      </button>
      {open && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 640 }}>
            <div className="m-head"><h3>議事録を取り込む</h3></div>
            <div className="m-body">
              <input ref={fileRef} type="file" hidden accept=".txt,.md,text/plain" onChange={(e) => loadTxt(e.target.files?.[0])} />
              <div className="form-grid">
                <div className="field"><label>タイトル <span className="req">*</span></label>
                  <input className="input" placeholder="例: 6月度 定例MTG" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                <div className="field"><label>企業（任意）</label>
                  <select className="select" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                    <option value="">（未紐付け）</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select></div>
                <div className="field col-2"><label>要点（任意）</label>
                  <textarea className="input" rows={2} placeholder="会話の要点…" value={summary} onChange={(e) => setSummary(e.target.value)} /></div>
                <div className="field col-2">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <label style={{ margin: 0 }}>文字起こし全文（Notta等から貼り付け）</label>
                    <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}>TXTを読み込む</button>
                  </div>
                  <textarea className="input" rows={7} placeholder="ここに文字起こしを貼り付け、またはTXTを読み込み" value={fullText} onChange={(e) => setFullText(e.target.value)} /></div>
                <div className="field col-2"><label>次にやること（1行1件・任意）</label>
                  <textarea className="input" rows={3} placeholder={'見積もりの提示\n次回日程の調整'} value={todos} onChange={(e) => setTodos(e.target.value)} /></div>
              </div>
              <div className="banner info mt16" style={{ fontSize: 12 }}>
                会議終了→Notta→Googleドライブの<b>自動取込</b>は Google 連携（OAuth）設定後に有効化されます。現在は貼り付け／TXTでの手動取込に対応しています。
              </div>
            </div>
            <div className="m-foot">
              <button className="btn" onClick={() => setOpen(false)}>キャンセル</button>
              <button className="btn btn-primary" disabled={pending || !title.trim()} onClick={submit}>取り込む</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** 自動連携フォルダ（Google Drive）— OAuth 連携は将来フェーズ。現状は手動取込を案内。 */
export function FolderChangeButton() {
  const { toast } = useUI();
  return (
    <button className="btn btn-sm" onClick={() => toast('Google ドライブ自動連携は今後対応予定です。現在は貼り付け／TXTで取り込めます。')}>変更</button>
  );
}
