/* 大吉CRM モックアップ — 共通シェル注入と簡易インタラクション */
(function () {
  // --- ミニ・アイコンセット（24x24 ストローク） ---
  const I = {
    home: 'M3 11.2 12 4l9 7.2M5.5 9.8V20h13V9.8',
    building: 'M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 21V9h4a1 1 0 0 1 1 1v11M3 21h18M7 8h4M7 12h4M7 16h4',
    card: 'M3 6h18v12H3zM3 10h18M6.5 14h5',
    link: 'M9 12h6M10 8.5H8a3.5 3.5 0 0 0 0 7h2M14 8.5h2a3.5 3.5 0 0 1 0 7h-2',
    handshake: 'M5 13l3-3 4 3 4-4 3 3M4 9l4-3 4 3M12 12v6M8 18h8',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',
    gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v2M12 19v2M5 5l1.5 1.5M17.5 17.5 19 19M3 12h2M19 12h2M5 19l1.5-1.5M17.5 6.5 19 5',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20c0-3.5 3-6 7-6s7 2.5 7 6',
    search: 'M11 11m-7 0a7 7 0 1 0 14 0 7 7 0 1 0-14 0M21 21l-5-5',
    menu: 'M4 7h16M4 12h16M4 17h16',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 1.8',
    pulse: 'M3 12h3.5l2.2-6 4 13 2.4-7H21',
    phone: 'M5 4h4l1.6 5L8 11a12 12 0 0 0 5 5l2-2.6 5 1.6v4a2 2 0 0 1-2.2 2A16 16 0 0 1 3 6.2 2 2 0 0 1 5 4',
    check: 'M5 12.5l4.2 4L19 6',
    folder: 'M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
    doc: 'M7 3h10v18H7zM9 8h6M9 12h6M9 16h4',
    inbox: 'M4 5h16v14H4zM4 13h6l1 2h2l1-2h6',
    help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.6 9a2.4 2.4 0 1 1 3.2 2.3c-.7.3-1.3.8-1.3 1.7M12 16.5h.01',
    mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
    send: 'M4 12l16-7-6 16-3-7-7-2z',
    users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 4.2a3.5 3.5 0 0 1 0 6.8M17.5 14.5c2.3.5 3.5 2.3 3.5 5',
  };
  function svg(d, w) {
    return `<svg class="ic" width="${w||18}" height="${w||18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${
      d.split('M').filter(Boolean).map(s => `<path d="M${s}"/>`).join('')
    }</svg>`;
  }
  window.icon = svg; window.ICONS = I;

  // --- サイドバー ---
  // 並びは実アプリ（components/AppShell.tsx）と同期: 業務動線順＋活動履歴はメルマガの下
  const NAV = [
    { id:'home',     label:'ホーム',       href:'dashboard.html',     ic:I.home },
    { id:'schedule', label:'期限・タスク', href:'schedule.html',      ic:I.clock },
    { id:'companies',label:'顧客（企業）', href:'companies.html',     ic:I.building, count:'248' },
    { id:'people',   label:'会った人',     href:'people.html',        ic:I.users },
    { id:'scan',     label:'名刺スキャン', href:'scan.html',          ic:I.card },
    { id:'documents',label:'資料',         href:'documents.html',     ic:I.folder },
    { id:'matching', label:'マッチング',   href:'matching.html',      ic:I.link },
    { id:'referrals',label:'紹介',         href:'referrals.html',     ic:I.handshake },
  ];
  const CONNECT = [
    { id:'meetings',   label:'打ち合わせ',   href:'meetings.html',      ic:I.calendar },
    { id:'notes',      label:'議事録',       href:'notes.html',         ic:I.doc },
    { id:'forms',      label:'フォーム',     href:'form-inbox.html',    ic:I.inbox },
    { id:'newsletter', label:'メルマガ',     href:'newsletters.html',   ic:I.mail },
    { id:'activities', label:'活動履歴',     href:'activities.html',    ic:I.pulse },
  ];
  const ADMIN = [
    { id:'admin',    label:'管理',         href:'admin-users.html',   ic:I.gear },
  ];

  function buildSidebar(active) {
    const item = n => `<a href="${n.href}" class="${n.id===active?'active':''} ${n.phase2?'phase2':''}">
        ${svg(n.ic)}<span>${n.label}</span>
        ${n.count?`<span class="badge-count num">${n.count}</span>`:''}
        ${n.phase2?'<span class="tag">P2</span>':''}
      </a>`;
    return `
      <div class="brand">
        <span class="seal">大</span>
        <span>大吉CRM<small>顧客管理・紹介</small></span>
      </div>
      <nav class="nav">
        ${NAV.map(item).join('')}
        <div class="group-label">連携・収集</div>
        ${CONNECT.map(item).join('')}
        <div class="group-label">その他</div>
        <a href="trash.html" class="${active==='trash'?'active':''}">${svg(I.trash)}<span>ゴミ箱</span></a>
        ${ADMIN.map(item).join('')}
        <a href="account.html" class="${active==='account'?'active':''}">${svg(I.user)}<span>アカウント</span></a>
      </nav>
      <div class="foot">大吉会計事務所 / v0.4 設計モック</div>`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const sb = document.querySelector('.sidebar');
    if (sb) sb.innerHTML = buildSidebar(sb.dataset.active);

    // ハンバーガー（モバイル）
    const hb = document.querySelector('.hamb');
    if (hb && sb) hb.addEventListener('click', () => sb.classList.toggle('open'));

    // 検索アイコン注入
    document.querySelectorAll('.search .mag').forEach(m => m.innerHTML = svg(I.search,16));

    // data-icon 属性でボタン等にアイコン
    document.querySelectorAll('[data-icon]').forEach(el => {
      el.insertAdjacentHTML('afterbegin', svg(I[el.dataset.icon] || I.home, el.dataset.iw||16));
    });
  });

  // --- 簡易トースト / モーダル ---
  window.toast = function (msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span class="ok">✓</span><span>${msg}</span>`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  };
  window.closeModal = function (el) {
    const s = el.closest('.scrim'); if (s) s.remove();
  };
  window.demoModal = function (title, body, confirmLabel, danger) {
    const s = document.createElement('div');
    s.className = 'scrim';
    s.innerHTML = `<div class="modal">
      <div class="m-head"><h3>${title}</h3></div>
      <div class="m-body">${body}</div>
      <div class="m-foot">
        <button class="btn" onclick="closeModal(this)">キャンセル</button>
        <button class="btn ${danger?'btn-danger':'btn-primary'}" onclick="closeModal(this);toast('${(confirmLabel||'実行')}しました')">${confirmLabel||'実行'}</button>
      </div></div>`;
    s.addEventListener('click', e => { if (e.target === s) s.remove(); });
    document.body.appendChild(s);
  };

  // 画面の使い方ガイド（各画面が内容を渡して呼ぶ。隠し要素 #guide の中身を表示）
  window.openGuide = function (title, bodyHtml) {
    const s = document.createElement('div');
    s.className = 'scrim';
    s.innerHTML = `<div class="modal" style="max-width:520px;">
      <div class="m-head"><h3>${title}</h3></div>
      <div class="m-body guide-body">${bodyHtml}</div>
      <div class="m-foot"><button class="btn btn-primary" onclick="closeModal(this)">とじる</button></div>
    </div>`;
    s.addEventListener('click', e => { if (e.target === s) s.remove(); });
    document.body.appendChild(s);
  };
})();

/* ===== 機能ツアー（案内人）: スポットライト + コーチカード =====
   startTour(steps, {mode:'tour'|'feature'})
   step: { sel?, title, body, note?, before?, cta?, onCta?, eyebrow? }
   sel なし = 中央カード（締めの一枚）。before = 表示前に実行（ビュー切替など）。 */
(function () {
  let T = null;

  function place(repos) {
    const s = T.steps[T.i];
    if (s.before && !repos) s.before();
    const el = s.sel ? document.querySelector(s.sel) : null;
    if (el) el.scrollIntoView({ block: 'center' });
    requestAnimationFrame(() => {
      if (!T) return;
      const last = T.i === T.steps.length - 1;
      const eyebrow = s.eyebrow || (T.mode === 'feature' ? '新機能' : '使い方ツアー');
      const stp = T.steps.length > 1 ? `<span class="stp num">${T.i + 1}/${T.steps.length}</span>` : '';
      const dots = T.steps.length > 1
        ? `<div class="tour-dots">${T.steps.map((_, j) => '<i class="' + (j === T.i ? 'on' : '') + '"></i>').join('')}</div>`
        : '<div class="tour-dots"></div>';
      const btns = T.mode === 'feature'
        ? `<button class="btn btn-sm btn-ghost" data-act="close">あとで</button>
           <button class="btn btn-sm btn-primary" data-act="cta">${s.cta || '試してみる'}</button>`
        : (T.i > 0 ? '<button class="btn btn-sm" data-act="prev">戻る</button>' : '') +
          `<button class="btn btn-sm btn-primary" data-act="next">${last ? '完了' : '次へ'}</button>`;
      T.card.innerHTML =
        `<button class="x" data-act="close" aria-label="とじる">✕</button>
         <div class="hd"><div class="guide">案</div><div><div class="eyebrow">${eyebrow}${stp}</div><h4>${s.title}</h4></div></div>
         <div class="bd">${s.body}</div>` +
        (s.note ? `<div class="tour-note">${s.note}</div>` : '') +
        `<div class="ft">${dots}${btns}</div><span class="arr" hidden></span>`;

      const r = el ? el.getBoundingClientRect() : null;
      if (r) {
        T.veil.style.background = 'transparent';
        T.spot.style.display = 'block';
        T.spot.style.left = (r.left - 6) + 'px';
        T.spot.style.top = (r.top - 6) + 'px';
        T.spot.style.width = (r.width + 12) + 'px';
        T.spot.style.height = (r.height + 12) + 'px';
      } else {
        T.spot.style.display = 'none';
        T.veil.style.background = 'rgba(14,44,71,.58)';
      }
      const cw = T.card.offsetWidth, ch = T.card.offsetHeight;
      let cx, cy, arrPos = null;
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
      T.card.style.left = cx + 'px';
      T.card.style.top = cy + 'px';
      const arr = T.card.querySelector('.arr');
      if (arrPos && r) {
        arr.hidden = false;
        arr.style.left = Math.min(Math.max(r.left + r.width / 2 - cx - 6, 14), cw - 26) + 'px';
        if (arrPos === 'top') { arr.style.top = '-6px'; arr.style.bottom = 'auto'; }
        else { arr.style.bottom = '-6px'; arr.style.top = 'auto'; }
      }
    });
  }

  window.startTour = function (steps, opts) {
    window.endTour();
    T = { steps, i: 0, mode: (opts && opts.mode) || 'tour' };
    T.veil = document.createElement('div'); T.veil.className = 'tour-veil';
    T.spot = document.createElement('div'); T.spot.className = 'tour-spot';
    T.card = document.createElement('div'); T.card.className = 'tour-card';
    T.card.setAttribute('role', 'dialog'); T.card.setAttribute('aria-label', '使い方ツアー');
    T.veil.addEventListener('wheel', e => e.preventDefault(), { passive: false });
    T.veil.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    T.card.addEventListener('click', e => {
      const act = e.target.dataset && e.target.dataset.act;
      if (!act || !T) return;
      const s = T.steps[T.i];
      if (act === 'close') window.endTour();
      else if (act === 'prev') { T.i--; place(); }
      else if (act === 'next') { if (T.i >= T.steps.length - 1) window.endTour(); else { T.i++; place(); } }
      else if (act === 'cta') { const fn = s.onCta; window.endTour(); if (fn) fn(); }
    });
    T.onKey = e => {
      if (e.key === 'Escape') window.endTour();
      else if (e.key === 'ArrowRight' && T.mode !== 'feature') { if (T.i < T.steps.length - 1) { T.i++; place(); } }
      else if (e.key === 'ArrowLeft' && T.mode !== 'feature') { if (T.i > 0) { T.i--; place(); } }
    };
    T.onRs = () => place(true);
    document.addEventListener('keydown', T.onKey);
    window.addEventListener('resize', T.onRs);
    document.body.append(T.veil, T.spot, T.card);
    place();
  };

  window.endTour = function () {
    if (!T) return;
    document.removeEventListener('keydown', T.onKey);
    window.removeEventListener('resize', T.onRs);
    T.veil.remove(); T.spot.remove(); T.card.remove();
    T = null;
  };
})();
