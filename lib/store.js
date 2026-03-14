/**
 * Supabase Data Store for Hakobune AI
 * Manages: groups, messages, sessions
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── Groups ───

export async function upsertGroup(lineGroupId, groupName) {
  const { error } = await supabase
    .from('hk_groups')
    .upsert(
      { line_group_id: lineGroupId, group_name: groupName || '' },
      { onConflict: 'line_group_id' }
    );
  if (error) console.error('upsertGroup error:', error.message);
}

// ─── Messages (conversation logging) ───

export async function saveMessage({ groupId, userId, displayName, content, messageId }) {
  const { error } = await supabase.from('hk_messages').insert({
    line_group_id: groupId || 'dm',
    line_user_id: userId,
    display_name: displayName || '',
    content: content || '',
    line_message_id: messageId,
  });
  if (error && !error.message.includes('duplicate')) {
    console.error('saveMessage error:', error.message);
  }
}

/**
 * Check if a user has opted out of recording
 */
export async function isOptedOut(userId) {
  const { data } = await supabase
    .from('hk_optout')
    .select('id')
    .eq('line_user_id', userId)
    .maybeSingle();
  return !!data;
}

export async function setOptout(userId, optout) {
  if (optout) {
    await supabase.from('hk_optout').upsert(
      { line_user_id: userId },
      { onConflict: 'line_user_id' }
    );
  } else {
    await supabase.from('hk_optout').delete().eq('line_user_id', userId);
  }
}

// ─── Sessions (conversation context for Grok) ───

export async function getSession(sessionKey) {
  const { data } = await supabase
    .from('hk_sessions')
    .select('messages')
    .eq('session_key', sessionKey)
    .maybeSingle();
  return data?.messages || [];
}

export async function saveSession(sessionKey, messages) {
  // Keep last 40 messages (Grok 2M context can handle more)
  const trimmed = messages.slice(-40);
  await supabase.from('hk_sessions').upsert(
    { session_key: sessionKey, messages: trimmed, updated_at: new Date().toISOString() },
    { onConflict: 'session_key' }
  );
}

export async function clearSession(sessionKey) {
  await supabase.from('hk_sessions').delete().eq('session_key', sessionKey);
}

// ─── Conversation Search (#振り返り) ───

export async function searchMessages(groupId, query, limit = 20) {
  // Guard against excessively long queries
  const safeQuery = (query || '').slice(0, 200);
  // Simple text search (upgrade to pgvector when embeddings are ready)
  const { data, error } = await supabase
    .from('hk_messages')
    .select('display_name, content, created_at')
    .eq('line_group_id', groupId || 'dm')
    .ilike('content', `%${safeQuery}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('searchMessages error:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Get recent messages for a group (for conversation review)
 */
export async function getRecentMessages(groupId, days = 7, limit = 50) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('hk_messages')
    .select('display_name, content, created_at')
    .eq('line_group_id', groupId || 'dm')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('getRecentMessages error:', error.message);
    return [];
  }
  return data || [];
}

// ─── Tasks (#task) ───

export async function createTask({ groupId, createdBy, createdByName, assignedTo, assignedToName, title, dueDate }) {
  const { data, error } = await supabase.from('hk_tasks').insert({
    line_group_id: groupId || 'dm',
    created_by: createdBy,
    created_by_name: createdByName || '',
    assigned_to: assignedTo || createdBy,
    assigned_to_name: assignedToName || createdByName || '',
    title,
    due_date: dueDate || null,
    status: 'open',
  }).select('id, title, due_date, assigned_to_name, status').single();

  if (error) {
    console.error('createTask error:', error.message);
    return null;
  }
  return data;
}

export async function listTasks(groupId, status = 'open', limit = 20) {
  const { data, error } = await supabase
    .from('hk_tasks')
    .select('id, title, due_date, assigned_to_name, created_by_name, status, created_at')
    .eq('line_group_id', groupId || 'dm')
    .eq('status', status)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error('listTasks error:', error.message);
    return [];
  }
  return data || [];
}

export async function completeTask(taskId) {
  const { data, error } = await supabase
    .from('hk_tasks')
    .update({ status: 'done', updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select('id, title, assigned_to_name')
    .single();

  if (error) {
    console.error('completeTask error:', error.message);
    return null;
  }
  return data;
}

export async function deleteTask(taskId) {
  const { error } = await supabase
    .from('hk_tasks')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', taskId);

  if (error) console.error('deleteTask error:', error.message);
  return !error;
}

/**
 * Get tasks due today or overdue (for Cron reminder)
 */
export async function getDueTasks() {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('hk_tasks')
    .select('id, title, due_date, assigned_to, assigned_to_name, line_group_id, created_by_name')
    .eq('status', 'open')
    .lte('due_date', endOfDay.toISOString())
    .order('due_date', { ascending: true });

  if (error) {
    console.error('getDueTasks error:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Look up a user's LINE User ID by display name (from hk_messages history)
 */
export async function findUserByName(groupId, name) {
  const { data } = await supabase
    .from('hk_messages')
    .select('line_user_id, display_name')
    .eq('line_group_id', groupId || 'dm')
    .ilike('display_name', `%${name}%`)
    .order('created_at', { ascending: false })
    .limit(1);

  return data?.[0] || null;
}
