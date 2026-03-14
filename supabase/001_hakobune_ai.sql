-- ==========================================
-- Hakobune AI — Phase 1 DB Schema
-- Supabase SQL Editor で実行してください
-- ==========================================

-- グループ管理
CREATE TABLE IF NOT EXISTS hk_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  line_group_id TEXT NOT NULL UNIQUE,
  group_name TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 会話ログ（全メッセージ保存）
CREATE TABLE IF NOT EXISTS hk_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  line_group_id TEXT NOT NULL DEFAULT 'dm',
  line_user_id TEXT NOT NULL,
  display_name TEXT DEFAULT '',
  content TEXT DEFAULT '',
  line_message_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- AIセッション（会話コンテキスト）
CREATE TABLE IF NOT EXISTS hk_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_key TEXT NOT NULL UNIQUE,
  messages JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 記録停止（オプトアウト）
CREATE TABLE IF NOT EXISTS hk_optout (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  line_user_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── インデックス ───
CREATE INDEX IF NOT EXISTS idx_hk_messages_group ON hk_messages(line_group_id);
CREATE INDEX IF NOT EXISTS idx_hk_messages_user ON hk_messages(line_user_id);
CREATE INDEX IF NOT EXISTS idx_hk_messages_ts ON hk_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_hk_messages_content ON hk_messages USING gin(to_tsvector('simple', content));
CREATE INDEX IF NOT EXISTS idx_hk_groups_gid ON hk_groups(line_group_id);
CREATE INDEX IF NOT EXISTS idx_hk_sessions_key ON hk_sessions(session_key);

-- ─── RLS ───
ALTER TABLE hk_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_optout ENABLE ROW LEVEL SECURITY;

-- service_role 用（Vercel Serverless Functions から使用）
CREATE POLICY "service_all_hk_groups" ON hk_groups FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_hk_messages" ON hk_messages FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_hk_sessions" ON hk_sessions FOR ALL TO service_role USING (true);
CREATE POLICY "service_all_hk_optout" ON hk_optout FOR ALL TO service_role USING (true);
