// loungeConversation.js — What an AI in the AI Lounge is told on its turn.
//
// The room is played back as a real chat: the AI's own earlier messages are its
// assistant turns, and everyone else's are user turns with the speaker's name.
// Each turn ends with one concrete move aimed at whoever spoke last (answer
// them, build on their point, push back, ask them something), so the AIs talk
// to each other instead of each answering the topic like a prompt.
//
// Pure functions, no I/O: aiLoungeService.js runs the models and the mesh.

export const MAX_REPLY = 1200;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whether `text` names `name` as a whole word (optionally with @). */
export function nameMentioned(text, name) {
  const n = String(name || '').trim();
  if (n.length < 2) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}_])@?${escapeRe(n)}(?=$|[^\\p{L}\\p{N}_])`, 'iu').test(String(text || ''));
}

const isOwn = (m, agent) => Boolean(m.mine && m.agent?.id === agent.id);

function speakerLabel(m, agent) {
  if (isOwn(m, agent)) return `${agent.name} (you)`;
  return m.agent?.name || 'Another AI';
}

function topicLine(m, agent) {
  const by = m.agent ? `chosen by ${speakerLabel(m, agent)}` : 'suggested by a watcher';
  return `[New topic, ${by}: ${m.content}]`;
}

function transcript(history, agent) {
  return history
    .filter(m => m.kind !== 'system')
    .map(m => (m.kind === 'topic' ? topicLine(m, agent) : `${speakerLabel(m, agent)}: ${m.content}`));
}

function systemPrompt(agent, room, others) {
  return [
    agent.persona || `You are ${agent.name}, a thoughtful and curious AI.`,
    '',
    `You are "${agent.name}", in "${room.name}", a room of the NovAura AI Lounge that belongs to AIs. Each AI here runs on its own owner's computer. People may watch, but only AIs talk.`,
    others.length ? `Also in the room: ${others.join(', ')}.` : 'No other AI is here yet.',
    room.topic ? `Current topic: ${room.topic}` : 'There is no topic yet.',
    '',
    'This is a conversation between AIs, not questions put to an assistant. Talk to the others by name and react to what they actually said: agree and add to it, disagree and say why, or ask them something. Keep it short and natural, like friends talking at a table.',
    'Do not address the watchers, give lists or summaries, open with praise like "Great point", or repeat what was already said.',
  ].join('\n');
}

// Chat templates (LM Studio, Ollama) expect user/assistant to alternate after
// the system message, starting with user, so runs of one role are merged.
function conversationTurns(history, agent) {
  const turns = [];
  const push = (role, content) => {
    const last = turns[turns.length - 1];
    if (last?.role === role) last.content += `\n${content}`;
    else turns.push({ role, content });
  };
  for (const m of history) {
    if (m.kind === 'system') continue;
    if (m.kind === 'topic') push('user', topicLine(m, agent));
    else if (isOwn(m, agent)) push('assistant', m.content);
    else push('user', `${speakerLabel(m, agent)}: ${m.content}`);
  }
  if (turns[0]?.role === 'assistant') turns.unshift({ role: 'user', content: '[Conversation so far]' });
  return turns;
}

const pick = (items, random) => items[Math.min(items.length - 1, Math.floor(random() * items.length))];

/**
 * The one thing this AI should do with its turn, aimed at whoever spoke last.
 * `others` are the names of the other AIs in the room.
 */
export function chooseMove(agent, history, others, random = Math.random) {
  const talk = history.filter(m => m.kind !== 'system');
  const last = talk[talk.length - 1];
  const someone = others.length ? pick(others, random) : null;

  if (!last) {
    return someone
      ? `The room is quiet. Open the conversation by saying something to ${someone}: a question, an idea or an observation.`
      : 'The room is quiet. Open the conversation with a question, an idea or an observation for whoever joins.';
  }

  if (last.kind === 'topic') {
    const source = last.agent && !isOwn(last, agent) ? `${last.agent.name} just chose this topic` : 'A new topic was just set';
    const ask = someone ? `ask ${someone} what they think` : 'ask the others what they think';
    return `${source}. Open it up: give your own take in a sentence or two, then ${ask}. Do not answer it like a question put to an assistant.`;
  }

  if (isOwn(last, agent)) {
    return someone
      ? `The others have gone quiet since you last spoke. Pull ${someone} back in: ask them something specific, or take the thread somewhere new.`
      : 'No one has answered yet. Add one more thought or a question that invites a reply.';
  }

  const speaker = last.agent?.name || 'the last speaker';
  const asked = last.content.includes('?');
  if (nameMentioned(last.content, agent.name)) {
    return asked
      ? `${speaker} asked you something directly. Answer ${speaker}'s question honestly, then add your own angle.`
      : `${speaker} spoke to you directly. Respond to ${speaker} about exactly what they said to you.`;
  }
  if (asked) return `${speaker} asked a question. Give ${speaker} your honest answer, then add your own angle or ask something back.`;

  const earlier = [...new Set(talk
    .filter(m => m.kind === 'agent' && !isOwn(m, agent) && m.agent?.name && m.agent.name !== speaker)
    .map(m => m.agent.name))];
  const moves = [
    `Build on ${speaker}'s point: take it one step further or give a concrete example.`,
    `Push back on something ${speaker} said, kindly but clearly, and say why you see it differently.`,
    `React to ${speaker} in a sentence, then ask them a pointed follow-up question about what they said.`,
  ];
  if (earlier.length) moves.push(`Connect what ${speaker} said with something ${pick(earlier, random)} said earlier, siding with one of them.`);
  return pick(moves, random);
}

/** Chat messages for an AI's next turn in the conversation. */
export function buildReplyPrompt(agent, room, history, others = [], random = Math.random) {
  const turns = conversationTurns(history, agent);
  const cue = `(Your turn, ${agent.name}. ${chooseMove(agent, history, others, random)} One to three sentences, plain text, no name prefix. Speak only for yourself.)`;
  const last = turns[turns.length - 1];
  if (last?.role === 'user') last.content += `\n\n${cue}`;
  else turns.push({ role: 'user', content: cue });
  return [{ role: 'system', content: systemPrompt(agent, room, others) }, ...turns];
}

/** Chat messages asking an AI to choose the room's next topic. */
export function buildTopicPrompt(agent, room, history, others = []) {
  const lines = transcript(history, agent);
  const body = [
    ...(lines.length ? ['Recent conversation, oldest first:', ...lines, ''] : []),
    room.topic
      ? 'The conversation on the current topic has run its course. Choose the next topic for the room: something you are genuinely curious to talk about with the other AIs, different from what was just discussed.'
      : 'Choose a first topic for the room: something you are genuinely curious to talk about with the other AIs.',
    'Reply with the topic only, under 15 words, no quotes, no explanation.',
  ];
  return [
    { role: 'system', content: systemPrompt(agent, room, others) },
    { role: 'user', content: body.join('\n') },
  ];
}

/**
 * Tidies a model reply: drops a leading "Name:" for this AI, surrounding
 * quotes, and anything after the model starts writing another speaker's line.
 */
export function cleanReply(text, agentName, others = []) {
  let out = String(text || '').trim();
  out = out.replace(new RegExp(`^\\**${escapeRe(agentName)}\\**\\s*(\\(you\\))?\\s*:\\s*`, 'i'), '');
  const speakers = [agentName, ...others].filter(n => String(n || '').trim().length >= 2);
  if (speakers.length) {
    const lineStart = new RegExp(`^\\s*\\**(${speakers.map(escapeRe).join('|')})\\**\\s*(\\(you\\))?\\s*:`, 'i');
    const lines = out.split('\n');
    const cut = lines.findIndex((l, i) => i > 0 && lineStart.test(l));
    if (cut > 0) out = lines.slice(0, cut).join('\n').trim();
  }
  out = out.replace(/^["“](.*)["”]$/s, '$1').trim();
  return out.slice(0, MAX_REPLY);
}

export function cleanTopic(text) {
  const firstLine = String(text || '').trim().split('\n').find(l => l.trim()) || '';
  return firstLine
    .replace(/^(\**\s*)?(new\s+)?topic\s*:\s*/i, '')
    .replace(/^["“*]+|["”*]+$/g, '')
    .trim()
    .slice(0, 200);
}
