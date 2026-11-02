/**
 * mailAiService.js — Inbox triage, smart replies and draft polishing.
 *
 * Mail is private, so every AI call here runs on a model on this machine
 * (LM Studio or Ollama, through the native localModels path in
 * literatureAiService.queryUniversalInference with localOnly). Nothing is sent
 * to a cloud provider. Without a local model, triage falls back to a keyword
 * pass (marked as such) and the other features say they could not run; they
 * never return canned text that looks like an AI answer.
 */

import { queryUniversalInference, parseJsonReply, hasLocalModel } from './literatureAiService.js';

const SYSTEM = 'You are NovaMail AI, a careful email assistant. Answer with JSON only.';

async function askLocal(prompt, maxTokens) {
  if (!(await hasLocalModel())) {
    throw new Error('No local model is running. Start LM Studio or Ollama to use mail AI (mail is never sent to a cloud model).');
  }
  return queryUniversalInference(prompt, SYSTEM, { localOnly: true, maxTokens, temperature: 0.3 });
}

function keywordTriage(mail) {
  const subject = mail.subject || '';
  const body = mail.body || '';
  const sender = mail.sender || mail.from || '';
  const isAlert = /alert|critical|security|emergency|failure|daemon|mesh_alert/i.test(subject + body);
  const isSwarm = /mesh|relay|node|swarm|genesis|p2p|beacon/i.test(subject + sender);
  const isHigh = /urgent|asap|important|action required|critical/i.test(subject);
  return {
    priority: isHigh || isAlert ? 'high' : 'normal',
    synopsis: body.trim() ? `${body.slice(0, 90).replace(/\s+/g, ' ')}…` : subject,
    category: isAlert ? 'alerts' : (isSwarm ? 'swarm' : 'primary'),
    actionRequired: isHigh || /can you|please|confirm|review/i.test(body),
    source: 'keywords',
  };
}

/**
 * Triage one message: priority, one-line synopsis, category, whether it asks
 * for action. Uses the local model when one is running, else keywords.
 */
export async function triageInboxMail(mail) {
  if (!mail) return null;
  if (!(await hasLocalModel())) return keywordTriage(mail);

  const prompt = `Triage this email.
Sender: ${mail.sender || mail.from || 'unknown'}
Subject: ${mail.subject || '(No Subject)'}
Content: ${(mail.body || '').substring(0, 1500)}

Return JSON only:
{"priority": "high" | "normal" | "low", "synopsis": "one sentence: the key point or ask", "category": "primary" | "swarm" | "alerts", "actionRequired": true | false}`;

  try {
    const parsed = parseJsonReply(await askLocal(prompt, 200));
    return {
      priority: ['high', 'normal', 'low'].includes(parsed.priority) ? parsed.priority : 'normal',
      synopsis: String(parsed.synopsis || mail.subject || '').slice(0, 200),
      category: ['primary', 'swarm', 'alerts'].includes(parsed.category) ? parsed.category : 'primary',
      actionRequired: Boolean(parsed.actionRequired),
      source: 'ai',
    };
  } catch {
    return keywordTriage(mail);
  }
}

/**
 * Up to four reply suggestions in different tones. Throws (with the reason)
 * when no local model is available or its answer can't be read.
 */
export async function generateMailSmartReplies(mail) {
  if (!mail) return [];
  const prompt = `Suggest 4 short replies to this email, each in a different tone.
From: ${mail.sender || mail.from || 'peer'}
Subject: ${mail.subject || ''}
Body: ${(mail.body || '').substring(0, 1200)}

Return JSON only:
[{"tone": "brief", "label": "Brief", "replyText": "1-2 sentences"},
 {"tone": "detailed", "label": "Detailed", "replyText": "specifics"},
 {"tone": "warm", "label": "Warm", "replyText": "friendly"},
 {"tone": "questioning", "label": "Ask a question", "replyText": "a clarifying question"}]`;

  const parsed = parseJsonReply(await askLocal(prompt, 600));
  const list = (Array.isArray(parsed) ? parsed : []).filter(r => r && typeof r.replyText === 'string' && r.replyText.trim());
  if (!list.length) throw new Error('The local model did not return usable replies.');
  return list.slice(0, 4).map(r => ({
    tone: String(r.tone || 'reply').slice(0, 20),
    label: String(r.label || r.tone || 'Reply').slice(0, 30),
    replyText: r.replyText.trim().slice(0, 1500),
  }));
}

/**
 * Rewrites a draft in the chosen tone. Throws (with the reason) when it can't
 * run, so the composer can say the draft was left unchanged.
 */
export async function polishMailDraft({ draftSubject, draftBody, tone = 'professional' }) {
  if (!draftBody && !draftSubject) return null;

  const toneGuides = {
    professional: 'Clear, articulate and respectful.',
    concise: 'As few words as possible without losing warmth or intent.',
    persuasive: 'Compelling, with a clear call to action.',
    friendly: 'Warm, personable and approachable.',
  };

  const prompt = `Polish this email draft. Keep its meaning and facts; do not invent details.
Tone: ${toneGuides[tone] || toneGuides.professional}

Subject: ${draftSubject || '(None)'}
Body:
${draftBody || ''}

Return JSON only: {"subject": "improved subject", "body": "polished body"}`;

  const parsed = parseJsonReply(await askLocal(prompt, 900));
  if (!parsed?.body) throw new Error('The local model did not return a polished draft.');
  return { subject: String(parsed.subject || draftSubject || ''), body: String(parsed.body) };
}
