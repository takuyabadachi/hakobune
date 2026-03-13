/* ============================================================
   Content Editor — Auto-Apply API (Vercel Serverless Function)
   
   汎用版：環境変数でリポジトリ設定を管理
   
   環境変数（Vercel Dashboard）:
     GITHUB_TOKEN  — GitHub PAT (repo scope)
     GITHUB_OWNER  — リポジトリオーナー (default: env から自動)
     GITHUB_REPO   — リポジトリ名 (default: env から自動)
     GITHUB_BRANCH — ブランチ名 (default: main)
     EDITOR_PATH_PREFIX — サイトのパスプレフィックス (例: mock1)
   ============================================================ */

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER || 'takuyabadachi';
  const repo = process.env.GITHUB_REPO || 'hakobune';
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!token) return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });

  try {
    const { pages } = req.body;
    if (!pages || !Object.keys(pages).length) {
      return res.status(400).json({ error: 'No changes provided' });
    }

    const results = [];
    let totalApplied = 0, totalFailed = 0;

    for (const [urlPath, page] of Object.entries(pages)) {
      // Convert URL path to file path: /mock1/consulting/ → mock1/consulting/index.html
      const filePath = urlPath.replace(/^\//, '').replace(/\/$/, '') + '/index.html';
      // Special case: root of prefix → prefix/index.html
      const normalizedPath = filePath === '/index.html' ? 'index.html' : filePath;

      // Get current file from GitHub
      const getRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${normalizedPath}?ref=${branch}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' } }
      );

      if (!getRes.ok) {
        results.push({ page: urlPath, status: 'error', reason: 'File not found' });
        totalFailed += (page.changes || []).length;
        continue;
      }

      const fileData = await getRes.json();
      let content = Buffer.from(fileData.content, 'base64').toString('utf-8');
      let applied = 0;

      for (const change of (page.changes || [])) {
        const orig = (change.original || '').trim();
        const mod = (change.modified || '').trim();
        if (orig && content.includes(orig)) {
          content = content.replace(orig, mod);
          applied++;
        } else {
          totalFailed++;
        }
      }

      if (applied > 0) {
        const putRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${normalizedPath}`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `fix(content): ${page.name || urlPath} — ${applied}件の文言修正`,
              content: Buffer.from(content).toString('base64'),
              sha: fileData.sha,
              branch
            })
          }
        );
        if (putRes.ok) {
          totalApplied += applied;
          results.push({ page: urlPath, status: 'success', applied });
        } else {
          totalFailed += applied;
          results.push({ page: urlPath, status: 'error', reason: (await putRes.json()).message });
        }
      } else {
        results.push({ page: urlPath, status: 'no_match' });
      }
    }

    return res.status(200).json({
      success: true,
      summary: { applied: totalApplied, failed: totalFailed },
      results,
      message: `${totalApplied}件を自動反映しました。`
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
