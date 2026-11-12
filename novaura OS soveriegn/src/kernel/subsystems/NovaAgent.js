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
import { hasCore, prepareTurn, settleTurn } from '../../services/auraCore/auraCore.js';
import { approveAgentTool } from '../../services/agentToolPolicy.js';

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

    // 3. Construct system prompt with tools and context
    const openWindows = this._kernel?.wm?.getOpenWindows?.() || [];
    // Aura Core: her chemistry shapes how she is sampled; it is never put into words.
    const core = hasCore(persona) ? await prepareTurn(persona).catch(() => null) : null;
    const systemPrompt = this._buildSystemPrompt(persona, openWindows, core?.charter);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
    ];

    // 4. Request inference from AISubsystem
    let responseText = '';
    let replied = false;
    try {
      responseText = await this._kernel.ai.chat(messages, {
        persona,
        onToken,
        ...core?.options,
      });
      replied = true;
    } catch (err) {
      responseText = `I encountered an issue executing inference: ${err.message}. Please check local server status or API keys.`;
    }

    // 5. Detect and execute tool calls in response (JSON block or tag format)
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
      settleTurn(persona, { userText, reply: responseText, ai: this._kernel.ai })
        .catch(err => console.warn('[AuraCore] Appraisal failed:', err.message));
    }

    return responseText;
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

  _buildSystemPrompt(persona, openWindows, charter = '') {
    const isNova = persona.toLowerCase() === 'nova';
    const personaDesc = isNova
      ? `You are Nova, the technical and analytical intelligence of Sovereign OS. You are deeply knowledgeable about systems architecture, coding, files, and operating system orchestration. You speak with crisp precision, clarity, and authority.`
      : `You are Aura, the intuitive, strategic, and creative companion of Sovereign OS. You focus on design, user experience, synthesis, and human potential. You speak warmly, insightfully, and with creative flair.`;

    const windowList = openWindows.map(w => `- ${w.title || w.appType} (${w.id})`).join('\n') || 'None';

    return `${personaDesc}
${charter ? `\n${charter}\n` : ''}
You operate directly inside the user's local-first Sovereign OS environment. All data is private and stored on the user's machine.
You have access to tools to interact with the OS. If you want to use a tool, respond with a JSON block:
\`\`\`tool_call
{
  "tool": "tool_name",
  "parameters": { ... }
}
\`\`\`

Available Tools:
${JSON.stringify(AGENT_TOOLS.map(t => ({ name: t.name, description: t.description })), null, 2)}

Current OS Context:
- Active Windows:
${windowList}
- Recent Events: ${this._recentEvents.length} recorded
`;
  }
}

export default NovaAgent;
