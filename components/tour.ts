// 使い方ツアー（案内人）: スポットライト＋コーチカード。mockups/assets/app.js の startTour を移植。
// startTour(steps, {mode:'tour'|'feature'})
//   step: { sel?, title, body, note?, before?, cta?, onCta?, eyebrow? }
//   sel なし = 中央カード（締めの一枚）。before = 表示前に実行（ビュー切替など）。
// React の状態更新（before によるビュー切替）後に要素が現れるまで rAF でリトライする。

export type TourStep = {
  sel?: string;
  title: string;
  /** 開発者定義の静的HTML（<b>等の簡易マークアップ可）。ユーザー入力・DB由来の文字列を渡さないこと（XSS） */
  body: string;
  note?: string;
  before?: () => void;
  cta?: string;
  onCta?: () => void;
  eyebrow?: string;
};
export type TourOpts = { mode?: 'tour' | 'feature' };

type TourState = {
  steps: TourStep[];
  i: number;
  mode: 'tour' | 'feature';
  veil: HTMLDivElement;
  spot: HTMLDivElement;
  card: HTMLDivElement;
  onKey: (e: KeyboardEvent) => void;
  onRs: () => void;
};

let T: TourState | null = null;

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** before 直後は要素が未マウントのことがあるため、見つかるまで数フレーム待つ */
function waitEl(sel: string | undefined, tries: number, cb: (el: Element | null) => void) {
  if (!sel) return cb(null);
  const el = document.querySelector(sel);
  if (el || tries <= 0) return cb(el);
  requestAnimationFrame(() => waitEl(sel, tries - 1, cb));
}

function place(repos = false) {
  if (!T) return;
  const s = T.steps[T.i];
  if (s.before && !repos) s.before();
  waitEl(s.sel, 30, (el) => {
    if (!T) return;
    if (el) el.scrollIntoView({ block: 'center' });
    requestAnimationFrame(() => {
      if (!T) return;
      const t = T;
      const last = t.i === t.steps.length - 1;
      const eyebrow = s.eyebrow || (t.mode === 'feature' ? '新機能' : '使い方ツアー');
      const stp = t.steps.length > 1 ? `<span class="stp num">${t.i + 1}/${t.steps.length}</span>` : '';
      const dots = t.steps.length > 1
        ? `<div class="tour-dots">${t.steps.map((_, j) => '<i class="' + (j === t.i ? 'on' : '') + '"></i>').join('')}</div>`
        : '<div class="tour-dots"></div>';
      const btns = t.mode === 'feature'
        ? `<button class="btn btn-sm btn-ghost" data-act="close">あとで</button>
           <button class="btn btn-sm btn-primary" data-act="cta">${esc(s.cta || '試してみる')}</button>`
        : (t.i > 0 ? '<button class="btn btn-sm" data-act="prev">戻る</button>' : '') +
          `<button class="btn btn-sm btn-primary" data-act="next">${last ? '完了' : '次へ'}</button>`;
      T.card.innerHTML =
        `<button class="x" data-act="close" aria-label="とじる">✕</button>
         <div class="hd"><div class="guide">案</div><div><div class="eyebrow">${esc(eyebrow)}${stp}</div><h4>${esc(s.title)}</h4></div></div>
         <div class="bd">${s.body}</div>` +
        (s.note ? `<div class="tour-note">${esc(s.note)}</div>` : '') +
        `<div class="ft">${dots}${btns}</div><span class="arr" hidden></span>`;

      const r = el ? el.getBoundingClientRect() : null;
      if (r) {
        T.veil.style.background = 'transparent';
        T.spot.style.display = 'block';
        T.spot.style.left = `${r.left - 6}px`;
        T.spot.style.top = `${r.top - 6}px`;
        T.spot.style.width = `${r.width + 12}px`;
        T.spot.style.height = `${r.height + 12}px`;
      } else {
        T.spot.style.display = 'none';
        T.veil.style.background = 'rgba(14,44,71,.58)';
      }
      const cw = T.card.offsetWidth;
      const ch = T.card.offsetHeight;
      let cx: number;
      let cy: number;
      let arrPos: 'top' | 'bottom' | null = null;
      if (r) {
        cx = Math.min(Math.max(r.left + r.width / 2 - cw / 2, 16), window.innerWidth - cw - 16);
        cy = r.bottom + 18;
        if (cy + ch > window.innerHeight - 16) { cy = r.top - ch - 18; arrPos = 'bottom'; }
        else { arrPos = 'top'; }
        if (cy < 16) { cy = 16; arrPos = null; }
      } else {
        cx = (window.innerWidth - cw) / 2;
        cy = Math.max((window.innerHeight - ch) / 2, 16);
      }
      T.card.style.left = `${cx}px`;
      T.card.style.top = `${cy}px`;
      const arr = T.card.querySelector('.arr') as HTMLElement | null;
      if (arr && arrPos && r) {
        arr.hidden = false;
        arr.style.left = `${Math.min(Math.max(r.left + r.width / 2 - cx - 6, 14), cw - 26)}px`;
        if (arrPos === 'top') { arr.style.top = '-6px'; arr.style.bottom = 'auto'; }
        else { arr.style.bottom = '-6px'; arr.style.top = 'auto'; }
      }
    });
  });
}

export function startTour(steps: TourStep[], opts?: TourOpts) {
  endTour();
  const veil = document.createElement('div'); veil.className = 'tour-veil';
  const spot = document.createElement('div'); spot.className = 'tour-spot';
  const card = document.createElement('div'); card.className = 'tour-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', '使い方ツアー');
  T = {
    steps, i: 0, mode: opts?.mode || 'tour', veil, spot, card,
    onKey: (e: KeyboardEvent) => {
      if (!T) return;
      if (e.key === 'Escape') endTour();
      else if (e.key === 'ArrowRight' && T.mode !== 'feature') { if (T.i < T.steps.length - 1) { T.i++; place(); } }
      else if (e.key === 'ArrowLeft' && T.mode !== 'feature') { if (T.i > 0) { T.i--; place(); } }
    },
    onRs: () => place(true),
  };
  veil.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
  veil.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  card.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).dataset?.act;
    if (!act || !T) return;
    const s = T.steps[T.i];
    if (act === 'close') endTour();
    else if (act === 'prev') { T.i--; place(); }
    else if (act === 'next') { if (T.i >= T.steps.length - 1) endTour(); else { T.i++; place(); } }
    else if (act === 'cta') { const fn = s.onCta; endTour(); if (fn) fn(); }
  });
  document.addEventListener('keydown', T.onKey);
  window.addEventListener('resize', T.onRs);
  document.body.append(veil, spot, card);
  place();
}

export function endTour() {
  if (!T) return;
  document.removeEventListener('keydown', T.onKey);
  window.removeEventListener('resize', T.onRs);
  T.veil.remove(); T.spot.remove(); T.card.remove();
  T = null;
}
