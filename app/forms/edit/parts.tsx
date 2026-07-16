'use client';

import { useState, useTransition } from 'react';
import { useUI } from '@/components/ui';
import { Icon } from '@/components/icons';
import { saveFormConfigAction } from './actions';

// 公開フォームの項目定義（mockups/form-edit.html の FIELDS を移植）。
// key: get_public_form_config().fields の要素キーに対応（表示ON/OFFはこの key の有無で連動）。
type Field = {
  key: string;
  label: string;
  type: string;
  render?: 'radio' | 'check';
  src?: 'master' | 'custom' | 'tag';
  master?: string;
  fixed?: boolean;
  opts?: string[];
  total?: number;
  kind?: 'need' | 'offer';
  checktext?: string;
  ph?: string;
  req?: boolean;
  lock?: boolean;
  editableMaster?: boolean;
};

const FIELDS: Field[] = [
  { key: 'type', label: '種別', type: '単一選択', render: 'radio', src: 'master', master: '種別（固定）', fixed: true, opts: ['法人', '個人事業主'], req: true, lock: true },
  { key: 'name', label: '会社名 / 屋号', type: '1行テキスト', ph: '株式会社サンプル', req: true, lock: true },
  { key: 'contact', label: 'ご担当者名', type: '1行テキスト', ph: '山田 太郎', req: true, lock: true },
  { key: 'kana', label: 'フリガナ', type: '1行テキスト', ph: 'ヤマダ タロウ', req: false },
  { key: 'email', label: 'メール', type: 'メール', ph: 'taro@example.co.jp', req: true, lock: true },
  { key: 'phone', label: '電話', type: '電話', ph: '03-1234-5678', req: false },
  { key: 'industry', label: '業種', type: '選択', src: 'master', master: '業種マスタ', opts: ['飲食', '建設', '卸売', '小売', 'IT・情報通信', '専門サービス'], total: 18, req: false, editableMaster: true },
  { key: 'area', label: 'エリア（都道府県）', type: '選択', src: 'master', master: '都道府県マスタ', fixed: true, opts: ['東京都', '大阪府', '愛知県', '福岡県'], total: 47, req: false },
  { key: 'size', label: '規模（売上）', type: '選択', src: 'master', master: '規模区分', fixed: true, opts: ['〜1千万', '1千万〜5千万', '5千万〜1億', '1億〜10億', '10億〜'], req: false },
  { key: 'needs', label: '求めてること', type: 'タグ', src: 'tag', kind: 'need', opts: ['集客', '仕入先', '資金調達'], req: false },
  { key: 'offers', label: '提供できること', type: 'タグ', src: 'tag', kind: 'offer', opts: ['食材卸'], req: false },
  { key: 'sns', label: 'Webサイト・SNS', type: 'URL', ph: 'https://example.co.jp / SNSのURL', req: false },
  { key: 'message', label: 'ご相談・メッセージ', type: '複数行テキスト', ph: 'ご要望やご紹介してほしい相手など', req: false },
  { key: 'newsletter', label: 'メルマガを購読する', type: 'チェック', render: 'check', checktext: 'メルマガ（税務・セミナー案内）を購読する', req: false },
];

function FieldPreview({ f }: { f: Field }) {
  if (f.render === 'radio')
    return (
      <>
        {f.opts!.map((o, i) => (
          <label key={o} className="row" style={{ gap: 6, fontWeight: 500, marginRight: 14, display: 'inline-flex' }}>
            <input type="radio" name={`pv_${f.key}`} disabled defaultChecked={i === 0} /> {o}
          </label>
        ))}
      </>
    );
  if (f.render === 'check')
    return <label className="row" style={{ gap: 8, fontWeight: 500 }}><input type="checkbox" disabled /> {f.checktext}</label>;
  if (f.type === '選択')
    return (
      <select className="select" disabled>
        <option>選択してください</option>
        {f.opts!.map((o) => <option key={o}>{o}</option>)}
        {f.total && f.total > f.opts!.length ? <option>…ほか {f.total - f.opts!.length} 件</option> : null}
      </select>
    );
  if (f.type === 'タグ') {
    const cls = f.kind === 'offer' ? 'offer' : 'need';
    const mk = f.kind === 'offer' ? '提' : '求';
    return (
      <div className="chips">
        {f.opts!.map((o) => <span key={o} className={`chip ${cls}`}><span className="mk">{mk}</span>{o} <span className="x">✕</span></span>)}
        <span className="chip chip-add">＋ 追加</span>
      </div>
    );
  }
  if (f.type === '複数行テキスト') return <textarea className="input" rows={2} placeholder={f.ph} disabled />;
  return <input className="input" placeholder={f.ph} disabled />;
}

function ChoiceInfo({ f }: { f: Field }) {
  if (f.src === 'master')
    return (
      <div className="choice">
        選択肢：<span className="src">{f.master}</span> を参照（{f.opts!.join(' / ')}{f.total && f.total > f.opts!.length ? ` …全${f.total}項目` : ''}）{' '}
        {f.editableMaster ? <a href="/admin/masters" target="_blank">マスタを編集 ↗</a> : <span className="muted">固定マスタ（編集不可）</span>}
      </div>
    );
  if (f.src === 'tag')
    return (
      <div className="choice">
        選択肢：<span className="src">求 / 提 の共通語彙（タグマスタ）</span>を参照。未知タグは確認のうえ追加。 <a href="/admin/masters" target="_blank">タグを編集 ↗</a>
      </div>
    );
  if (f.ph) return <div className="choice muted">プレースホルダ：{f.ph}</div>;
  return null;
}

type Config = {
  title?: string;
  intro?: string;
  consent?: string;
  submit_label?: string;
  done_title?: string;
  notify_email?: string;
  auto_subscribe?: boolean;
  rate_limit?: boolean;
  published?: boolean;
  fields?: string[];
};

export function FormEditor({ config, publicUrl }: { config: Config; publicUrl: string }) {
  const { toast, confirm } = useUI();
  const [pending, start] = useTransition();

  const [title, setTitle] = useState(config.title ?? '');
  const [intro, setIntro] = useState(config.intro ?? '');
  const [consent, setConsent] = useState(config.consent ?? '');
  const [submitLabel, setSubmitLabel] = useState(config.submit_label ?? '送信する');
  const [doneTitle, setDoneTitle] = useState(config.done_title ?? '送信ありがとうございました');
  const [notifyEmail, setNotifyEmail] = useState(config.notify_email ?? 'info@daikichi-kaikei.example.jp');
  const [autoSubscribe, setAutoSubscribe] = useState(config.auto_subscribe ?? true);
  const [rateLimit, setRateLimit] = useState(config.rate_limit ?? true);
  const [published, setPublished] = useState(config.published ?? true);
  const [qrOpen, setQrOpen] = useState(false);
  const [shown, setShown] = useState<Set<string>>(new Set(config.fields ?? FIELDS.map((f) => f.key)));

  const toggleShow = (f: Field) => {
    if (f.lock) return;
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(f.key)) next.delete(f.key);
      else next.add(f.key);
      return next;
    });
  };

  // 保存する設定を組み立てる（overrides で published 等を明示上書き）。
  const buildConfig = (overrides: Partial<Config> = {}): Config => ({
    title, intro, consent,
    submit_label: submitLabel, done_title: doneTitle,
    notify_email: notifyEmail, auto_subscribe: autoSubscribe,
    rate_limit: rateLimit, published,
    fields: FIELDS.filter((f) => shown.has(f.key)).map((f) => f.key),
    ...overrides,
  });

  const save = () =>
    start(async () => {
      const res = await saveFormConfigAction(buildConfig());
      if (res.error) toast(`保存できません: ${res.error}`);
      else toast('フォームを保存しました');
    });

  const setPublishState = (next: boolean) =>
    start(async () => {
      const res = await saveFormConfigAction(buildConfig({ published: next }));
      if (res.error) { toast(`保存できません: ${res.error}`); return; }
      setPublished(next);
      toast(next ? 'フォームを再公開しました' : 'フォームを公開停止しました');
    });

  const copyUrl = async () => {
    try { await navigator.clipboard.writeText(publicUrl); } catch { /* ignore */ }
    toast('URLをコピーしました');
  };

  const shownCount = FIELDS.filter((f) => shown.has(f.key)).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>フォーム管理</h2>
          <div className="sub">公開フォームの項目・文言・公開設定を編集します。回答は受信箱に貯まり、直接DBには書き込まれません。</div>
        </div>
        <div className="actions">
          <button className="btn" onClick={copyUrl}>URLをコピー</button>
          <button className="btn btn-primary" onClick={save} disabled={pending}>{pending ? '保存中…' : '保存'}</button>
        </div>
      </div>

      <div className="grid-2">
        {/* 左: 基本設定＋項目 */}
        <div>
          <div className="panel">
            <div className="panel-head"><h3>基本設定</h3></div>
            <div className="panel-body">
              <div className="form-grid">
                <div className="field col-2"><label>見出し（公開ページの大見出し）</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                <div className="field col-2"><label>説明文</label><textarea className="input" rows={2} value={intro} onChange={(e) => setIntro(e.target.value)} /></div>
                <div className="field"><label>送信ボタンの文言</label><input className="input" value={submitLabel} onChange={(e) => setSubmitLabel(e.target.value)} /></div>
                <div className="field"><label>送信後メッセージ（見出し）</label><input className="input" value={doneTitle} onChange={(e) => setDoneTitle(e.target.value)} /></div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>入力項目</h3><span className="count num">{shownCount} 項目</span></div>
            <div className="panel-body">
              <div className="banner info" style={{ fontSize: 12.5, marginBottom: 12 }}>
                <Icon name="help" size={16} />
                <div>各項目に<b>表示プレビュー</b>（公開フォームでの見え方）を表示します。<b>選択項目</b>は「<b>マスタ参照</b>（管理のマスタを共有・値も連動）」か「<b>自由設定</b>」のどちらかです。新項目はまず extra(JSONB) に保存（C-8）。</div>
              </div>
              <div className="fcards">
                {FIELDS.map((f) => {
                  const isShown = shown.has(f.key);
                  return (
                    <div className="fcard" key={f.key}>
                      <div className="fh">
                        <span className="grip" title="ドラッグで並び替え">⠿</span>
                        <span className="lbl">{f.label}</span>
                        {f.lock && <span className="muted" style={{ fontSize: 11 }}>基本項目</span>}
                        <span className={`tpill ${f.src === 'master' ? 'master' : ''}`}>
                          {f.type + (f.src === 'master' ? '・マスタ参照' : '')}
                        </span>
                        <span className="togs">
                          {f.lock
                            ? <span className="tog" style={{ color: 'var(--brand-700)' }}>必須</span>
                            : <span className="tog">必須<span className="tg"><input type="checkbox" defaultChecked={f.req} disabled /><span className="tk" /></span></span>}
                          <span className="tog">表示
                            <span className={`tg ${f.lock ? 'lock' : ''}`}>
                              <input type="checkbox" checked={f.lock ? true : isShown} disabled={f.lock} onChange={() => toggleShow(f)} />
                              <span className="tk" onClick={() => toggleShow(f)} />
                            </span>
                          </span>
                        </span>
                      </div>
                      <div className="fb">
                        <div className="prev"><div className="pl">表示プレビュー（公開フォームでの見え方）</div><FieldPreview f={f} /></div>
                        <ChoiceInfo f={f} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 右: 公開・共有／受信後／同意文 */}
        <div>
          <div className="panel">
            <div className="panel-head"><h3>公開・共有</h3>
              <span className={`badge ${published ? 'active' : ''}`}><span className="dot" />{published ? '公開中' : '停止中'}</span>
            </div>
            <div className="panel-body">
              <div className="field"><label>公開URL（ログイン不要）</label>
                <div className="row" style={{ gap: 6 }}>
                  <input className="input num" style={{ flex: 1, fontSize: 12 }} value={publicUrl} readOnly />
                  <button className="btn btn-sm" onClick={copyUrl}>コピー</button>
                </div>
                <span className="hint">名刺・メール・メルマガ・QRなどから案内できます。</span>
              </div>
              <div className="row mt16" style={{ gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="row" style={{ gap: 6, fontSize: 13 }} title="送信フォームに隠しフィールドを仕込み、ボットの自動投稿を破棄します（常時ON）">
                  <span style={{ color: 'var(--brand-700)', fontWeight: 700 }}>✓</span> ハニーポット（ボット対策・常時ON）
                </span>
                <label className="row" style={{ gap: 8, fontSize: 13 }} title="同一IPから10分に5件までに制限">
                  <span className="tg"><input type="checkbox" checked={rateLimit} onChange={(e) => setRateLimit(e.target.checked)} /><span className="tk" onClick={() => setRateLimit((v) => !v)} /></span>
                  レート制限（同一IP・10分5件）
                </label>
              </div>
              <div className="row mt16" style={{ gap: 8 }}>
                <button className="btn btn-sm" onClick={() => setQrOpen(true)}>QRコード</button>
                {published ? (
                  <button
                    className="btn btn-sm btn-danger"
                    disabled={pending}
                    onClick={() =>
                      confirm({
                        title: 'フォームを公開停止しますか？',
                        body: '停止中は公開URLにアクセスしても受け付けません。いつでも再公開できます。',
                        confirmLabel: '公開を停止',
                        danger: true,
                        onConfirm: () => new Promise<void>((resolve) => { setPublishState(false); resolve(); }),
                      })
                    }
                  >
                    公開を停止
                  </button>
                ) : (
                  <button className="btn btn-sm btn-primary" disabled={pending} onClick={() => setPublishState(true)}>再公開する</button>
                )}
              </div>
            </div>
          </div>

          {qrOpen && (
            <div className="scrim" onClick={(e) => e.target === e.currentTarget && setQrOpen(false)}>
              <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 380 }}>
                <div className="m-head"><h3>公開フォームのQRコード</h3></div>
                <div className="m-body" style={{ textAlign: 'center' }}>
                  {/* SVGは /api/forms/qr がサーバ内生成（外部サービスに問い合わせない）。 */}
                  <img src="/api/forms/qr" alt="公開フォームのQRコード" width={240} height={240} style={{ maxWidth: '100%', height: 'auto' }} />
                  <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>名刺・チラシ・掲示などに印刷して案内できます。</div>
                </div>
                <div className="m-foot">
                  <button className="btn" onClick={() => setQrOpen(false)}>閉じる</button>
                  <a className="btn btn-primary" href="/api/forms/qr" download="daikichi-form-qr.svg">SVGをダウンロード</a>
                </div>
              </div>
            </div>
          )}

          <div className="panel">
            <div className="panel-head"><h3>受信後の動作</h3></div>
            <div className="panel-body">
              <div className="banner info" style={{ fontSize: 12.5 }}>
                <Icon name="inbox" size={16} />
                <div>回答は <b>form_submissions</b>（anon INSERTのみ・RLS保護）に入り、<b>companies へ直書きしません</b>。スタッフが受信箱で確認・取込します。</div>
              </div>
              <label className="row mt16" style={{ gap: 8, fontSize: 13 }}>
                <span className="tg"><input type="checkbox" checked={autoSubscribe} onChange={(e) => setAutoSubscribe(e.target.checked)} /><span className="tk" onClick={() => setAutoSubscribe((v) => !v)} /></span>
                <span>「メルマガ購読」に同意した回答を<b>購読者へ自動登録</b>（確認メールでダブルオプトイン）</span>
              </label>
              <div className="field mt16"><label>新着回答の通知先メール</label><input className="input" value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} /></div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>個人情報の取り扱い同意文</h3></div>
            <div className="panel-body">
              <textarea className="input" rows={3} value={consent} onChange={(e) => setConsent(e.target.value)} />
              <span className="hint">公開フォームのチェックボックスに表示されます（必須・固定）。</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function TopbarActions({ publicUrl }: { publicUrl: string }) {
  const { toast } = useUI();
  const copyUrl = async () => {
    try { await navigator.clipboard.writeText(publicUrl); } catch { /* ignore */ }
    toast('公開フォームのURLをコピーしました');
  };
  return (
    <>
      <a className="btn btn-sm" href={publicUrl} target="_blank">プレビュー ↗</a>
      <button className="btn btn-sm" onClick={copyUrl}>URLをコピー</button>
    </>
  );
}
