/* ============================================================
   HAKOBUNE INC. — Content Editor System
   URL に ?edit=true を追加すると編集モードが有効化
   クライアントが直接ページ上でテキストを修正可能
   変更は localStorage に即時保存、差分をエクスポート可能
   ============================================================ */

(function() {
  'use strict';

  // ---- Edit Mode Check ----
  const urlParams = new URLSearchParams(window.location.search);
  if (!urlParams.has('edit') || urlParams.get('edit') !== 'true') return;

  // ---- Config ----
  const STORAGE_KEY = 'hakobune_edits_' + window.location.pathname;
  const EDITABLE_SELECTORS = [
    'h1', 'h2', 'h3', 'h4',
    'p', 'blockquote',
    'span.hero__subtitle', 'span.hero__scroll-text',
    'span.lp-hero__label',
    'span.service-card__number',
    'span.service-card__title-en',
    '.service-card__desc',
    '.service-card__title',
    '.section-label',
    '.philosophy__quote', '.philosophy__body',
    '.hero__lead', '.hero__title',
    '.lp-hero__title', '.lp-hero__lead',
    '.lp-about__body',
    '.lp-feature-card__title', '.lp-feature-card__desc',
    '.lp-result-card__value', '.lp-result-card__label',
    '.lp-pricing__total',
    '.community__feature-number', '.community__feature-text',
    '.contact__note',
    '.footer__logo', '.footer__desc',
    '.footer__copyright',
    'td', 'th',
    '.section-body',
    '.section-heading'
  ].join(', ');

  // ---- State ----
  let originalTexts = {};
  let currentEdits = {};
  let editableElements = [];

  // ---- Init ----
  function init() {
    injectStyles();
    collectOriginalTexts();
    loadSavedEdits();
    makeEditable();
    createToolbar();
    updateChangeCount();
  }

  // ---- Inject Editor Styles ----
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Editor Mode Indicator */
      body.editor-active::before {
        content: '✏️ 編集モード — テキストをクリックして修正できます';
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 10000;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
        text-align: center;
        padding: 10px 20px;
        font-family: 'Noto Sans JP', sans-serif;
        font-size: 13px;
        font-weight: 500;
        letter-spacing: 0.05em;
      }
      body.editor-active {
        padding-top: 40px !important;
      }
      body.editor-active .header {
        top: 40px !important;
      }

      /* Editable Elements */
      [data-editable] {
        position: relative;
        transition: outline 0.2s ease, background 0.2s ease;
        cursor: text;
        border-radius: 4px;
      }
      [data-editable]:hover {
        outline: 2px dashed rgba(102, 126, 234, 0.5);
        outline-offset: 4px;
      }
      [data-editable]:focus {
        outline: 2px solid #667eea;
        outline-offset: 4px;
        background: rgba(102, 126, 234, 0.05);
      }
      [data-editable].is-changed {
        outline: 2px solid #f59e0b;
        outline-offset: 4px;
      }
      [data-editable].is-changed::after {
        content: '変更済';
        position: absolute;
        top: -8px;
        right: -4px;
        background: #f59e0b;
        color: #fff;
        font-size: 9px;
        padding: 1px 6px;
        border-radius: 8px;
        font-family: 'Noto Sans JP', sans-serif;
        pointer-events: none;
        z-index: 100;
      }

      /* Floating Toolbar */
      .editor-toolbar {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 10001;
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-family: 'Noto Sans JP', -apple-system, sans-serif;
      }
      .editor-toolbar__panel {
        background: #1a1a2e;
        border-radius: 16px;
        padding: 20px 24px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        min-width: 280px;
        backdrop-filter: blur(12px);
      }
      .editor-toolbar__title {
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.4);
        margin-bottom: 12px;
      }
      .editor-toolbar__count {
        font-size: 36px;
        font-weight: 300;
        color: #fff;
        margin-bottom: 4px;
        line-height: 1;
      }
      .editor-toolbar__label {
        font-size: 12px;
        color: rgba(255,255,255,0.5);
        margin-bottom: 16px;
      }
      .editor-toolbar__buttons {
        display: flex;
        gap: 8px;
      }
      .editor-toolbar__btn {
        flex: 1;
        padding: 10px 16px;
        border: none;
        border-radius: 8px;
        font-family: inherit;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        letter-spacing: 0.05em;
      }
      .editor-toolbar__btn--export {
        background: #667eea;
        color: #fff;
      }
      .editor-toolbar__btn--export:hover {
        background: #5a6fd6;
      }
      .editor-toolbar__btn--export:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .editor-toolbar__btn--reset {
        background: rgba(255,255,255,0.1);
        color: rgba(255,255,255,0.7);
      }
      .editor-toolbar__btn--reset:hover {
        background: rgba(255,255,255,0.15);
      }
      .editor-toolbar__btn--copy {
        background: #10b981;
        color: #fff;
      }
      .editor-toolbar__btn--copy:hover {
        background: #059669;
      }
      .editor-toolbar__toast {
        position: fixed;
        bottom: 100px;
        right: 24px;
        background: #10b981;
        color: #fff;
        padding: 12px 24px;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 500;
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.3s ease;
        pointer-events: none;
        z-index: 10002;
      }
      .editor-toolbar__toast.is-visible {
        opacity: 1;
        transform: translateY(0);
      }

      /* Page List */
      .editor-toolbar__pages {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid rgba(255,255,255,0.1);
      }
      .editor-toolbar__page-link {
        display: block;
        font-size: 11px;
        color: rgba(255,255,255,0.5);
        padding: 4px 0;
        transition: color 0.2s;
      }
      .editor-toolbar__page-link:hover {
        color: #fff;
      }
      .editor-toolbar__page-link.is-current {
        color: #667eea;
      }
    `;
    document.head.appendChild(style);
  }

  // ---- Collect Original Texts ----
  function collectOriginalTexts() {
    const elements = document.querySelectorAll(EDITABLE_SELECTORS);
    let id = 0;
    elements.forEach(el => {
      // Skip if inside nav-overlay, editor toolbar, or is a link with only href
      if (el.closest('.nav-overlay') || el.closest('.editor-toolbar') || el.closest('.header')) return;
      if (el.tagName === 'A' && el.children.length === 0 && el.getAttribute('href')) return;

      const editId = 'edit-' + id++;
      el.setAttribute('data-edit-id', editId);
      el.setAttribute('data-editable', '');
      originalTexts[editId] = el.innerHTML.trim();
      editableElements.push(el);
    });
  }

  // ---- Make Elements Editable ----
  function makeEditable() {
    document.body.classList.add('editor-active');

    editableElements.forEach(el => {
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'false');

      // Real-time save on input
      el.addEventListener('input', () => {
        const editId = el.getAttribute('data-edit-id');
        const current = el.innerHTML.trim();
        const original = originalTexts[editId];

        if (current !== original) {
          currentEdits[editId] = {
            original: original,
            modified: current,
            selector: getSelector(el),
            page: window.location.pathname
          };
          el.classList.add('is-changed');
        } else {
          delete currentEdits[editId];
          el.classList.remove('is-changed');
        }

        saveEdits();
        updateChangeCount();
      });

      // Prevent line breaks on Enter for headings
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          if (el.tagName.match(/^H[1-6]$/) || el.classList.contains('section-label')) {
            e.preventDefault();
          }
        }
      });
    });
  }

  // ---- Save / Load Edits ----
  function saveEdits() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentEdits));
  }

  function loadSavedEdits() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        currentEdits = JSON.parse(saved);
        // Apply saved edits
        Object.keys(currentEdits).forEach(editId => {
          const el = document.querySelector(`[data-edit-id="${editId}"]`);
          if (el) {
            el.innerHTML = currentEdits[editId].modified;
            el.classList.add('is-changed');
          }
        });
      }
    } catch (e) {
      console.warn('Failed to load saved edits', e);
    }
  }

  // ---- Get Human-Readable Selector ----
  function getSelector(el) {
    const tag = el.tagName.toLowerCase();
    const cls = el.className ? '.' + el.className.split(' ').filter(c => !c.startsWith('is-') && c !== '').join('.') : '';
    const section = el.closest('section');
    const sectionId = section ? '#' + (section.id || section.className.split(' ')[0]) : '';
    return `${sectionId} ${tag}${cls}`.trim();
  }

  // ---- Create Toolbar ----
  function createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'editor-toolbar';
    toolbar.innerHTML = `
      <div class="editor-toolbar__panel">
        <div class="editor-toolbar__title">Content Editor</div>
        <div class="editor-toolbar__count" id="editorCount">0</div>
        <div class="editor-toolbar__label">箇所を変更済み</div>
        <div class="editor-toolbar__buttons">
          <button class="editor-toolbar__btn editor-toolbar__btn--copy" id="editorCopy" disabled>
            📋 コピー
          </button>
          <button class="editor-toolbar__btn editor-toolbar__btn--export" id="editorExport" disabled>
            💾 保存
          </button>
          <button class="editor-toolbar__btn editor-toolbar__btn--reset" id="editorReset">
            ↩️ リセット
          </button>
        </div>
        <div class="editor-toolbar__pages">
          <a href="/mock1/?edit=true" class="editor-toolbar__page-link ${isCurrentPage('/mock1/') ? 'is-current' : ''}">HP</a>
          <a href="/mock1/consulting/?edit=true" class="editor-toolbar__page-link ${isCurrentPage('/mock1/consulting/') ? 'is-current' : ''}">Consulting</a>
          <a href="/mock1/realestate/?edit=true" class="editor-toolbar__page-link ${isCurrentPage('/mock1/realestate/') ? 'is-current' : ''}">Real Estate</a>
          <a href="/mock1/community/?edit=true" class="editor-toolbar__page-link ${isCurrentPage('/mock1/community/') ? 'is-current' : ''}">Community</a>
          <a href="/mock1/tour/?edit=true" class="editor-toolbar__page-link ${isCurrentPage('/mock1/tour/') ? 'is-current' : ''}">Tour</a>
          <a href="/mock1/coin/?edit=true" class="editor-toolbar__page-link ${isCurrentPage('/mock1/coin/') ? 'is-current' : ''}">Coin</a>
          <a href="/mock1/akiya/?edit=true" class="editor-toolbar__page-link ${isCurrentPage('/mock1/akiya/') ? 'is-current' : ''}">Akiya</a>
        </div>
      </div>
    `;
    document.body.appendChild(toolbar);

    // Toast element
    const toast = document.createElement('div');
    toast.className = 'editor-toolbar__toast';
    toast.id = 'editorToast';
    document.body.appendChild(toast);

    // Event Listeners
    document.getElementById('editorCopy').addEventListener('click', copyChanges);
    document.getElementById('editorExport').addEventListener('click', exportChanges);
    document.getElementById('editorReset').addEventListener('click', resetChanges);
  }

  function isCurrentPage(path) {
    return window.location.pathname === path;
  }

  // ---- Update Change Count ----
  function updateChangeCount() {
    const count = Object.keys(currentEdits).length;
    const countEl = document.getElementById('editorCount');
    const exportBtn = document.getElementById('editorExport');
    const copyBtn = document.getElementById('editorCopy');
    if (countEl) countEl.textContent = count;
    if (exportBtn) exportBtn.disabled = count === 0;
    if (copyBtn) copyBtn.disabled = count === 0;
  }

  // ---- Show Toast ----
  function showToast(message) {
    const toast = document.getElementById('editorToast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    setTimeout(() => toast.classList.remove('is-visible'), 2500);
  }

  // ---- Generate Change Report ----
  function generateReport() {
    // Collect edits from ALL pages
    const allEdits = {};
    const pages = [
      '/mock1/', '/mock1/consulting/', '/mock1/realestate/',
      '/mock1/community/', '/mock1/tour/', '/mock1/coin/', '/mock1/akiya/'
    ];
    const pageNames = {
      '/mock1/': 'HP（トップ）',
      '/mock1/consulting/': 'コンサルティング',
      '/mock1/realestate/': '海外不動産',
      '/mock1/community/': 'コミュニティ',
      '/mock1/tour/': '世界一周ツアー',
      '/mock1/coin/': 'アンティークコイン',
      '/mock1/akiya/': '空き家再生'
    };

    pages.forEach(page => {
      const key = 'hakobune_edits_' + page;
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          const edits = JSON.parse(saved);
          if (Object.keys(edits).length > 0) {
            allEdits[page] = edits;
          }
        }
      } catch(e) {}
    });

    if (Object.keys(allEdits).length === 0) {
      return '変更はありません。';
    }

    let report = '═══════════════════════════════════════\n';
    report += '  Hakobune Inc. — 文言修正一覧\n';
    report += '  作成日: ' + new Date().toLocaleString('ja-JP') + '\n';
    report += '═══════════════════════════════════════\n\n';

    let totalChanges = 0;
    Object.keys(allEdits).forEach(page => {
      const pageName = pageNames[page] || page;
      const edits = allEdits[page];
      const changeCount = Object.keys(edits).length;
      totalChanges += changeCount;

      report += `▼ ${pageName}（${changeCount}件）\n`;
      report += '───────────────────────────────────────\n';

      Object.values(edits).forEach((edit, i) => {
        // Strip HTML tags for clean display
        const cleanOriginal = edit.original.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        const cleanModified = edit.modified.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        report += `  ${i + 1}. 【変更前】${cleanOriginal}\n`;
        report += `     【変更後】${cleanModified}\n\n`;
      });
      report += '\n';
    });

    report += `═══════════════════════════════════════\n`;
    report += `  合計: ${totalChanges}件の変更\n`;
    report += `═══════════════════════════════════════\n`;

    return report;
  }

  // ---- Copy Changes to Clipboard ----
  function copyChanges() {
    const report = generateReport();
    navigator.clipboard.writeText(report).then(() => {
      showToast('✅ 変更内容をクリップボードにコピーしました');
    }).catch(() => {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = report;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      showToast('✅ 変更内容をクリップボードにコピーしました');
    });
  }

  // ---- Export Changes as File ----
  function exportChanges() {
    const report = generateReport();
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hakobune_修正一覧_' + new Date().toISOString().slice(0,10) + '.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast('💾 修正一覧をダウンロードしました');
  }

  // ---- Reset All Changes ----
  function resetChanges() {
    if (!confirm('このページの変更をすべてリセットしますか？')) return;

    Object.keys(originalTexts).forEach(editId => {
      const el = document.querySelector(`[data-edit-id="${editId}"]`);
      if (el) {
        el.innerHTML = originalTexts[editId];
        el.classList.remove('is-changed');
      }
    });

    currentEdits = {};
    localStorage.removeItem(STORAGE_KEY);
    updateChangeCount();
    showToast('↩️ 変更をリセットしました');
  }

  // ---- Start ----
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
