/* ============================================================
   HAKOBUNE INC. — Content Editor v2
   Luxury Theme — Matches Hakobune Design System
   ?edit=true → 編集モード有効化
   リアルタイム保存 + 全ページ差分エクスポート + 自動反映用JSON
   ============================================================ */

(function() {
  'use strict';

  const urlParams = new URLSearchParams(window.location.search);
  const isEditQuery = urlParams.get('edit') === 'true';
  const isEditSession = sessionStorage.getItem('hakobune_edit_mode') === 'true';

  // Activate via ?edit=true or sessionStorage (set by /edit/ hub)
  if (isEditQuery) {
    sessionStorage.setItem('hakobune_edit_mode', 'true');
  }
  if (!isEditQuery && !isEditSession) return;

  /* ---- Config ---- */
  const STORAGE_KEY = 'hakobune_edits_' + window.location.pathname;
  const PAGES = [
    { path: '/mock1/', name: 'HP', label: 'トップ' },
    { path: '/mock1/consulting/', name: 'Consulting', label: 'コンサルティング' },
    { path: '/mock1/realestate/', name: 'Real Estate', label: '海外不動産' },
    { path: '/mock1/community/', name: 'Community', label: 'コミュニティ' },
    { path: '/mock1/tour/', name: 'Tour', label: 'ツアー' },
    { path: '/mock1/coin/', name: 'Coin', label: 'コイン' },
    { path: '/mock1/akiya/', name: 'Akiya', label: '空き家再生' }
  ];

  const EDITABLE_SELECTORS = [
    'h1', 'h2', 'h3', 'h4', 'p:not(.editor-p)',
    '.section-label', '.section-heading', '.section-body',
    '.hero__subtitle', '.hero__title', '.hero__lead',
    '.hero__scroll-text',
    '.lp-hero__label', '.lp-hero__title', '.lp-hero__lead',
    '.philosophy__quote', '.philosophy__body',
    '.lp-about__body',
    '.lp-feature-card__title', '.lp-feature-card__desc',
    '.lp-result-card__value', '.lp-result-card__label',
    '.lp-pricing__total',
    '.service-card__number', '.service-card__title',
    '.service-card__title-en', '.service-card__desc',
    '.community__feature-number', '.community__feature-text',
    '.contact__note',
    '.footer__logo', '.footer__desc', '.footer__copyright',
    'td', 'th'
  ].join(', ');

  /* ---- State ---- */
  let originalTexts = {};
  let currentEdits = {};
  let editableElements = [];

  /* ---- Init ---- */
  function init() {
    injectStyles();
    collectOriginals();
    loadSavedEdits();
    enableEditing();
    renderToolbar();
    refreshUI();
  }

  /* ---- Luxury Theme Styles ---- */
  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      /* == Top Bar == */
      body.hk-editing::before {
        content: '✦  編 集 モ ー ド  —  テキストをクリックして直接修正';
        position: fixed;
        top: 0; left: 0; right: 0;
        z-index: 10000;
        background: #1A1A1A;
        color: rgba(255,255,255,0.6);
        text-align: center;
        padding: 11px 20px;
        font-family: 'Lexend Deca','Noto Sans JP',sans-serif;
        font-size: 11px;
        font-weight: 300;
        letter-spacing: 0.25em;
      }
      body.hk-editing {
        padding-top: 40px !important;
      }
      body.hk-editing .header {
        top: 40px !important;
      }

      /* == Editable Elements == */
      [data-hk-edit] {
        position: relative;
        cursor: text;
        transition: outline 0.3s ease, box-shadow 0.3s ease;
        border-radius: 2px;
      }
      [data-hk-edit]:hover {
        outline: 1px dashed rgba(212,208,200,0.6);
        outline-offset: 6px;
      }
      [data-hk-edit]:focus {
        outline: 1px solid #D4D0C8;
        outline-offset: 6px;
        box-shadow: 0 0 0 4px rgba(212,208,200,0.15);
      }
      [data-hk-edit].hk-changed {
        outline: 1px solid #C8A96E;
        outline-offset: 6px;
      }
      [data-hk-edit].hk-changed::after {
        content: '修正済';
        position: absolute;
        top: -10px; right: -4px;
        background: #C8A96E;
        color: #1A1A1A;
        font-size: 8px;
        font-weight: 500;
        padding: 2px 8px;
        border-radius: 2px;
        font-family: 'Noto Sans JP',sans-serif;
        letter-spacing: 0.1em;
        pointer-events: none;
        z-index: 100;
      }

      /* == Toolbar Panel == */
      .hk-editor {
        position: fixed;
        bottom: 28px; right: 28px;
        z-index: 10001;
        font-family: 'Lexend Deca','Noto Sans JP',sans-serif;
        width: 300px;
      }
      .hk-editor__panel {
        background: rgba(26,26,26,0.97);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 4px;
        padding: 28px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.4);
      }
      .hk-editor__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .hk-editor__brand {
        font-size: 9px;
        font-weight: 400;
        letter-spacing: 0.3em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.3);
      }
      .hk-editor__status {
        font-size: 8px;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        color: #C8A96E;
        background: rgba(200,169,110,0.1);
        padding: 3px 10px;
        border-radius: 2px;
      }
      .hk-editor__count-row {
        display: flex;
        align-items: baseline;
        gap: 10px;
        margin-bottom: 6px;
      }
      .hk-editor__count {
        font-size: 48px;
        font-weight: 200;
        color: #fff;
        line-height: 1;
        font-family: 'Lexend Deca',sans-serif;
      }
      .hk-editor__count-label {
        font-size: 11px;
        font-weight: 300;
        color: rgba(255,255,255,0.35);
        letter-spacing: 0.05em;
      }
      .hk-editor__page-info {
        font-size: 10px;
        color: rgba(255,255,255,0.25);
        letter-spacing: 0.1em;
        margin-bottom: 24px;
      }

      /* Buttons */
      .hk-editor__actions {
        display: flex;
        gap: 6px;
        margin-bottom: 20px;
      }
      .hk-editor__btn {
        flex: 1;
        padding: 11px 8px;
        border: 1px solid rgba(255,255,255,0.1);
        background: transparent;
        color: rgba(255,255,255,0.6);
        font-family: 'Lexend Deca','Noto Sans JP',sans-serif;
        font-size: 10px;
        font-weight: 400;
        letter-spacing: 0.08em;
        cursor: pointer;
        transition: all 0.3s ease;
        border-radius: 2px;
      }
      .hk-editor__btn:hover {
        background: rgba(255,255,255,0.06);
        color: #fff;
        border-color: rgba(255,255,255,0.2);
      }
      .hk-editor__btn:disabled {
        opacity: 0.25;
        cursor: not-allowed;
      }
      .hk-editor__btn--primary {
        background: #C8A96E;
        border-color: #C8A96E;
        color: #1A1A1A;
        font-weight: 500;
      }
      .hk-editor__btn--primary:hover {
        background: #D4B87A;
        border-color: #D4B87A;
      }
      .hk-editor__btn--primary:disabled {
        opacity: 0.3;
      }

      /* Submit (auto-apply) */
      .hk-editor__submit {
        width: 100%;
        padding: 14px;
        border: 1px solid #C8A96E;
        background: transparent;
        color: #C8A96E;
        font-family: 'Lexend Deca','Noto Sans JP',sans-serif;
        font-size: 11px;
        font-weight: 400;
        letter-spacing: 0.15em;
        cursor: pointer;
        transition: all 0.3s ease;
        border-radius: 2px;
        margin-bottom: 20px;
      }
      .hk-editor__submit:hover {
        background: #C8A96E;
        color: #1A1A1A;
      }
      .hk-editor__submit:disabled {
        opacity: 0.25;
        cursor: not-allowed;
      }

      /* Page Links */
      .hk-editor__pages {
        padding-top: 16px;
        border-top: 1px solid rgba(255,255,255,0.06);
      }
      .hk-editor__pages-title {
        font-size: 8px;
        letter-spacing: 0.3em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.2);
        margin-bottom: 10px;
      }
      .hk-editor__page {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 0;
        transition: color 0.2s;
      }
      .hk-editor__page-name {
        font-size: 12px;
        font-weight: 300;
        color: rgba(255,255,255,0.4);
        letter-spacing: 0.03em;
        text-decoration: none;
        transition: color 0.2s;
      }
      .hk-editor__page-name:hover {
        color: #fff;
      }
      .hk-editor__page-name.hk-current {
        color: #C8A96E;
      }
      .hk-editor__page-badge {
        font-size: 9px;
        color: rgba(255,255,255,0.2);
        letter-spacing: 0.05em;
      }
      .hk-editor__page-badge.hk-has-edits {
        color: #C8A96E;
      }

      /* Toast */
      .hk-toast {
        position: fixed;
        bottom: 24px; left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: #1A1A1A;
        border: 1px solid rgba(200,169,110,0.3);
        color: #C8A96E;
        padding: 14px 32px;
        border-radius: 2px;
        font-family: 'Lexend Deca','Noto Sans JP',sans-serif;
        font-size: 12px;
        font-weight: 300;
        letter-spacing: 0.1em;
        opacity: 0;
        transition: all 0.4s cubic-bezier(0.25,0.46,0.45,0.94);
        pointer-events: none;
        z-index: 10002;
        white-space: nowrap;
      }
      .hk-toast.hk-visible {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }

      /* Minimized toggle */
      .hk-editor__toggle {
        position: fixed;
        bottom: 28px; right: 28px;
        z-index: 10001;
        width: 48px; height: 48px;
        background: rgba(26,26,26,0.95);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 2px;
        display: none;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #C8A96E;
        font-size: 18px;
        transition: all 0.3s ease;
        box-shadow: 0 8px 30px rgba(0,0,0,0.3);
      }
      .hk-editor__toggle:hover {
        background: #C8A96E;
        color: #1A1A1A;
      }
      .hk-editor__toggle.hk-show {
        display: flex;
      }
      .hk-editor.hk-hidden {
        display: none;
      }
    `;
    document.head.appendChild(s);
  }

  /* ---- Collect Original Texts ---- */
  function collectOriginals() {
    let id = 0;
    document.querySelectorAll(EDITABLE_SELECTORS).forEach(el => {
      if (el.closest('.nav-overlay') || el.closest('.hk-editor') || el.closest('.header')) return;
      if (el.tagName === 'A' && !el.children.length && el.getAttribute('href')) return;
      const eid = 'hk-' + id++;
      el.setAttribute('data-hk-id', eid);
      el.setAttribute('data-hk-edit', '');
      originalTexts[eid] = el.innerHTML.trim();
      editableElements.push(el);
    });
  }

  /* ---- Enable Editing ---- */
  function enableEditing() {
    document.body.classList.add('hk-editing');
    editableElements.forEach(el => {
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'false');
      el.addEventListener('input', () => {
        const eid = el.getAttribute('data-hk-id');
        const cur = el.innerHTML.trim();
        if (cur !== originalTexts[eid]) {
          currentEdits[eid] = { original: originalTexts[eid], modified: cur, selector: describeElement(el) };
          el.classList.add('hk-changed');
        } else {
          delete currentEdits[eid];
          el.classList.remove('hk-changed');
        }
        saveEdits();
        refreshUI();
      });
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey && el.tagName.match(/^H[1-6]$/)) e.preventDefault();
      });
    });
  }

  /* ---- Save / Load ---- */
  function saveEdits() { localStorage.setItem(STORAGE_KEY, JSON.stringify(currentEdits)); }
  function loadSavedEdits() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      currentEdits = saved;
      Object.keys(saved).forEach(eid => {
        const el = document.querySelector(`[data-hk-id="${eid}"]`);
        if (el) { el.innerHTML = saved[eid].modified; el.classList.add('hk-changed'); }
      });
    } catch(e) {}
  }

  /* ---- Describe Element (human-readable) ---- */
  function describeElement(el) {
    const section = el.closest('section');
    const sectionClass = section ? section.className.split(' ')[0] : 'page';
    return `${sectionClass} > ${el.tagName.toLowerCase()}${el.className ? '.' + el.className.split(' ').filter(c => !c.startsWith('hk-') && c).join('.') : ''}`;
  }

  /* ---- Get All Edits (all pages) ---- */
  function getAllEdits() {
    const all = {};
    PAGES.forEach(p => {
      try {
        const d = JSON.parse(localStorage.getItem('hakobune_edits_' + p.path) || '{}');
        if (Object.keys(d).length) all[p.path] = { name: p.name, label: p.label, edits: d };
      } catch(e) {}
    });
    return all;
  }

  function getTotalCount() {
    let n = 0;
    PAGES.forEach(p => {
      try { n += Object.keys(JSON.parse(localStorage.getItem('hakobune_edits_' + p.path) || '{}')).length; } catch(e) {}
    });
    return n;
  }

  /* ---- Render Toolbar ---- */
  function renderToolbar() {
    const wrapper = document.createElement('div');
    wrapper.className = 'hk-editor';
    wrapper.id = 'hkEditor';
    const currentPage = PAGES.find(p => p.path === window.location.pathname) || PAGES[0];
    wrapper.innerHTML = `
      <div class="hk-editor__panel">
        <div class="hk-editor__header">
          <span class="hk-editor__brand">Content Editor</span>
          <span class="hk-editor__status" id="hkStatus">ACTIVE</span>
        </div>
        <div class="hk-editor__count-row">
          <span class="hk-editor__count" id="hkCount">0</span>
          <span class="hk-editor__count-label">箇所を修正</span>
        </div>
        <div class="hk-editor__page-info" id="hkPageInfo">${currentPage.label}</div>
        <div class="hk-editor__actions">
          <button class="hk-editor__btn hk-editor__btn--primary" id="hkCopy" disabled>コピー</button>
          <button class="hk-editor__btn" id="hkSave" disabled>保存</button>
          <button class="hk-editor__btn" id="hkReset">リセット</button>
          <button class="hk-editor__btn" id="hkMinimize">—</button>
        </div>
        <button class="hk-editor__submit" id="hkSubmit" disabled>✦  修正を確定して送信</button>
        <div class="hk-editor__pages">
          <div class="hk-editor__pages-title">Pages</div>
          ${PAGES.map(p => `
            <div class="hk-editor__page">
              <a href="${p.path}" class="hk-editor__page-name ${p.path === window.location.pathname ? 'hk-current' : ''}">${p.name}</a>
              <span class="hk-editor__page-badge" id="hkBadge${p.name.replace(/\s/g,'')}">—</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(wrapper);

    // Toggle button (minimized)
    const toggle = document.createElement('div');
    toggle.className = 'hk-editor__toggle';
    toggle.id = 'hkToggle';
    toggle.innerHTML = '✦';
    document.body.appendChild(toggle);

    // Toast
    const toast = document.createElement('div');
    toast.className = 'hk-toast';
    toast.id = 'hkToast';
    document.body.appendChild(toast);

    // Events
    document.getElementById('hkCopy').addEventListener('click', copyReport);
    document.getElementById('hkSave').addEventListener('click', downloadReport);
    document.getElementById('hkReset').addEventListener('click', resetEdits);
    document.getElementById('hkSubmit').addEventListener('click', submitEdits);
    document.getElementById('hkMinimize').addEventListener('click', () => {
      wrapper.classList.add('hk-hidden');
      toggle.classList.add('hk-show');
    });
    toggle.addEventListener('click', () => {
      wrapper.classList.remove('hk-hidden');
      toggle.classList.remove('hk-show');
    });
  }

  /* ---- Refresh UI ---- */
  function refreshUI() {
    const localCount = Object.keys(currentEdits).length;
    const totalCount = getTotalCount();
    const countEl = document.getElementById('hkCount');
    const copyBtn = document.getElementById('hkCopy');
    const saveBtn = document.getElementById('hkSave');
    const submitBtn = document.getElementById('hkSubmit');
    if (countEl) countEl.textContent = totalCount;
    if (copyBtn) copyBtn.disabled = totalCount === 0;
    if (saveBtn) saveBtn.disabled = totalCount === 0;
    if (submitBtn) submitBtn.disabled = totalCount === 0;

    // Page badges
    PAGES.forEach(p => {
      const badge = document.getElementById('hkBadge' + p.name.replace(/\s/g,''));
      if (!badge) return;
      try {
        const n = Object.keys(JSON.parse(localStorage.getItem('hakobune_edits_' + p.path) || '{}')).length;
        badge.textContent = n > 0 ? n + '件' : '—';
        badge.classList.toggle('hk-has-edits', n > 0);
      } catch(e) { badge.textContent = '—'; }
    });
  }

  /* ---- Toast ---- */
  function toast(msg) {
    const t = document.getElementById('hkToast');
    t.textContent = msg;
    t.classList.add('hk-visible');
    setTimeout(() => t.classList.remove('hk-visible'), 2800);
  }

  /* ---- Generate Text Report ---- */
  function generateReport() {
    const all = getAllEdits();
    if (!Object.keys(all).length) return '修正はありません。';
    const strip = s => s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    let r = '══════════════════════════════════════════\n';
    r += '  Hakobune Inc. — 文言修正一覧\n';
    r += '  ' + new Date().toLocaleString('ja-JP') + '\n';
    r += '══════════════════════════════════════════\n\n';
    let total = 0;
    Object.values(all).forEach(page => {
      const edits = Object.values(page.edits);
      total += edits.length;
      r += `▼ ${page.label}（${edits.length}件）\n`;
      r += '──────────────────────────────────────────\n';
      edits.forEach((e,i) => {
        r += `  ${i+1}. 【変更前】${strip(e.original)}\n     【変更後】${strip(e.modified)}\n\n`;
      });
    });
    r += `══════════════════════════════════════════\n  合計: ${total}件\n══════════════════════════════════════════\n`;
    return r;
  }

  /* ---- Generate JSON (for auto-apply) ---- */
  function generateJSON() {
    const all = getAllEdits();
    const output = { generatedAt: new Date().toISOString(), pages: {} };
    Object.entries(all).forEach(([path, page]) => {
      output.pages[path] = {
        name: page.label,
        changes: Object.values(page.edits).map(e => ({
          original: e.original,
          modified: e.modified,
          selector: e.selector
        }))
      };
    });
    return JSON.stringify(output, null, 2);
  }

  /* ---- Actions ---- */
  function copyReport() {
    const text = generateReport();
    navigator.clipboard.writeText(text).then(() => toast('修正一覧をコピーしました')).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      toast('修正一覧をコピーしました');
    });
  }

  function downloadReport() {
    const blob = new Blob([generateReport()], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hakobune_修正_' + new Date().toISOString().slice(0,10) + '.txt';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('修正一覧をダウンロードしました');
  }

  function resetEdits() {
    if (!confirm('このページの修正をすべて元に戻しますか？')) return;
    Object.keys(originalTexts).forEach(eid => {
      const el = document.querySelector(`[data-hk-id="${eid}"]`);
      if (el) { el.innerHTML = originalTexts[eid]; el.classList.remove('hk-changed'); }
    });
    currentEdits = {};
    localStorage.removeItem(STORAGE_KEY);
    refreshUI();
    toast('修正をリセットしました');
  }

  function submitEdits() {
    const total = getTotalCount();
    if (total === 0) return;
    if (!confirm(`全${total}件の修正を確定して送信しますか？\n\n修正内容のJSONファイルがダウンロードされます。\nこのファイルを開発者に渡すと自動反映されます。`)) return;

    // Download JSON for auto-apply
    const json = generateJSON();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hakobune_修正_auto_' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);

    // Also copy text report
    navigator.clipboard.writeText(generateReport()).catch(() => {});

    toast('修正を確定しました — JSONファイルを開発者にお渡しください');
  }

  /* ---- Start ---- */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
