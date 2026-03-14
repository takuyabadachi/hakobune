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
} from '../lib/store.js';
import { helpFlex, privacyNoticeFlex, reviewResultsFlex } from '../lib/flex-templates.js';

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
