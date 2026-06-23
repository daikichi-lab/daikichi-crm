'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition, useEffect } from 'react';
import { useUI } from '@/components/ui';
import { Icon } from '@/components/icons';
import { detectDuplicateAction, createCompanyWithContactAction, addContactToCompanyAction } from './actions';

type Masters = { industries: string[]; areas: string[]; sizes: string[] };
type DupCandidate = { id: string; name: string; industry?: string; area?: string; status?: string };

// dev: OCR は固定ダミー（実装時に Tesseract.js の抽出へ差し替え）
const DEMO_OCR = {
  company: 'みどり食堂',
  name: '緑川 みどり',
  title: '店主',
  email: 'midori@example.co.jp',
  phone: '06-6xxx-xxxx',
  mobile: '',
  address: '大阪府大阪市中央区…',
  type: '個人事業主',
  industry: '飲食',
  area: '大阪府',
  size: '〜1千万',
  titleLowConf: true,
};

function normalizeDuplicates(res: any): DupCandidate[] {
  if (!res) return [];
  const arr = Array.isArray(res) ? res : res.matches ?? res.candidates ?? res.companies ?? (res.id ? [res] : []);
  return (arr as any[]).map((c) => ({ id: c.id ?? c.company_id, name: c.name, industry: c.industry, area: c.area, status: c.status })).filter((c) => c.id);
}

export function ScanWizard({ masters }: { masters: Masters }) {
  const { toast } = useUI();
  const router = useRouter();
  const [pending, start] = useTransition();

  // step: 1 取り込み / 2 読み取り / 3 確認・補正
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [hasBack, setHasBack] = useState(false);

  // 抽出フォーム
  const [company, setCompany] = useState('');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState('個人事業主');
  const [industry, setIndustry] = useState('');
  const [area, setArea] = useState('');
  const [size, setSize] = useState('');
  const [titleLowConf, setTitleLowConf] = useState(false);

  const [dups, setDups] = useState<DupCandidate[]>([]);
  const [dupMode, setDupMode] = useState<'existing' | 'new'>('new');

  const runOcr = () => {
    // dev: 擬似OCR → フォームへ反映
    setCompany(DEMO_OCR.company); setName(DEMO_OCR.name); setTitle(DEMO_OCR.title);
    setEmail(DEMO_OCR.email); setPhone(DEMO_OCR.phone); setMobile(DEMO_OCR.mobile);
    setAddress(DEMO_OCR.address); setType(DEMO_OCR.type); setIndustry(DEMO_OCR.industry);
    setArea(DEMO_OCR.area); setSize(DEMO_OCR.size); setTitleLowConf(DEMO_OCR.titleLowConf);
    setStep(3);
  };

  // step3 に入ったら重複検出
  useEffect(() => {
    if (step !== 3 || !company) return;
    let alive = true;
    detectDuplicateAction(company, email || undefined).then((res) => {
      if (!alive) return;
      const list = normalizeDuplicates(res);
      setDups(list);
      setDupMode(list.length > 0 ? 'existing' : 'new');
    });
    return () => { alive = false; };
  }, [step, company, email]);

  const contactPayload = () => ({
    name: name.trim(),
    title: title || undefined,
    email: email || undefined,
    phone: phone || undefined,
    mobile: mobile || undefined,
    is_primary: true,
    extra: address ? { address } : undefined,
  });

  const create = () => {
    if (!name.trim()) { toast('氏名を確認してください'); return; }
    const frontCard = `cards/scan-${Date.now()}.jpg`;
    start(async () => {
      if (dupMode === 'existing' && dups[0]) {
        const res = await addContactToCompanyAction(dups[0].id, contactPayload(), frontCard);
        toast(`「${dups[0].name}」に担当者を追加しました`);
        router.push(`/companies/${dups[0].id}#contacts`);
        void res;
      } else {
        const res = await createCompanyWithContactAction(
          { name: company.trim(), type, industry: industry || undefined, area: area || undefined, size: size || undefined },
          contactPayload(),
          frontCard,
        );
        toast('企業＋担当者を作成しました');
        const cid = res?.id ?? res?.company_id;
        router.push(cid ? `/companies/${cid}` : '/companies');
      }
    });
  };

  const stepClass = (n: number) => `s${step >= n ? ' on' : ''}`;

  return (
    <>
      <div className="steps" data-scan-steps>
        <span className={stepClass(1)}><span className="n num">1</span>取り込み</span><span className="sep" />
        <span className={stepClass(2)}><span className="n num">2</span>読み取り</span><span className="sep" />
        <span className={stepClass(3)}><span className="n num">3</span>確認・補正</span><span className="sep" />
        <span className="s"><span className="n num">4</span>作成</span>
      </div>

      <div className="page-head"><div><h2>名刺から顧客を作成</h2><div className="sub">読み取り後に必ず内容を確認・補正してから作成します（OCR: ブラウザ内 Tesseract.js）</div></div></div>

      <div className="scan-split">
        {/* 左: 画像とOCR */}
        <div>
          <div className="scan-preview">
            <div className="row" style={{ justifyContent: 'space-between', color: '#cdddea', fontSize: 12.5, fontWeight: 700 }}>
              <span>取り込んだ名刺</span>
              <span className="row" style={{ gap: 6 }}>
                <button className="btn btn-sm" data-icon="card" onClick={() => { toast('カメラを起動しました'); if (step === 1) setStep(2); }}>撮影</button>
                <button className="btn btn-sm" onClick={() => { toast('ファイルを選択しました'); if (step === 1) setStep(2); }}>ファイル</button>
              </span>
            </div>
            {step === 1 ? (
              <div className="shot" role="button" tabIndex={0} onClick={() => { toast('名刺を取り込みました'); setStep(2); }} style={{ display: 'grid', placeItems: 'center', background: '#1f2832', color: '#9fb6c9', cursor: 'pointer' }}>
                <div style={{ textAlign: 'center', fontSize: 13 }}><div style={{ fontSize: 26 }}>＋</div>タップして撮影 / ファイルを選択</div>
              </div>
            ) : (
              <div className="shot"><div className="fakecard"><div className="lines">
                <div style={{ fontWeight: 700, fontSize: 14 }}>{company || 'みどり食堂'}</div>
                <div style={{ fontSize: 11, marginTop: 8 }}>{title || '店主'}</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{name || '緑川 みどり'}</div>
                <div className="num" style={{ fontSize: 10, marginTop: 10 }}>{address || '大阪府大阪市中央区…'} ／ TEL {phone || '06-6xxx-xxxx'}</div>
                <div className="num" style={{ fontSize: 10 }}>{email || 'midori@example.co.jp'}</div>
              </div></div></div>
            )}
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => toast('トリミング')}>トリミング</button>
              <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => toast('回転しました')}>回転</button>
              <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => toast('明るさを調整しました')}>明るさ</button>
            </div>
            <div style={{ color: '#9fb6c9', fontSize: 12 }}>裏面（任意）: <button className="linklike" onClick={() => { setHasBack(true); toast('裏面を追加しました'); }} style={{ color: '#bcd2e4', background: 'none', border: 0, cursor: 'pointer', padding: 0 }}>{hasBack ? '✓ 追加済み' : '＋ 追加'}</button></div>
          </div>

          <div className="panel mt16">
            <div className="panel-body">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="b">OCR 読み取り</span>
                <span className="muted" style={{ fontSize: 12 }}>{step >= 3 ? '完了' : step === 2 ? '待機中' : '未取込'}</span>
              </div>
              <div className="progress"><i style={{ width: step >= 3 ? '100%' : step === 2 ? '40%' : '0%' }} /></div>
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>画像はブラウザ内で処理。外部サービスには送信していません。</div>
              {step === 2 && <button className="btn btn-sm btn-primary mt8" onClick={runOcr}><Icon name="card" size={14} />読み取りを実行</button>}
              {step >= 3 && <button className="btn btn-sm mt8" onClick={() => { runOcr(); toast('再読み取りしました'); }}>再読み取り</button>}
            </div>
          </div>
        </div>

        {/* 右: 抽出結果フォーム */}
        <div className="panel">
          <div className="panel-head"><h3>抽出結果を確認・補正</h3></div>
          <div className="panel-body">
            {step < 3 ? (
              <div className="muted" style={{ padding: '24px 4px', fontSize: 13 }}>名刺を取り込み、左の「読み取りを実行」を押すと、ここに抽出結果が表示されます。</div>
            ) : (
              <>
                {dups.length > 0 && (
                  <div className="panel" style={{ borderColor: '#ecdcb4', background: 'var(--amber-50)', marginBottom: 14, boxShadow: 'none' }}>
                    <div className="panel-body" style={{ padding: '12px 14px' }}>
                      <div className="b" style={{ color: 'var(--gold-700)', marginBottom: 6 }}>⚠ 似た企業「{dups[0].name}」が見つかりました — 重複を防ぐため、登録先を選んでください</div>
                      <label className="dup-opt">
                        <input type="radio" name="dupmode" value="existing" checked={dupMode === 'existing'} onChange={() => setDupMode('existing')} />
                        <span><b>既存の「{dups[0].name}」に担当者として追加</b> <span className="badge prospect" style={{ height: 18, fontSize: 10 }}>おすすめ</span><br /><span className="muted">いま読み取った担当者の内容はそのまま使います。会社情報は既存のものを引き継ぎます。</span></span>
                      </label>
                      <label className="dup-opt">
                        <input type="radio" name="dupmode" value="new" checked={dupMode === 'new'} onChange={() => setDupMode('new')} />
                        <span><b>新しい企業として作成</b><br /><span className="muted">別の会社であればこちら。</span></span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="form-grid">
                  <div className="field col-2">
                    <label>会社名 / 屋号</label>
                    <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} disabled={dupMode === 'existing'} />
                  </div>
                  <div className="field">
                    <label>氏名</label>
                    <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className={`field${titleLowConf ? ' err' : ''}`}>
                    <label>役職</label>
                    <input className={`input${titleLowConf ? ' lowconf' : ''}`} value={title} onChange={(e) => { setTitle(e.target.value); setTitleLowConf(false); }} />
                    {titleLowConf && <span className="lowconf-note">⚠ 読み取り信頼度: 低 — 「店主」の可能性。確認してください</span>}
                  </div>
                  <div className="field col-2">
                    <label>メール</label>
                    <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>電話</label>
                    <input className="input num" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>携帯</label>
                    <input className="input num" placeholder="（未検出）" value={mobile} onChange={(e) => setMobile(e.target.value)} />
                  </div>
                  <div className="field col-2">
                    <label>住所</label>
                    <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
                  </div>
                </div>

                {dupMode === 'new' ? (
                  <div>
                    <div className="muted" style={{ fontSize: 12, fontWeight: 700, margin: '16px 0 6px' }}>企業の分類（任意・後で設定可）</div>
                    <div className="row">
                      <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
                        <option value="個人事業主">個人事業主</option>
                        <option value="法人">法人</option>
                      </select>
                      <select className="select" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                        <option value="">業種を選択</option>
                        {masters.industries.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <select className="select" value={area} onChange={(e) => setArea(e.target.value)}>
                        <option value="">エリア</option>
                        {masters.areas.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <select className="select" value={size} onChange={(e) => setSize(e.target.value)}>
                        <option value="">規模</option>
                        {masters.sizes.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="muted" style={{ fontSize: 12, margin: '16px 0 0' }}>業種・エリア・規模・求/提は <b>既存の「{dups[0]?.name}」</b> のものを引き継ぎます。</div>
                )}

                <div className="banner info mt16" style={{ fontSize: 12.5 }}>
                  {dupMode === 'existing'
                    ? <>既存の <b>「{dups[0]?.name}」</b> に 担当者 <b>「{name}」</b> を追加します。会社情報は既存のものを使います（読み取った担当者情報はそのまま反映）。</>
                    : <>新しい企業 <b>「{company}」</b> ＋ 担当者 <b>「{name}」</b> を作成します。求/提は作成後に企業ページで設定できます。</>}
                </div>

                <div className="row mt16" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {dupMode === 'existing' ? <>登録先: <b>既存企業「{dups[0]?.name}」</b></> : <>登録先: <b>新しい企業「{company}」</b></>}
                  </span>
                  <span className="row" style={{ gap: 8 }}>
                    <button className="btn" onClick={() => { setStep(1); setDups([]); }}>やり直す</button>
                    <button className="btn btn-primary" disabled={pending} onClick={create}>
                      {dupMode === 'existing' ? `「${dups[0]?.name}」に担当者を追加` : '企業＋担当者を作成'}
                    </button>
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
