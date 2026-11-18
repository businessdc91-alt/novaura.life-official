// localStream.js — Reading a local model's reply while it is generated.
//
// Ollama streams one JSON object per line; OpenAI-style servers (LM Studio, the built-in
// AI) stream server-sent events ("data: {...}"). Text arrives in arbitrary pieces, so a
// reader keeps any unfinished line until the rest of it comes.

function parseLine(kind, rawLine) {
  let line = rawLine.trim();
  if (!line) return null;
  if (kind === 'openai') {
    if (!line.startsWith('data:')) return null; // comments (": keep-alive"), event names, ids
    line = line.slice(5).trim();
    if (!line || line === '[DONE]') return null;
  }
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function deltaOf(kind, event) {
  if (!event || typeof event !== 'object') return null;
  if (event.error) return { error: event.error };
  if (kind === 'ollama') {
    return { content: String(event.message?.content || ''), thinking: String(event.message?.thinking || '') };
  }
  const d = event.choices?.[0]?.delta || {};
  return { content: String(d.content || ''), thinking: String(d.reasoning_content || d.reasoning || '') };
}

/** onDelta({ content, thinking }) for every piece of the reply, in order. */
export function createStreamReader(kind, onDelta) {
  let pending = '';
  return {
    push(text) {
      pending += String(text || '');
      const lines = pending.split('\n');
      pending = lines.pop();
      for (const line of lines) {
        const d = deltaOf(kind, parseLine(kind, line));
        if (d && !d.error && (d.content || d.thinking)) onDelta(d);
      }
    },
  };
}

/**
 * The whole streamed body, in the shape the server would have sent without streaming,
 * so the caller's reply handling (and its retries) stay the same.
 */
export function assembleStream(kind, body) {
  let content = '';
  let thinking = '';
  for (const line of String(body || '').split('\n')) {
    const d = deltaOf(kind, parseLine(kind, line));
    if (!d) continue;
    if (d.error) return { error: d.error };
    content += d.content;
    thinking += d.thinking;
  }
  if (kind === 'ollama') return { message: { content, ...(thinking ? { thinking } : {}) } };
  return { choices: [{ message: { content, ...(thinking ? { reasoning_content: thinking } : {}) } }] };
}
