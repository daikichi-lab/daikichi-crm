'use client';

import { useState, useTransition } from 'react';
import { submitPublicFormAction } from './actions';

const INDUSTRIES = ['飲食', '建設', '卸売', '小売', 'IT・情報通信', '専門サービス', 'その他'];
const AREAS = ['東京都', '大阪府', '愛知県', '福岡県'];
const SIZES = ['〜1千万', '1千万〜5千万', '5千万〜1億', '1億〜10億', '10億〜'];

type Config = {
  title?: string;
  intro?: string;
  consent?: string;
  submit_label?: string;
  done_title?: string;
  fields?: string[];
};

function TagInput({ kind, tags, setTags }: { kind: 'need' | 'offer'; tags: string[]; setTags: (t: string[]) => void }) {
  const cls = kind === 'offer' ? 'offer' : 'need';
  const mk = kind === 'offer' ? '提' : '求';
  const add = () => {
    const v = window.prompt(kind === 'offer' ? '提供できることを入力' : '求めてることを入力');
    if (v && v.trim() && !tags.includes(v.trim())) setTags([...tags, v.trim()]);
  };
  return (
    <div className="chips" style={{ padding: 8, border: '1px solid var(--line-strong)', borderRadius: 'var(--radius-sm)', minHeight: 44 }}>
      {tags.map((t) => (
        <span key={t} className={`chip ${cls}`}>
          <span className="mk">{mk}</span>{t} <span className="x" style={{ cursor: 'pointer' }} onClick={() => setTags(tags.filter((x) => x !== t))}>✕</span>
        </span>
      ))}
      <span className="chip-add chip" onClick={add}>＋ 追加</span>
    </div>
  );
}

export function PublicForm({ config }: { config: Config }) {
  const fields = new Set(config.fields ?? ['type', 'industry', 'name', 'contact', 'kana', 'email', 'phone', 'area', 'size', 'needs', 'offers', 'sns', 'message', 'newsletter']);
  const has = (k: string) => fields.has(k);

  const [type, setType] = useState('法人');
  const [industry, setIndustry] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [kana, setKana] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [size, setSize] = useState('');
  const [needs, setNeeds] = useState<string[]>([]);
  const [offers, setOffers] = useState<string[]>([]);
  const [sns, setSns] = useState('');
  const [message, setMessage] = useState('');
  const [newsletter, setNewsletter] = useState(false);
  const [consent, setConsent] = useState(false);

  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const submit = () => {
    setError('');
    if (!consent) { setError('個人情報の取り扱いに同意してください。'); return; }
    start(async () => {
      const res = await submitPublicFormAction({
        type, industry, name, contact, kana, email, phone, area, size, needs, offers, sns, message, newsletter,
      });
      if (res.error) setError(res.error);
      else { setDone(true); window.scrollTo(0, 0); }
    });
  };

  if (done) {
    return (
      <div className="panel">
        <div className="done-card">
          <div className="ic">✓</div>
          <h3>{config.done_title ?? '送信ありがとうございました'}</h3>
          <p className="muted" style={{ maxWidth: 420, margin: '8px auto 0' }}>
            担当者が内容を確認し、必要に応じてご連絡いたします。ご登録いただいた「求めてること／提供できること」をもとに、相性の良いお客様のご紹介を検討します。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel" id="formCard">
      <div className="panel-body">
        <div className="form-grid">
          {has('type') && (
            <div className="field"><label>種別 <span className="req">*</span></label>
              <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
                <option>法人</option><option>個人事業主</option>
              </select></div>
          )}
          {has('industry') && (
            <div className="field"><label>業種</label>
              <select className="select" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                <option value="">選択してください</option>
                {INDUSTRIES.map((o) => <option key={o}>{o}</option>)}
              </select></div>
          )}
          {has('name') && (
            <div className="field col-2"><label>会社名 / 屋号 <span className="req">*</span></label>
              <input className="input" placeholder="株式会社サンプル" value={name} onChange={(e) => setName(e.target.value)} /></div>
          )}
          {has('contact') && (
            <div className="field"><label>ご担当者名 <span className="req">*</span></label>
              <input className="input" placeholder="山田 太郎" value={contact} onChange={(e) => setContact(e.target.value)} /></div>
          )}
          {has('kana') && (
            <div className="field"><label>フリガナ</label>
              <input className="input" placeholder="ヤマダ タロウ" value={kana} onChange={(e) => setKana(e.target.value)} /></div>
          )}
          {has('email') && (
            <div className="field"><label>メール <span className="req">*</span></label>
              <input className="input" type="email" placeholder="taro@example.co.jp" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          )}
          {has('phone') && (
            <div className="field"><label>電話</label>
              <input className="input" placeholder="03-1234-5678" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          )}
          {has('area') && (
            <div className="field"><label>エリア（都道府県）</label>
              <select className="select" value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="">選択してください</option>
                {AREAS.map((o) => <option key={o}>{o}</option>)}
              </select></div>
          )}
          {has('size') && (
            <div className="field"><label>規模（売上）</label>
              <select className="select" value={size} onChange={(e) => setSize(e.target.value)}>
                <option value="">選択してください</option>
                {SIZES.map((o) => <option key={o}>{o}</option>)}
              </select></div>
          )}
        </div>

        {has('needs') && (
          <div className="field col-2" style={{ marginTop: 16 }}>
            <label>求めてること（探しているもの）</label>
            <TagInput kind="need" tags={needs} setTags={setNeeds} />
            <span className="hint">例: 集客 / 仕入先 / 資金調達 / 人材採用 など</span>
          </div>
        )}
        {has('offers') && (
          <div className="field col-2" style={{ marginTop: 14 }}>
            <label>提供できること（強み・サービス）</label>
            <TagInput kind="offer" tags={offers} setTags={setOffers} />
          </div>
        )}

        {has('sns') && (
          <div className="field col-2" style={{ marginTop: 14 }}><label>Webサイト・SNS</label>
            <input className="input" placeholder="https://example.co.jp / SNSのURL" value={sns} onChange={(e) => setSns(e.target.value)} /></div>
        )}
        {has('message') && (
          <div className="field col-2" style={{ marginTop: 14 }}><label>ご相談・メッセージ</label>
            <textarea className="input" rows={3} placeholder="ご要望やご紹介してほしい相手など" value={message} onChange={(e) => setMessage(e.target.value)} /></div>
        )}

        {has('newsletter') && (
          <label className="row" style={{ gap: 8, marginTop: 16, fontSize: 12.5, color: 'var(--ink-2)' }}>
            <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} /> メルマガ（税務・セミナー案内）を購読する
          </label>
        )}

        <label className="row" style={{ gap: 8, marginTop: 16, fontSize: 12.5, color: 'var(--ink-2)' }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          {config.consent ?? '入力内容を大吉会計事務所が確認・保管することに同意します（個人情報は国内サーバーに保管）。'}
        </label>

        {error && <div className="banner warn mt16" style={{ fontSize: 12.5 }}><span>{error}</span></div>}

        <button className="btn btn-primary" style={{ width: '100%', marginTop: 16, height: 44 }} disabled={pending} onClick={submit}>
          {pending ? '送信中…' : (config.submit_label ?? '送信する')}
        </button>
      </div>
    </div>
  );
}
