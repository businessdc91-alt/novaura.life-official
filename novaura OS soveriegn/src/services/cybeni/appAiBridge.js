// appAiBridge.js — Answers the ai.chat() calls a Cybeni app makes inside its preview.
//
// The app's AI runs on the person's chosen OS model (the caller passes `chat`), not on
// the model Cybeni builds with, so what the preview does is what the installed app does.
// Sovereign sets no token limit on local models or the person's own keys (the provider's
// limits apply); the only guard here is backpressure: an app stuck in a loop can keep a
// couple of requests running, not hundreds.

export const APP_AI_MAX_CONCURRENT = 2;
// A ceiling for nonsense values only; the model's own limit is usually lower.
export const APP_AI_MAX_TOKENS = 32768;
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_SYSTEM = 'You are a helpful AI assistant embedded inside an application.';

function cleanMessages(list, system) {
  const out = [];
  for (const m of Array.isArray(list) ? list : []) {
    if (!m || typeof m !== 'object') continue;
    const role = m.role === 'system' || m.role === 'assistant' ? m.role : 'user';
    out.push({ role, content: String(m.content ?? '') });
  }
  if (!out.some(m => m.role === 'system')) out.unshift({ role: 'system', content: String(system || DEFAULT_SYSTEM) });
  return out;
}

function tokenLimit(value) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, APP_AI_MAX_TOKENS) : DEFAULT_MAX_TOKENS;
}

/**
 * chat(messages, { temperature, maxTokens, onToken? }) -> Promise<string>
 * Returns { handle(request, reply), inFlight() }. `reply(payload)` posts to the app's frame.
 */
export function createAppAiBridge({ chat, maxConcurrent = APP_AI_MAX_CONCURRENT }) {
  let running = 0;

  async function handle(request, reply) {
    const requestId = request?.requestId;
    const opts = request?.opts || {};
    if (running >= maxConcurrent) {
      reply({ __cybeniAiReply: true, requestId, error: `This app already has ${maxConcurrent} AI requests running. Wait for one to finish, then try again.` });
      return;
    }
    running++;
    try {
      const text = await chat(cleanMessages(request?.messages, opts.system), {
        temperature: Number.isFinite(Number(opts.temperature)) ? Number(opts.temperature) : 0.5,
        maxTokens: tokenLimit(opts.maxTokens),
        ...(opts.stream ? { onToken: (piece) => { if (piece) reply({ __cybeniAiChunk: true, requestId, text: String(piece) }); } } : {}),
      });
      reply({ __cybeniAiReply: true, requestId, text: String(text ?? '') });
    } catch (err) {
      reply({ __cybeniAiReply: true, requestId, error: String(err?.message || err || 'AI request failed.') });
    } finally {
      running--;
    }
  }

  return { handle, inFlight: () => running };
}
