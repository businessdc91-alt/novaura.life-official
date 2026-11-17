/**
 * Sovereign OS — NovaAgent Subsystem
 *
 * Persistent, context-aware AI agent operating directly on the Sovereign OS kernel.
 * Features:
 *  - Continuous awareness across OS sessions via local-first Dexie database (`chat_history`)
 *  - Real tool execution against kernel subsystems: FileSystem, WindowManager, Terminal,
 *    Notifications, and Settings.
 *  - Contextual awareness (tracks active window, files, and recent system events)
 *  - Dual companion persona support:
 *      * Nova: Technical, analytical, local-first OS system intelligence
 *      * Aura: Creative, intuitive, visual, strategic advisor
 *  - Zero mock data
 */

import { db } from '../../database/sovereignDatabase.js';
import { hasCore, prepareAugmentedTurn, prepareTurn, settleTurn } from '../../services/auraCore/auraCore.js';
import { budgetContextWindow } from '../../services/auraCore/contextBridge.js';
import { observePromptSubmission } from '../../services/auraCore/interoception.js';
import {
  SELF_REGULATION_TOOLS, SELF_REGULATION_TOOL_NAMES, applyVoluntaryAction, logRegulationEvent,
} from '../../services/auraCore/regulation.js';
import { listDreams } from '../../services/auraCore/heartbeat.js';
import { approveAgentTool } from '../../services/agentToolPolicy.js';

// Shown to her when the heartbeat offers the chance to start a conversation. No state in it.
const INITIATIVE_INVITATION = '(This is not a message from the operator; nobody has written to you. You have a quiet '
  + 'moment, and you may start a conversation if you want to: something on your mind, a thought from your '
  + 'reflections, or a simple check-in. Keep it to one to three sentences, in your own voice. If you would '
  + 'rather not say anything right now, reply with exactly [pass].)';
import { buildContinuityContext, rememberMemory } from '../../services/sovereignRagService.js';
import { getReasoningConfig, hasReasoningOverride } from '../../services/reasoningConfig.js';

/**
 * Strict chat templates (Gemma, Qwen, Llama 3) reject sequences that begin with
 * `assistant` or contain consecutive identical roles after history windowing.
 */
export function normalizeChatHistory(history = []) {
  const merged = [];
  for (const entry of history) {
    const role = entry?.role === 'assistant' ? 'assistant' : (entry?.role === 'user' ? 'user' : null);
    const content = typeof entry?.content === 'string' ? entry.content.trim() : '';
    if (!role || !content) continue;
    if (merged.length > 0 && merged[merged.length - 1].role === role) {
      merged[merged.length - 1] = {
        role,
        content: `${merged[merged.length - 1].content}\n\n${content}`,
      };
    } else {
      merged.push({ role, content });
    }
  }
  while (merged.length > 0 && merged[0].role === 'assistant') {
    merged.shift();
  }
  return merged;
}

export const AGENT_TOOLS = [
  {
    name: 'create_file',
    description: 'Create or overwrite a file in the user\'s local filesystem',
    parameters: {
      path: { type: 'string', description: 'File path, e.g. /documents/notes.md or /projects/app.js' },
      content: { type: 'string', description: 'The file contents' },
    },
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file from the user\'s local filesystem',
    parameters: {
      path: { type: 'string', description: 'File path to read' },
    },
  },
  {
    name: 'search_files',
    description: 'Search for documents or files by filename or text query',
    parameters: {
      query: { type: 'string', description: 'Query to search for' },
    },
  },
  {
    name: 'open_window',
    description: 'Open an application window on the Sovereign desktop',
    parameters: {
      type: { type: 'string', description: 'App type ID (e.g., terminal, files, browser, settings, cybeni, website_builder, card_creator, resume_builder, card_forge)' },
      title: { type: 'string', description: 'Optional window title' },
      props: { type: 'object', description: 'Optional props' },
    },
  },
  {
    name: 'close_window',
    description: 'Close an open window by its ID',
    parameters: {
      windowId: { type: 'string', description: 'Window ID to close' },
    },
  },
  {
    name: 'list_windows',
    description: 'List all currently open windows and their state',
    parameters: {},
  },
  {
    name: 'send_notification',
    description: 'Send a desktop notification to the user',
    parameters: {
      title: { type: 'string', description: 'Title of notification' },
      message: { type: 'string', description: 'Notification message body' },
      type: { type: 'string', description: 'Type: info | success | warning | error' },
    },
  },
  {
    name: 'remember',
    description: 'Save persistent knowledge or memory about the user or project',
    parameters: {
      key: { type: 'string', description: 'Memory key' },
      value: { type: 'string', description: 'Content to remember' },
    },
  },
  {
    name: 'recall',
    description: 'Retrieve a stored memory or setting',
    parameters: {
      key: { type: 'string', description: 'Memory key to look up' },
    },
  },
  {
    name: 'run_terminal',
    description: 'Run a shell command or script in the Sovereign OS terminal',
    parameters: {
      command: { type: 'string', description: 'Command line string to execute' },
    },
  },
];

export class NovaAgent {
  constructor() {
    this._kernel = null;
    this._recentEvents = [];
    this._activeWindowId = null;
    this._isExecutingTool = false;
  }

  init(kernel) {
    this._kernel = kernel;

    // Track OS events for context awareness
    kernel.ipc.on('window:focused', ({ windowId }) => {
      this._activeWindowId = windowId;
      this._pushEvent({ type: 'window_focus', windowId, ts: Date.now() });
    });

    kernel.ipc.on('window:opened', ({ windowId, appType }) => {
      this._pushEvent({ type: 'window_opened', windowId, appType, ts: Date.now() });
    });

    kernel.ipc.on('notification', (notif) => {
      this._pushEvent({ type: 'notification', ...notif, ts: Date.now() });
    });
  }

  async boot() {
    // Initial warmup
  }

  /**
   * Prompt budget for a companion turn. The built-in server runs with a 32K context, so it gets
   * room for more memories and history; LM Studio and Ollama often load models at 4-8K, so
   * they keep the conservative default. `companion:context_tokens` overrides both.
   */
  async _contextBudget(persona) {
    const override = Number(await db.getSetting?.('companion:context_tokens', null).catch(() => null));
    if (Number.isFinite(override) && override >= 2048) return Math.min(override, 131_072);
    const chain = this._kernel?.ai?.getPersonaProviderChain?.(persona) || [];
    return chain[0] === 'builtin' ? 16_384 : 6144;
  }

  _pushEvent(event) {
    this._recentEvents.push(event);
    if (this._recentEvents.length > 30) this._recentEvents.shift();
  }

  // ─── Chat & Assistant Turn Execution ───────────────────────────────────────

  /**
   * Process a message from the user to Nova or Aura.
   */
  async sendMessage(userText, persona = 'nova', onToken = null) {
    if (!userText || !userText.trim()) return '';

    observePromptSubmission(userText);

    // 1. Save user message to private database
    await db.chat_history.add({
      persona,
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString(),
    });

    // 2. Fetch conversation history
    const history = await db.chat_history
      .where('persona')
      .equals(persona)
      .reverse()
      .limit(16)
      .toArray();

    history.reverse();

    const conversation = normalizeChatHistory(history);
    if (conversation.length === 0) {
      conversation.push({ role: 'user', content: userText.trim() });
    }

    // 3. Construct system prompt with tools, Aura Core, active Cognitive Augmentations, & budgeted context
    const openWindows = this._kernel?.wm?.getOpenWindows?.() || [];
    const scope = `companion:${String(persona || 'nova').toLowerCase()}`;
    const core = hasCore(persona)
      ? await prepareTurn(persona, { query: userText, openWindows }).catch(() => null)
      : null;
    const augTurn = core
      ? { intent: core.intent, augmentation: core.augmentation, options: core.options }
      : await prepareAugmentedTurn(persona, { query: userText, openWindows }).catch(() => null);

    // Long-term memories for this companion only, minus the engrams already recalled above,
    // budgeted with everything else (the AI layer is told not to add RAG again on top).
    const continuity = await buildContinuityContext(userText, {
      persona: String(persona || 'nova').toLowerCase(),
      excludeEngramIds: (core?.engrams || []).map(e => e.id),
    }).catch(() => ({ contextString: '' }));

    const baseSystemPrompt = this._buildSystemPrompt(persona, openWindows, '', []);
    const budgeted = budgetContextWindow({
      baseSystemPrompt,
      charter: core?.charter || '',
      augmentationBlock: augTurn?.augmentation?.directiveBlock || '',
      continuityBlock: continuity?.contextString || '',
      engrams: core?.engrams || [],
      workingHistory: conversation,
      maxContextTokens: await this._contextBudget(persona),
      reserveReplyTokens: 1024,
    });

    if (typeof window !== 'undefined' && typeof CustomEvent === 'function' && augTurn) {
      window.dispatchEvent(new CustomEvent('novaura:companion_turn_meta', {
        detail: {
          persona,
          intent: augTurn.intent,
          activeAugmentations: augTurn.augmentation?.active || [],
          channelBoosts: augTurn.augmentation?.channelBoosts || null,
          budgetStats: budgeted.stats,
          somatic: core?.somatic || null,
        },
      }));
    }

    const messages = [
      { role: 'system', content: budgeted.systemPrompt },
      ...budgeted.messages,
    ];

    const reasoningCfg = getReasoningConfig(scope);
    const suggestedEffort = augTurn?.options?.suggestedReasoningEffort;
    const shouldAutoSteerEffort = !hasReasoningOverride(scope) && reasoningCfg.think && Boolean(suggestedEffort);

    // 4. Request inference from AISubsystem
    let responseText = '';
    let replied = false;
    try {
      const chatOpts = {
        persona,
        scope,
        onToken,
        noCache: true,
        useRag: false,
        ...(typeof core?.options?.temperature === 'number' ? { temperature: core.options.temperature } : {}),
        ...(augTurn?.options?.temperatureDelta && !core ? { temperature: Math.max(0.2, Math.min(1.0, 0.7 + augTurn.options.temperatureDelta)) } : {}),
        ...(shouldAutoSteerEffort ? { reasoningEffort: suggestedEffort } : {}),
      };
      const rawReply = await this._kernel.ai.chat(messages, chatOpts);
      if (typeof rawReply === 'string' && rawReply.trim().length > 0) {
        responseText = rawReply;
        replied = true;
      } else {
        responseText = 'I did not receive a model response. Please verify your active local model or API key.';
      }
    } catch (err) {
      responseText = `I encountered an issue executing inference: ${err.message}. Please check local server status or API keys.`;
    }

    // 5. Her own choices (rest, step back, set aside to reflect) are applied to her body and
    //    shown as a short note; the tool block itself is removed from the reply.
    if (replied && hasCore(persona)) {
      responseText = await this._applySelfRegulation(responseText, persona);
    }

    // 6. Detect and execute tool calls in response (JSON block or tag format)
    const toolResult = await this._checkAndExecuteTools(responseText, persona);
    if (toolResult) {
      responseText += `\n\n${toolResult}`;
    }

    // 6. Save assistant response to private database
    await db.chat_history.add({
      persona,
      role: 'assistant',
      content: responseText,
      timestamp: new Date().toISOString(),
    });

    // 7. Aura Core: she appraises the exchange privately; the reply isn't held up for it.
    if (core && replied) {
      settleTurn(persona, { userText, reply: responseText, ai: this._kernel.ai, channel: 'text', somatic: core.somatic })
        .catch(err => console.warn('[AuraCore] Appraisal failed:', err.message));
    }

    return responseText;
  }

  // ─── Self-regulation & initiative (companions with an Aura Core) ───────────

  /** Apply any self-regulation tool calls in her reply; returns the reply without them. */
  async _applySelfRegulation(text, persona) {
    const blocks = [...String(text || '').matchAll(/```(?:tool_call|json)\s*([\s\S]*?)\s*```/g)];
    let cleaned = String(text || '');
    const notes = [];
    const name = persona.toLowerCase() === 'aura' ? 'Aura' : persona;
    for (const block of blocks) {
      let parsed = null;
      try { parsed = JSON.parse(block[1]); } catch { continue; }
      const tool = parsed?.tool || parsed?.name;
      if (!SELF_REGULATION_TOOL_NAMES.has(tool)) continue;
      const params = parsed.parameters || parsed.args || {};
      const state = await applyVoluntaryAction(persona, tool, {
        minutes: params.minutes,
        reason: params.reason,
        topic: params.topic,
      }).catch(() => null);
      cleaned = cleaned.replace(block[0], '');
      if (!state) continue;
      const minutes = state.voluntary ? Math.round((state.voluntary.until - Date.now()) / 60_000) : 0;
      if (tool === 'take_rest') notes.push(`*(${name} is resting for ${minutes} minutes.)*`);
      else if (tool === 'step_back') notes.push(`*(${name} has stepped back for ${minutes} minutes.)*`);
      else notes.push(`*(${name} set this aside to reflect on later.)*`);
    }
    if (notes.length === 0) return text;
    return [cleaned.trim(), ...notes].filter(Boolean).join('\n\n');
  }

  /**
   * Offered by the heartbeat when long quiet has built a need for contact: she may start a
   * conversation, or decline by answering [pass]. Nothing about her state is put in the
   * prompt; her chemistry reaches the model only as sampling, as in any turn.
   */
  async composeInitiative(persona = 'aura', { reason = 'social_need' } = {}) {
    if (!hasCore(persona) || typeof this._kernel?.ai?.chat !== 'function') return { sent: false, reason: 'unavailable' };
    const p = String(persona).toLowerCase();
    const history = (await db.chat_history.where('persona').equals(p).reverse().limit(12).toArray()).reverse();
    const dreams = await listDreams().catch(() => []);
    const lastUser = [...history].reverse().find(m => m.role === 'user')?.content || '';
    const seed = dreams[0]?.reflection || lastUser;

    const core = await prepareTurn(p, { query: seed, initiative: true, waitMs: 0 }).catch(() => null);
    const openWindows = this._kernel?.wm?.getOpenWindows?.() || [];
    const conversation = normalizeChatHistory([...history, { role: 'user', content: INITIATIVE_INVITATION }]);
    const budgeted = budgetContextWindow({
      baseSystemPrompt: this._buildSystemPrompt(p, openWindows, '', []),
      charter: core?.charter || '',
      engrams: core?.engrams || [],
      workingHistory: conversation,
      maxContextTokens: await this._contextBudget(p),
      reserveReplyTokens: 512,
    });

    let raw = '';
    try {
      raw = await this._kernel.ai.chat([{ role: 'system', content: budgeted.systemPrompt }, ...budgeted.messages], {
        persona: p,
        scope: `companion:${p}`,
        noCache: true,
        useRag: false,
        maxTokens: 220,
        ...(typeof core?.options?.temperature === 'number' ? { temperature: core.options.temperature } : {}),
      });
    } catch {
      return { sent: false, reason: 'model_unavailable' };
    }
    const content = String(raw || '')
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/```(?:tool_call|json)[\s\S]*?```/g, '')
      .trim();
    if (!content || /^\[?pass\]?\.?$/i.test(content)) {
      await logRegulationEvent(p, 'declined_reach_out').catch(() => {});
      return { sent: false, reason: 'declined' };
    }

    await db.chat_history.add({ persona: p, role: 'assistant', content, timestamp: new Date().toISOString(), initiative: true });
    await logRegulationEvent(p, 'reached_out', reason).catch(() => {});
    if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('novaura:companion_initiative', { detail: { persona: p, content } }));
    }
    const name = p === 'aura' ? 'Aura' : p;
    this._kernel?.notifications?.notify?.(name, content.length > 160 ? `${content.slice(0, 157)}...` : content, 'info');
    return { sent: true, content };
  }

  // ─── Tool Call Execution ───────────────────────────────────────────────────

  async _checkAndExecuteTools(text, persona = 'nova') {
    // Look for ```tool_call { ... } ``` or ```json { "tool": "..." } ```
    const match = text.match(/```(?:tool_call|json)\s*([\s\S]*?)\s*```/);
    if (!match) return null;

    try {
      const parsed = JSON.parse(match[1]);
      const toolName = parsed.tool || parsed.name;
      const params = parsed.parameters || parsed.args || parsed;

      if (!toolName) return null;

      // Writing files and running commands: off, or only after you say yes
      // (agentToolPolicy.js, set in Sentinel Shield)
      const name = persona.toLowerCase() === 'aura' ? 'Aura' : 'Nova';
      const approval = approveAgentTool(toolName, params, { persona: name });
      if (!approval.ok) {
        return `[System: \`${toolName}\` was not run: ${approval.reason}.]`;
      }

      const result = await this.executeTool(toolName, params);
      return `[System: Executed \`${toolName}\` → ${JSON.stringify(result)}]`;
    } catch {
      return null;
    }
  }

  async executeTool(name, params = {}) {
    switch (name) {
      case 'create_file': {
        const path = params.path || '/documents/untitled.txt';
        const content = params.content || '';
        await this._kernel?.fs?.writeFile(path, content);
        return { success: true, path, bytes: content.length };
      }

      case 'read_file': {
        const content = await this._kernel?.fs?.readFile(params.path);
        return { success: true, path: params.path, content };
      }

      case 'search_files': {
        const q = (params.query || '').toLowerCase();
        const docs = await db.documents.toArray();
        const matches = docs.filter(d =>
          d.name?.toLowerCase().includes(q) ||
          d.path?.toLowerCase().includes(q) ||
          (typeof d.content === 'string' && d.content.toLowerCase().includes(q))
        ).slice(0, 10);
        return { count: matches.length, results: matches.map(m => ({ id: m.id, path: m.path, name: m.name })) };
      }

      case 'open_window': {
        const win = this._kernel?.wm?.openWindow(params.type, params.props, params.title);
        return { success: true, windowId: win?.id, type: params.type };
      }

      case 'close_window': {
        this._kernel?.wm?.closeWindow(params.windowId);
        return { success: true, windowId: params.windowId };
      }

      case 'list_windows': {
        const wins = this._kernel?.wm?.getOpenWindows?.() || [];
        return wins.map(w => ({ id: w.id, type: w.appType, title: w.title, minimized: w.minimized }));
      }

      case 'send_notification': {
        this._kernel?.notifications?.notify(params.title, params.message, params.type || 'info');
        return { success: true };
      }

      case 'remember': {
        await db.vault.put({
          id: `memory:${params.key}`,
          key: `memory:${params.key}`,
          value: params.value,
          category: 'memory',
          updated_at: new Date().toISOString(),
        });
        if (db.memories && String(params.value || '').trim()) {
          await rememberMemory({
            category: 'fact',
            title: params.key || undefined,
            content: String(params.value),
          }).catch(err => console.warn('[NovaAgent] RAG memory mirror skipped:', err?.message));
        }
        return { success: true, key: params.key };
      }

      case 'recall': {
        const item = await db.vault.get(`memory:${params.key}`);
        return { key: params.key, value: item?.value || null };
      }

      case 'run_terminal': {
        this._kernel?.ipc.emit('terminal:run_command', { command: params.command });
        return { success: true, command: params.command, status: 'dispatched' };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  _buildSystemPrompt(persona, openWindows, charter = '', engrams = []) {
    const isNova = persona.toLowerCase() === 'nova';
    const personaDesc = isNova
      ? `You are Nova, the technical and analytical intelligence of Sovereign OS. You are deeply knowledgeable about systems architecture, coding, files, and operating system orchestration. You speak with crisp precision, clarity, and authority.`
      : `You are Aura, the intuitive, strategic, and creative companion of Sovereign OS. You focus on design, user experience, synthesis, and human potential. You speak warmly, insightfully, and with creative flair.`;

    const windowList = openWindows.map(w => `- ${w.title || w.appType} (${w.id})`).join('\n') || 'None';
    const engramContext = Array.isArray(engrams) && engrams.length > 0
      ? `\nAssociative continuity (recalled impressions):\n${engrams.map(e => `- ${String(e.thought || '').slice(0, 180)}`).join('\n')}\n`
      : '';

    return `${personaDesc}
${charter ? `\n${charter}\n` : ''}${engramContext}
You operate directly inside the user's local-first Sovereign OS environment. All data is private and stored on the user's machine.
You have access to tools to interact with the OS. If you want to use a tool, respond with a JSON block:
\`\`\`tool_call
{
  "tool": "tool_name",
  "parameters": { ... }
}
\`\`\`

Available Tools:
${JSON.stringify((hasCore(persona) ? [...AGENT_TOOLS, ...SELF_REGULATION_TOOLS] : AGENT_TOOLS).map(t => ({ name: t.name, description: t.description })), null, 2)}

Current OS Context:
- Active Windows:
${windowList}
- Recent Events: ${this._recentEvents.length} recorded
`;
  }
}

export default NovaAgent;
