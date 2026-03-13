/* ============================================================
   Content Editor Engine v2 (Generic)

   全プロジェクト共通。設定は editor-config.js から読み込み。
   ?edit=true or sessionStorage で編集モード有効化。
   ============================================================ */

(function() {
  'use strict';

  /* ---- Activation Check ---- */
  const urlParams = new URLSearchParams(window.location.search);
  const isEditQuery = urlParams.get('edit') === 'true';
  const isEditSession = sessionStorage.getItem('content_editor_mode') === 'true';
  if (isEditQuery) sessionStorage.setItem('content_editor_mode', 'true');
  if (!isEditQuery && !isEditSession) return;

  /* ---- Load Config ---- */
  const CFG = window.EDITOR_CONFIG;
  if (!CFG) { console.warn('EDITOR_CONFIG not found'); return; }

  const PAGES = CFG.pages || [];
  const STORAGE_PREFIX = 'editor_' + (CFG.projectSlug || 'site') + '_';
  const STORAGE_KEY = STORAGE_PREFIX + window.location.pathname;
  const SELECTORS = (CFG.editableSelectors || ['h1','h2','h3','p']).join(', ');
  const EXCLUDE = CFG.excludeSelectors || [];
  const T = CFG.theme || {};

  /* ---- State ---- */
  let originals = {}, edits = {}, elements = [];

  /* ---- Init ---- */
  function init() {
    injectCSS();
    scan();
    loadEdits();
    activate();
    toolbar();
    refresh();
  }

  /* ---- CSS (Theme-aware) ---- */
  function injectCSS() {
    const accent = T.accent || '#C8A96E';
    const accentHover = T.accentHover || '#D4B87A';
    const panelBg = T.panelBg || 'rgba(26,26,26,0.97)';
    const border = T.panelBorder || 'rgba(255,255,255,0.06)';
    const topBar = T.topBarBg || '#1A1A1A';
    const s = document.createElement('style');
    s.textContent = `
      body.ce-active::before {
        content:'✦  編 集 モ ー ド  —  テキストをクリックして直接修正';
        position:fixed;top:0;left:0;right:0;z-index:10000;
        background:${topBar};color:rgba(255,255,255,0.6);
        text-align:center;padding:11px 20px;
        font-family:'Lexend Deca','Noto Sans JP',sans-serif;
        font-size:11px;font-weight:300;letter-spacing:0.25em;
      }
      body.ce-active{padding-top:40px!important}
      body.ce-active .header{top:40px!important}
      [data-ce]{position:relative;cursor:text;transition:outline .3s,box-shadow .3s;border-radius:2px}
      [data-ce]:hover{outline:1px dashed rgba(212,208,200,.6);outline-offset:6px}
      [data-ce]:focus{outline:1px solid #D4D0C8;outline-offset:6px;box-shadow:0 0 0 4px rgba(212,208,200,.15)}
      [data-ce].ce-mod{outline:1px solid ${accent};outline-offset:6px}
      [data-ce].ce-mod::after{
        content:'修正済';position:absolute;top:-10px;right:-4px;
        background:${accent};color:#1A1A1A;font-size:8px;font-weight:500;
        padding:2px 8px;border-radius:2px;font-family:'Noto Sans JP',sans-serif;
        letter-spacing:.1em;pointer-events:none;z-index:100;
      }
      .ce-panel{position:fixed;bottom:28px;right:28px;z-index:10001;
        font-family:'Lexend Deca','Noto Sans JP',sans-serif;width:300px}
      .ce-panel__inner{background:${panelBg};backdrop-filter:blur(20px);
        -webkit-backdrop-filter:blur(20px);border:1px solid ${border};
        border-radius:4px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
      .ce-panel__head{display:flex;align-items:center;justify-content:space-between;
        margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid ${border}}
      .ce-panel__brand{font-size:9px;font-weight:400;letter-spacing:.3em;
        text-transform:uppercase;color:rgba(255,255,255,.3)}
      .ce-panel__badge{font-size:8px;letter-spacing:.15em;text-transform:uppercase;
        color:${accent};background:rgba(200,169,110,.1);padding:3px 10px;border-radius:2px}
      .ce-panel__num{font-size:48px;font-weight:200;color:#fff;line-height:1;
        font-family:'Lexend Deca',sans-serif}
      .ce-panel__row{display:flex;align-items:baseline;gap:10px;margin-bottom:6px}
      .ce-panel__sub{font-size:11px;font-weight:300;color:rgba(255,255,255,.35);letter-spacing:.05em}
      .ce-panel__page{font-size:10px;color:rgba(255,255,255,.25);letter-spacing:.1em;margin-bottom:24px}
      .ce-panel__btns{display:flex;gap:6px;margin-bottom:20px}
      .ce-btn{flex:1;padding:11px 8px;border:1px solid rgba(255,255,255,.1);background:transparent;
        color:rgba(255,255,255,.6);font-family:inherit;font-size:10px;font-weight:400;
        letter-spacing:.08em;cursor:pointer;transition:all .3s;border-radius:2px}
      .ce-btn:hover{background:rgba(255,255,255,.06);color:#fff;border-color:rgba(255,255,255,.2)}
      .ce-btn:disabled{opacity:.25;cursor:not-allowed}
      .ce-btn--gold{background:${accent};border-color:${accent};color:#1A1A1A;font-weight:500}
      .ce-btn--gold:hover{background:${accentHover};border-color:${accentHover}}
      .ce-btn--gold:disabled{opacity:.3}
      .ce-submit{width:100%;padding:14px;border:1px solid ${accent};background:transparent;
        color:${accent};font-family:inherit;font-size:11px;font-weight:400;
        letter-spacing:.15em;cursor:pointer;transition:all .3s;border-radius:2px;margin-bottom:20px}
      .ce-submit:hover{background:${accent};color:#1A1A1A}
      .ce-submit:disabled{opacity:.25;cursor:not-allowed}
      .ce-submit.ce-loading{pointer-events:none;opacity:.5}
      .ce-pages{padding-top:16px;border-top:1px solid ${border}}
      .ce-pages__title{font-size:8px;letter-spacing:.3em;text-transform:uppercase;
        color:rgba(255,255,255,.2);margin-bottom:10px}
      .ce-pages__row{display:flex;align-items:center;justify-content:space-between;padding:6px 0}
      .ce-pages__link{font-size:12px;font-weight:300;color:rgba(255,255,255,.4);
        letter-spacing:.03em;text-decoration:none;transition:color .2s}
      .ce-pages__link:hover{color:#fff}
      .ce-pages__link.ce-cur{color:${accent}}
      .ce-pages__cnt{font-size:9px;color:rgba(255,255,255,.2);letter-spacing:.05em}
      .ce-pages__cnt.ce-has{color:${accent}}
      .ce-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);
        background:#1A1A1A;border:1px solid rgba(200,169,110,.3);color:${accent};
        padding:14px 32px;border-radius:2px;font-family:'Lexend Deca','Noto Sans JP',sans-serif;
        font-size:12px;font-weight:300;letter-spacing:.1em;opacity:0;
        transition:all .4s cubic-bezier(.25,.46,.45,.94);pointer-events:none;z-index:10002;white-space:nowrap}
      .ce-toast.ce-show{opacity:1;transform:translateX(-50%) translateY(0)}
      .ce-toggle{position:fixed;bottom:28px;right:28px;z-index:10001;width:48px;height:48px;
        background:rgba(26,26,26,.95);border:1px solid ${border};border-radius:2px;
        display:none;align-items:center;justify-content:center;cursor:pointer;
        color:${accent};font-size:18px;transition:all .3s;box-shadow:0 8px 30px rgba(0,0,0,.3)}
      .ce-toggle:hover{background:${accent};color:#1A1A1A}
      .ce-toggle.ce-vis{display:flex}
      .ce-panel.ce-hide{display:none}
    `;
    document.head.appendChild(s);
  }

  /* ---- Scan Editable Elements ---- */
  function scan() {
    let id = 0;
    document.querySelectorAll(SELECTORS).forEach(el => {
      if (EXCLUDE.some(s => el.closest(s))) return;
      if (el.tagName === 'A' && !el.children.length && el.getAttribute('href')) return;
      const eid = 'ce-' + id++;
      el.setAttribute('data-ce-id', eid);
      el.setAttribute('data-ce', '');
      originals[eid] = el.innerHTML.trim();
      elements.push(el);
    });
  }

  /* ---- Activate Editing ---- */
  function activate() {
    document.body.classList.add('ce-active');
    elements.forEach(el => {
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'false');
      el.addEventListener('input', () => {
        const eid = el.getAttribute('data-ce-id');
        const cur = el.innerHTML.trim();
        if (cur !== originals[eid]) {
          edits[eid] = { original: originals[eid], modified: cur, selector: desc(el) };
          el.classList.add('ce-mod');
        } else {
          delete edits[eid];
          el.classList.remove('ce-mod');
        }
        save();
        refresh();
      });
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey && el.tagName.match(/^H[1-6]$/)) e.preventDefault();
      });
    });
  }

  /* ---- Persistence ---- */
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(edits)); }
  function loadEdits() {
    try {
      edits = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      Object.keys(edits).forEach(eid => {
        const el = document.querySelector(`[data-ce-id="${eid}"]`);
        if (el) { el.innerHTML = edits[eid].modified; el.classList.add('ce-mod'); }
      });
    } catch(e) {}
  }

  function desc(el) {
    const sec = el.closest('section');
    return `${sec ? sec.className.split(' ')[0] : 'page'} > ${el.tagName.toLowerCase()}${el.className ? '.' + el.className.split(' ').filter(c => !c.startsWith('ce-') && c).join('.') : ''}`;
  }

  /* ---- All-page edits ---- */
  function allEdits() {
    const a = {};
    PAGES.forEach(p => {
      try {
        const d = JSON.parse(localStorage.getItem(STORAGE_PREFIX + p.path) || '{}');
        if (Object.keys(d).length) a[p.path] = { name: p.label, changes: Object.values(d) };
      } catch(e) {}
    });
    return a;
  }
  function totalCount() {
    let n = 0;
    PAGES.forEach(p => {
      try { n += Object.keys(JSON.parse(localStorage.getItem(STORAGE_PREFIX + p.path) || '{}')).length; } catch(e) {}
    });
    return n;
  }

  /* ---- Toolbar ---- */
  function toolbar() {
    const cur = PAGES.find(p => p.path === location.pathname) || PAGES[0];
    const panel = document.createElement('div');
    panel.className = 'ce-panel';
    panel.id = 'cePanel';
    panel.innerHTML = `<div class="ce-panel__inner">
      <div class="ce-panel__head">
        <span class="ce-panel__brand">Content Editor</span>
        <span class="ce-panel__badge">ACTIVE</span>
      </div>
      <div class="ce-panel__row">
        <span class="ce-panel__num" id="ceN">0</span>
        <span class="ce-panel__sub">箇所を修正</span>
      </div>
      <div class="ce-panel__page">${cur.label || cur.name}</div>
      <div class="ce-panel__btns">
        <button class="ce-btn ce-btn--gold" id="ceCopy" disabled>コピー</button>
        <button class="ce-btn" id="ceSave" disabled>保存</button>
        <button class="ce-btn" id="ceReset">リセット</button>
        <button class="ce-btn" id="ceMin">—</button>
      </div>
      <button class="ce-submit" id="ceSubmit" disabled>✦  修正を確定して送信</button>
      <div class="ce-pages">
        <div class="ce-pages__title">Pages</div>
        ${PAGES.map(p => `<div class="ce-pages__row">
          <a href="${p.path}" class="ce-pages__link ${p.path===location.pathname?'ce-cur':''}">${p.name}</a>
          <span class="ce-pages__cnt" id="ceBadge_${p.name.replace(/\s/g,'')}">—</span>
        </div>`).join('')}
      </div>
    </div>`;
    document.body.appendChild(panel);

    const toggle = document.createElement('div');
    toggle.className = 'ce-toggle';
    toggle.id = 'ceToggle';
    toggle.innerHTML = '✦';
    document.body.appendChild(toggle);

    const toast = document.createElement('div');
    toast.className = 'ce-toast';
    toast.id = 'ceToast';
    document.body.appendChild(toast);

    document.getElementById('ceCopy').addEventListener('click', copyReport);
    document.getElementById('ceSave').addEventListener('click', dlReport);
    document.getElementById('ceReset').addEventListener('click', resetPage);
    document.getElementById('ceSubmit').addEventListener('click', submitAll);
    document.getElementById('ceMin').addEventListener('click', () => {
      panel.classList.add('ce-hide'); toggle.classList.add('ce-vis');
    });
    toggle.addEventListener('click', () => {
      panel.classList.remove('ce-hide'); toggle.classList.remove('ce-vis');
    });
  }

  /* ---- Refresh UI ---- */
  function refresh() {
    const t = totalCount();
    const el = document.getElementById('ceN');
    if (el) el.textContent = t;
    ['ceCopy','ceSave','ceSubmit'].forEach(id => {
      const b = document.getElementById(id); if (b) b.disabled = t === 0;
    });
    PAGES.forEach(p => {
      const b = document.getElementById('ceBadge_' + p.name.replace(/\s/g,''));
      if (!b) return;
      try {
        const n = Object.keys(JSON.parse(localStorage.getItem(STORAGE_PREFIX + p.path) || '{}')).length;
        b.textContent = n > 0 ? n + '件' : '—';
        b.classList.toggle('ce-has', n > 0);
      } catch(e) { b.textContent = '—'; }
    });
  }

  /* ---- Toast ---- */
  function showToast(m) {
    const t = document.getElementById('ceToast');
    t.textContent = m; t.classList.add('ce-show');
    setTimeout(() => t.classList.remove('ce-show'), 2800);
  }

  /* ---- Report Generation ---- */
  function makeReport() {
    const a = allEdits();
    if (!Object.keys(a).length) return '修正はありません。';
    const strip = s => s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    let r = `══════════════════════════════════════════\n  ${CFG.projectName} — 文言修正一覧\n  ${new Date().toLocaleString('ja-JP')}\n══════════════════════════════════════════\n\n`;
    let t = 0;
    Object.values(a).forEach(pg => {
      const ch = pg.changes; t += ch.length;
      r += `▼ ${pg.name}（${ch.length}件）\n──────────────────────────────────────────\n`;
      ch.forEach((e,i) => { r += `  ${i+1}. 【変更前】${strip(e.original)}\n     【変更後】${strip(e.modified)}\n\n`; });
    });
    r += `══════════════════════════════════════════\n  合計: ${t}件\n══════════════════════════════════════════\n`;
    return r;
  }

  function makeJSON() {
    return JSON.stringify({ generatedAt: new Date().toISOString(), project: CFG.projectSlug, pages: allEdits() }, null, 2);
  }

  /* ---- Actions ---- */
  function copyReport() {
    navigator.clipboard.writeText(makeReport()).then(() => showToast('修正一覧をコピーしました')).catch(() => {
      const ta = document.createElement('textarea'); ta.value = makeReport();
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      showToast('修正一覧をコピーしました');
    });
  }

  function dlReport() {
    const b = new Blob([makeReport()], { type:'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = `${CFG.projectSlug}_修正_${new Date().toISOString().slice(0,10)}.txt`;
    a.click(); URL.revokeObjectURL(a.href);
    showToast('修正一覧をダウンロードしました');
  }

  function resetPage() {
    if (!confirm('このページの修正をすべて元に戻しますか？')) return;
    Object.keys(originals).forEach(eid => {
      const el = document.querySelector(`[data-ce-id="${eid}"]`);
      if (el) { el.innerHTML = originals[eid]; el.classList.remove('ce-mod'); }
    });
    edits = {}; localStorage.removeItem(STORAGE_KEY);
    refresh(); showToast('修正をリセットしました');
  }

  async function submitAll() {
    const t = totalCount();
    if (!t) return;
    if (!confirm(`全${t}件の修正を確定しますか？\n変更はサイトに自動反映されます。`)) return;

    const btn = document.getElementById('ceSubmit');
    btn.classList.add('ce-loading');
    btn.textContent = '✦  送信中...';

    const data = { pages: allEdits() };

    // Try API endpoint first
    if (CFG.apiEndpoint) {
      try {
        const res = await fetch(CFG.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (res.ok && result.success) {
          // Clear all edits after success
          PAGES.forEach(p => localStorage.removeItem(STORAGE_PREFIX + p.path));
          edits = {};
          document.querySelectorAll('.ce-mod').forEach(el => el.classList.remove('ce-mod'));
          refresh();
          btn.classList.remove('ce-loading');
          btn.textContent = '✦  修正を確定して送信';
          showToast(`✓ ${result.summary.applied}件を自動反映しました`);
          return;
        } else {
          console.warn('API error, falling back to download:', result);
        }
      } catch(e) {
        console.warn('API unavailable, falling back to download:', e);
      }
    }

    // Fallback: download JSON
    btn.classList.remove('ce-loading');
    btn.textContent = '✦  修正を確定して送信';
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${CFG.projectSlug}_修正_auto_${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
    navigator.clipboard.writeText(makeReport()).catch(() => {});
    showToast('修正をJSONでダウンロードしました');
  }

  /* ---- Start ---- */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
