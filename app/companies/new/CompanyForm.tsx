'use client';

import './company-form.css';
import Link from 'next/link';
import { useState, useRef } from 'react';
import { useUI } from '@/components/ui';

type Owner = { id: string; name: string };
export type CompanyFormValues = {
  id?: string;
  type: string; name: string; industry: string | null; area: string | null; size: string | null;
  status: string; owner_id: string | null; notes: string | null;
  needs: string[]; offers: string[]; extra: Record<string, unknown>;
};

const SIZES_FALLBACK = ['〜1千万', '1千万〜5千万', '5千万〜1億', '1億〜10億', '10億〜', '不明'];

export function CompanyForm({
  mode, values, industries, areas, sizes, tags, owners, action,
}: {
  mode: 'new' | 'edit';
  values: CompanyFormValues;
  industries: string[]; areas: string[]; sizes: string[]; tags: string[]; owners: Owner[];
  action: (form: FormData) => void | Promise<void>;
}) {
  const { toast } = useUI();
  const [needs, setNeeds] = useState<string[]>(values.needs ?? []);
  const [offers, setOffers] = useState<string[]>(values.offers ?? []);
  const sizeList = sizes.length ? sizes : SIZES_FALLBACK;

  const extra = values.extra ?? {};
  const website = (extra.website as string | undefined) ?? '';
  const sns = (extra.sns as Record<string, string> | undefined) ?? {};
  const reservedExtra = ['website', 'sns'];
  const [extraRows, setExtraRows] = useState<{ key: string; val: string }[]>(
    Object.entries(extra).filter(([k]) => !reservedExtra.includes(k)).map(([k, v]) => ({ key: k, val: String(v) })),
  );

  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} onSubmit={() => toast('企業を保存しました')}>
      <input type="hidden" name="needs" value={JSON.stringify(needs)} />
      <input type="hidden" name="offers" value={JSON.stringify(offers)} />

      <div className="panel">
        <div className="panel-head"><h3>基本情報</h3></div>
        <div className="panel-body">
          <div className="form-grid">
            <div className="field">
              <label>種別 <span className="req">*</span></label>
              <select className="select" name="type" defaultValue={values.type}>
                <option>法人</option><option>個人事業主</option>
              </select>
            </div>
            <div className="field">
              <label>ステータス</label>
              <select className="select" name="status" defaultValue={values.status}>
                <option>顧問中</option><option>見込み</option><option>休眠</option>
              </select>
            </div>
            <div className="field col-2">
              <label>名称 <span className="req">*</span></label>
              <input className="input" name="name" required defaultValue={values.name} placeholder="株式会社 ◯◯ / 屋号・氏名" />
            </div>
            <div className="field">
              <label>業種</label>
              <select className="select" name="industry" defaultValue={values.industry ?? ''}>
                <option value="">（未選択）</option>
                {industries.map((i) => <option key={i}>{i}</option>)}
              </select>
              <span className="hint">マッチング精度のためマスタから選択</span>
            </div>
            <div className="field">
              <label>エリア（都道府県）</label>
              <select className="select" name="area" defaultValue={values.area ?? ''}>
                <option value="">（未選択）</option>
                {areas.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div className="field">
              <label>規模（売上）</label>
              <select className="select" name="size" defaultValue={values.size ?? ''}>
                <option value="">（未選択）</option>
                {sizeList.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label>社内担当</label>
              <select className="select" name="owner_id" defaultValue={values.owner_id ?? ''}>
                <option value="">（なし）</option>
                {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <span className="hint">先方担当者ではなく事務所側の担当</span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Webサイト・SNS</h3></div>
        <div className="panel-body">
          <div className="form-grid">
            <div className="field col-2"><label>公式サイト</label><input className="input" name="website" placeholder="https://example.co.jp" defaultValue={website} /></div>
            <div className="field"><label>X（旧Twitter）</label><input className="input" name="sns_x" placeholder="https://x.com/…" defaultValue={sns['𝕏 X'] ?? ''} /></div>
            <div className="field"><label>Instagram</label><input className="input" name="sns_instagram" placeholder="https://instagram.com/…" defaultValue={sns['Instagram'] ?? ''} /></div>
            <div className="field"><label>Facebook</label><input className="input" name="sns_facebook" placeholder="https://facebook.com/…" defaultValue={sns['Facebook'] ?? ''} /></div>
            <div className="field"><label>LINE公式 / その他</label><input className="input" name="sns_other" placeholder="https://…" defaultValue={sns['LINE / その他'] ?? ''} /></div>
          </div>
          <span className="hint mt8">SNS・サイトのURLを保存できます（当面は <b>extra</b>(JSONB) に格納、多用されれば正式な列へ昇格）。</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>求めてること / 提供できること</h3>
          <span className="legend right"><span className="chip need" style={{ height: 20 }}><span className="mk">求</span>needs</span><span className="chip offer" style={{ height: 20 }}><span className="mk">提</span>offers</span></span>
        </div>
        <div className="panel-body">
          <div className="field col-2" style={{ marginBottom: 14 }}>
            <label>求めてること（needs）</label>
            <TagInput kind="need" value={needs} onChange={setNeeds} suggestions={tags} />
            <span className="hint">マスタから補完。無いタグは確認のうえ追加されます（表記ゆれ防止）。</span>
          </div>
          <div className="field col-2">
            <label>提供できること（offers）</label>
            <TagInput kind="offer" value={offers} onChange={setOffers} suggestions={tags} />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>メモ・追加項目</h3></div>
        <div className="panel-body">
          <div className="field col-2" style={{ marginBottom: 14 }}>
            <label>メモ</label>
            <textarea className="input" name="notes" rows={3} defaultValue={values.notes ?? ''} />
          </div>
          <div className="banner info"><span>「取引銀行」「決算月」などの試験的な項目は <b>extra</b> として、マイグレーションなしで追加できます。</span></div>
          <div className="mt8">
            {extraRows.map((row, i) => (
              <div className="extra-row" key={i}>
                <input className="input" name="extra_key" placeholder="項目名（例: 取引銀行）" value={row.key}
                  onChange={(e) => setExtraRows((r) => r.map((x, j) => j === i ? { ...x, key: e.target.value } : x))} style={{ maxWidth: 200 }} />
                <input className="input" name="extra_val" placeholder="値" value={row.val}
                  onChange={(e) => setExtraRows((r) => r.map((x, j) => j === i ? { ...x, val: e.target.value } : x))} />
                <button type="button" className="btn btn-sm btn-icon btn-danger" onClick={() => setExtraRows((r) => r.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setExtraRows((r) => [...r, { key: '', val: '' }])}>＋ 追加項目（extra）を足す</button>
          </div>
        </div>
      </div>

      <div className="row mt16" style={{ justifyContent: 'flex-end' }}>
        <Link className="btn" href={mode === 'edit' && values.id ? `/companies/${values.id}` : '/companies'}>キャンセル</Link>
        <button className="btn btn-primary" type="submit">保存</button>
      </div>
    </form>
  );
}

function TagInput({ kind, value, onChange, suggestions }: { kind: 'need' | 'offer'; value: string[]; onChange: (v: string[]) => void; suggestions: string[] }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const add = (t: string) => {
    const v = t.trim();
    if (!v || value.includes(v)) { setText(''); return; }
    onChange([...value, v]);
    setText('');
  };
  const remove = (t: string) => onChange(value.filter((x) => x !== t));
  const filtered = suggestions.filter((s) => !value.includes(s) && (text === '' || s.includes(text))).slice(0, 8);

  return (
    <div className="tag-suggest">
      <div className="tagbox">
        {value.map((t) => (
          <span key={t} className={`chip ${kind}`}><span className="mk">{kind === 'need' ? '求' : '提'}</span>{t}<span className="x" onClick={() => remove(t)}>✕</span></span>
        ))}
        <input
          className="tag-input"
          value={text}
          placeholder="＋ タグを追加"
          onChange={(e) => { setText(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(text); } else if (e.key === 'Backspace' && text === '' && value.length) { remove(value[value.length - 1]); } }}
        />
      </div>
      {open && (filtered.length > 0 || text.trim()) && (
        <div className="tag-menu">
          {filtered.map((s) => <button type="button" key={s} onMouseDown={(e) => { e.preventDefault(); add(s); }}>{s}</button>)}
          {text.trim() && !suggestions.includes(text.trim()) && !value.includes(text.trim()) && (
            <button type="button" onMouseDown={(e) => { e.preventDefault(); add(text); }}><b>＋ 「{text.trim()}」を追加</b></button>
          )}
        </div>
      )}
    </div>
  );
}
