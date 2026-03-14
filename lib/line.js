/**
 * LINE Messaging API Helpers
 */

import crypto from 'crypto';

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const CHANNEL_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_API = 'https://api.line.me/v2/bot';

/**
 * Verify LINE webhook signature
 */
export function verifySignature(body, signature) {
  const hash = crypto
    .createHmac('SHA256', CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hash === signature;
}

/**
 * Reply to a LINE message
 */
export async function reply(replyToken, messages) {
  if (!Array.isArray(messages)) messages = [messages];
  // Convert string messages to text message objects
  messages = messages.map(m =>
    typeof m === 'string' ? { type: 'text', text: m } : m
  );

  const res = await fetch(`${LINE_API}/message/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CHANNEL_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });

  if (!res.ok) {
    console.error('LINE reply error:', res.status, await res.text());
  }
}

/**
 * Push a message to a user or group
 */
export async function push(to, messages) {
  if (!Array.isArray(messages)) messages = [messages];
  messages = messages.map(m =>
    typeof m === 'string' ? { type: 'text', text: m } : m
  );

  const res = await fetch(`${LINE_API}/message/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CHANNEL_TOKEN}`,
    },
    body: JSON.stringify({ to, messages }),
  });

  if (!res.ok) {
    console.error('LINE push error:', res.status, await res.text());
  }
}

/**
 * Get user profile
 */
export async function getProfile(userId) {
  try {
    const res = await fetch(`${LINE_API}/profile/${userId}`, {
      headers: { Authorization: `Bearer ${CHANNEL_TOKEN}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Get group member profile
 */
export async function getGroupMemberProfile(groupId, userId) {
  try {
    const res = await fetch(
      `${LINE_API}/group/${groupId}/member/${userId}`,
      { headers: { Authorization: `Bearer ${CHANNEL_TOKEN}` } }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Format text for LINE (strip markdown)
 */
export function formatForLine(text) {
  return text
    .replace(/#{1,6}\s/g, '■ ')      // Headers → ■
    .replace(/\*\*(.*?)\*\*/g, '$1')  // Bold → plain
    .replace(/\*(.*?)\*/g, '$1')      // Italic → plain
    .replace(/`{3}[\s\S]*?`{3}/g, '') // Code blocks → remove
    .replace(/`(.*?)`/g, '$1')        // Inline code → plain
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links → text only
    .trim();
}
