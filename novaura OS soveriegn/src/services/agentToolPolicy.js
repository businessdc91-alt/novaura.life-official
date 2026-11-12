/**
 * What the AI agent (NovaAgent) may do without you. Set in Sentinel Shield, kept
 * per profile. A tool that changes something is either off, or asks you first,
 * every time, showing exactly what it will do. A model's reply can be steered by
 * text it read (a file, a web page, a message), so it never acts silently.
 */

const KEY = 'novaura_agent_tool_policy';

// true: allowed after you confirm; false: refused
export const DEFAULT_POLICY = { aiFileWrite: true, aiTerminalExec: true };

// Tools that change something, and the setting that governs each
export const GUARDED_TOOLS = { create_file: 'aiFileWrite', run_terminal: 'aiTerminalExec' };

export function getAgentPolicy() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      aiFileWrite: saved.aiFileWrite !== false,
      aiTerminalExec: saved.aiTerminalExec !== false,
    };
  } catch {
    return { ...DEFAULT_POLICY };
  }
}

export function setAgentPolicy(patch) {
  const next = { ...getAgentPolicy(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* storage unavailable: the defaults (ask first) apply */ }
  return next;
}

function describe(name, params) {
  if (name === 'create_file') {
    const content = String(params?.content ?? '');
    const preview = content.length > 300 ? `${content.slice(0, 300)}…` : content;
    return `write the file ${params?.path || '/documents/untitled.txt'} (${content.length} characters):\n\n${preview}`;
  }
  return `run this Sovereign Terminal command:\n\n${params?.command ?? ''}`;
}

/**
 * Whether the agent may run `name` with `params` now. Unguarded tools pass; a
 * guarded one is refused when its setting is off, otherwise you're asked.
 * Returns { ok: true } or { ok: false, reason }.
 */
export function approveAgentTool(name, params, { persona = 'The AI', confirm = (msg) => window.confirm(msg) } = {}) {
  const setting = GUARDED_TOOLS[name];
  if (!setting) return { ok: true };
  if (!getAgentPolicy()[setting]) return { ok: false, reason: 'that is turned off in Sentinel Shield' };
  const allowed = confirm(`${persona} wants to ${describe(name, params)}\n\nAllow it?`);
  return allowed ? { ok: true } : { ok: false, reason: 'you declined it' };
}
