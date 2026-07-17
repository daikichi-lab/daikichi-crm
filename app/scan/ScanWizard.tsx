'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition, useEffect, useRef } from 'react';
import { useUI } from '@/components/ui';
import { Icon } from '@/components/icons';
import { detectDuplicateAction, createCompanyWithContactAction, addContactToCompanyAction, uploadScanImageAction } from './actions';
import { parseBusinessCard } from './ocr-parse';

type Masters = { industries: string[]; areas: string[]; sizes: string[] };
type DupCandidate = { id: string; name: string; industry?: string; area?: string; status?: string };

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

  // 実画像（表/裏）と OCR
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontUrl, setFrontUrl] = useState<string>('');
  const [backUrl, setBackUrl] = useState<string>('');
  const [ocrPct, setOcrPct] = useState(0);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrText, setOcrText] = useState('');

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

  const [dups, setDups] = useState<DupCandidate[]>([]);
  const [dupMode, setDupMode] = useState<'existing' | 'new'>('new');

  // オブジェクトURLの後始末
  useEffect(() => () => { if (frontUrl) URL.revokeObjectURL(frontUrl); }, [frontUrl]);
  useEffect(() => () => { if (backUrl) URL.revokeObjectURL(backUrl); }, [backUrl]);

  const pickFront = (f: File | undefined) => {
    if (!f) return;
    if (frontUrl) URL.revokeObjectURL(frontUrl);
    setFrontFile(f);
    setFrontUrl(URL.createObjectURL(f));
    setStep(2);
  };
  const pickBack = (f: File | undefined) => {
    if (!f) return;
    if (backUrl) URL.revokeObjectURL(backUrl);
    setBackFile(f);
    setBackUrl(URL.createObjectURL(f));
    toast('裏面を追加しました');
  };

  const applyParsed = (text: string) => {
    setOcrText(text);
    const p = parseBusinessCard(text);
    if (p.company) setCompany(p.company);
    if (p.name) setName(p.name);
    if (p.title) setTitle(p.title);
    if (p.email) setEmail(p.email);
    if (p.phone) setPhone(p.phone);
    if (p.mobile) setMobile(p.mobile);
    if (p.address) setAddress(p.address);
  };

  // ブラウザ内 Tesseract.js（画像を外部OCRサービスに送らない）。失敗時は手入力へフォールバック。
  const runOcr = async () => {
    if (!frontFile) { toast('先に名刺画像を取り込んでください'); return; }
    setOcrRunning(true);
    setOcrPct(0);
    try {
      const [{ createWorker }, { preprocessCardImage }] = await Promise.all([
        import('tesseract.js'),
        import('./preprocess'),
      ]);
      // 前処理（グレースケール＋コントラスト伸長＋拡大）で読み取り精度を上げる。失敗時は元画像。
      const input = await preprocessCardImage(frontFile);
      const worker = await createWorker('jpn+eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') setOcrPct(Math.round(m.progress * 100));
        },
      });
      const { data } = await worker.recognize(input);
      await worker.terminate();
      applyParsed(data.text || '');
      setOcrPct(100);
      setStep(3);
      toast('読み取りました。内容を必ず確認・補正してください。');
    } catch {
      toast('自動読み取りに失敗しました。手入力で入力してください。');
      setStep(3);
    } finally {
      setOcrRunning(false);
    }
  };

  const skipOcr = () => { setStep(3); };

  // step3 に入ったら重複検出（会社名が入っているとき）
  useEffect(() => {
    if (step !== 3 || !company) { setDups([]); return; }
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

  // 表/裏を実アップロードして Storage パスを得る
  const uploadImages = async (): Promise<{ front?: string; back?: string; error?: string }> => {
    let front: string | undefined;
    let back: string | undefined;
    if (frontFile) {
      const fd = new FormData(); fd.append('file', frontFile);
      const r = await uploadScanImageAction(fd);
      if (r.error) return { error: r.error };
      front = r.path;
    }
    if (backFile) {
      const fd = new FormData(); fd.append('file', backFile);
      const r = await uploadScanImageAction(fd);
      if (r.error) return { error: r.error };
      back = r.path;
    }
    return { front, back };
  };

  const create = () => {
    if (!name.trim()) { toast('氏名を確認してください'); return; }
    if (dupMode === 'new' && !company.trim()) { toast('会社名 / 屋号を入力してください'); return; }
    start(async () => {
      const up = await uploadImages();
      if (up.error) { toast(`画像のアップロードに失敗: ${up.error}`); return; }
      if (dupMode === 'existing' && dups[0]) {
        await addContactToCompanyAction(dups[0].id, contactPayload(), up.front, up.back);
        toast(`「${dups[0].name}」に担当者を追加しました`);
        router.push(`/companies/${dups[0].id}#contacts`);
      } else {
        const res = await createCompanyWithContactAction(
          { name: company.trim(), type, industry: industry || undefined, area: area || undefined, size: size || undefined },
          contactPayload(),
          up.front, up.back,
        );
        if (res?.error) { toast(res.error); return; }
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

      <div className="page-head"><div><h2>名刺から顧客を作成</h2><div className="sub">読み取り後に必ず内容を確認・補正してから作成します（OCR: ブラウザ内 Tesseract.js・画像は外部送信しません）</div></div></div>

      {/* 隠しファイル入力（撮影=capture / ファイル選択） */}
      <input ref={frontRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pickFront(e.target.files?.[0])} />
      <input ref={backRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pickBack(e.target.files?.[0])} />

      <div className="scan-split">
        {/* 左: 画像とOCR */}
        <div>
          <div className="scan-preview">
            <div className="row" style={{ justifyContent: 'space-between', color: '#cdddea', fontSize: 12.5, fontWeight: 700 }}>
              <span>取り込んだ名刺</span>
              <span className="row" style={{ gap: 6 }}>
                <button className="btn btn-sm" data-icon="card" onClick={() => frontRef.current?.click()}>撮影</button>
                <button className="btn btn-sm" onClick={() => frontRef.current?.click()}>ファイル</button>
              </span>
            </div>
            {step === 1 || !frontUrl ? (
              <div className="shot" role="button" tabIndex={0} onClick={() => frontRef.current?.click()} style={{ display: 'grid', placeItems: 'center', background: '#1f2832', color: '#9fb6c9', cursor: 'pointer' }}>
                <div style={{ textAlign: 'center', fontSize: 13 }}><div style={{ fontSize: 26 }}>＋</div>タップして撮影 / ファイルを選択</div>
              </div>
            ) : (
              <div className="shot" style={{ background: '#0d1116' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={frontUrl} alt="取り込んだ名刺（表）" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
            )}
            <div style={{ color: '#9fb6c9', fontSize: 12 }}>裏面（任意）: <button className="linklike" onClick={() => backRef.current?.click()} style={{ color: '#bcd2e4', background: 'none', border: 0, cursor: 'pointer', padding: 0 }}>{backFile ? '✓ 追加済み（変更）' : '＋ 追加'}</button></div>
          </div>

          <div className="panel mt16">
            <div className="panel-body">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="b">OCR 読み取り</span>
                <span className="muted" style={{ fontSize: 12 }}>{step >= 3 ? '完了' : ocrRunning ? `${ocrPct}%` : step === 2 ? '待機中' : '未取込'}</span>
              </div>
              <div className="progress"><i style={{ width: step >= 3 ? '100%' : ocrRunning ? `${ocrPct}%` : '0%' }} /></div>
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>画像はブラウザ内で処理。外部サービスには送信していません。初回は言語データの取得に少し時間がかかります。</div>
              {step === 2 && (
                <div className="row mt8" style={{ gap: 6 }}>
                  <button className="btn btn-sm btn-primary" onClick={runOcr} disabled={ocrRunning}><Icon name="card" size={14} />{ocrRunning ? '読み取り中…' : '読み取りを実行'}</button>
                  <button className="btn btn-sm" onClick={skipOcr} disabled={ocrRunning}>OCRせず手入力で進む</button>
                </div>
              )}
              {step >= 3 && frontFile && <button className="btn btn-sm mt8" onClick={() => { setStep(2); }} disabled={ocrRunning}>読み取りをやり直す</button>}
              {ocrText && step >= 3 && (
                <details className="mt8"><summary className="muted" style={{ fontSize: 12, cursor: 'pointer' }}>読み取り原文（確認用）</summary>
                  <div className="num" style={{ fontSize: 11.5, whiteSpace: 'pre-wrap', color: 'var(--ink-3)', marginTop: 6, maxHeight: 160, overflow: 'auto' }}>{ocrText}</div>
                </details>
              )}
            </div>
          </div>
        </div>

        {/* 右: 抽出結果フォーム */}
        <div className="panel">
          <div className="panel-head"><h3>抽出結果を確認・補正</h3></div>
          <div className="panel-body">
            {step < 3 ? (
              <div className="muted" style={{ padding: '24px 4px', fontSize: 13 }}>名刺を取り込み、左の「読み取りを実行」を押すと、ここに抽出結果が表示されます（自動読み取りをせず手入力も可）。</div>
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
                    <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} disabled={dupMode === 'existing'} placeholder="株式会社サンプル / 屋号" />
                  </div>
                  <div className="field">
                    <label>氏名</label>
                    <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="山田 太郎" />
                  </div>
                  <div className="field">
                    <label>役職</label>
                    <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="代表 / 部長 など" />
                  </div>
                  <div className="field col-2">
                    <label>メール</label>
                    <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="taro@example.co.jp" />
                  </div>
                  <div className="field">
                    <label>電話</label>
                    <input className="input num" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03-1234-5678" />
                  </div>
                  <div className="field">
                    <label>携帯</label>
                    <input className="input num" placeholder="090-…" value={mobile} onChange={(e) => setMobile(e.target.value)} />
                  </div>
                  <div className="field col-2">
                    <label>住所</label>
                    <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="都道府県市区町村…" />
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
                    ? <>既存の <b>「{dups[0]?.name}」</b> に 担当者 <b>「{name || '（氏名未入力）'}」</b> を追加します。会社情報は既存のものを使います。名刺画像も保存します。</>
                    : <>新しい企業 <b>「{company || '（会社名未入力）'}」</b> ＋ 担当者 <b>「{name || '（氏名未入力）'}」</b> を作成します。名刺画像も保存します。</>}
                </div>

                <div className="row mt16" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {dupMode === 'existing' ? <>登録先: <b>既存企業「{dups[0]?.name}」</b></> : <>登録先: <b>新しい企業「{company || '未入力'}」</b></>}
                  </span>
                  <span className="row" style={{ gap: 8 }}>
                    <button className="btn" onClick={() => { setStep(1); setDups([]); }} disabled={pending}>やり直す</button>
                    <button className="btn btn-primary" disabled={pending} onClick={create}>
                      {pending ? '作成中…' : dupMode === 'existing' ? `「${dups[0]?.name}」に担当者を追加` : '企業＋担当者を作成'}
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
