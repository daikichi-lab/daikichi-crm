'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useUI } from '@/components/ui';
import { Icon } from '@/components/icons';
import { getSegmentAction, saveNewsletterDraftAction, sendNewsletterAction, testSendNewsletterAction } from '../actions';

type Sample = { name: string; company: string; email: string };

export function ComposeForm({
  draftId,
  initial,
  topics,
  industries,
  areas,
}: {
  draftId?: string;
  initial: { subject: string; body: string; topics: string[]; segment: { status?: string; industry?: string; area?: string; type?: string } };
  topics: string[];
  industries: string[];
  areas: string[];
}) {
  const router = useRouter();
  const { toast, confirm } = useUI();
  const [pending, startTransition] = useTransition();

  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [selTopics, setSelTopics] = useState<string[]>(initial.topics);
  const [status, setStatus] = useState(initial.segment.status ?? '');
  const [type, setType] = useState(initial.segment.type ?? '');
  const [industry, setIndustry] = useState(initial.segment.industry ?? '');
  const [area, setArea] = useState(initial.segment.area ?? '');

  const [scheduled, setScheduled] = useState(false);
  const [sd, setSd] = useState('2026-06-25');
  const [st, setSt] = useState('09:00');

  const [count, setCount] = useState<number | null>(null);
  const [sample, setSample] = useState<Sample[]>([]);
  const [segLoading, startSeg] = useTransition();

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // セグメント条件が変わるたびにサーバーで対象人数・サンプルを再取得（ライブ）
  useEffect(() => {
    startSeg(async () => {
      const r = await getSegmentAction({ topics: selTopics, status, industry, area });
      setCount(r.count);
      setSample(r.sample);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selTopics, status, industry, area]);

  const toggleTopic = (t: string) =>
    setSelTopics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const insAt = (text: string) => {
    const t = bodyRef.current;
    if (!t) { setBody((b) => b + text); return; }
    const s = t.selectionStart ?? body.length;
    const e = t.selectionEnd ?? body.length;
    const next = body.slice(0, s) + text + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => {
      t.focus();
      const p = s + text.length;
      t.setSelectionRange(p, p);
    });
  };

  const insLink = (kind: 'form' | 'seminar' | 'url') => {
    const m: Record<string, [string, string]> = {
      form: ['お客様情報フォーム', 'https://daikichi-kaikei.example.jp/f/intake'],
      seminar: ['セミナー申込', 'https://daikichi-kaikei.example.jp/f/seminar'],
      url: ['リンクテキスト', 'https://'],
    };
    const [label, url] = m[kind];
    insAt(`\n▶ ${label}：${url}\n`);
    toast('リンクを本文に挿入しました');
  };
  const insCTA = () => {
    insAt('\n────────────────\n  ▶ お客様情報フォームはこちら\n  https://daikichi-kaikei.example.jp/f/intake\n────────────────\n');
    toast('CTAボタンを挿入しました');
  };

  const segment = { status, industry, area, type };
  const payload = () => ({ id: draftId, subject, body, topic_ids: selTopics, segment });

  const saveDraft = () => {
    startTransition(async () => {
      const r = await saveNewsletterDraftAction(payload());
      if (r && (r as any).id) {
        toast('下書きを保存しました');
        if (!draftId) router.replace(`/newsletters/compose?id=${(r as any).id}`);
      } else {
        toast('保存に失敗しました');
      }
    });
  };

  // 本文の下書きは手元のClaude（MCP経由）に依頼する運用（アプリからは有料LLMを呼ばない＝C-1）。
  const claudeDraft = () => toast('本文の下書きは手元のClaude（MCP）に依頼してください（件名・本文をここに貼り付け）');
  const testSend = () => {
    const to = window.prompt('テスト送信先のメールアドレスを入力してください');
    if (!to) return;
    startTransition(async () => {
      const res = await testSendNewsletterAction(subject, body, to.trim());
      toast(res.error ?? `${to} にテスト送信しました`);
    });
  };

  const send = () => {
    const n = count ?? 0;
    if (scheduled) {
      confirm({
        title: 'この日時に予約送信しますか？',
        body: <span>{sd} {st}（JST）に、選択中のトピックの購読者 {n}人 へ送信予約します。予約後も送信前なら編集・取消できます。</span>,
        confirmLabel: '予約する',
        onConfirm: async () => { await sendNewsletterAction(payload()); },
      });
    } else {
      confirm({
        title: `${n}人にメルマガを送信しますか？`,
        body: <span>選択中のトピックの購読者のうち、同意あり・配信停止していない {n}人 に今すぐ送信します。送信者情報と配信停止リンクは自動で本文末尾に付与されます。</span>,
        confirmLabel: '送信する',
        onConfirm: async () => { await sendNewsletterAction(payload()); },
      });
    }
  };

  return (
    <>
      <div className="page-head">
        <div><h2>メルマガを作成</h2><div className="sub">本文を書き、配信トピック × 顧客属性で宛先を絞り込みます。</div></div>
        <div className="actions">
          <button type="button" className="btn" disabled={pending} onClick={saveDraft}>下書き保存</button>
        </div>
      </div>

      <div className="banner info">
        <span><Icon name="help" size={16} /></span>
        <div>送信者情報（事務所名・住所）と<span className="b">配信停止リンク</span>はメール末尾に自動付与されます。<span className="b">配信同意のない宛先・配信停止した人には送信されません。</span></div>
      </div>

      <div className="grid-2 mt16">
        {/* 左: 本文 */}
        <div>
          <div className="panel">
            <div className="panel-head"><h3>内容</h3>
              <div className="actions">
                <button type="button" className="btn btn-sm btn-gold" onClick={claudeDraft}><Icon name="doc" size={14} />Claudeで下書き</button>
              </div>
            </div>
            <div className="panel-body">
              <div className="form-grid">
                <div className="field col-2"><label>件名 <span className="req">*</span></label>
                  <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="件名を入力" /></div>
                <div className="field"><label>送信者名</label><input className="input" defaultValue="大吉会計事務所" /></div>
                <div className="field"><label>返信先メール</label><input className="input" defaultValue="info@daikichi-kaikei.example.jp" /></div>
              </div>

              <div className="field col-2" style={{ marginTop: 16 }}>
                <label>本文</label>
                <div className="row" style={{ gap: 6, margin: '2px 0 6px' }}>
                  <span className="hint">差し込み変数:</span>
                  <span className="merge" onClick={() => insAt('{{氏名}}')}>{'{{氏名}}'}</span>
                  <span className="merge" onClick={() => insAt('{{会社名}}')}>{'{{会社名}}'}</span>
                  <span className="merge" onClick={() => insAt('{{役職}}')}>{'{{役職}}'}</span>
                </div>
                <div className="row" style={{ gap: 6, margin: '0 0 6px' }}>
                  <span className="hint">リンク挿入:</span>
                  <span className="merge link" onClick={() => insLink('form')}>顧客情報フォーム</span>
                  <span className="merge link" onClick={() => insLink('seminar')}>セミナー申込</span>
                  <span className="merge link" onClick={() => insLink('url')}>任意のURL</span>
                  <span className="merge link" onClick={insCTA}>▶ CTAボタン</span>
                </div>
                <textarea ref={bodyRef} className="input body-input" value={body} onChange={(e) => setBody(e.target.value)} />
                <span className="hint">簡易HTML＋差し込み変数に対応。送信前にテスト送信での確認をおすすめします。</span>
              </div>

              <div className="mail-foot">
                ── このメールは配信トピック「{selTopics[0] ?? '（未選択）'}」を購読中の方へお送りしています。<br />
                大吉会計事務所 ／ 〒000-0000 ○○県○○市○○ 1-2-3 ／ TEL 00-0000-0000<br />
                配信を停止する（このリンクは受信者ごとに自動生成されます）
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>テスト送信</h3></div>
            <div className="panel-body row">
              <input className="input" style={{ minWidth: 260 }} defaultValue="yamada@daikichi-kaikei.example.jp" />
              <button type="button" className="btn" onClick={testSend}>自分宛にテスト送信</button>
              <span className="muted" style={{ fontSize: 12 }}>差し込み変数はサンプル値で表示されます。</span>
            </div>
          </div>
        </div>

        {/* 右: 宛先セグメント */}
        <div>
          <div className="panel sticky-side">
            <div className="panel-head"><h3>宛先（セグメント）</h3></div>
            <div className="panel-body">
              <div className="field col-2">
                <label>配信トピック（メルマガ属性）</label>
                <div className="chips" style={{ marginTop: 4 }}>
                  {topics.map((t) => (
                    <span key={t} className={`topic${selTopics.includes(t) ? ' on' : ''}`} onClick={() => toggleTopic(t)}>{t}</span>
                  ))}
                </div>
                <span className="hint">購読者だけが対象。複数選ぶといずれかを購読中の人が対象になります。</span>
              </div>

              <div className="field col-2" style={{ marginTop: 16 }}>
                <label>さらに絞り込み（任意・顧客属性）</label>
                <div className="form-grid" style={{ gap: 10 }}>
                  <div className="field">
                    <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="ステータス">
                      <option value="">ステータス: すべて</option>
                      <option value="顧問中">顧問中</option><option value="見込み">見込み</option><option value="休眠">休眠</option>
                    </select>
                  </div>
                  <div className="field">
                    <select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="種別">
                      <option value="">種別: すべて</option>
                      <option value="法人">法人</option><option value="個人事業主">個人事業主</option>
                    </select>
                  </div>
                  <div className="field">
                    <select className="select" value={industry} onChange={(e) => setIndustry(e.target.value)} aria-label="業種">
                      <option value="">業種: すべて</option>
                      {industries.map((i) => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <select className="select" value={area} onChange={(e) => setArea(e.target.value)} aria-label="エリア">
                      <option value="">エリア: すべて</option>
                      {areas.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                </div>
                <span className="hint">既存の顧客台帳の属性をそのまま条件に使えます（新しい名簿は不要）。</span>
              </div>

              <div className="panel" style={{ marginTop: 16, boxShadow: 'none', background: 'var(--surface-2)' }}>
                <div className="panel-body" style={{ textAlign: 'center' }}>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>送信対象</div>
                  <div className="target-num num">{segLoading ? '…' : (count ?? 0)} <span style={{ fontSize: 15, color: 'var(--ink-3)' }}>人</span></div>
                  <div className="muted" style={{ fontSize: 11.5 }}>同意なし・配信停止は自動除外</div>
                  {sample.length > 0 && (
                    <div className="muted" style={{ fontSize: 11, marginTop: 6, textAlign: 'left' }}>
                      例: {sample.slice(0, 3).map((s) => `${s.name}（${s.company}）`).join('、')}
                    </div>
                  )}
                </div>
              </div>

              <div className="field col-2" style={{ marginTop: 16 }}>
                <label>送信タイミング</label>
                <label className="row" style={{ gap: 8, fontWeight: 500, fontSize: 13 }}>
                  <input type="radio" name="when" checked={!scheduled} onChange={() => setScheduled(false)} /> 今すぐ送信
                </label>
                <label className="row" style={{ gap: 8, fontWeight: 500, fontSize: 13 }}>
                  <input type="radio" name="when" checked={scheduled} onChange={() => setScheduled(true)} /> 予約送信
                </label>
                {scheduled && (
                  <div className="row" style={{ gap: 8, marginTop: 8 }}>
                    <input className="input" type="date" value={sd} onChange={(e) => setSd(e.target.value)} style={{ maxWidth: 160 }} />
                    <input className="input" type="time" value={st} onChange={(e) => setSt(e.target.value)} style={{ maxWidth: 112 }} />
                    <span className="hint">日本時間（JST）</span>
                  </div>
                )}
              </div>

              <button type="button" className="btn btn-primary" style={{ width: '100%', marginTop: 14, height: 44 }} disabled={pending} onClick={send}>
                <Icon name={scheduled ? 'calendar' : 'send'} size={16} />
                {scheduled ? '予約を確定' : `${count ?? 0}人に送信`}
              </button>
              <div className="hint" style={{ textAlign: 'center', marginTop: 6 }}>送信は日次上限内で自動スロットル配信されます。</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
