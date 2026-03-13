# Content Editor — Static Site Inline Editor

クライアントが直接Webページ上でテキストを編集し、変更をGitHub経由で自動反映するシステム。

## 導入方法

### 1. ファイルをコピー

```
your-project/
├── editor.js           ← エディターエンジン（共通）
├── editor-config.js    ← プロジェクト固有設定（★これだけ変更）
├── edit/index.html     ← エディターハブページ（共通）
├── api/apply-edits.js  ← Vercel Serverless Function（共通）
├── middleware.js       ← 認証ミドルウェア（共通）
└── *.html              ← 各ページのHTMLファイル
```

### 2. HTMLにスクリプトを追加

各ページの `</body>` 前に:

```html
<script src="/editor-config.js"></script>
<script src="/editor.js"></script>
```

### 3. editor-config.js を編集

```javascript
window.EDITOR_CONFIG = {
  projectName: 'Your Client Name',
  projectSlug: 'client-slug',
  apiEndpoint: '/api/apply-edits',
  apiSecret: null, // EDITOR_API_SECRET と同じ値
  pages: [
    { path: '/', name: 'Home', label: 'トップ' },
    { path: '/about/', name: 'About', label: '会社概要' },
    // ...
  ],
  editableSelectors: ['h1', 'h2', 'h3', 'p', '.hero__title', /* ... */],
  excludeSelectors: ['.header', '.nav-overlay'],
  theme: {
    accent: '#C8A96E',      // ゴールド
    panelBg: 'rgba(26,26,26,0.97)',
    topBarBg: '#1A1A1A',
  }
};
```

### 4. Vercel環境変数を設定

```
GITHUB_TOKEN       = ghp_xxxxxxxxxxxx (repo scope)
GITHUB_OWNER       = your-github-username
GITHUB_REPO        = your-repo-name
GITHUB_BRANCH      = main
EDITOR_API_SECRET  = your-random-secret-string
```

### 5. クライアントに共有

```
https://your-site.com/edit/
```

## 機能一覧

| 機能 | 説明 |
|------|------|
| インライン編集 | テキストクリックで直接修正 |
| 自動保存 | localStorage に即時保存 |
| ペースト保護 | プレーンテキスト強制（HTML混入防止） |
| Undo/Redo | Ctrl+Z / Ctrl+Shift+Z |
| 書式ブロック | Ctrl+B/I/U を無効化 |
| 認証付きAPI | Bearer token で保護 |
| 自動デプロイ | GitHub commit → Vercel 自動反映 |
| オンボーディング | 初回訪問時に3ステップガイド表示 |
| 全ページカウント | ページ横断で変更数を集計 |

## セキュリティ

- APIは `middleware.js` で `Authorization: Bearer` 認証
- GitHub Token は Vercel env vars に格納（クライアントに公開しない）
- `apiSecret` は editor-config.js に設定（本番では環境変数注入推奨）

## GitHub App 移行（推奨）

Personal Access Token の代わりに GitHub App を使用すると:
- リポジトリ限定の権限
- トークン自動回転
- 監査ログ対応

### 設定手順

1. GitHub → Settings → Developer Settings → GitHub Apps → New
2. App名: `Content Editor Bot`
3. Permissions: Contents (Read & Write)
4. Installation: 対象リポジトリのみ
5. Private Key をダウンロード
6. Vercel env vars に `APP_ID`, `PRIVATE_KEY`, `INSTALLATION_ID` を設定
7. `api/apply-edits.js` で JWT → Installation Token 取得に変更
