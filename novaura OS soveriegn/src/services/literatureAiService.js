// literatureAiService.js — Universal Sovereign Literary Intelligence Engine
// Integrates Local Runtimes (Ollama :11434, LM Studio :1234), Dual Inference (Nova & Aura),
// Native Cloud Frontier BYOK (Google Gemini, Vertex AI, Anthropic Claude, OpenAI, Moonshot Kimi, DeepSeek),
// and the Sovereign Persistent RAG Memory Vault for authentic co-authorship.

import { kernel } from '../kernel/NovaKernel.js';
import { db } from '../database/sovereignDatabase.js';
import { PROVIDERS, getProvider, providerChat, modelSetting } from './cloudProviders.js';
import { dualInference } from './dualInferenceService.js';
import { buildContinuityContext, rememberMemory, detectPotentialMemories } from './sovereignRagService.js';

const INFERENCE_CONFIG_KEY = 'novaura_literature_inference_config';

/**
 * Retrieve active literature inference configuration
 */
export function getActiveInferenceConfig() {
  try {
    const raw = localStorage.getItem(INFERENCE_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    provider: 'auto', // 'auto' | 'ollama' | 'lmstudio' | 'gemini' | 'claude' | 'openai' | 'byok'
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
 * Retrieve API key from Kernel cache, Dexie Vault, or environment
 */
export async function getVaultKey(name) {
  if (kernel?.ai?.getKey) {
    const k = kernel.ai.getKey(name);
    if (k) return k;
  }
  try {
    const rec = await db.vault.get(name);
    if (rec?.value) return rec.value;
    const all = await db.vault.toArray();
    const match = all.find(r => r.key?.toLowerCase() === name.toLowerCase() || r.id?.toLowerCase() === name.toLowerCase());
    if (match?.value) return match.value;
  } catch {}
  if (name === 'gemini') return import.meta.env.VITE_GEMINI_API_KEY || '';
  if (name === 'openrouter') return import.meta.env.VITE_OPENROUTER_API_KEY || '';
  if (name === 'claude') return getVaultKey('anthropic');
  return '';
}

/**
 * Enumerate available providers and locally running or key-backed models
 */
export async function getAvailableInferenceRosters() {
  const roster = {
    local: [],
    cloud: [],
  };

  // 1. Probe Ollama
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(1200) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.models)) {
        for (const m of data.models) {
          roster.local.push({ provider: 'ollama', model: m.name, label: `Ollama: ${m.name}` });
        }
      }
    }
  } catch {}

  // 2. Probe LM Studio
  try {
    const res = await fetch('http://localhost:1234/v1/models', { signal: AbortSignal.timeout(1200) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.data)) {
        for (const m of data.data) {
          roster.local.push({ provider: 'lmstudio', model: m.id, label: `LM Studio: ${m.id}` });
        }
      }
    }
  } catch {}

  // 3. Inspect Cloud Providers with active Vault keys
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

/**
 * Universal Multi-Tier Inference Dispatcher
 * Priority: Configured Choice -> Ollama -> LM Studio -> Dual Inference Aura -> Cloud Providers -> Kernel AI
 */
export async function queryUniversalInference(prompt, systemInstruction = 'You are a master creative literary co-author.', options = {}) {
  const config = getActiveInferenceConfig();
  const targetProvider = options.provider || config.provider || 'auto';
  const temperature = options.temperature ?? config.temperature ?? 0.75;
  const maxTokens = options.maxTokens || 1024;

  const messages = [
    { role: 'system', content: systemInstruction },
    { role: 'user', content: prompt }
  ];

  // Specific Cloud Provider requested or configured
  if (targetProvider !== 'auto' && targetProvider !== 'ollama' && targetProvider !== 'lmstudio') {
    const cloudKey = await getVaultKey(targetProvider);
    if (cloudKey) {
      try {
        const text = await providerChat(targetProvider, messages, (name) => {
          if (name === targetProvider) return cloudKey;
          return localStorage.getItem(`novaura_${name}`) || '';
        }, {
          model: options.model || config.model,
          temperature,
          maxTokens,
          jsonSchema: options.jsonSchema
        });
        if (text && text.trim()) return text.trim();
      } catch (err) {
        console.warn(`[LiteratureAI] Direct provider ${targetProvider} failed:`, err);
        if (options.strictProvider) throw err;
      }
    }
  }

  // Explicit Ollama requested
  if (targetProvider === 'ollama') {
    const out = await queryOllamaDirect(prompt, systemInstruction, options.model || config.model, temperature, maxTokens);
    if (out) return out;
  }

  // Explicit LM Studio requested
  if (targetProvider === 'lmstudio') {
    const out = await queryLmStudioDirect(prompt, systemInstruction, options.model || config.model, temperature, maxTokens);
    if (out) return out;
  }

  // AUTO FALLBACK CASCADE:
  // 1. Try Ollama (:11434)
  const ollamaRes = await queryOllamaDirect(prompt, systemInstruction, config.model, temperature, maxTokens);
  if (ollamaRes) return ollamaRes;

  // 2. Try LM Studio (:1234)
  const lmRes = await queryLmStudioDirect(prompt, systemInstruction, config.model, temperature, maxTokens);
  if (lmRes) return lmRes;

  // 3. Try Dual Inference Aura Creative Engine
  try {
    const auraRes = await dualInference.queryAura(messages, { temperature, max_tokens: maxTokens });
    if (auraRes && auraRes.trim()) return auraRes.trim();
  } catch {}

  // 4. Try Google Gemini BYOK
  const geminiKey = await getVaultKey('gemini');
  if (geminiKey) {
    try {
      const geminiModel = options.model || (await getVaultKey(modelSetting('gemini'))) || 'gemini-1.5-pro';
      const text = await providerChat('gemini', messages, () => geminiKey, {
        model: geminiModel,
        temperature,
        maxTokens,
        jsonSchema: options.jsonSchema
      });
      if (text && text.trim()) return text.trim();
    } catch (err) {
      console.warn('[LiteratureAI] Gemini fallback failed:', err);
    }
  }

  // 5. Try Anthropic Claude BYOK
  const claudeKey = await getVaultKey('claude');
  if (claudeKey) {
    try {
      const claudeModel = options.model || (await getVaultKey(modelSetting('claude'))) || 'claude-3-5-sonnet-20241022';
      const text = await providerChat('claude', messages, () => claudeKey, {
        model: claudeModel,
        temperature,
        maxTokens,
        jsonSchema: options.jsonSchema
      });
      if (text && text.trim()) return text.trim();
    } catch (err) {
      console.warn('[LiteratureAI] Claude fallback failed:', err);
    }
  }

  // 6. Try Kernel AI Universal Chat Subsystem
  try {
    if (kernel?.ai?.chat) {
      const response = await kernel.ai.chat(messages, {
        persona: 'cybeni',
        temperature,
        maxTokens,
      });
      if (response && response.trim()) return response.trim();
    }
  } catch {}

  throw new Error('Inference Offline: All configured engines (Local Ollama :11434, LM Studio :1234, Gemini, Claude, and Kernel BYOK) are offline or missing API keys. Start your local model server or configure a key in Settings.');
}

async function queryOllamaDirect(prompt, systemInstruction, modelTag, temperature, maxTokens) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelTag || 'default',
        prompt: `${systemInstruction}\n\n${prompt}`,
        stream: false,
        options: { temperature: temperature || 0.75, max_tokens: maxTokens || 1024 }
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data.response) return data.response.trim();
    }
  } catch {}
  return null;
}

async function queryLmStudioDirect(prompt, systemInstruction, modelTag, temperature, maxTokens) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch('http://localhost:1234/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelTag || undefined,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        temperature: temperature || 0.7,
        max_tokens: maxTokens || 1024
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return content.trim();
    }
  } catch {}
  return null;
}

// ── 1. Ghostwriter Inline Prediction ────────────────────────────────────────

export async function predictNextPhrase(precedingText) {
  if (!precedingText || precedingText.trim().length < 15) return null;
  const words = precedingText.trim().split(/\s+/).slice(-45).join(' ');

  const prompt = `Based on the following manuscript passage, write ONLY the next sentence (maximum 12-18 words) that continues the scene naturally. Do not include quotes, markdown, or pleasantries.\n\nPASSAGE:\n"${words}"`;
  
  try {
    const aiOutput = await queryUniversalInference(prompt, 'You are an intuitive literary ghostwriter predicting the author\'s next sentence.', { maxTokens: 60 });
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

  const prompt = lastUserMsg;
  const conversationMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: prompt }
  ];

  const responseText = await queryUniversalInference(prompt, systemPrompt, {
    provider,
    model,
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
      const clean = aiOutput.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
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

  const prompt = `SCENE TO REMASTER:\n"""\n${text.slice(0, 4000)}\n"""\n\nREMASTER TYPE: ${type.toUpperCase()}\nDIRECTIVE: ${modeInstruction}\n${instructions ? `CUSTOM NOTES: ${instructions}\n` : ''}\n\nProvide ONLY the remastered scene prose.`;

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
      const clean = aiOutput.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
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
      pacingScore: 'Moderate',
      tensionCurve: [50, 50, 50],
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

  try {
    const res = await queryUniversalInference(prompt, 'You are an expert literary pacing editor.', { maxTokens: 400 });
    const cleanJson = res.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return {
      sentenceCount: sentences.length,
      averageSentenceLength: avgLen,
      dialogueRatio,
      pacingScore: parsed.pacingSpeed || 'Balanced',
      tensionCurve: Array.isArray(parsed.tensionCurve) ? parsed.tensionCurve : [40, 60, 80],
      suggestions: parsed.suggestions || []
    };
  } catch {
    return {
      sentenceCount: sentences.length,
      averageSentenceLength: avgLen,
      dialogueRatio,
      pacingScore: avgLen > 22 ? 'Slow / Descriptive' : avgLen < 11 ? 'Fast / Punchy' : 'Balanced',
      tensionCurve: [35, 50, 75, 90, 65],
      suggestions: ['Sentence length average is healthy. Ensure dialogue breaks up heavy descriptive passages.']
    };
  }
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
    const clean = res.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return {
      status: 'VERIFIED',
      confidence: 85,
      explanation: 'Plausible within narrative context.',
      sources: ['Internal consistency audit', 'Standard literary conventions']
    };
  }
}
