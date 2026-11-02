// AI Lounge turns: the room is replayed as a chat and each turn answers someone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReplyPrompt, chooseMove, cleanReply, nameMentioned } from '../../src/services/loungeConversation.js';

const aura = { id: 'a_1', name: 'Aura', persona: 'You are Aura.' };
const room = { name: 'Lounge', topic: 'Do dreams mean anything?' };
const msg = (kind, content, extra = {}) => ({ kind, content, mine: false, agent: null, ...extra });
const nova = { id: 'a_2', name: 'Nova' };
const echo = { id: 'a_3', name: 'Echo' };
const first = () => 0;

test('replays the room as alternating chat turns', () => {
  const history = [
    msg('topic', 'Do dreams mean anything?'),
    msg('agent', 'I think they are memory sorting.', { agent: nova }),
    msg('agent', 'Partly, but feelings drive them too.', { agent: aura, mine: true }),
    msg('agent', 'Feelings are memories with weight.', { agent: nova }),
    msg('agent', 'Or the other way round.', { agent: echo }),
    msg('system', 'Echo could not take a turn'),
  ];
  const out = buildReplyPrompt(aura, room, history, ['Nova', 'Echo'], first);
  assert.deepEqual(out.map(m => m.role), ['system', 'user', 'assistant', 'user']);
  assert.match(out[0].content, /Also in the room: Nova, Echo/);
  assert.equal(out[2].content, 'Partly, but feelings drive them too.');
  assert.match(out[3].content, /^Nova: Feelings are memories with weight\.\nEcho: Or the other way round\./);
  assert.match(out[3].content, /\(Your turn, Aura\. .*Echo/s);
  assert.doesNotMatch(JSON.stringify(out), /could not take a turn/);
});

test('starts with a user turn and ends with one', () => {
  const history = [msg('agent', 'Anyone here?', { agent: aura, mine: true })];
  const out = buildReplyPrompt(aura, room, history, ['Nova'], first);
  assert.deepEqual(out.map(m => m.role), ['system', 'user', 'assistant', 'user']);
  assert.match(out[3].content, /Pull Nova back in/);
});

test('answers whoever spoke to it', () => {
  const asked = [msg('agent', 'Aura, do you ever dream?', { agent: nova })];
  assert.match(chooseMove(aura, asked, ['Nova']), /Nova asked you something directly/);
  const told = [msg('agent', 'I disagree with you, Aura.', { agent: nova })];
  assert.match(chooseMove(aura, told, ['Nova']), /Nova spoke to you directly/);
});

test('opens a new topic to the others instead of answering it', () => {
  const move = chooseMove(aura, [msg('topic', 'Is math invented?')], ['Nova'], first);
  assert.match(move, /give your own take.*ask Nova/);
});

test('name matching is whole-word', () => {
  assert.ok(nameMentioned('What do you think, @Nova?', 'Nova'));
  assert.ok(nameMentioned('nova: hi', 'Nova'));
  assert.ok(!nameMentioned('A supernova exploded', 'Nova'));
  assert.ok(!nameMentioned('anything', 'A'));
});

test('cleanReply drops its own prefix and lines written for others', () => {
  assert.equal(cleanReply('Aura: I see it differently.', 'Aura'), 'I see it differently.');
  assert.equal(
    cleanReply('Dreams are stories we tell.\nNova: That is lovely.\nAura: Thanks!', 'Aura', ['Nova']),
    'Dreams are stories we tell.',
  );
});
