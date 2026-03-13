/* ============================================================
   Vercel Edge Middleware — API認証
   
   /api/* へのリクエストに Bearer token 認証を要求
   
   環境変数:
     EDITOR_API_SECRET — APIシークレット（任意の文字列）
   ============================================================ */

export const config = {
  matcher: '/api/:path*',
};

export default function middleware(request) {
  // OPTIONS は CORS preflight なので通す
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const authHeader = request.headers.get('Authorization');
  const expectedSecret = process.env.EDITOR_API_SECRET;

  if (!expectedSecret) {
    return new Response(JSON.stringify({ error: 'EDITOR_API_SECRET not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
