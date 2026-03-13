/* ============================================================
   EDITOR CONFIG — プロジェクト固有設定
   
   他クライアントで使う場合、このファイルだけ差し替えてください。
   editor.js, edit/index.html, api/apply-edits.js は共通です。
   ============================================================ */

window.EDITOR_CONFIG = {

  /* ---- プロジェクト情報 ---- */
  projectName: 'Hakobune Inc.',
  projectSlug: 'hakobune',
  
  /* ---- API Endpoint (Vercel Serverless Function) ---- */
  apiEndpoint: '/api/apply-edits',

  /* ---- API認証シークレット (Vercel EDITOR_API_SECRET と同じ値) ---- */
  /* ⚠️ 本番では環境変数経由で注入するか、別途認証フローを構築 */
  apiSecret: 'b3afc4d3731a29ef7c3cee2ce944335fcabfd345643d27718bc1d42f7f17f528',

  /* ---- ページ一覧 ---- */
  pages: [
    { path: '/mock1/',            name: 'Home',           label: 'トップページ' },
    { path: '/mock1/consulting/', name: 'Consulting',     label: 'コンサルティング' },
    { path: '/mock1/realestate/', name: 'Real Estate',    label: '海外不動産' },
    { path: '/mock1/community/',  name: 'Community',      label: 'コミュニティ' },
    { path: '/mock1/tour/',       name: 'World Tour',     label: '世界一周ツアー' },
    { path: '/mock1/coin/',       name: 'Antique Coins',  label: 'アンティークコイン' },
    { path: '/mock1/akiya/',      name: 'Akiya',          label: '空き家再生' }
  ],

  /* ---- 編集対象セレクタ ---- */
  editableSelectors: [
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
  ],

  /* ---- 編集から除外する要素 ---- */
  excludeSelectors: ['.nav-overlay', '.hk-editor', '.header'],

  /* ---- テーマカラー ---- */
  theme: {
    accent: '#C8A96E',       // ゴールド
    accentHover: '#D4B87A',
    panelBg: 'rgba(26,26,26,0.97)',
    panelBorder: 'rgba(255,255,255,0.06)',
    textPrimary: '#fff',
    textSecondary: 'rgba(255,255,255,0.6)',
    textMuted: 'rgba(255,255,255,0.25)',
    topBarBg: '#1A1A1A',
    badgeColor: '#C8A96E'
  }
};
