/* ============================================================
   Content Editor Engine v3 (Generic + Hardened)

   Grok推奨改善全実装:
   - innerText使用（HTML構造崩壊防止）
   - ペースト時にプレーンテキスト強制
   - 書式ショートカット無効化 (Ctrl+B/I/U)
   - 認証付きAPI送信
   - オンボーディングモーダル
   - undo/redo対応
   
   設定は editor-config.js から読み込み。
   ============================================================ */

(function() {
  'use strict';

  /* ---- Activation ---- */
  const urlParams = new URLSearchParams(window.location.search);
  const isEditQ = urlParams.get('edit') === 'true';
  const isEditS = sessionStorage.getItem('content_editor_mode') === 'true';
  if (isEditQ) sessionStorage.setItem('content_editor_mode', 'true');
  if (!isEditQ && !isEditS) return;

  /* ---- Config ---- */
  const CFG = window.EDITOR_CONFIG;
  if (!CFG) { console.warn('EDITOR_CONFIG not found'); return; }

  const PAGES = CFG.pages || [];
  const PREFIX = 'editor_' + (CFG.projectSlug || 'site') + '_';
  const SKEY = PREFIX + window.location.pathname;
  const SEL = (CFG.editableSelectors || ['h1','h2','h3','p']).join(', ');
  const EXCL = CFG.excludeSelectors || [];
  const T = CFG.theme || {};
  const accent = T.accent || '#C8A96E';
  const accentH = T.accentHover || '#D4B87A';
  const panelBg = T.panelBg || 'rgba(26,26,26,0.97)';
  const border = T.panelBorder || 'rgba(255,255,255,0.06)';
  const topBar = T.topBarBg || '#1A1A1A';

  /* ---- State ---- */
  let originals = {}, edits = {}, elements = [];
  let undoStack = {}, redoStack = {};

  /* ---- Init ---- */
  function init() {
    css();
    scan();
    load();
    activate();
    bar();
    ui();
    onboarding();
  }

  /* ---- CSS ---- */
  function css() {
    const s = document.createElement('style');
    s.textContent = `
      body.ce-on::before{content:'✦  編 集 モ ー ド  —  テキストをクリックして直接修正';
        position:fixed;top:0;left:0;right:0;z-index:10000;background:${topBar};
        color:rgba(255,255,255,.6);text-align:center;padding:11px 20px;
        font-family:'Lexend Deca','Noto Sans JP',sans-serif;font-size:11px;font-weight:300;letter-spacing:.25em}
      body.ce-on{padding-top:40px!important}
      body.ce-on .header{top:40px!important}
      [data-ce]{position:relative;cursor:text;transition:outline .3s,box-shadow .3s;border-radius:4px}
      [data-ce]:hover{outline:1px dashed rgba(212,208,200,.6);outline-offset:6px}
      [data-ce]:focus{outline:1px solid #D4D0C8;outline-offset:6px;box-shadow:0 0 0 4px rgba(212,208,200,.15)}
      [data-ce].ce-m{outline:1px solid ${accent};outline-offset:6px}
      [data-ce].ce-m::after{content:'修正済';position:absolute;top:-10px;right:-4px;
        background:${accent};color:#1A1A1A;font-size:8px;font-weight:500;padding:2px 10px;
        border-radius:12px;font-family:'Noto Sans JP',sans-serif;letter-spacing:.1em;pointer-events:none;z-index:100}
      .ce-p{position:fixed;bottom:28px;right:28px;z-index:10001;
        font-family:'Lexend Deca','Noto Sans JP',sans-serif;width:300px}
      .ce-p__i{background:${panelBg};backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
        border:1px solid ${border};border-radius:16px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
      .ce-p__h{display:flex;align-items:center;justify-content:space-between;
        margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid ${border}}
      .ce-p__br{font-size:9px;font-weight:400;letter-spacing:.3em;text-transform:uppercase;color:rgba(255,255,255,.3)}
      .ce-p__st{font-size:8px;letter-spacing:.15em;text-transform:uppercase;
        color:${accent};background:rgba(200,169,110,.1);padding:3px 12px;border-radius:12px}
      .ce-p__r{display:flex;align-items:baseline;gap:10px;margin-bottom:6px}
      .ce-p__n{font-size:48px;font-weight:200;color:#fff;line-height:1;font-family:'Lexend Deca',sans-serif}
      .ce-p__s{font-size:11px;font-weight:300;color:rgba(255,255,255,.35);letter-spacing:.05em}
      .ce-p__pg{font-size:10px;color:rgba(255,255,255,.25);letter-spacing:.1em;margin-bottom:24px}
      .ce-p__bs{display:flex;gap:6px;margin-bottom:12px}
      .ce-b{flex:1;padding:11px 8px;border:1px solid rgba(255,255,255,.1);background:transparent;
        color:rgba(255,255,255,.6);font-family:inherit;font-size:10px;font-weight:400;
        letter-spacing:.08em;cursor:pointer;transition:all .3s;border-radius:10px}
      .ce-b:hover{background:rgba(255,255,255,.06);color:#fff;border-color:rgba(255,255,255,.2)}
      .ce-b:disabled{opacity:.25;cursor:not-allowed}
      .ce-b--g{background:${accent};border-color:${accent};color:#1A1A1A;font-weight:500}
      .ce-b--g:hover{background:${accentH};border-color:${accentH}}
      .ce-b--g:disabled{opacity:.3}
      .ce-undo{display:flex;gap:6px;margin-bottom:20px}
      .ce-ub{flex:1;padding:8px;border:1px solid rgba(255,255,255,.06);background:transparent;
        color:rgba(255,255,255,.3);font-family:inherit;font-size:9px;letter-spacing:.1em;
        cursor:pointer;transition:all .3s;border-radius:8px}
      .ce-ub:hover{color:rgba(255,255,255,.6);border-color:rgba(255,255,255,.15)}
      .ce-ub:disabled{opacity:.2;cursor:not-allowed}
      .ce-sub{width:100%;padding:14px;border:1px solid ${accent};background:transparent;
        color:${accent};font-family:inherit;font-size:11px;font-weight:400;letter-spacing:.15em;
        cursor:pointer;transition:all .3s;border-radius:12px;margin-bottom:20px}
      .ce-sub:hover{background:${accent};color:#1A1A1A}
      .ce-sub:disabled{opacity:.25;cursor:not-allowed}
      .ce-sub.ce-ld{pointer-events:none;opacity:.5}
      .ce-pgs{padding-top:16px;border-top:1px solid ${border}}
      .ce-pgs__t{font-size:8px;letter-spacing:.3em;text-transform:uppercase;color:rgba(255,255,255,.2);margin-bottom:10px}
      .ce-pgs__r{display:flex;align-items:center;justify-content:space-between;padding:6px 0}
      .ce-pgs__l{font-size:12px;font-weight:300;color:rgba(255,255,255,.4);letter-spacing:.03em;text-decoration:none;transition:color .2s}
      .ce-pgs__l:hover{color:#fff}
      .ce-pgs__l.ce-c{color:${accent}}
      .ce-pgs__cnt{font-size:9px;color:rgba(255,255,255,.2);letter-spacing:.05em}
      .ce-pgs__cnt.ce-has{color:${accent}}
      .ce-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);
        background:#1A1A1A;border:1px solid rgba(200,169,110,.3);color:${accent};
        padding:14px 32px;border-radius:12px;font-family:'Lexend Deca','Noto Sans JP',sans-serif;
        font-size:12px;font-weight:300;letter-spacing:.1em;opacity:0;
        transition:all .4s cubic-bezier(.25,.46,.45,.94);pointer-events:none;z-index:10002;white-space:nowrap}
      .ce-toast.ce-vis{opacity:1;transform:translateX(-50%) translateY(0)}
      .ce-tog{position:fixed;bottom:28px;right:28px;z-index:10001;width:48px;height:48px;
        background:rgba(26,26,26,.95);border:1px solid ${border};border-radius:14px;
        display:flex;align-items:center;justify-content:center;cursor:pointer;
        color:${accent};font-size:18px;box-shadow:0 8px 30px rgba(0,0,0,.3);
        opacity:0;transform:scale(.8);pointer-events:none;
        transition:all .4s cubic-bezier(.25,.46,.45,.94)}
      .ce-tog:hover{background:${accent};color:#1A1A1A}
      .ce-tog.ce-v{opacity:1;transform:scale(1);pointer-events:auto}
      .ce-p{transition:opacity .4s cubic-bezier(.25,.46,.45,.94),transform .4s cubic-bezier(.25,.46,.45,.94)}
      .ce-p.ce-hid{opacity:0;transform:translateY(20px) scale(.96);pointer-events:none}
      /* Onboarding Modal */
      .ce-ob{position:fixed;inset:0;z-index:20000;background:rgba(0,0,0,.85);
        display:flex;align-items:center;justify-content:center;
        opacity:0;transition:opacity .4s;pointer-events:none}
      .ce-ob.ce-show{opacity:1;pointer-events:auto}
      .ce-ob__card{background:#1A1A1A;border:1px solid ${border};border-radius:20px;
        padding:48px;max-width:480px;width:90%;text-align:center}
      .ce-ob__title{font-size:24px;font-weight:200;color:#fff;margin-bottom:8px;letter-spacing:.03em}
      .ce-ob__sub{font-size:12px;color:rgba(255,255,255,.35);letter-spacing:.1em;margin-bottom:40px}
      .ce-ob__steps{text-align:left;margin-bottom:40px}
      .ce-ob__step{display:flex;gap:16px;align-items:flex-start;margin-bottom:24px}
      .ce-ob__num{width:32px;height:32px;border:1px solid ${accent};border-radius:50%;
        display:flex;align-items:center;justify-content:center;flex-shrink:0;
        font-size:13px;color:${accent};font-weight:400}
      .ce-ob__text{font-size:13px;font-weight:300;color:rgba(255,255,255,.6);line-height:1.7}
      .ce-ob__text strong{color:#fff;font-weight:400}
      .ce-ob__go{padding:14px 48px;background:${accent};border:none;color:#1A1A1A;
        font-family:inherit;font-size:12px;font-weight:500;letter-spacing:.15em;
        cursor:pointer;border-radius:12px;transition:background .3s}
      .ce-ob__go:hover{background:${accentH}}
      .ce-ob__skip{display:block;margin-top:16px;font-size:10px;color:rgba(255,255,255,.25);
        letter-spacing:.1em;cursor:pointer;border:none;background:none;font-family:inherit;transition:color .2s}
      .ce-ob__skip:hover{color:rgba(255,255,255,.5)}
      /* ---- Mobile Responsive ---- */
      @media(max-width:600px){
        body.ce-on::before{font-size:9px;padding:8px 12px;letter-spacing:.15em}
        body.ce-on{padding-top:32px!important}
        body.ce-on .header{top:32px!important}
        .ce-p{bottom:12px;right:12px;left:12px;width:auto}
        .ce-p__i{padding:16px;border-radius:14px}
        .ce-p__h{margin-bottom:12px;padding-bottom:10px}
        .ce-p__br{font-size:8px;letter-spacing:.2em}
        .ce-p__r{margin-bottom:4px}
        .ce-p__n{font-size:28px}
        .ce-p__s{font-size:9px}
        .ce-p__pg{font-size:9px;margin-bottom:12px}
        .ce-p__bs{gap:4px;margin-bottom:8px}
        .ce-b{padding:8px 4px;font-size:9px;border-radius:8px}
        .ce-undo{gap:4px;margin-bottom:10px}
        .ce-ub{padding:6px;font-size:8px}
        .ce-sub{padding:10px;font-size:10px;border-radius:10px;margin-bottom:10px}
        .ce-pgs{display:none}
        .ce-tog{bottom:12px;right:12px;width:40px;height:40px;font-size:14px;border-radius:12px}
        .ce-toast{font-size:10px;padding:10px 20px;bottom:12px;border-radius:10px}
        .ce-ob__card{padding:28px 20px;border-radius:16px}
        .ce-ob__title{font-size:20px}
        .ce-ob__steps{margin-bottom:24px}
        .ce-ob__step{gap:12px;margin-bottom:16px}
        .ce-ob__num{width:28px;height:28px;font-size:11px}
        .ce-ob__text{font-size:12px}
        .ce-ob__go{padding:12px 36px;font-size:11px;border-radius:10px}
      }
    `;
    document.head.appendChild(s);
  }

  /* ---- Scan ---- */
  function scan() {
    let id = 0;
    document.querySelectorAll(SEL).forEach(el => {
      if (EXCL.some(s => el.closest(s))) return;
      if (el.tagName === 'A' && !el.children.length && el.getAttribute('href')) return;
      const eid = 'ce-' + id++;
      el.setAttribute('data-ce-id', eid);
      el.setAttribute('data-ce', '');
      // ★ innerTextで保存（HTML構造ではなくプレーンテキスト）
      originals[eid] = el.innerText.trim();
      undoStack[eid] = [];
      redoStack[eid] = [];
      elements.push(el);
    });
  }

  /* ---- Activate Editing ---- */
  function activate() {
    document.body.classList.add('ce-on');
    elements.forEach(el => {
      el.setAttribute('contenteditable', 'plaintext-only');
      el.setAttribute('spellcheck', 'false');

      // ★ ペースト時にプレーンテキスト強制
      el.addEventListener('paste', e => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text/plain');
        document.execCommand('insertText', false, text);
      });

      // ★ 書式ショートカット無効化 (Ctrl/Cmd + B/I/U)
      el.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && ['b','i','u'].includes(e.key.toLowerCase())) {
          e.preventDefault();
          return;
        }
        // Undo: Ctrl+Z
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo(el);
          return;
        }
        // Redo: Ctrl+Shift+Z or Ctrl+Y
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
          e.preventDefault();
          redo(el);
          return;
        }
        // Enterで改行防止（見出し要素）
        if (e.key === 'Enter' && !e.shiftKey && el.tagName.match(/^H[1-6]$/)) {
          e.preventDefault();
        }
      });

      // ★ innerTextで変更検知
      el.addEventListener('input', () => {
        const eid = el.getAttribute('data-ce-id');
        const cur = el.innerText.trim();
        // Undo履歴追加
        const prev = edits[eid] ? edits[eid].modified : originals[eid];
        if (cur !== prev) {
          if (!undoStack[eid]) undoStack[eid] = [];
          undoStack[eid].push(prev);
          redoStack[eid] = [];
        }
        if (cur !== originals[eid]) {
          edits[eid] = { original: originals[eid], modified: cur, selector: desc(el) };
          el.classList.add('ce-m');
        } else {
          delete edits[eid];
          el.classList.remove('ce-m');
        }
        save(); ui();
      });
    });
  }

  /* ---- Undo / Redo ---- */
  function undo(el) {
    const eid = el.getAttribute('data-ce-id');
    if (!undoStack[eid] || !undoStack[eid].length) return;
    const cur = el.innerText.trim();
    if (!redoStack[eid]) redoStack[eid] = [];
    redoStack[eid].push(cur);
    const prev = undoStack[eid].pop();
    el.innerText = prev;
    el.dispatchEvent(new Event('input'));
  }

  function redo(el) {
    const eid = el.getAttribute('data-ce-id');
    if (!redoStack[eid] || !redoStack[eid].length) return;
    const cur = el.innerText.trim();
    undoStack[eid].push(cur);
    const next = redoStack[eid].pop();
    el.innerText = next;
    el.dispatchEvent(new Event('input'));
  }

  /* ---- Save/Load ---- */
  function save() { localStorage.setItem(SKEY, JSON.stringify(edits)); }
  function load() {
    try {
      edits = JSON.parse(localStorage.getItem(SKEY) || '{}');
      Object.keys(edits).forEach(eid => {
        const el = document.querySelector(`[data-ce-id="${eid}"]`);
        if (el) { el.innerText = edits[eid].modified; el.classList.add('ce-m'); }
      });
    } catch(e) {}
  }

  function desc(el) {
    const sec = el.closest('section');
    return `${sec ? sec.className.split(' ')[0] : 'page'} > ${el.tagName.toLowerCase()}`;
  }

  /* ---- All Edits ---- */
  function allEdits() {
    const a = {};
    PAGES.forEach(p => {
      try {
        const d = JSON.parse(localStorage.getItem(PREFIX + p.path) || '{}');
        if (Object.keys(d).length) a[p.path] = { name: p.label, changes: Object.values(d) };
      } catch(e) {}
    });
    return a;
  }

  function total() {
    let n = 0;
    PAGES.forEach(p => {
      try { n += Object.keys(JSON.parse(localStorage.getItem(PREFIX + p.path) || '{}')).length; } catch(e) {}
    });
    return n;
  }

  /* ---- Toolbar ---- */
  function bar() {
    const cur = PAGES.find(p => p.path === location.pathname) || PAGES[0];
    const panel = document.createElement('div');
    panel.className = 'ce-p';
    panel.id = 'ceP';
    panel.innerHTML = `<div class="ce-p__i">
      <div class="ce-p__h">
        <span class="ce-p__br">Content Editor</span>
        <span class="ce-p__st">ACTIVE</span>
      </div>
      <div class="ce-p__r">
        <span class="ce-p__n" id="ceN">0</span>
        <span class="ce-p__s">箇所を修正</span>
      </div>
      <div class="ce-p__pg">${cur.label || cur.name}</div>
      <div class="ce-p__bs">
        <button class="ce-b ce-b--g" id="ceCopy" disabled>コピー</button>
        <button class="ce-b" id="ceSave" disabled>保存</button>
        <button class="ce-b" id="ceReset">リセット</button>
        <button class="ce-b" id="ceMin">—</button>
      </div>
      <div class="ce-undo">
        <button class="ce-ub" id="ceUndo" disabled>↶ 戻す</button>
        <button class="ce-ub" id="ceRedo" disabled>↷ やり直す</button>
      </div>
      <button class="ce-sub" id="ceSub" disabled>✦  修正を確定して送信</button>
      <div class="ce-pgs">
        <div class="ce-pgs__t">Pages</div>
        ${PAGES.map(p => `<div class="ce-pgs__r">
          <a href="${p.path}" class="ce-pgs__l ${p.path===location.pathname?'ce-c':''}">${p.name}</a>
          <span class="ce-pgs__cnt" id="ceBdg_${p.name.replace(/\s/g,'')}">—</span>
        </div>`).join('')}
      </div>
    </div>`;
    document.body.appendChild(panel);

    const toggle = document.createElement('div');
    toggle.className = 'ce-tog'; toggle.id = 'ceTog'; toggle.innerHTML = '✦';
    document.body.appendChild(toggle);

    const toast = document.createElement('div');
    toast.className = 'ce-toast'; toast.id = 'ceToast';
    document.body.appendChild(toast);

    document.getElementById('ceCopy').addEventListener('click', copyRpt);
    document.getElementById('ceSave').addEventListener('click', dlRpt);
    document.getElementById('ceReset').addEventListener('click', resetPg);
    document.getElementById('ceSub').addEventListener('click', submit);
    document.getElementById('ceMin').addEventListener('click', () => {
      panel.classList.add('ce-hid');
      setTimeout(() => toggle.classList.add('ce-v'), 150);
    });
    toggle.addEventListener('click', () => {
      toggle.classList.remove('ce-v');
      setTimeout(() => panel.classList.remove('ce-hid'), 150);
    });
  }

  /* ---- Refresh UI ---- */
  function ui() {
    const t = total();
    const el = document.getElementById('ceN');
    if (el) el.textContent = t;
    ['ceCopy','ceSave','ceSub'].forEach(id => {
      const b = document.getElementById(id); if (b) b.disabled = t === 0;
    });
    PAGES.forEach(p => {
      const b = document.getElementById('ceBdg_' + p.name.replace(/\s/g,''));
      if (!b) return;
      try {
        const n = Object.keys(JSON.parse(localStorage.getItem(PREFIX + p.path) || '{}')).length;
        b.textContent = n > 0 ? n + '件' : '—';
        b.classList.toggle('ce-has', n > 0);
      } catch(e) { b.textContent = '—'; }
    });
  }

  /* ---- Toast ---- */
  function toast(m) {
    const t = document.getElementById('ceToast');
    t.textContent = m; t.classList.add('ce-vis');
    setTimeout(() => t.classList.remove('ce-vis'), 2800);
  }

  /* ---- Onboarding Modal ---- */
  function onboarding() {
    const seen = sessionStorage.getItem('ce_onboarding_done');
    if (seen) return;

    const modal = document.createElement('div');
    modal.className = 'ce-ob';
    modal.id = 'ceOb';
    modal.innerHTML = `<div class="ce-ob__card">
      <h2 class="ce-ob__title">文言修正ガイド</h2>
      <p class="ce-ob__sub">${CFG.projectName || 'Content Editor'}</p>
      <div class="ce-ob__steps">
        <div class="ce-ob__step">
          <span class="ce-ob__num">1</span>
          <p class="ce-ob__text">修正したいテキストを<strong>クリック</strong>してください。<br>枠線が表示され、編集可能になります。</p>
        </div>
        <div class="ce-ob__step">
          <span class="ce-ob__num">2</span>
          <p class="ce-ob__text">テキストを<strong>直接書き換え</strong>てください。<br>変更は自動保存されます。</p>
        </div>
        <div class="ce-ob__step">
          <span class="ce-ob__num">3</span>
          <p class="ce-ob__text">すべての修正が完了したら<br><strong>「✦ 修正を確定して送信」</strong>を押してください。</p>
        </div>
      </div>
      <button class="ce-ob__go" id="ceObGo">編集を開始する</button>
      <button class="ce-ob__skip" id="ceObSkip">次回から表示しない</button>
    </div>`;
    document.body.appendChild(modal);

    requestAnimationFrame(() => modal.classList.add('ce-show'));

    document.getElementById('ceObGo').addEventListener('click', () => {
      modal.classList.remove('ce-show');
      setTimeout(() => modal.remove(), 400);
      sessionStorage.setItem('ce_onboarding_done', 'true');
    });
    document.getElementById('ceObSkip').addEventListener('click', () => {
      modal.classList.remove('ce-show');
      setTimeout(() => modal.remove(), 400);
      sessionStorage.setItem('ce_onboarding_done', 'true');
      localStorage.setItem('ce_onboarding_skip', 'true');
    });

    // Skip if previously opted out
    if (localStorage.getItem('ce_onboarding_skip')) {
      modal.remove();
    }
  }

  /* ---- Report ---- */
  function rpt() {
    const a = allEdits();
    if (!Object.keys(a).length) return '修正はありません。';
    let r = `══════════════════════════════════════════\n  ${CFG.projectName} — 文言修正一覧\n  ${new Date().toLocaleString('ja-JP')}\n══════════════════════════════════════════\n\n`;
    let t = 0;
    Object.values(a).forEach(pg => {
      t += pg.changes.length;
      r += `▼ ${pg.name}（${pg.changes.length}件）\n──────────────────────────────────────────\n`;
      pg.changes.forEach((e,i) => { r += `  ${i+1}. 【変更前】${e.original}\n     【変更後】${e.modified}\n\n`; });
    });
    r += `══════════════════════════════════════════\n  合計: ${t}件\n══════════════════════════════════════════\n`;
    return r;
  }

  /* ---- Actions ---- */
  function copyRpt() {
    navigator.clipboard.writeText(rpt()).then(() => toast('修正一覧をコピーしました')).catch(() => {
      const ta = document.createElement('textarea'); ta.value = rpt();
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      toast('修正一覧をコピーしました');
    });
  }

  function dlRpt() {
    const b = new Blob([rpt()], { type:'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = `${CFG.projectSlug}_修正_${new Date().toISOString().slice(0,10)}.txt`;
    a.click(); URL.revokeObjectURL(a.href);
    toast('修正一覧をダウンロードしました');
  }

  function resetPg() {
    if (!confirm('このページの修正をすべて元に戻しますか？')) return;
    Object.keys(originals).forEach(eid => {
      const el = document.querySelector(`[data-ce-id="${eid}"]`);
      if (el) { el.innerText = originals[eid]; el.classList.remove('ce-m'); }
    });
    edits = {}; localStorage.removeItem(SKEY); ui();
    toast('修正をリセットしました');
  }

  async function submit() {
    const t = total();
    if (!t) return;
    if (!confirm(`全${t}件の修正を確定しますか？\n変更はサイトに自動反映されます。`)) return;

    const btn = document.getElementById('ceSub');
    btn.classList.add('ce-ld'); btn.textContent = '✦  送信中...';

    const data = { pages: allEdits() };

    if (CFG.apiEndpoint) {
      try {
        const headers = { 'Content-Type': 'application/json' };
        // ★ 認証ヘッダー追加
        if (CFG.apiSecret) {
          headers['Authorization'] = `Bearer ${CFG.apiSecret}`;
        }
        const res = await fetch(CFG.apiEndpoint, { method: 'POST', headers, body: JSON.stringify(data) });
        const result = await res.json();

        if (res.ok && result.success) {
          PAGES.forEach(p => localStorage.removeItem(PREFIX + p.path));
          edits = {};
          document.querySelectorAll('.ce-m').forEach(el => el.classList.remove('ce-m'));
          ui();
          btn.classList.remove('ce-ld'); btn.textContent = '✦  修正を確定して送信';
          toast(`✓ ${result.summary.applied}件を自動反映しました`);
          return;
        }
        if (res.status === 401) {
          toast('認証エラー — 管理者に連絡してください');
          btn.classList.remove('ce-ld'); btn.textContent = '✦  修正を確定して送信';
          return;
        }
      } catch(e) {
        console.warn('API unavailable, fallback to download:', e);
      }
    }

    // Fallback: JSON download
    btn.classList.remove('ce-ld'); btn.textContent = '✦  修正を確定して送信';
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${CFG.projectSlug}_修正_${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
    toast('修正をJSONでダウンロードしました');
  }

  /* ---- Start ---- */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
