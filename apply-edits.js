#!/usr/bin/env node
/* ============================================================
   Hakobune — Auto-Apply Script
   クライアントから受け取ったJSONを元にHTMLを自動修正

   使い方:
     node apply-edits.js <edits.json>

   JSONフォーマット (editor.js が出力するもの):
   {
     "pages": {
       "/mock1/": {
         "name": "トップ",
         "changes": [
           { "original": "<old text>", "modified": "<new text>" }
         ]
       }
     }
   }
   ============================================================ */

const fs = require('fs');
const path = require('path');

// Path mapping: URL path → local file path
const PATH_MAP = {
  '/mock1/': 'mock1/index.html',
  '/mock1/consulting/': 'mock1/consulting/index.html',
  '/mock1/realestate/': 'mock1/realestate/index.html',
  '/mock1/community/': 'mock1/community/index.html',
  '/mock1/tour/': 'mock1/tour/index.html',
  '/mock1/coin/': 'mock1/coin/index.html',
  '/mock1/akiya/': 'mock1/akiya/index.html'
};

function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error('使い方: node apply-edits.js <edits.json>');
    process.exit(1);
  }

  const edits = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  let totalApplied = 0;
  let totalFailed = 0;

  console.log('══════════════════════════════════════════');
  console.log('  Hakobune — 自動文言修正');
  console.log(`  JSON: ${jsonPath}`);
  console.log(`  生成日時: ${edits.generatedAt || '不明'}`);
  console.log('══════════════════════════════════════════\n');

  Object.entries(edits.pages).forEach(([urlPath, page]) => {
    const filePath = PATH_MAP[urlPath];
    if (!filePath) {
      console.log(`⚠ パス不明: ${urlPath} — スキップ`);
      return;
    }

    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠ ファイルなし: ${fullPath} — スキップ`);
      return;
    }

    let html = fs.readFileSync(fullPath, 'utf-8');
    console.log(`▼ ${page.name}（${filePath}）`);

    page.changes.forEach((change, i) => {
      const original = change.original.trim();
      const modified = change.modified.trim();

      if (html.includes(original)) {
        html = html.replace(original, modified);
        const preview = original.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
        console.log(`  ✓ ${i + 1}. "${preview}..." → 修正適用`);
        totalApplied++;
      } else {
        const preview = original.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
        console.log(`  ✗ ${i + 1}. "${preview}..." → 一致なし（手動確認が必要）`);
        totalFailed++;
      }
    });

    fs.writeFileSync(fullPath, html, 'utf-8');
    console.log(`  → 保存完了\n`);
  });

  console.log('══════════════════════════════════════════');
  console.log(`  完了: ${totalApplied}件適用 / ${totalFailed}件失敗`);
  console.log('══════════════════════════════════════════');

  if (totalFailed > 0) {
    console.log('\n⚠ 一部の修正が自動適用できませんでした。');
    console.log('  手動で確認してください。');
    process.exit(1);
  }
}

main();
