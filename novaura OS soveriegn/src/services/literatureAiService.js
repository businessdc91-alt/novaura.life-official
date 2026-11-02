// literatureAiService.js — The Literature IDE's AI calls.
//
// Local first: by default ("auto") every request runs on a model on this
// machine (LM Studio, then Ollama) through the native localModels helper, so
// the manuscript never leaves the computer. A cloud model (bring-your-own key)
// is used only when the author picks one in the Co-Author model menu; there is
// no silent fallback from local to cloud.

import { kernel } from '../kernel/NovaKernel.js';
import { db } from '../database/sovereignDatabase.js';
import { getProvider, providerChat, modelSetting, PROVIDERS } from './cloudProviders.js';
import { LOCAL_RUNTIMES, discoverLocalModels, runLocalChat, toModelRef } from './localModels.js';
import { buildContinuityContext, rememberMemory, detectPotentialMemories } from './sovereignRagService.js';

const INFERENCE_CONFIG_KEY = 'novaura_literature_inference_config';
const CHAT_HISTORY_TURNS = 12;
const CHAT_TURN_CHARS = 4000;

/**
 * Retrieve active literature inference configuration
 */
export function getActiveInferenceConfig() {
  try {
    const raw = localStorage.getItem(INFERENCE_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    provider: 'auto', // 'auto' | 'lmstudio' | 'ollama' | a cloud provider id from cloudProviders.js
    model: '',
    temperature: 0.75,
  };
}

/**
 * Persist active literature inference configuration
 */
export function setActiveInferenceConfig(config) {
  try {
    localStorage.setItem(INFERENCE_CONFIG_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('novaura:literature_model_changed', { detail: config }));
  } catch (err) {
    console.warn('[LiteratureAI] Save inference config note:', err);
  }
}

/**
 * Retrieve an API key (or saved setting) from the local vault.
 */
export async function getVaultKey(name) {
  const cached = kernel?.ai?.getKey?.(name);
  if (cached) return cached;
  try {
    const rec = await db.vault.get(name);
    if (rec?.value) return rec.value;
    const all = await db.vault.toArray();
    const match = all.find(r => r.key?.toLowerCase() === name.toLowerCase() || r.id?.toLowerCase() === name.toLowerCase());
    if (match?.value) return match.value;
  } catch {}
  if (name === 'claude') return getVaultKey('anthropic');
  return '';
}

/**
 * Local models running on this machine, and cloud providers with a saved key.
 */
export async function getAvailableInferenceRosters() {
  const roster = { local: [], cloud: [] };

  const runtimes = await discoverLocalModels().catch(() => []);
  for (const rt of runtimes) {
    for (const ref of rt.models) {
      const model = ref.slice(rt.runtime.length + 1);
      const loaded = rt.loaded.includes(ref);
      roster.local.push({ provider: rt.runtime, model, label: `${rt.label}: ${model}${loaded ? ' (loaded)' : ''}` });
    }
  }

  for (const p of PROVIDERS) {
    const key = await getVaultKey(p.id);
    if (key) {
      const savedModel = await getVaultKey(modelSetting(p.id)) || p.defaultModel || (p.suggested ? p.suggested[0] : '');
      roster.cloud.push({
        provider: p.id,
        label: `${p.label} (${p.vendor})`,
        model: savedModel,
        suggested: p.suggested || [],
      });
    }
  }

  return roster;
}

// The local model "auto" uses: a loaded one first (it answers fastest), LM
// Studio before Ollama. Cached briefly so typing-speed features don't probe on
// every call.
let _localPick = { at: 0, ref: null, runtime: null };
const LOCAL_PICK_TTL_MS = 30000;

async function pickLocalModel(runtime = null) {
  if (Date.now() - _localPick.at < LOCAL_PICK_TTL_MS && _localPick.runtime === runtime) return _localPick.ref;
  const runtimes = (await discoverLocalModels().catch(() => []))
    .filter(rt => rt.online && (!runtime || rt.runtime === runtime));
  const ref = runtimes.flatMap(rt => rt.loaded)[0] || runtimes.flatMap(rt => rt.models)[0] || null;
  _localPick = { at: Date.now(), ref, runtime };
  return ref;
}

/** Whether a local model is available right now (cached, cheap to call often). */
export async function hasLocalModel() {
  return Boolean(await pickLocalModel());
}

// providerChat reads keys synchronously, so the ones it may need are loaded first.
async function cloudKeyLookup(provider) {
  const values = {};
  for (const name of [provider, modelSetting(provider), 'byok_endpoint', 'bedrock_region']) {
    values[name] = await getVaultKey(name);
  }
  return (name) => values[name] || '';
}

/**
 * Run one request on the author's chosen model.
 *
 * queryUniversalInference(prompt, systemInstruction, options) or
 * queryUniversalInference({ prompt, systemPrompt, ...options }).
 * options: provider, model, temperature, maxTokens, history (earlier
 * [{role, content}] turns), localOnly (never use a cloud model).
 */
export async function queryUniversalInference(prompt, systemInstruction = 'You are a master creative literary co-author.', options = {}) {
  if (prompt && typeof prompt === 'object') {
    const { prompt: text, systemPrompt, systemInstruction: sys, ...rest } = prompt;
    return queryUniversalInference(text, systemPrompt || sys || systemInstruction, rest);
  }

  const config = getActiveInferenceConfig();
  let provider = options.provider || config.provider || 'auto';
  let model = options.model ?? (options.provider ? '' : config.model);
  if (options.localOnly && !LOCAL_RUNTIMES[provider]) {
    provider = 'auto';
    model = '';
  }
  const temperature = options.temperature ?? config.temperature ?? 0.75;
  const maxTokens = options.maxTokens || 1024;
  const messages = [
    { role: 'system', content: systemInstruction },
    ...(options.history || []),
    { role: 'user', content: String(prompt || '') },
  ];

  if (provider === 'auto' || LOCAL_RUNTIMES[provider]) {
    const runtime = provider === 'auto' ? null : provider;
    const ref = model && runtime ? toModelRef(runtime, model) : await pickLocalModel(runtime);
    if (!ref) {
      const where = runtime ? LOCAL_RUNTIMES[runtime].label : 'LM Studio or Ollama';
      throw new Error(`No local model is running. Start ${where} and load a model, or choose a cloud model in the Co-Author model menu.`);
    }
    const text = await runLocalChat(ref, messages, { maxTokens, temperature, jsonSchema: options.jsonSchema });
    if (!text) throw new Error('The local model returned an empty reply.');
    return text;
  }

  // A cloud model the author chose explicitly.
  const def = getProvider(provider);
  if (!def) throw new Error(`Unknown model provider "${provider}".`);
  const getKey = await cloudKeyLookup(provider);
  if (!getKey(provider)) throw new Error(`No API key saved for ${def.label}. Add one in Settings, or choose a local model.`);
  const text = await providerChat(provider, messages, getKey, { model: model || undefined, temperature, maxTokens, jsonSchema: options.jsonSchema });
  if (!text || !text.trim()) throw new Error(`${def.label} returned an empty reply.`);
  return text.trim();
}

/** Pulls the first JSON object or array out of a model reply (fences, prose around it). */
export function parseJsonReply(text) {
  const raw = String(text || '').replace(/```(?:json)?/gi, '').trim();
  const starts = [raw.indexOf('{'), raw.indexOf('[')].filter(i => i >= 0);
  if (!starts.length) throw new Error('The model did not return JSON.');
  const start = Math.min(...starts);
  const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
  if (end <= start) throw new Error('The model did not return JSON.');
  return JSON.parse(raw.slice(start, end + 1));
}

// ── 1. Ghostwriter Inline Prediction ────────────────────────────────────────

export async function predictNextPhrase(precedingText) {
  if (!precedingText || precedingText.trim().length < 15) return null;
  const words = precedingText.trim().split(/\s+/).slice(-45).join(' ');

  const prompt = `Based on the following manuscript passage, write ONLY the next sentence (maximum 12-18 words) that continues the scene naturally. Do not include quotes, markdown, or pleasantries.\n\nPASSAGE:\n"${words}"`;
  
  // Runs on every pause in typing, so it stays on this machine and is skipped
  // when no local model is up.
  if (!(await hasLocalModel())) return null;
  try {
    const aiOutput = await queryUniversalInference(prompt, 'You are an intuitive literary ghostwriter predicting the author\'s next sentence.', { maxTokens: 60, localOnly: true });
    if (aiOutput) {
      return aiOutput.replace(/^["']|["']$/g, '').trim();
    }
  } catch {}

  return null;
}

// ── 2. Interactive Co-Author Discussion & Chat (VS Code / Cursor Style) ──────

export async function chatLiteratureCoAuthor({
  messages = [],
  documentContext = '',
  selectionContext = '',
  codexContext = '',
  activeDocName = 'Manuscript',
  useRag = true,
  onToken = null,
  provider = null,
  model = null,
}) {
  const lastUserMsg = messages[messages.length - 1]?.content || '';

  // 1. Build RAG Memory Context for Personalization & Narrative Continuity
  let ragContextString = '';
  let retrievedMemories = [];

  if (useRag) {
    try {
      const rag = await buildContinuityContext(`${lastUserMsg} ${selectionContext} ${documentContext.slice(0, 300)}`);
      ragContextString = rag.contextString;
      retrievedMemories = rag.memories;
    } catch (err) {
      console.warn('[LiteratureAI] RAG retrieval error:', err);
    }
  }

  // 2. Auto-detect if user stated a new persistent rule/lore to remember
  const detected = detectPotentialMemories(lastUserMsg);
  for (const item of detected) {
    rememberMemory({
      category: item.category,
      title: item.title,
      content: item.content,
      importance: 4,
    }).catch(() => {});
  }

  // 3. Construct System Prompt with Document Context, Codex, & RAG Memory
  const systemPrompt = `You are the master literary co-author and narrative architect inside Novaura Literature IDE.
You collaborate directly with the author in real-time, functioning just like VS Code Copilot/Cursor but tailored specifically for deep storytelling, character psychology, worldbuilding, and prose craftsmanship.

${ragContextString ? ragContextString : ''}
${codexContext ? `=== [STORY BIBLE & CODEX ENTITIES] ===\n${codexContext}\n=====================================\n` : ''}

CURRENT WORKSPACE CONTEXT:
Active Document: "${activeDocName}"
${selectionContext ? `SELECTED PASSAGE (User highlighted in editor):\n"""\n${selectionContext}\n"""\n` : ''}
${documentContext ? `ACTIVE CHAPTER EXCERPT:\n"""\n${documentContext.slice(0, 2000)}\n"""\n` : ''}

GUIDELINES:
- Provide insightful, constructive, and creatively rich critique, suggestions, or prose continuations.
- Always maintain continuity with the user's established characters, world lore, and narrative rules.
- If writing prose, format clearly so the author can easily insert it into the manuscript.
- Be concise, direct, and collaborative. Avoid robotic pleasantries.`;

  // Earlier turns, so the co-author remembers the conversation.
  const history = messages.slice(0, -1)
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-CHAT_HISTORY_TURNS)
    .map(m => ({ role: m.role, content: String(m.content).slice(0, CHAT_TURN_CHARS) }));
  while (history[0]?.role === 'assistant') history.shift();

  const responseText = await queryUniversalInference(lastUserMsg, systemPrompt, {
    provider,
    model,
    history,
    maxTokens: 1500,
  });

  if (onToken) onToken(responseText);
  return { text: responseText, usedMemories: retrievedMemories };
}

// ── 3. Sudowrite-Style "Sensory 5-Senses" & Metaphor Expander ────────────────

export async function describeSensory({ text, sense = 'sight', context = '' }) {
  if (!text || !text.trim()) throw new Error('Please select text to describe.');

  let promptFocus = '';
  switch (sense.toLowerCase()) {
    case 'sight':
      promptFocus = 'Focus exclusively on vivid visual impressions, lighting, color gradients, shadows, silhouettes, and micro-physical textures.';
      break;
    case 'sound':
      promptFocus = 'Focus exclusively on acoustic cues, volume, resonance, frequency, rhythm, echo, pitch, and subtle background ambient sounds.';
      break;
    case 'smell':
      promptFocus = 'Focus exclusively on olfactory cues, musk, chemical or organic notes, atmospheric scents, sharpness, and emotional memory tied to scent.';
      break;
    case 'taste':
      promptFocus = 'Focus exclusively on palate notes, acidity, sweetness, bitterness, metallic or mineral sensations, and visceral mouthfeel.';
      break;
    case 'touch':
      promptFocus = 'Focus exclusively on tactile feedback, temperature, weight, roughness, friction, vibration, and visceral physical sensations.';
      break;
    case 'vibe':
    case 'atmosphere':
      promptFocus = 'Focus on psychological atmosphere, impending dread or calm, mood, emotional tension, and sensory room resonance.';
      break;
    case 'metaphor':
      promptFocus = 'Provide 3 striking, original, and deeply literary metaphors or similes that capture the thematic essence of this subject.';
      break;
    default:
      promptFocus = 'Provide rich, multisensory descriptions across sight, sound, smell, and tactile feedback.';
  }

  const prompt = `SUBJECT TO DESCRIBE:
"""
${text.trim()}
"""
${context ? `SURROUNDING SCENE CONTEXT:\n"${context.slice(0, 300)}"\n` : ''}

INSTRUCTION:
${promptFocus}
Write 2-3 atmospheric, evocative options that an author can copy or weave directly into the manuscript. Keep it strictly focused on literary description with no conversational filler.`;

  return await queryUniversalInference(prompt, 'You are a master sensory stylist and poet for fiction authors.', { maxTokens: 600 });
}

// ── 4. Story Continuation with Branching Options ─────────────────────────────

export async function generatePlotBranches(currentContent) {
  const words = (currentContent || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).slice(-250).join(' ');
  if (!words) {
    throw new Error('Manuscript editor is empty. Enter narrative text before generating story branches.');
  }

  const prompt = `Read this story excerpt:\n"${words}"\n\nGenerate exactly 3 distinct and intriguing ways to continue the story from this point.
Return JSON with this exact shape:
[
  { "id": "branch_1", "tag": "Escalation", "title": "Sudden Complication", "summary": "1 sentence teaser" },
  { "id": "branch_2", "tag": "Discovery", "title": "Hidden Clue Unveiled", "summary": "1 sentence teaser" },
  { "id": "branch_3", "tag": "Introspection", "title": "Quiet Revelation", "summary": "1 sentence teaser" }
]`;

  const aiOutput = await queryUniversalInference(prompt, 'You are an expert story consultant.', { maxTokens: 700 });
  if (aiOutput) {
    try {
      const parsed = parseJsonReply(aiOutput);
      if (Array.isArray(parsed) && parsed.length >= 3) return parsed;
    } catch {}
  }

  throw new Error('Failed to parse branching options. Verify model output.');
}

export async function expandBranchIntoProse(currentContent, branch) {
  const words = (currentContent || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).slice(-180).join(' ');
  const prompt = `We are continuing this story:\n"${words}"\n\nThe author chooses this continuation: "${branch.title}: ${branch.summary}".\n\nWrite 2 rich, atmospheric paragraphs (around 130-190 words) describing this scene unfolding seamlessly. Use evocative sensory prose. Return ONLY the narrative prose.`;

  return await queryUniversalInference(prompt, 'You are an award-winning novelist writing the next scene.', { maxTokens: 800 });
}

// ── 5. Story Remastering & Remix Engine (7 Modes) ───────────────────────────

export async function remasterScene({ text, type = 'enhanced', instructions = '', storyBible = null }) {
  if (!text || !text.trim()) throw new Error('No text provided for remastering.');

  let modeInstruction = '';
  switch (type) {
    case 'full_remaster':
      modeInstruction = 'Perform a complete structural rewrite. Enhance sensory immersion, pacing, character agency, and subtext while preserving core plot events.';
      break;
    case 'branching_point':
      modeInstruction = 'Take this scene to a critical tipping point and diverge into a radical "what if" alternative outcome.';
      break;
    case 'genre_shift':
      modeInstruction = `Rewrite this scene shifting its genre cadence to: ${instructions || 'Dark Cyberpunk Noir'}.`;
      break;
    case 'perspective_flip':
      modeInstruction = `Flip the point-of-view (POV) to another character present in the scene: ${instructions || 'the antagonist or secondary character'}. Capture their internal thoughts and biases.`;
      break;
    case 'condensed':
      modeInstruction = 'Condense this scene into tight, fast-paced, high-tension prose. Cut all filler and passive cadence.';
      break;
    case 'expanded':
      modeInstruction = 'Expand this scene with rich worldbuilding details, micro-expressions, atmospheric texture, and deeper character introspection.';
      break;
    case 'enhanced':
    default:
      modeInstruction = 'Enhance dialogue snap, rhythm, sensory hooks, and emotional resonance. Polish every sentence to literary excellence.';
  }

  const bible = typeof storyBible === 'string' ? storyBible.trim() : '';
  const prompt = `${bible ? `STORY BIBLE (keep names, character states and established facts consistent with it):\n${bible}\n\n` : ''}SCENE TO REMASTER:\n"""\n${text.slice(0, 4000)}\n"""\n\nREMASTER TYPE: ${type.toUpperCase()}\nDIRECTIVE: ${modeInstruction}\n${instructions ? `CUSTOM NOTES: ${instructions}\n` : ''}\n\nProvide ONLY the remastered scene prose.`;

  return await queryUniversalInference(prompt, 'You are an elite literary editor and master ghostwriter executing a story remaster.', { maxTokens: 2500 });
}

// ── 6. Guided "Craft Complete Story" Studio Wizard ──────────────────────────

export async function craftGuidedStory({ genre, tone, protagonist, premise, setting }) {
  const prompt = `Craft a complete, highly engaging story foundation and Chapter 1 draft for a novel with these parameters:
- Genre: ${genre}
- Tone: ${tone}
- Protagonist: ${protagonist}
- Premise: ${premise}
- Setting: ${setting}

Output JSON in this format:
{
  "title": "Novel Title",
  "synopsis": "2 sentence high level synopsis",
  "theme": "Core underlying theme",
  "outline": [
    { "chapter": 1, "title": "Chapter 1 Title", "beats": "Key beats" },
    { "chapter": 2, "title": "Chapter 2 Title", "beats": "Key beats" },
    { "chapter": 3, "title": "Chapter 3 Title", "beats": "Key beats" }
  ],
  "chapter1Prose": "HTML formatted first chapter (3 paragraphs with <h1> and <p>)"
}`;

  const aiOutput = await queryUniversalInference(prompt, 'You are an award-winning novelist and master worldbuilder.', { maxTokens: 2000 });
  if (aiOutput) {
    try {
      const parsed = parseJsonReply(aiOutput);
      if (parsed && parsed.title && parsed.chapter1Prose) return parsed;
    } catch {}
  }

  throw new Error('Failed to parse crafted story blueprint.');
}

// ── 7. Style Transformations ────────────────────────────────────────────────

export async function transformStyle(selectedText, mode) {
  if (!selectedText) return selectedText;

  let instruction = '';
  switch (mode) {
    case 'show_dont_tell':
      instruction = 'Rewrite the following text using the "Show, Don\'t Tell" technique. Replace abstract claims with vivid physical actions, sensory impressions, and visceral reactions.';
      break;
    case 'intensify_conflict':
      instruction = 'Rewrite the following text to sharply increase psychological tension, stakes, and emotional friction.';
      break;
    case 'dialogue_punch':
      instruction = 'Rewrite the following dialogue to be sharper, snappier, filled with subtext, and authentic to human speech rhythms.';
      break;
    case 'poetic_metaphor':
      instruction = 'Rewrite the following text with evocative literary metaphors, rhythmic cadence, and striking imagery.';
      break;
    default:
      instruction = 'Rewrite the following passage to improve flow, clarity, and narrative punch.';
  }

  const prompt = `${instruction}\n\nORIGINAL TEXT:\n"${selectedText}"\n\nProvide ONLY the revised text with no commentary or quotes.`;
  return await queryUniversalInference(prompt, 'You are an expert prose stylist.', { maxTokens: 800 });
}

// ── 8. ProWritingAid-Style Narrative Pacing & Tension Analytics ─────────────

export async function analyzePacingAndTension({ text }) {
  if (!text || text.trim().length < 50) {
    return {
      sentenceCount: 0,
      averageSentenceLength: 0,
      dialogueRatio: 0,
      pacingScore: 'Not enough text',
      tensionCurve: [],
      aiNote: 'add more prose first.',
      suggestions: ['Add more prose to evaluate narrative cadence.']
    };
  }

  // Heuristic local stats
  const clean = text.replace(/<[^>]+>/g, ' ');
  const sentences = clean.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  const words = clean.split(/\s+/).filter(Boolean);
  const dialogueMatches = clean.match(/["“][^"”]+["”]/g) || [];
  const dialogueWords = dialogueMatches.join(' ').split(/\s+/).filter(Boolean).length;
  const dialogueRatio = Math.round((dialogueWords / Math.max(1, words.length)) * 100);
  const avgLen = Math.round(words.length / Math.max(1, sentences.length));

  // AI evaluation of emotional tension & pacing
  const prompt = `Analyze the narrative pacing and dramatic tension of this prose passage:
"""
${clean.slice(0, 2500)}
"""

Evaluate:
1. Pacing speed (Slow / Moderate / Fast / Erratic)
2. Tension arc points across 5 stages (scores 0-100)
3. 2 concise, actionable suggestions to improve sentence rhythm or scene friction.

Return JSON:
{
  "pacingSpeed": "Fast",
  "tensionCurve": [40, 55, 70, 85, 60],
  "suggestions": ["Suggestion 1", "Suggestion 2"]
}`;

  // Counted locally, so these are real even when the AI part fails.
  const localPace = avgLen > 22 ? 'Slow / Descriptive' : avgLen < 11 ? 'Fast / Punchy' : 'Balanced';
  try {
    const res = await queryUniversalInference(prompt, 'You are an expert literary pacing editor.', { maxTokens: 400 });
    const parsed = parseJsonReply(res);
    const curve = (Array.isArray(parsed.tensionCurve) ? parsed.tensionCurve : [])
      .map(Number).filter(Number.isFinite).map(v => Math.max(0, Math.min(100, Math.round(v)))).slice(0, 12);
    return {
      sentenceCount: sentences.length,
      averageSentenceLength: avgLen,
      dialogueRatio,
      pacingScore: String(parsed.pacingSpeed || localPace).slice(0, 40),
      tensionCurve: curve,
      aiNote: curve.length ? '' : 'the model did not return one.',
      suggestions: (Array.isArray(parsed.suggestions) ? parsed.suggestions : []).map(String).slice(0, 5),
    };
  } catch (err) {
    return {
      sentenceCount: sentences.length,
      averageSentenceLength: avgLen,
      dialogueRatio,
      pacingScore: localPace,
      tensionCurve: [],
      aiNote: err.message || 'the AI analysis failed.',
      suggestions: [],
    };
  }
}

// ── 8b. Story Event Extraction (Timeline) ───────────────────────────────────

/**
 * Reads a chapter and lists the story events in it, with the characters
 * involved (names as written). `eventTypes` are the allowed type ids;
 * `knownCharacters` are names from the story bible so the model reuses them.
 * Returns [{ type, title, description, impact, characterNames }].
 */
export async function extractStoryEvents({ text, chapterName = 'This chapter', eventTypes = [], knownCharacters = [] }) {
  const clean = String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length < 80) throw new Error('Write a little more of the chapter first.');
  const allowed = eventTypes.length ? eventTypes : ['other'];

  const prompt = `List the important story events in this chapter ("${chapterName}"), in the order they happen. Only events that actually happen in the text (not ones merely mentioned as possible), at most 8.

ALLOWED TYPES: ${allowed.join(', ')}
${knownCharacters.length ? `KNOWN CHARACTERS (use these exact names when they appear): ${knownCharacters.slice(0, 60).join(', ')}\n` : ''}
CHAPTER:
"""
${clean.slice(0, 6000)}
"""

Return JSON only:
{"events": [{"type": "one of the allowed types", "title": "short title", "description": "one sentence", "impact": "what changes because of it", "characters": ["names involved"]}]}`;

  const res = await queryUniversalInference(prompt, 'You are a meticulous story editor who tracks plot events and continuity.', { maxTokens: 900, temperature: 0.2 });
  const parsed = parseJsonReply(res);
  const list = Array.isArray(parsed) ? parsed : parsed?.events;
  if (!Array.isArray(list)) throw new Error('The model did not return a list of events.');
  const clip = (v, n) => String(v ?? '').trim().slice(0, n);
  return list.slice(0, 8).map(e => ({
    type: allowed.includes(String(e?.type || '').toLowerCase()) ? String(e.type).toLowerCase() : 'other',
    title: clip(e?.title, 80),
    description: clip(e?.description, 300),
    impact: clip(e?.impact, 300),
    characterNames: (Array.isArray(e?.characters) ? e.characters : []).map(n => clip(n, 60)).filter(Boolean).slice(0, 8),
  })).filter(e => e.title);
}

// ── 9. Fact & Canon Verification ───────────────────────────────────────────

export async function verifyFactualClaim({ claim, worldCanon = '', context = '' }) {
  if (!claim) throw new Error('Claim text cannot be empty.');

  const prompt = `Evaluate the plausibility or accuracy of this claim in fiction writing:
CLAIM: "${claim}"
${worldCanon ? `ESTABLISHED WORLDBUILDING CANON:\n${worldCanon}\n` : ''}
${context ? `SCENE CONTEXT:\n${context.slice(0, 400)}\n` : ''}

Determine:
1. Status: "VERIFIED" (accurate/plausible), "QUESTIONABLE" (potential plot hole or factual inaccuracy), or "CONTRADICTS_CANON"
2. Confidence score (0-100)
3. 2 concise supporting or counter examples with context.

Return JSON:
{
  "status": "VERIFIED",
  "confidence": 92,
  "explanation": "Brief explanation",
  "sources": ["Example 1", "Example 2"]
}`;

  const res = await queryUniversalInference(prompt, 'You are a meticulous literary fact-checker and continuity supervisor.', { maxTokens: 500 });
  try {
    const parsed = parseJsonReply(res);
    const status = String(parsed.status || '').toUpperCase();
    if (!['VERIFIED', 'QUESTIONABLE', 'CONTRADICTS_CANON'].includes(status)) throw new Error('unknown status');
    const confidence = Number(parsed.confidence);
    return {
      status,
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, Math.round(confidence))) : null,
      explanation: String(parsed.explanation || '').slice(0, 600),
      sources: (Array.isArray(parsed.sources) ? parsed.sources : []).map(String).slice(0, 4),
    };
  } catch {
    // Never report a claim as checked when the answer couldn't be read.
    return {
      status: 'UNVERIFIED',
      confidence: null,
      explanation: 'The model\'s answer could not be read, so this claim was not checked. Try again or pick another model.',
      sources: [],
    };
  }
}
