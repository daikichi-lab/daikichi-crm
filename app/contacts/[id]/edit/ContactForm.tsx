'use client';
import Link from 'next/link';
import { useState, useTransition, useRef, useEffect } from 'react';
import { useUI } from '@/components/ui';
import { Icon } from '@/components/icons';
import { createContactAction, updateContactAction } from './actions';
import { uploadScanImageAction } from '@/app/scan/actions';

export type ContactInitial = {
  name?: string;
  kana?: string;
  title?: string;
  department?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  is_primary?: boolean;
  sns_x?: string;
  sns_linkedin?: string;
  sns_instagram?: string;
  sns_other?: string;
  has_front_card?: boolean;
};

type Props = {
  mode: 'create' | 'edit';
  companyId?: string;
  companyName: string;
  contactId?: string;
  initial?: ContactInitial;
};

export function ContactForm({ mode, companyId, companyName, contactId, initial = {} }: Props) {
  const { toast } = useUI();
  const [pending, start] = useTransition();
  const [f, setF] = useState<ContactInitial>(initial);

  // 名刺画像は実ファイルを保持し、保存時に非公開バケットへアップロードして Storage パスを紐付ける。
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontUrl, setFrontUrl] = useState('');
  const [backUrl, setBackUrl] = useState('');
  // 編集時に既存の表面名刺がある（新たに選ぶまでは既存を維持）
  const [hasExistingFront, setHasExistingFront] = useState(!!initial.has_front_card);

  useEffect(() => () => { if (frontUrl) URL.revokeObjectURL(frontUrl); }, [frontUrl]);
  useEffect(() => () => { if (backUrl) URL.revokeObjectURL(backUrl); }, [backUrl]);

  const set = (k: keyof ContactInitial) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const pickFront = (file: File | undefined) => {
    if (!file) return;
    if (frontUrl) URL.revokeObjectURL(frontUrl);
    setFrontFile(file); setFrontUrl(URL.createObjectURL(file)); setHasExistingFront(false);
    toast('表面の名刺を取り込みました');
  };
  const pickBack = (file: File | undefined) => {
    if (!file) return;
    if (backUrl) URL.revokeObjectURL(backUrl);
    setBackFile(file); setBackUrl(URL.createObjectURL(file));
    toast('裏面の名刺を取り込みました');
  };

  const submit = () => {
    if (!f.name?.trim()) { toast('氏名を入力してください'); return; }
    const payload = {
      name: f.name.trim(),
      kana: f.kana,
      title: f.title,
      department: f.department,
      email: f.email,
      phone: f.phone,
      mobile: f.mobile,
      is_primary: !!f.is_primary,
      extra: {
        sns_x: f.sns_x || undefined,
        sns_linkedin: f.sns_linkedin || undefined,
        sns_instagram: f.sns_instagram || undefined,
        sns_other: f.sns_other || undefined,
      },
    };
    start(async () => {
      // 新たに選択された名刺画像を実アップロードして Storage パスを得る
      let front: string | undefined;
      let back: string | undefined;
      if (frontFile) {
        const fd = new FormData(); fd.append('file', frontFile);
        const r = await uploadScanImageAction(fd);
        if (r.error) { toast(`名刺のアップロードに失敗: ${r.error}`); return; }
        front = r.path;
      }
      if (backFile) {
        const fd = new FormData(); fd.append('file', backFile);
        const r = await uploadScanImageAction(fd);
        if (r.error) { toast(`裏面のアップロードに失敗: ${r.error}`); return; }
        back = r.path;
      }
      const card = front ? { front, back } : undefined;
      if (mode === 'edit' && contactId) await updateContactAction(contactId, companyId, payload, card);
      else if (companyId) await createContactAction(companyId, payload, card);
    });
  };

  const cancelHref = companyId ? `/companies/${companyId}#contacts` : '/companies';
  const title = mode === 'edit' ? '担当者を編集' : '担当者を追加';

  return (
    <>
      <div className="page-head">
        <div><h2>{title}</h2><div className="sub">{companyName}</div></div>
        <div className="actions"><Link className="btn" href="/scan"><Icon name="card" size={15} />名刺から自動入力（OCR）</Link></div>
      </div>

      {/* 隠しファイル入力（撮影=capture / ファイル選択） */}
      <input ref={frontRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pickFront(e.target.files?.[0])} />
      <input ref={backRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pickBack(e.target.files?.[0])} />

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head"><h3>担当者情報</h3></div>
          <div className="panel-body">
            <div className="form-grid">
              <div className="field">
                <label>氏名 <span className="req">*</span></label>
                <input className="input" placeholder="佐藤 太郎" value={f.name ?? ''} onChange={set('name')} />
              </div>
              <div className="field">
                <label>フリガナ</label>
                <input className="input" placeholder="サトウ タロウ" value={f.kana ?? ''} onChange={set('kana')} />
              </div>
              <div className="field">
                <label>役職</label>
                <input className="input" placeholder="営業部 部長" value={f.title ?? ''} onChange={set('title')} />
              </div>
              <div className="field">
                <label>部署</label>
                <input className="input" placeholder="営業部" value={f.department ?? ''} onChange={set('department')} />
              </div>
              <div className="field col-2">
                <label>メール</label>
                <input className="input" type="email" placeholder="sato@daikichi-shoji.co.jp" value={f.email ?? ''} onChange={set('email')} />
              </div>
              <div className="field">
                <label>電話</label>
                <input className="input num" placeholder="03-1234-5678" value={f.phone ?? ''} onChange={set('phone')} />
              </div>
              <div className="field">
                <label>携帯</label>
                <input className="input num" placeholder="080-9876-5432" value={f.mobile ?? ''} onChange={set('mobile')} />
              </div>
              <div className="field col-2">
                <label>個人のSNS・リンク</label>
                <div className="form-grid" style={{ gap: '10px 12px' }}>
                  <input className="input" placeholder="X（旧Twitter） https://x.com/…" value={f.sns_x ?? ''} onChange={set('sns_x')} />
                  <input className="input" placeholder="LinkedIn https://linkedin.com/in/…" value={f.sns_linkedin ?? ''} onChange={set('sns_linkedin')} />
                  <input className="input" placeholder="Instagram https://instagram.com/…" value={f.sns_instagram ?? ''} onChange={set('sns_instagram')} />
                  <input className="input" placeholder="Facebook / その他" value={f.sns_other ?? ''} onChange={set('sns_other')} />
                </div>
                <span className="hint">担当者<b>個人</b>のSNS。企業のSNS（企業編集）とは別に保存します（当面は extra(JSONB)）。</span>
              </div>
              <div className="field col-2">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                  <input type="checkbox" checked={!!f.is_primary} onChange={(e) => setF((p) => ({ ...p, is_primary: e.target.checked }))} /> この企業の主担当にする
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>名刺画像</h3><span className="count">表 / 裏</span></div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>表面</div>
              {frontFile ? (
                <>
                  <div className="card-slot filled">
                    <span className="face-tag">表</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={frontUrl} alt="表面の名刺" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                  <div className="row mt8">
                    <button type="button" className="btn btn-sm" data-icon="card" onClick={() => frontRef.current?.click()}>差し替え</button>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => { setFrontFile(null); setFrontUrl(''); toast('表面を取り消しました'); }}>取消</button>
                  </div>
                </>
              ) : hasExistingFront ? (
                <>
                  <div className="card-slot filled">
                    <span className="face-tag">表</span>
                    <div className="fakecard"><div className="lines" style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{companyName}</div>
                      <div style={{ fontSize: 11, marginTop: 6 }}>登録済みの名刺があります</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{f.name}</div>
                    </div></div>
                  </div>
                  <div className="row mt8">
                    <button type="button" className="btn btn-sm" data-icon="card" onClick={() => frontRef.current?.click()}>差し替え（新しい画像を選択）</button>
                  </div>
                  <span className="hint">既存の名刺は担当者ページの「履歴」で確認できます。</span>
                </>
              ) : (
                <div className="card-slot" role="button" tabIndex={0} onClick={() => frontRef.current?.click()}>
                  <span className="big">＋</span>
                  <div>タップして撮影 / ファイルを選択</div>
                </div>
              )}
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>裏面（任意）</div>
              {backFile ? (
                <>
                  <div className="card-slot filled">
                    <span className="face-tag">裏</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={backUrl} alt="裏面の名刺" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                  <div className="row mt8"><button type="button" className="btn btn-sm btn-danger" onClick={() => { setBackFile(null); setBackUrl(''); toast('裏面を取り消しました'); }}>取消</button></div>
                </>
              ) : (
                <div className="card-slot" role="button" tabIndex={0} onClick={() => backRef.current?.click()}>
                  <span className="big">＋</span>
                  <div>タップして撮影 / ファイルを選択</div>
                </div>
              )}
            </div>
            <div className="banner ok" style={{ fontSize: 12 }}><span>名刺画像は<b>非公開で保管</b>し、閲覧は署名URLのみ。外部OCRには送りません。</span></div>
          </div>
        </div>
      </div>

      <div className="row mt16" style={{ justifyContent: 'flex-end' }}>
        <Link className="btn" href={cancelHref}>キャンセル</Link>
        <button type="button" className="btn btn-primary" disabled={pending} onClick={submit}>保存</button>
      </div>
    </>
  );
}
