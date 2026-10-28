// literatureAiService.js — Local Sovereign Writing Assistant & Ghostwriter Engine
// Integrates with local Ollama (:11434), LM Studio (:1234), Kernel AI Subsystem (Universal BYOK),
// and the Sovereign Persistent RAG Memory Engine for true personalization and narrative continuity.

import { kernel } from '../kernel/NovaKernel.js';
import { buildContinuityContext, rememberMemory, detectPotentialMemories } from './sovereignRagService.js';

/**
 * Get active model tag dynamically from local storage or Ollama tags
 */
async function getDynamicLocalModel() {
  try {
    const saved = localStorage.getItem('novaura_active_model');
    if (saved) return saved;
  } catch {}

  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      const data = await res.json();
      if (data.models && data.models.length > 0) {
        return data.models[0].name;
      }
    }
  } catch {}

  return null;
}

/**
 * Multi-tier inference query (Ollama -> LM Studio -> Kernel BYOK)
 */
async function queryLocalInference(prompt, systemInstruction = 'You are a master creative co-author.') {
  const dynamicModel = await getDynamicLocalModel();

  // 1. Try Ollama (:11434)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: dynamicModel || 'default',
        prompt: `${systemInstruction}\n\n${prompt}`,
        stream: false,
        options: { temperature: 0.75, max_tokens: 600 }
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data.response) return data.response.trim();
    }
  } catch {
    // Ollama offline or timed out
  }

  // 2. Try LM Studio (OpenAI compatible /v1/chat/completions)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('http://localhost:1234/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 600
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return content.trim();
    }
  } catch {
    // LM Studio offline
  }

  // 3. Try Sovereign Kernel AI Subsystem (Universal BYOK / WebGPU)
  try {
    if (kernel?.ai?.chat) {
      const response = await kernel.ai.chat([
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt }
      ], {
        persona: 'cybeni',
        temperature: 0.75,
        maxTokens: 600,
      });
      if (response && response.trim()) return response.trim();
    }
  } catch {
    // Kernel AI fallback
  }

  return null;
}

// ── 1. Ghostwriter Inline Prediction ────────────────────────────────────────

export async function predictNextPhrase(precedingText) {
  if (!precedingText || precedingText.trim().length < 15) return null;
  const words = precedingText.trim().split(/\s+/).slice(-45).join(' ');

  const prompt = `Based on the following manuscript passage, write ONLY the next sentence (maximum 12-18 words) that continues the scene naturally. Do not include quotes, markdown, or pleasantries.\n\nPASSAGE:\n"${words}"`;
  const aiOutput = await queryLocalInference(prompt, 'You are an intuitive literary ghostwriter predicting the author\'s next sentence.');

  if (aiOutput) {
    return aiOutput.replace(/^["']|["']$/g, '').trim();
  }

  return null;
}

// ── 2. Interactive Co-Author Discussion & Chat (VS Code / Cursor Style) ──────

export async function chatLiteratureCoAuthor({
  messages = [],
  documentContext = '',
  selectionContext = '',
  activeDocName = 'Manuscript',
  useRag = true,
  onToken = null,
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

  // 3. Construct System Prompt with Document Context & RAG Memory
  const systemPrompt = `You are the master literary co-author and narrative architect inside Novaura Literature IDE.
You collaborate directly with the author in real-time, functioning just like VS Code Copilot/Cursor but tailored specifically for deep storytelling, character psychology, worldbuilding, and prose craftsmanship.

${ragContextString ? ragContextString : ''}

CURRENT WORKSPACE CONTEXT:
Active Document: "${activeDocName}"
${selectionContext ? `SELECTED PASSAGE (User highlighted in editor):\n"""\n${selectionContext}\n"""\n` : ''}
${documentContext ? `ACTIVE CHAPTER EXCERPT:\n"""\n${documentContext.slice(0, 1500)}\n"""\n` : ''}

GUIDELINES:
- Provide insightful, constructive, and creatively rich critique, suggestions, or prose continuations.
- Always maintain continuity with the user's established characters, world lore, and narrative rules.
- If writing prose, format clearly so the author can easily insert it into the manuscript.
- Be concise, direct, and collaborative. Avoid robotic pleasantries.`;

  const dynamicModel = await getDynamicLocalModel();

  // 4. Try Ollama (:11434) with streaming or JSON
  try {
    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content }))
    ];

    const controller = new AbortController();
    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: dynamicModel || 'default',
        messages: formattedMessages,
        stream: false,
        options: { temperature: 0.75, max_tokens: 1024 }
      }),
      signal: controller.signal
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.message?.content?.trim();
      if (content) {
        if (onToken) onToken(content);
        return { text: content, usedMemories: retrievedMemories };
      }
    }
  } catch {}

  // 5. Try LM Studio (:1234)
  try {
    const res = await fetch('http://localhost:1234/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role, content: m.content }))
        ],
        temperature: 0.75,
        max_tokens: 1024
      }),
      signal: AbortSignal.timeout(6000)
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) {
        if (onToken) onToken(content);
        return { text: content, usedMemories: retrievedMemories };
      }
    }
  } catch {}

  // 6. Try Sovereign Kernel AI Subsystem (Universal BYOK)
  try {
    if (kernel?.ai?.chat) {
      const response = await kernel.ai.chat([
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ], {
        persona: 'cybeni',
        temperature: 0.75,
        maxTokens: 1024,
      });

      if (response && response.trim()) {
        if (onToken) onToken(response.trim());
        return { text: response.trim(), usedMemories: retrievedMemories };
      }
    }
  } catch {}

  throw new Error('Inference Offline: All local runtimes (Ollama :11434, LM Studio :1234) and BYOK cloud keys are currently offline. Launch Ollama or provide a BYOK key in Settings.');
}

// ── 3. Story Continuation with Branching Options ─────────────────────────────

export async function generatePlotBranches(currentContent) {
  const words = (currentContent || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).slice(-200).join(' ');
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

  const aiOutput = await queryLocalInference(prompt);
  if (aiOutput) {
    try {
      const parsed = JSON.parse(aiOutput.replace(/```json|```/g, '').trim());
      if (Array.isArray(parsed) && parsed.length >= 3) return parsed;
    } catch {}
  }

  throw new Error('Inference Offline: Connect local Ollama (http://localhost:11434), LM Studio (http://localhost:1234), or enter an API key in Settings to synthesize story branches.');
}

export async function expandBranchIntoProse(currentContent, branch) {
  const words = (currentContent || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).slice(-150).join(' ');
  const prompt = `We are continuing this story:\n"${words}"\n\nThe author chooses this continuation: "${branch.title}: ${branch.summary}".\n\nWrite 2 rich, atmospheric paragraphs (around 120-180 words) describing this scene unfolding seamlessly. Use evocative sensory prose. Return ONLY the narrative prose.`;

  const aiOutput = await queryLocalInference(prompt);
  if (aiOutput) {
    return aiOutput.trim();
  }

  throw new Error('Inference Offline: Unable to expand branch into narrative prose. Verify Ollama, LM Studio, or Cloud AI settings.');
}

// ── 4. Guided "Craft Complete Story" Wizard ──────────────────────────────────

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
  "chapter1Prose": "HTML formatted first chapter (3 paragraphs)"
}`;

  const aiOutput = await queryLocalInference(prompt, 'You are an award-winning novelist and master worldbuilder.');
  if (aiOutput) {
    try {
      const parsed = JSON.parse(aiOutput.replace(/```json|```/g, '').trim());
      if (parsed && parsed.title && parsed.chapter1Prose) return parsed;
    } catch {}
  }

  throw new Error('Inference Offline: Story drafting requires an active model. Start Ollama, LM Studio, or configure BYOK in Settings.');
}

// ── 5. Style Transformations ────────────────────────────────────────────────

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
  const aiOutput = await queryLocalInference(prompt);
  if (aiOutput) return aiOutput.trim();

  throw new Error('Inference Offline: Style transformation requires an active local or cloud AI model.');
}
