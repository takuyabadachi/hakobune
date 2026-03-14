-- ==========================================
-- COptO AI — LINE関連テーブル削除
-- 
-- ⚠️ 注意: 実行前に以下のコード修正を完了してください:
-- 1. chat/index.ts: getAdminContext() からline系テーブル参照を削除
-- 2. admin-main.js: fetchLineData(), renderLineSummary(), 
--    renderLineExtractions(), approveExtraction(), dismissExtraction(),
--    populateLineGroupSelect(), renderLineLog() を削除
-- 3. admin HTML: LINE タブ関連のUI要素を削除
--
-- Supabase SQL Editor で実行してください
-- ==========================================

-- まずポリシーを削除
DROP POLICY IF EXISTS "service_all_line_extractions" ON line_extractions;
DROP POLICY IF EXISTS "service_all_line_messages" ON line_messages;
DROP POLICY IF EXISTS "service_all_line_groups" ON line_groups;
DROP POLICY IF EXISTS "service_role_line_users" ON line_users;
DROP POLICY IF EXISTS "auth_read_line_extractions" ON line_extractions;
DROP POLICY IF EXISTS "auth_read_line_messages" ON line_messages;
DROP POLICY IF EXISTS "auth_read_line_groups" ON line_groups;
DROP POLICY IF EXISTS "auth_update_line_extractions" ON line_extractions;
DROP POLICY IF EXISTS "Admin read line_extractions" ON line_extractions;
DROP POLICY IF EXISTS "Admin write line_extractions" ON line_extractions;
DROP POLICY IF EXISTS "Admin read line_groups" ON line_groups;

-- テーブル削除（CASCADE で依存関係も削除）
DROP TABLE IF EXISTS line_extractions CASCADE;
DROP TABLE IF EXISTS line_messages CASCADE;
DROP TABLE IF EXISTS line_groups CASCADE;
DROP TABLE IF EXISTS line_users CASCADE;

-- Realtime publication から削除（エラーは無視してOK）
-- ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS line_messages;
-- ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS line_extractions;
