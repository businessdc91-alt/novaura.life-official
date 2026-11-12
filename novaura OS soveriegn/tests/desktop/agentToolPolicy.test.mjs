// The AI agent never writes files or runs commands silently: off means refused,
// on means you're asked every time, with what it will do.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
};
const { approveAgentTool, getAgentPolicy, setAgentPolicy } = await import('../../src/services/agentToolPolicy.js');

test('guarded tools ask, showing the path or command; others pass', () => {
  store.clear();
  const asked = [];
  const yes = (msg) => { asked.push(msg); return true; };
  assert.deepEqual(approveAgentTool('create_file', { path: '/documents/a.txt', content: 'hello' }, { persona: 'Aura', confirm: yes }), { ok: true });
  assert.match(asked[0], /Aura wants to write the file \/documents\/a\.txt \(5 characters\)/);
  approveAgentTool('run_terminal', { command: 'rm notes.txt' }, { confirm: yes });
  assert.match(asked[1], /rm notes\.txt/);
  assert.deepEqual(approveAgentTool('read_file', { path: '/x' }, { confirm: () => { throw new Error('should not ask'); } }), { ok: true });
  const no = approveAgentTool('run_terminal', { command: 'vault set x y' }, { confirm: () => false });
  assert.equal(no.ok, false);
});

test('switched off in Sentinel Shield: refused without asking, and the choice is kept', () => {
  store.clear();
  setAgentPolicy({ aiTerminalExec: false });
  assert.deepEqual(getAgentPolicy(), { aiFileWrite: true, aiTerminalExec: false });
  const r = approveAgentTool('run_terminal', { command: 'mesh ping' }, { confirm: () => { throw new Error('should not ask'); } });
  assert.equal(r.ok, false);
  assert.match(r.reason, /turned off/);
});
