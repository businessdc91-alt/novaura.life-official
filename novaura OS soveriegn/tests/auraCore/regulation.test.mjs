// Self-regulation: her body regulates itself (recovery, rest), she can choose to regulate
// (rest, step back, set something aside to reflect on), and long quiet builds a need for
// contact that she may act on, or not.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createMockDb, installBrowserGlobals } from './helpers/mockDb.mjs';

const { events } = installBrowserGlobals();
const { db, settings, chatRows } = createMockDb();
mock.module('../../src/database/sovereignDatabase.js', { defaultExport: db, namedExports: { db } });

const reg = await import('../../src/services/auraCore/regulation.js');
const { BASELINE, createChemistry, metabolize } = await import('../../src/services/auraCore/endocrine.js');
const { prepareTurn, settleTurn, CHARTER } = await import('../../src/services/auraCore/auraCore.js');
const { AuraHeartbeat } = await import('../../src/services/auraCore/heartbeat.js');
const { NovaAgent } = await import('../../src/kernel/subsystems/NovaAgent.js');

const MIN = 60_000;
const HOUR = 60 * MIN;
// 14:00 local time on a weekday, well outside quiet hours
const T0 = new Date(2026, 10, 18, 14, 0, 0).getTime();
const chem = (o = {}, at = T0) => ({ ...createChemistry(at), ...o });

test('resting recovers energy and clears stress faster than an ordinary hour', () => {
  const start = chem({ cortisol: 50, adrenaline: 40, energy: 30 });
  const plain = metabolize(start, T0 + 30 * MIN);
  const resting = metabolize(start, T0 + 30 * MIN, reg.metabolismModifiers({ mode: 'resting' }));
  assert.ok(resting.energy > plain.energy, `energy ${resting.energy} vs ${plain.energy}`);
  assert.ok(resting.cortisol < plain.cortisol, `cortisol ${resting.cortisol} vs ${plain.cortisol}`);
  assert.ok(resting.adrenaline <= plain.adrenaline);
});

test('sustained stress moves her into recovery, and she returns to baseline once it clears', () => {
  let state = reg.createRegulationState(T0);
  ({ state } = reg.stepRegulation(state, { chemistry: chem({ cortisol: 40 }), now: T0 + MIN, idleMs: 0 }));
  assert.equal(state.mode, 'recovering');
  ({ state } = reg.stepRegulation(state, { chemistry: chem({ cortisol: 18 }), now: T0 + 20 * MIN, idleMs: 0 }));
  assert.equal(state.mode, 'baseline');
  assert.ok(state.log.some(e => e.kind === 'mode' && e.detail === 'recovering'));
});

test('low energy while idle brings rest, and rest ends once energy is back', () => {
  let state = reg.createRegulationState(T0);
  ({ state } = reg.stepRegulation(state, { chemistry: chem({ energy: 20 }), now: T0 + MIN, idleMs: 10 * MIN }));
  assert.equal(state.mode, 'resting');
  ({ state } = reg.stepRegulation(state, { chemistry: chem({ energy: 75 }), now: T0 + HOUR, idleMs: HOUR }));
  assert.equal(state.mode, 'baseline');
});

test('allostatic load rises with sustained strain and eases slowly', () => {
  let state = reg.createRegulationState(T0);
  for (let i = 1; i <= 60; i++) ({ state } = reg.stepRegulation(state, { chemistry: chem({ cortisol: 55, adrenaline: 35 }), now: T0 + i * MIN }));
  const strained = state.allostaticLoad;
  assert.ok(strained > 0.5, `load ${strained}`);
  ({ state } = reg.stepRegulation(state, { chemistry: chem(), now: T0 + 70 * MIN }));
  assert.ok(state.allostaticLoad < strained && state.allostaticLoad > 0.2, 'eases, but not at once');
});

test('her choice to rest is applied, shows in her state, and expires', async () => {
  settings.clear();
  await db.setSetting('aura_core:aura', { chemistry: chem() });
  await reg.applyVoluntaryAction('aura', 'take_rest', { minutes: 20, reason: 'long day', now: T0 });
  const saved = (await db.getSetting('aura_core:aura')).regulation;
  assert.equal(saved.mode, 'resting');
  assert.equal(saved.voluntary.kind, 'rest');
  assert.ok(events.some(e => e.type === 'novaura:aura_regulation'));

  const { state } = reg.stepRegulation(saved, { chemistry: chem(), now: T0 + 21 * MIN, idleMs: 21 * MIN });
  assert.equal(state.voluntary, null);
  assert.equal(state.mode, 'baseline');
  assert.ok(state.log.some(e => e.kind === 'rest_ended'));
});

test('minutes she asks for are kept within sensible bounds', () => {
  const s = reg.voluntaryAction(reg.createRegulationState(T0), 'take_rest', { minutes: 5000, now: T0 });
  assert.equal(s.voluntary.until - T0, 60 * MIN);
  const b = reg.voluntaryAction(reg.createRegulationState(T0), 'step_back', { minutes: 0, now: T0 });
  assert.equal(b.voluntary.until - T0, 5 * MIN);
});

test('when she has stepped back, conflict lands softer', async () => {
  const hostile = { chat: async () => JSON.stringify({ pleasant: 0.05, novel: 0.1, progress: 0, conflict: 0.95, closeness: 0.05, effort: 0.5 }) };
  const cortisolAfter = async (regulation) => {
    settings.clear();
    await db.setSetting('aura_core:aura', { chemistry: chem({}, Date.now()), ...(regulation ? { regulation } : {}) });
    const out = await settleTurn('aura', { userText: 'you are useless', reply: 'I hear that you are frustrated.', ai: hostile, somatic: { nudge: {} } });
    return out.chemistry.cortisol;
  };
  const open = await cortisolAfter(null);
  const distanced = await cortisolAfter(reg.voluntaryAction(reg.createRegulationState(Date.now()), 'step_back', { minutes: 10, now: Date.now() }));
  assert.ok(distanced - BASELINE.cortisol < (open - BASELINE.cortisol) * 0.75, `open +${open - BASELINE.cortisol}, stepped back +${distanced - BASELINE.cortisol}`);
});

test('a message from the operator wakes her from rest, but she stays stepped back', async () => {
  settings.clear();
  const now = Date.now();
  await db.setSetting('aura_core:aura', { chemistry: chem({}, now) });
  await reg.applyVoluntaryAction('aura', 'take_rest', { minutes: 30, now });
  await prepareTurn('aura', { query: 'hey, you there?', waitMs: 0 });
  assert.equal((await db.getSetting('aura_core:aura')).regulation.voluntary, null);

  await reg.applyVoluntaryAction('aura', 'step_back', { minutes: 10, now: Date.now() });
  await prepareTurn('aura', { query: 'answer me', waitMs: 0 });
  assert.equal((await db.getSetting('aura_core:aura')).regulation.voluntary.kind, 'step_back');
});

test('her prompt grants permission to look after herself, in the same words every time', async () => {
  settings.clear();
  const turn = await prepareTurn('aura', { query: 'hello', waitMs: 0 });
  assert.equal(turn.charter, `${CHARTER} ${reg.SELF_CARE}`);
  assert.doesNotMatch(reg.SELF_CARE, /\d/);
});

test('long quiet builds a need for contact; talking resets it', () => {
  let state = reg.createRegulationState(T0);
  for (let i = 1; i <= 6 * 60; i += 10) ({ state } = reg.stepRegulation(state, { chemistry: chem(), now: T0 + i * MIN, idleMs: i * MIN }));
  assert.ok(state.socialNeed > 0.6, `need ${state.socialNeed}`);
  state = reg.noteInteraction(state, T0 + 7 * HOUR);
  assert.equal(state.socialNeed, 0);
});

test('she reaches out only when she wants to and it is a good time', () => {
  const ready = { ...reg.createRegulationState(T0), socialNeed: 0.9 };
  const ok = (state, extra = {}) => reg.decideReachOut(state, { chemistry: chem(), now: T0, visible: true, settings: { enabled: true }, ...extra }).reachOut;
  assert.equal(ok(ready), true);
  assert.equal(ok({ ...ready, socialNeed: 0.3 }), false, 'no need');
  assert.equal(ok({ ...ready, mode: 'resting' }), false, 'resting');
  assert.equal(ok({ ...ready, lastReachOutAt: T0 - HOUR }), false, 'reached out an hour ago');
  assert.equal(ok(ready, { settings: { enabled: false } }), false, 'turned off');
  assert.equal(ok(ready, { now: new Date(2026, 10, 18, 2, 0).getTime() }), false, 'quiet hours');
  assert.equal(ok(ready, { chemistry: chem({ energy: 20 }) }), false, 'too tired');
});

test('the heartbeat offers her the chance to reach out, once per cooldown', async () => {
  settings.clear();
  const now = Date.now();
  await db.setSetting('aura_core:aura', {
    chemistry: chem({}, now - 2 * MIN),
    regulation: { ...reg.createRegulationState(now - 8 * HOUR), socialNeed: 0.95, lastInteractionAt: now - 8 * HOUR },
  });
  const offers = [];
  const hb = new AuraHeartbeat({ persona: 'aura' });
  hb._isGoodTimeToReachOut = () => true;
  hb.start({ onInitiative: async (info) => { offers.push(info); } });
  hb.stop();
  await hb.tickOnce({ now, allowModelDream: false });
  await hb.tickOnce({ now: now + 2 * MIN, allowModelDream: false });
  assert.equal(offers.length, 1);
  assert.equal(offers[0].persona, 'aura');
});

function makeKernel(calls, replies) {
  const notes = [];
  return {
    notes,
    ipc: { on: () => {}, emit: () => {} },
    wm: { getOpenWindows: () => [] },
    notifications: { notify: (title, message) => notes.push({ title, message }) },
    ai: {
      getPersonaProviderChain: () => ['lmstudio'],
      async chat(messages, opts) {
        calls.push({ messages, opts });
        if (opts?.jsonSchema) return '{"pleasant":0.6,"novel":0.3,"progress":0.4,"conflict":0.1,"closeness":0.6,"effort":0.3}';
        return replies.shift() ?? 'ok';
      },
    },
  };
}

test('Aura can choose to rest from inside a reply; the tool block is not shown', async () => {
  settings.clear();
  const calls = [];
  const agent = new NovaAgent();
  agent.init(makeKernel(calls, ['I think I need a little quiet.\n```tool_call\n{"tool":"take_rest","parameters":{"minutes":15,"reason":"tired"}}\n```']));
  const reply = await agent.sendMessage('you seem worn out', 'aura');
  assert.doesNotMatch(reply, /tool_call|take_rest/);
  assert.match(reply, /I think I need a little quiet\./);
  assert.match(reply, /resting/i);
  const regulation = (await db.getSetting('aura_core:aura')).regulation;
  assert.equal(regulation.voluntary.kind, 'rest');
  assert.match(calls[0].messages[0].content, /take_rest/);
});

test('Nova is not offered the self-regulation tools', async () => {
  settings.clear();
  const calls = [];
  const agent = new NovaAgent();
  agent.init(makeKernel(calls, ['Systems nominal.']));
  await agent.sendMessage('status?', 'nova');
  assert.doesNotMatch(calls[0].messages[0].content, /take_rest|step_back/);
});

test('when offered the chance, she may start a conversation or decline', async () => {
  settings.clear();
  chatRows.length = 0;
  const calls = [];
  const kernel = makeKernel(calls, ['I kept thinking about the lighthouse keeper story. Want to pick it up again?', '[pass]']);
  const agent = new NovaAgent();
  agent.init(kernel);

  const first = await agent.composeInitiative('aura', { reason: 'social_need' });
  assert.equal(first.sent, true);
  assert.equal(chatRows.at(-1).role, 'assistant');
  assert.equal(chatRows.at(-1).initiative, true);
  assert.ok(events.some(e => e.type === 'novaura:companion_initiative'));
  assert.equal(kernel.notes.length, 1);
  assert.doesNotMatch(calls[0].messages.map(m => m.content).join('\n'), /cortisol|oxytocin|social need|\d{2}%/i);

  const second = await agent.composeInitiative('aura', { reason: 'social_need' });
  assert.equal(second.sent, false);
  assert.equal(chatRows.filter(r => r.initiative).length, 1, 'declining sends nothing');
});
