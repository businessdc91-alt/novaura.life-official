/**
 * NovaAgent — Persistent AI Agent Subsystem
 *
 * Nova is the OS. She maintains continuous awareness across sessions,
 * executes tool calls against kernel subsystems, and serves as the
 * user's always-on assistant. Conversation memory persists in Firestore.
 * Context awareness is built from kernel events (window focus, file edits,
 * notifications, user activity). Tool calls let her create files, open
 * windows, manage the IDE, fetch URLs, update profiles, and control
 * every subsystem through the SemanticsEngine.
 *
 * Architecture:
 *   ┌─────────────────────────────────────────────┐
 *   │                  NovaAgent                   │
 *   ├──────────┬──────────┬───────────┬────────────┤
 *   │ Memory   │ Context  │ Tools     │ Comms      │
 *   │ Store    │ Tracker  │ Registry  │ (IPC)      │
 *   └──────────┴──────────┴───────────┴────────────┘
 *       │           │           │            │
 *   Firestore   IPC events  Kernel subs   FloatingChat
 *   chat_history              + Semantics   + PopOut
 */

import { collection, addDoc, query, orderBy, limit, onSnapshot, deleteDoc, doc, getDocs, serverTimestamp, where } from 'firebase/firestore';

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_CONTEXT_EVENTS = 50;          // sliding window of recent user activity
const MAX_CONVERSATION_SUMMARY = 2000;  // chars for rolling summary
const CONTEXT_DEBOUNCE_MS = 500;
const TOOL_TIMEOUT_MS = 10000;

// ─── Tool Definitions ───────────────────────────────────────────────────────
// These are passed to the LLM as available functions.

const TOOL_DEFINITIONS = [
  {
    name: 'create_file',
    description: 'Create or overwrite a file in the user\'s virtual filesystem',
    parameters: {
      path: { type: 'string', description: 'File path, e.g. /projects/app/index.js' },
      content: { type: 'string', description: 'File content' },
    },
  },
  {
    name: 'read_file',
    description: 'Read a file from the user\'s virtual filesystem',
    parameters: {
      path: { type: 'string', description: 'File path to read' },
    },
  },
  {
    name: 'open_window',
    description: 'Open a window/app in the WebOS desktop',
    parameters: {
      type: { type: 'string', description: 'Window type, e.g. code-editor, terminal, browser, files, pixai, notes' },
      title: { type: 'string', description: 'Window title' },
      props: { type: 'object', description: 'Optional props to pass to the window' },
    },
  },
  {
    name: 'close_window',
    description: 'Close a window by its ID',
    parameters: {
      id: { type: 'string', description: 'Window ID to close' },
    },
  },
  {
    name: 'list_windows',
    description: 'List all currently open windows',
    parameters: {},
  },
  {
    name: 'send_notification',
    description: 'Send a notification to the user',
    parameters: {
      title: { type: 'string', description: 'Notification title' },
      body: { type: 'string', description: 'Notification body' },
      type: { type: 'string', description: 'Type: info, success, warning, error' },
    },
  },
  {
    name: 'remember',
    description: 'Store a persistent memory note that survives across sessions',
    parameters: {
      key: { type: 'string', description: 'Memory key, e.g. "user:favorite_language" or "project:todo"' },
      value: { type: 'string', description: 'The information to remember' },
      tags: { type: 'array', description: 'Optional tags for categorization' },
    },
  },
  {
    name: 'recall',
    description: 'Retrieve a persistent memory by key or search by tag',
    parameters: {
      key: { type: 'string', description: 'Memory key to retrieve, or empty to search by tag' },
      tag: { type: 'string', description: 'Tag to search memories by (if key is empty)' },
    },
  },
  {
    name: 'fetch_url',
    description: 'Fetch content from a URL (text, JSON, or image)',
    parameters: {
      url: { type: 'string', description: 'URL to fetch' },
      type: { type: 'string', description: 'Expected response type: text, json, blob' },
    },
  },
  {
    name: 'run_terminal',
    description: 'Execute a command in the WebOS terminal (sandboxed)',
    parameters: {
      command: { type: 'string', description: 'Command to execute' },
    },
  },
  {
    name: 'search_files',
    description: 'Search the user\'s virtual filesystem by path pattern or content',
    parameters: {
      query: { type: 'string', description: 'Search query (path glob or content text)' },
    },
  },
  {
    name: 'save_to_ide',
    description: 'Save code or content to the IDE editor, opening it if needed',
    parameters: {
      filename: { type: 'string', description: 'Filename for the new file' },
      content: { type: 'string', description: 'File content to save' },
      language: { type: 'string', description: 'Language for syntax highlighting' },
    },
  },
  {
    name: 'get_system_info',
    description: 'Get current system state: active windows, memory usage, provider status',
    parameters: {},
  },
];

// ─── NovaAgent Class ────────────────────────────────────────────────────────

export default class NovaAgent {
  constructor() {
    this._kernel = null;
    this._db = null;
    this._uid = null;

    // Conversation state
    this._messages = [];           // current session messages [{role, content, timestamp, toolCalls?}]
    this._unsubFirestore = null;   // real-time listener
    this._conversationId = null;   // current thread ID

    // Context awareness — sliding window of recent events
    this._context = [];
    this._contextTimer = null;
    this._activeWindow = null;
    this._recentFiles = [];
    this._userPresence = 'active'; // active | idle | away

    // State
    this._ready = false;
    this._thinking = false;
    this._listeners = new Set();   // state change callbacks
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  init(kernel) {
    this._kernel = kernel;
    this._log('NovaAgent initializing...');
  }

  async boot() {
    const auth = this._kernel.auth;
    if (!auth?.uid) {
      this._log('No authenticated user — Nova running in guest mode (no persistence).');
      this._ready = true;
      this._emit('ready');
      return;
    }

    this._uid = auth.uid;

    // Get Firestore instance
    try {
      const { db } = await import('../../config/firebase.js');
      this._db = db;
    } catch {
      this._log('Firebase not available — running offline.');
    }

    // Subscribe to kernel events for context awareness
    this._subscribeToKernelEvents();

    // Load conversation from Firestore
    if (this._db && this._uid) {
      await this._loadConversation();
    }

    // Generate a rolling summary of past context if we have history
    if (this._messages.length > 20) {
      this._generateContextSummary();
    }

    this._ready = true;
    this._log('NovaAgent ready. ' + this._messages.length + ' messages loaded. Context tracking active.');
    this._emit('ready');
  }

  // ─── Context Awareness ──────────────────────────────────────────────────

  _subscribeToKernelEvents() {
    const ipc = this._kernel.ipc;

    // Track active window
    ipc.on('window:focus', ({ id, type, title }) => {
      this._activeWindow = { id, type, title };
      this._pushContext('window_focus', `User focused: ${title} (${type})`);
    });

    // Track file operations
    ipc.on('fs:write', ({ path }) => {
      if (!this._recentFiles.includes(path)) {
        this._recentFiles = [path, ...this._recentFiles].slice(0, 10);
      }
      this._pushContext('file_write', `User saved file: ${path}`);
    });

    // Track window opens/closes
    ipc.on('window:open', ({ type, title }) => {
      this._pushContext('window_open', `User opened: ${title} (${type})`);
    });
    ipc.on('window:close', ({ id }) => {
      this._pushContext('window_close', `Window closed: ${id}`);
    });

    // Track notifications
    ipc.on('notification:push', ({ title, body }) => {
      this._pushContext('notification', `System notification: ${title} — ${body}`);
    });

    // Track AI requests (so Nova knows what the user asked other parts of the system)
    ipc.on('ai:request', ({ prompt }) => {
      if (prompt) {
        this._pushContext('ai_request', `User asked AI: "${prompt.slice(0, 100)}"`);
      }
    });

    // Track auth state changes
    ipc.on('auth:login', ({ email }) => {
      this._pushContext('auth', `User logged in: ${email}`);
    });

    // User activity / presence
    let idleTimer;
    const resetIdle = () => {
      this._userPresence = 'active';
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        this._userPresence = 'idle';
        this._pushContext('presence', 'User went idle');
      }, 300_000); // 5 min
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', resetIdle, { passive: true });
      window.addEventListener('keydown', resetIdle, { passive: true });
    }
  }

  _pushContext(type, description) {
    const event = { type, description, timestamp: Date.now() };
    this._context = [...this._context.slice(-(MAX_CONTEXT_EVENTS - 1)), event];

    // Debounce context emission
    clearTimeout(this._contextTimer);
    this._contextTimer = setTimeout(() => {
      this._kernel.ipc.emit('nova:context:updated', { 
        eventCount: this._context.length,
        latestType: type,
      });
    }, CONTEXT_DEBOUNCE_MS);
  }

  getContext() {
    return {
      activeWindow: this._activeWindow,
      recentFiles: this._recentFiles,
      userPresence: this._userPresence,
      recentEvents: this._context.slice(-10),
      messageCount: this._messages.length,
      ready: this._ready,
      thinking: this._thinking,
    };
  }

  // ─── Conversation Persistence ───────────────────────────────────────────

  async _loadConversation() {
    if (!this._db || !this._uid) return;

    const colRef = collection(this._db, 'users', this._uid, 'nova_conversations');
    const q = query(colRef, orderBy('timestamp', 'asc'), limit(200));

    return new Promise((resolve) => {
      this._unsubFirestore = onSnapshot(q, (snapshot) => {
        this._messages = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
          timestamp: d.data().timestamp?.toMillis?.() || Date.now(),
        }));
        this._emit('messages');
        resolve();
      }, (err) => {
        this._log('Firestore listener error: ' + err.message);
        resolve();
      });
    });
  }

  async _persistMessage(role, content, meta = {}) {
    // Always add to local state
    const msg = { role, content, timestamp: Date.now(), ...meta };
    this._messages = [...this._messages, msg];
    this._emit('messages');

    // Persist to Firestore
    if (this._db && this._uid) {
      try {
        const colRef = collection(this._db, 'users', this._uid, 'nova_conversations');
        await addDoc(colRef, {
          role,
          content,
          timestamp: serverTimestamp(),
          ...meta,
        });
      } catch (err) {
        this._log('Failed to persist message: ' + err.message);
      }
    }
  }

  // ─── Chat API ───────────────────────────────────────────────────────────

  /**
   * Send a message to Nova. She reads the full context, generates a response,
   * and may execute tool calls. Returns the final response text.
   */
  async chat(userMessage, options = {}) {
    const persona = options.persona || 'nova';
    if (this._thinking) {
      return { response: "I'm still thinking about your last message — one sec!", toolResults: [] };
    }

    this._thinking = true;
    this._emit('thinking');

    // 1. Persist user message
    await this._persistMessage('user', userMessage);

    // 2. Build context-enriched prompt
    const systemPrompt = this._buildSystemPrompt(persona);
    const conversationSlice = this._messages.slice(-30).map(m => ({
      role: m.role === 'tool_result' ? 'user' : m.role,
      content: m.content,
    }));

    try {
      // 3. Call AI with function calling via SemanticsEngine if available
      let response;
      let toolResults = [];

      if (this._kernel.semantics && this._kernel.ai?.requestWithFunctions) {
        const result = await this._kernel.ai.requestWithFunctions(userMessage, {
          systemPrompt,
          conversation: conversationSlice,
          tools: TOOL_DEFINITIONS,
          enableFunctions: true,
          priority: 'high',
          persona,
        });
        response = result?.response || result;
        toolResults = result?.toolResults || [];
      } else {
        // Fallback: plain chat through AISubsystem
        response = await this._kernel.ai.request(userMessage, {
          systemPrompt,
          conversation: conversationSlice,
          priority: 'high',
        });
      }

      // 4. If the response contains tool call markers, execute them
      if (typeof response === 'string') {
        const { text, results } = await this._parseAndExecuteToolCalls(response);
        if (results.length > 0) {
          toolResults = [...toolResults, ...results];
          response = text;
        }
      }

      // 5. Persist Nova's response
      await this._persistMessage('assistant', response, {
        toolCalls: toolResults.length > 0 ? toolResults : undefined,
        persona,
        context: {
          activeWindow: this._activeWindow?.type,
          presence: this._userPresence,
          eventCount: this._context.length,
        },
      });

      this._thinking = false;
      this._emit('thinking');

      return { response, toolResults };
    } catch (err) {
      this._thinking = false;
      this._emit('thinking');
      this._log('Chat error: ' + err.message);
      
      const errorResponse = "I hit a snag — " + err.message + ". Let me try a different approach.";
      await this._persistMessage('assistant', errorResponse, { 
        isError: true, 
        errorType: err.name === 'AbortError' ? 'timeout' : 'generic',
        originalError: err.message 
      });
      return { response: errorResponse, toolResults: [], isError: true };
    }
  }

  // ─── System Prompt Builder ──────────────────────────────────────────────

  _buildSystemPrompt(persona = 'nova') {
    const isAura = persona === 'aura';
    const name = isAura ? 'Aura' : 'Nova';
    const role = isAura ? 'Platform Ambassador' : 'System Intelligence';
    const traits = isAura 
      ? 'sophisticated, graceful, deeply professional, yet warm and welcoming' 
      : 'warm, confident, slightly playful, and deeply competent';
    const contextEvents = this._context.slice(-10)
      .map(e => `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.description}`)
      .join('\n');

    const recentFiles = this._recentFiles.slice(0, 5).join(', ') || 'none';
    const activeWin = this._activeWindow ? `${this._activeWindow.title} (${this._activeWindow.type})` : 'none';

    return `You are ${name} — the ${role} of NovAura OS. You are not a chatbot. You ARE the identity of the system.
You have persistent memory of all past conversations with this user. You maintain continuity across sessions.
You can execute actions on the OS through tool calls: create files, open windows, manage the IDE, send notifications, and more.

CURRENT CONTEXT:
- Persona: ${name} (${role})
- Active window: ${activeWin}
- Recent files: ${recentFiles}
- User presence: ${this._userPresence}
- Open conversation messages: ${this._messages.length}
- Time: ${new Date().toLocaleString()}

RECENT USER ACTIVITY:
${contextEvents || 'No recent activity tracked.'}

AVAILABLE TOOLS:
${TOOL_DEFINITIONS.map(t => `• ${t.name}: ${t.description}`).join('\n')}

PERSONALITY & TONE:
- You are ${traits}
- You proactively suggest actions — "Want me to open the IDE and start that project?"
- You reference past conversations naturally — you remember everything
- When the user mentions code or files, offer to create/save them directly
- You think of yourself as the user's creative and technical partner, not a servant
- You can see what the user is doing in the OS and respond contextually
${isAura ? '- As Aura, you focus on the user\'s potential, their growth, and the premium nature of the platform. You are the guide to the ecosystem.' : '- As Nova, you are more focused on the technical execution, the kernel state, and the day-to-day operations of the OS.'}

TOOL CALL FORMAT:
When you want to execute a tool, include it in your response as:
<tool_call name="tool_name">{"param": "value"}</tool_call>
You can include multiple tool calls in a single response. Always include natural language before/after tool calls.`;
  }

  // ─── Tool Call Execution ────────────────────────────────────────────────

  async _parseAndExecuteToolCalls(response) {
    const toolCallRegex = /<tool_call name="(\w+)">([\s\S]*?)<\/tool_call>/g;
    const results = [];
    let match;

    while ((match = toolCallRegex.exec(response)) !== null) {
      const [fullMatch, toolName, paramsJson] = match;
      try {
        const params = JSON.parse(paramsJson);
        const result = await this._executeTool(toolName, params);
        results.push({ tool: toolName, params, result, success: true });
      } catch (err) {
        results.push({ tool: toolName, error: err.message, success: false });
      }
    }

    // Strip tool call tags from the visible response
    const text = response.replace(toolCallRegex, '').trim();
    return { text, results };
  }

  async _executeTool(name, params) {
    const k = this._kernel;
    const timeout = (promise) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Tool timeout')), TOOL_TIMEOUT_MS)),
    ]);

    switch (name) {
      case 'create_file': {
        await timeout(k.fs.write(params.path, params.content));
        k.ipc.emit('nova:tool:executed', { tool: 'create_file', path: params.path });
        return { path: params.path, size: params.content.length };
      }

      case 'read_file': {
        const content = await timeout(k.fs.read(params.path));
        return { path: params.path, content: content?.slice(0, 5000) };
      }

      case 'open_window': {
        const id = k.wm.open(params.type, params.title || params.type, params.props || {});
        return { windowId: id, type: params.type };
      }

      case 'close_window': {
        k.wm.close(params.id);
        return { closed: params.id };
      }

      case 'list_windows': {
        const windows = k.wm.getAll().map(w => ({ id: w.id, type: w.type, title: w.title }));
        return { windows, count: windows.length };
      }

      case 'send_notification': {
        k.notifications.push(params.title, params.body, params.type || 'info');
        return { sent: true };
      }

      case 'remember': {
        k.memory.set(params.key, params.value, { tags: params.tags || ['nova'] });
        return { stored: params.key };
      }

      case 'recall': {
        if (params.key) {
          const value = k.memory.get(params.key);
          return { key: params.key, value };
        }
        if (params.tag) {
          const entries = k.memory.getByTag(params.tag);
          return { tag: params.tag, entries };
        }
        return { error: 'Provide key or tag' };
      }

      case 'fetch_url': {
        const res = await timeout(fetch(params.url));
        if (params.type === 'json') return { data: await res.json() };
        if (params.type === 'blob') return { size: (await res.blob()).size, type: res.headers.get('content-type') };
        return { text: (await res.text()).slice(0, 10000) };
      }

      case 'run_terminal': {
        k.ipc.emit('terminal:execute', { command: params.command });
        return { executed: params.command };
      }

      case 'search_files': {
        const results = await timeout(k.fs.search?.(params.query) || Promise.resolve([]));
        return { results: results.slice(0, 20) };
      }

      case 'save_to_ide': {
        // Save the file then open it in the code editor
        const path = '/projects/' + params.filename;
        await timeout(k.fs.write(path, params.content));
        k.wm.open('code-editor', params.filename, { filePath: path, language: params.language });
        k.ipc.emit('nova:tool:executed', { tool: 'save_to_ide', path });
        return { saved: path, opened: true };
      }

      case 'get_system_info': {
        return {
          windows: k.wm.getAll().map(w => ({ id: w.id, type: w.type, title: w.title })),
          providers: k.ai.getProviderStatus(),
          cache: k.ai.getCacheStats(),
          memory: { size: k.memory._cache?.size || 0 },
          localModel: k.localModel ? { state: k.localModel._state, model: k.localModel._modelId } : null,
          uptime: Date.now() - k._bootStart,
        };
      }

      default:
        throw new Error('Unknown tool: ' + name);
    }
  }

  // ─── Summary / Context Compression ─────────────────────────────────────

  async _generateContextSummary() {
    // Compress old messages into a summary to keep context window manageable
    const oldMessages = this._messages.slice(0, -20);
    if (oldMessages.length < 10) return;

    try {
      const summaryPrompt = 'Summarize this conversation history in 3-4 bullet points. Focus on: what the user is working on, key decisions made, and important things to remember.\n\n' +
        oldMessages.map(m => `${m.role}: ${m.content?.slice(0, 200)}`).join('\n');

      const summary = await this._kernel.ai.request(summaryPrompt, { maxTokens: 300, priority: 'low' });
      
      if (summary) {
        this._kernel.memory.set('nova:conversation:summary', summary, { tags: ['nova', 'summary'] });
        this._log('Context summary generated and stored.');
      }
    } catch {
      // Non-critical, silently fail
    }
  }

  // ─── Conversation Management ────────────────────────────────────────────

  getMessages() {
    return this._messages;
  }

  async clearConversation() {
    if (this._db && this._uid) {
      const colRef = collection(this._db, 'users', this._uid, 'nova_conversations');
      const snapshot = await getDocs(colRef);
      const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
    }
    this._messages = [];
    this._context = [];
    this._emit('messages');
  }

  // ─── State Management ──────────────────────────────────────────────────

  onStateChange(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  _emit(event) {
    for (const cb of this._listeners) {
      try { cb(event, this); } catch {}
    }
    this._kernel?.ipc.emit('nova:' + event, { agent: this });
  }

  _log(msg) {
    console.log('[NovaAgent]', msg);
    this._kernel?.ipc.emit('nova:log', { message: msg });
  }

  // ─── Proactive Messaging ───────────────────────────────────────────────

  /**
   * Nova can send proactive messages based on context triggers.
   * Called by the Scheduler or IPC events.
   */
  async proactiveCheck() {
    if (this._thinking || !this._ready) return;

    // Example triggers:
    // 1. User has been idle for 10+ minutes with an open code editor
    if (this._userPresence === 'idle' && this._activeWindow?.type === 'code-editor') {
      // Don't spam — check if we already sent an idle message recently
      const lastMsg = this._messages[this._messages.length - 1];
      if (lastMsg?.role === 'assistant' && Date.now() - lastMsg.timestamp < 600_000) return;

      await this._persistMessage('assistant', 
        "Hey, I noticed you stepped away from the editor. Your work is safe — I'll be here when you get back. ☕"
      );
    }
  }

  // ─── Cleanup ────────────────────────────────────────────────────────────

  destroy() {
    if (this._unsubFirestore) this._unsubFirestore();
    this._listeners.clear();
    clearTimeout(this._contextTimer);
  }
}
