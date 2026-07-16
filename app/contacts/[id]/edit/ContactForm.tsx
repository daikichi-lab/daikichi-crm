'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useUI } from '@/components/ui';
import { Icon } from '@/components/icons';
import { createContactAction, updateContactAction } from './actions';

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
  // dev: ドロップゾーンはパス文字列で表現（実画像アップロードは本番で差し替え）
  const [front, setFront] = useState<string | undefined>(initial.has_front_card ? `cards/${contactId ?? 'new'}-front.jpg` : undefined);
  const [back, setBack] = useState<string | undefined>(undefined);

  const set = (k: keyof ContactInitial) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

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
    const card = front ? { front, back } : undefined;
    start(async () => {
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
              {front ? (
                <>
                  <div className="card-slot filled">
                    <span className="face-tag">表</span>
                    <div className="fakecard"><div className="lines">
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{companyName}</div>
                      <div style={{ fontSize: 11, marginTop: 6 }}>{[f.department, f.title].filter(Boolean).join(' ')}</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{f.name}</div>
                      <div className="num" style={{ fontSize: 10, marginTop: 8 }}>{[f.phone, f.email].filter(Boolean).join(' ／ ')}</div>
                    </div></div>
                  </div>
                  <div className="row mt8">
                    <button type="button" className="btn btn-sm" data-icon="card" onClick={() => { setFront(`cards/${contactId ?? 'new'}-front.jpg`); toast('カメラを起動しました'); }}>撮影</button>
                    <button type="button" className="btn btn-sm" onClick={() => { setFront(`cards/${contactId ?? 'new'}-front.jpg`); toast('表面を差し替えました'); }}>差し替え</button>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => { setFront(undefined); toast('表面を削除しました'); }}>削除</button>
                  </div>
                </>
              ) : (
                <div className="card-slot" role="button" tabIndex={0} onClick={() => { setFront(`cards/${contactId ?? 'new'}-front.jpg`); toast('表面の名刺を取り込みました'); }}>
                  <span className="big">＋</span>
                  <div>タップして撮影 / ファイルを選択</div>
                </div>
              )}
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>裏面（任意）</div>
              {back ? (
                <>
                  <div className="card-slot filled">
                    <span className="face-tag">裏</span>
                    <div className="fakecard"><div className="lines" style={{ color: '#5a6b7d', fontSize: 10 }}><div>裏面を取り込み済み</div></div></div>
                  </div>
                  <div className="row mt8"><button type="button" className="btn btn-sm btn-danger" onClick={() => { setBack(undefined); toast('裏面を削除しました'); }}>削除</button></div>
                </>
              ) : (
                <div className="card-slot" role="button" tabIndex={0} onClick={() => { setBack(`cards/${contactId ?? 'new'}-back.jpg`); toast('裏面の名刺を取り込みました'); }}>
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
