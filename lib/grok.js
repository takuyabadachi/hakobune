/**
 * Grok API Client (OpenAI-compatible)
 * Model: grok-4.1-fast-reasoning (accurate for structured tasks)
 */

import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

const MODEL = 'grok-4.1-fast-reasoning';
const MAX_TOKENS = 4000;

/**
 * Send a chat completion request to Grok
 * @param {string} systemPrompt - System prompt for the mode
 * @param {Array<{role: string, content: string}>} messages - Conversation history
 * @returns {Promise<string>} AI response text
 */
export async function chat(systemPrompt, messages) {
  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    });
    return res.choices[0]?.message?.content || '申し訳ありません。応答を生成できませんでした。';
  } catch (err) {
    console.error('Grok API error:', err.message);
    return '申し訳ありません。現在AIが応答できません。しばらくしてからもう一度お試しください。';
  }
}

/**
 * Generate an embedding for vector search (pgvector)
 * Uses Grok's embedding endpoint
 */
export async function embed(text) {
  try {
    const res = await client.embeddings.create({
      model: 'v1',
      input: text,
    });
    return res.data[0]?.embedding || null;
  } catch (err) {
    console.error('Embedding error:', err.message);
    return null;
  }
}
