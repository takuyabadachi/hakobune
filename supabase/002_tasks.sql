-- ─── Phase 2: Task Management ───
-- Run in Supabase SQL Editor (same project as Phase 1)

CREATE TABLE IF NOT EXISTS hk_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  line_group_id TEXT NOT NULL DEFAULT 'dm',
  created_by TEXT NOT NULL,
  created_by_name TEXT DEFAULT '',
  assigned_to TEXT DEFAULT '',
  assigned_to_name TEXT DEFAULT '',
  title TEXT NOT NULL,
  due_date TIMESTAMPTZ,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hk_tasks_group ON hk_tasks(line_group_id);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_status ON hk_tasks(status);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_assigned ON hk_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_due ON hk_tasks(due_date);

ALTER TABLE hk_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all_hk_tasks" ON hk_tasks FOR ALL TO service_role USING (true);
