/**
 * Hakobune AI — LINE Webhook Handler
 * Vercel Serverless Function
 */

import { verifySignature, reply, push, formatForLine, getProfile, getGroupMemberProfile } from '../lib/line.js';
import { chat } from '../lib/grok.js';
import { PROMPTS, parseCommand, detectCoptoRedirect } from '../lib/prompts.js';
import {
  saveMessage, getSession, saveSession, clearSession,
  upsertGroup, isOptedOut, setOptout,
  searchMessages, getRecentMessages,
  createTask, listTasks, completeTask, deleteTask, findUserByName,
} from '../lib/store.js';
import { helpFlex, privacyNoticeFlex, reviewResultsFlex, taskCardFlex, taskListFlex } from '../lib/flex-templates.js';

// Disable Vercel body parsing to get raw body for signature verification
export const config = {
  api: { bodyParser: false },
};

const ADMIN_USER_ID = process.env.ADMIN_LINE_USER_ID || '';

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', c => chunks.push(typeof c === 'string' ? Buffer.from(c) : c));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ─── Signature Verification ───
  const buf = await buffer(req);
  const signature = req.headers['x-line-signature'];
  if (!verifySignature(buf.toString(), signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const body = JSON.parse(buf.toString());
  const events = body.events || [];

  // Respond 200 immediately (LINE requires fast response)
  res.status(200).json({ status: 'ok' });

  // Process events asynchronously
  for (const event of events) {
    try {
      await processEvent(event);
    } catch (err) {
      console.error('Event processing error:', err);
      // Notify admin on error
      if (ADMIN_USER_ID) {
        try { await push(ADMIN_USER_ID, `⚠️ Hakobune AI エラー:\n${err.message}`); } catch (_) {}
      }
    }
  }
}

async function processEvent(event) {
  // ─── Bot joined a group ───
  if (event.type === 'join') {
    const groupId = event.source.groupId;
    await upsertGroup(groupId, '');
    await reply(event.replyToken, [privacyNoticeFlex()]);
    return;
  }

  // ─── Postback (Flex Message button taps) ───
  if (event.type === 'postback') {
    await handlePostback(event);
    return;
  }

  // ─── Text message ───
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const text = event.message.text;
  const userId = event.source.userId;
  const groupId = event.source.groupId || null;
  const isGroup = event.source.type === 'group';
  const sessionKey = groupId || userId;

  // Get display name
  let displayName = '';
  if (isGroup && userId) {
    const profile = await getGroupMemberProfile(groupId, userId);
    displayName = profile?.displayName || '';
  } else if (userId) {
    const profile = await getProfile(userId);
    displayName = profile?.displayName || '';
  }

  // ─── Save message to conversation log (if not opted out) ───
  const optedOut = await isOptedOut(userId);
  if (!optedOut) {
    await saveMessage({
      groupId: groupId || 'dm',
      userId,
      displayName,
      content: text,
      messageId: event.message.id,
    });
  }

  // ─── In groups, only respond to commands (# prefix) or @mentions ───
  if (isGroup) {
    const isCommand = text.startsWith('#');
    // Also respond if bot is mentioned (LINE doesn't have native mentions easily,
    // so we check for "Hakobune" or "ハコブネ" in the message)
    const isMentioned = /hakobune|ハコブネ|はこぶね/i.test(text);
    if (!isCommand && !isMentioned) return; // Silent recording mode
  }

  // ─── Parse command ───
  const { mode, body: msgBody } = parseCommand(text);

  // ─── Handle special commands ───
  if (mode === 'help') {
    await reply(event.replyToken, [helpFlex()]);
    return;
  }

  if (mode === 'reset') {
    await clearSession(sessionKey);
    await reply(event.replyToken, '会話履歴をリセットしました 🔄');
    return;
  }

  if (mode === 'optout') {
    await setOptout(userId, true);
    await reply(event.replyToken, '発言の記録を停止しました。再開するには #記録再開 と送信してください。');
    return;
  }

  if (mode === 'optin') {
    await setOptout(userId, false);
    await reply(event.replyToken, '発言の記録を再開しました ✅');
    return;
  }

  // ─── #振り返り — Conversation search ───
  if (mode === 'review') {
    const query = msgBody || '';
    if (!query) {
      // Show recent messages summary
      const recent = await getRecentMessages(groupId || 'dm', 7, 30);
      if (recent.length === 0) {
        await reply(event.replyToken, '過去7日間の会話記録がありません。');
        return;
      }
      // Use Grok to summarize recent conversations
      const logText = recent
        .map(m => `[${new Date(m.created_at).toLocaleDateString('ja-JP')}] ${m.display_name}: ${m.content}`)
        .join('\n');
      const summary = await chat(
        PROMPTS.review + logText,
        [{ role: 'user', content: '過去7日間の会話を要約してください。誰が何を話したかを中心に。' }]
      );
      await reply(event.replyToken, formatForLine(summary));
      return;
    }

    // Search by keyword
    const results = await searchMessages(groupId || 'dm', query);
    await reply(event.replyToken, [reviewResultsFlex(query, results)]);
    return;
  }

  // ─── #task — Task management ───
  if (mode === 'task') {
    await handleTaskCommand(event, msgBody, userId, displayName, groupId);
    return;
  }

  // ─── COptO guardrail check ───
  if (detectCoptoRedirect(msgBody || text)) {
    await reply(event.replyToken,
      'この内容はCOptO AIの方が得意です！💡\n\n戦略・企画・分析・営業戦略などは、COptO AIに聞いてみてください。\nHakobune AIは「書く・整理する・管理する」業務をお手伝いします。'
    );
    return;
  }

  // ─── Get conversation history ───
  const history = await getSession(sessionKey);
  const userMessage = msgBody || text;
  history.push({ role: 'user', content: userMessage });

  // ─── Call Grok ───
  const prompt = PROMPTS[mode] || PROMPTS.default;
  const aiResponse = await chat(prompt, history);
  const lineText = formatForLine(aiResponse);

  // ─── Save conversation context ───
  history.push({ role: 'assistant', content: aiResponse });
  await saveSession(sessionKey, history);

  // ─── Reply (split if too long for LINE: 5000 char limit) ───
  if (lineText.length <= 5000) {
    await reply(event.replyToken, lineText);
  } else {
    // Split into chunks
    const chunks = [];
    for (let i = 0; i < lineText.length; i += 4500) {
      chunks.push(lineText.slice(i, i + 4500));
    }
    // LINE allows max 5 messages per reply
    await reply(event.replyToken, chunks.slice(0, 5));
  }
}

// ─── Task Command Handler ───

async function handleTaskCommand(event, body, userId, displayName, groupId) {
  const groupKey = groupId || 'dm';

  // #task 一覧 — List open tasks
  if (!body || body === '一覧' || body === 'list') {
    const tasks = await listTasks(groupKey);
    await reply(event.replyToken, [taskListFlex(tasks)]);
    return;
  }

  // #task 完了一覧 — List completed tasks
  if (body === '完了一覧' || body === 'done') {
    const tasks = await listTasks(groupKey, 'done');
    await reply(event.replyToken, tasks.length > 0
      ? [taskListFlex(tasks)]
      : '完了済みタスクはありません。'
    );
    return;
  }

  // ─── Create a new task ───
  // Parse: @担当者 タスク内容 日付
  let assignedToName = displayName;
  let assignedTo = userId;
  let title = body;

  // Extract @mention
  const mentionMatch = body.match(/[@＠]([^\s]+)\s*/);
  if (mentionMatch) {
    const mentionName = mentionMatch[1];
    title = body.replace(mentionMatch[0], '').trim();
    // Look up user by name in message history
    const found = await findUserByName(groupKey, mentionName);
    if (found) {
      assignedTo = found.line_user_id;
      assignedToName = found.display_name;
    } else {
      assignedToName = mentionName;
      assignedTo = ''; // Unknown user, store name only
    }
  }

  // Extract date (simple patterns: 明日, 今日, M/D, M月D日, YYYY/M/D)
  let dueDate = null;
  const now = new Date();

  if (/明日/.test(title)) {
    dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 1);
    title = title.replace(/明日/, '').trim();
  } else if (/今日/.test(title)) {
    dueDate = new Date(now);
    title = title.replace(/今日/, '').trim();
  } else if (/明後日/.test(title)) {
    dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 2);
    title = title.replace(/明後日/, '').trim();
  }

  // M/D or M月D日 patterns
  const dateMatch = title.match(/(\d{1,2})[/月](\d{1,2})[日]?/);
  if (dateMatch && !dueDate) {
    dueDate = new Date(now.getFullYear(), parseInt(dateMatch[1]) - 1, parseInt(dateMatch[2]));
    // If the date is in the past, assume next year
    if (dueDate < now) dueDate.setFullYear(dueDate.getFullYear() + 1);
    title = title.replace(dateMatch[0], '').trim();
  }

  // Time pattern: HH:MM or HH時
  const timeMatch = title.match(/(\d{1,2})[:時](\d{0,2})[分]?/);
  if (timeMatch && dueDate) {
    dueDate.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2] || '0'), 0, 0);
    title = title.replace(timeMatch[0], '').trim();
  } else if (dueDate) {
    dueDate.setHours(9, 0, 0, 0); // Default to 9:00 AM
  }

  // Clean up remaining particles
  title = title.replace(/^[にをでまで]+|[にをでまで]+$/g, '').trim();

  if (!title) {
    await reply(event.replyToken, '📋 タスク内容を入力してください。\n\n例：#task @佐藤 見積もり取得 3/20');
    return;
  }

  const task = await createTask({
    groupId: groupKey,
    createdBy: userId,
    createdByName: displayName,
    assignedTo,
    assignedToName,
    title,
    dueDate: dueDate?.toISOString() || null,
  });

  if (task) {
    await reply(event.replyToken, [taskCardFlex(task)]);
  } else {
    await reply(event.replyToken, 'タスクの登録に失敗しました。もう一度お試しください。');
  }
}

// ─── Postback Handler (Flex Message button taps) ───

async function handlePostback(event) {
  const data = new URLSearchParams(event.postback.data);
  const action = data.get('action');
  const id = data.get('id');

  if (!action || !id) return;

  if (action === 'complete_task') {
    const task = await completeTask(id);
    if (task) {
      await reply(event.replyToken, `✅ 完了：${task.title}\n👤 ${task.assigned_to_name || ''}`);
    }
  } else if (action === 'delete_task') {
    await deleteTask(id);
    await reply(event.replyToken, '🗑️ タスクを削除しました。');
  }
}
