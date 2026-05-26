const vscode = require('vscode');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════════
//  NovAura Coding Partner — VS Code NovaAgent v1.1
//  Ports WebOS NovaAgent + AISubsystem patterns into VS Code extension context
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Configuration ────────────────────────────────────────────────────────────
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OR_REFERER = 'https://novaura.life';
const OR_TITLE = 'NovAura AI Coding Partner';

// ─── Free Model Fallback Chain ────────────────────────────────────────────────
// Tried in order until one succeeds. Pulled from live OpenRouter API + aiService.js
const FREE_MODEL_CHAIN = [
  { id: 'google/gemma-4-31b-it:free',      name: 'Nova (Gemma 4 31B)',      tier: 'persona' },
  { id: 'google/gemma-4-26b-a4b-it:free',  name: 'Aura (Gemma 4 26B MoE)',  tier: 'persona' },
  { id: 'nousresearch/hermes-3-llama-3.1-405b:free', name: 'Hermes 405B',    tier: 'reasoning' },
  { id: 'qwen/qwen3-coder:free',           name: 'Qwen3 Coder',             tier: 'code' },
  { id: 'poolside/laguna-m.1:free',        name: 'Poolside Laguna',         tier: 'code' },
  { id: 'deepseek/deepseek-v4-flash:free', name: 'DeepSeek V4 Flash',       tier: 'fast' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B',    tier: 'general' },
  { id: 'openai/gpt-oss-120b:free',        name: 'GPT-OSS 120B',            tier: 'general' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron Super',  tier: 'general' },
];

// ─── VS Code Tool Definitions (adapted from NovaAgent.js) ─────────────────────
// Passed to OpenRouter as native function calling schema
const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file in the workspace. Use relative paths from workspace root.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path, e.g. "src/App.tsx" or "package.json"' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or overwrite a file in the workspace with the given content.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path' },
          content: { type: 'string', description: 'Full file content to write' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files and folders in a directory. Defaults to workspace root.',
      parameters: {
        type: 'object',
        properties: {
          dir: { type: 'string', description: 'Relative directory path. Use "." for workspace root.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Search for files by glob pattern or content text across the workspace.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Glob pattern (e.g. "**/*.tsx") or search text' },
          byContent: { type: 'boolean', description: 'If true, search file contents instead of names' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_terminal',
      description: 'Execute a command in a VS Code integrated terminal.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to run' },
          name: { type: 'string', description: 'Optional terminal name' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_open_files',
      description: 'Get a list of currently open editor files with their language IDs.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_current_file',
      description: 'Get the content and metadata of the currently active editor file.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_edit',
      description: 'Apply an edit to the currently active file. Use this to refactor, insert, or replace code.',
      parameters: {
        type: 'object',
        properties: {
          oldText: { type: 'string', description: 'Exact text to find and replace. Use "" to insert at start.' },
          newText: { type: 'string', description: 'Replacement text' },
        },
        required: ['oldText', 'newText'],
      },
    },
  },
];

// ─── Global State ─────────────────────────────────────────────────────────────
let conversationHistory = [];
let currentModelIndex = 0;

// ═══════════════════════════════════════════════════════════════════════════════
//  ACTIVATE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('[NovAura] NovaAgent v1.1 booting...');

  const provider = new NovAuraSidebarProvider(context.extensionUri, context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('novaura-ai-sidebar', provider)
  );

  // ── Commands ───────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('novaura.synthesizeCurrentFile', () => synthesizeCurrentFile(provider)),
    vscode.commands.registerCommand('novaura.deployToFirebase', () => vscode.window.showInformationMessage('🚀 Firebase deploy coming in v1.2!')),
    vscode.commands.registerCommand('novaura.setApiKey', () => promptSetApiKey(provider)),
    vscode.commands.registerCommand('novaura.askNova', () => quickAsk(provider)),
    vscode.commands.registerCommand('novaura.clearChat', () => {
      conversationHistory = [];
      currentModelIndex = 0;
      provider.sendMessageToWebview({ type: 'clearChat' });
      vscode.window.showInformationMessage('🧹 Chat history cleared.');
    })
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  KEY RESOLUTION (adapted from keyService.ts)
//  Priority: VS Code settings → process.env → workspace .env files
// ═══════════════════════════════════════════════════════════════════════════════

async function resolveApiKey() {
  // 1. VS Code settings (user override)
  const configKey = vscode.workspace.getConfiguration('novaura').get('openrouterApiKey');
  if (configKey) return { key: configKey, source: 'settings' };

  // 2. Environment variable
  if (process.env.OPENROUTER_API_KEY) {
    return { key: process.env.OPENROUTER_API_KEY, source: 'env' };
  }

  // 3. Scan workspace .env files (platform key discovery)
  const folders = vscode.workspace.workspaceFolders;
  if (folders) {
    const envPaths = [
      '.env',
      'NovAura-WebOS/.env',
      'NovAura-WebOS/functions/.env',
      'Novaura-Ops/.env',
      'Novaura-Desktop/aura_NovaFiles/.env',
    ];
    for (const folder of folders) {
      for (const rel of envPaths) {
        const full = path.join(folder.uri.fsPath, rel);
        try {
          if (fs.existsSync(full)) {
            const content = fs.readFileSync(full, 'utf8');
            const match = content.match(/OPENROUTER_API_KEY\s*=\s*(.+)/);
            if (match) return { key: match[1].trim(), source: `workspace:${rel}` };
          }
        } catch {}
      }
    }
  }

  return null;
}

async function getApiKey() {
  const resolved = await resolveApiKey();
  return resolved?.key || null;
}

function promptForApiKey() {
  vscode.window
    .showWarningMessage('🔑 No OpenRouter API key found.', 'Set API Key', 'Get Free Key')
    .then((choice) => {
      if (choice === 'Set API Key') vscode.commands.executeCommand('novaura.setApiKey');
      else if (choice === 'Get Free Key') vscode.env.openExternal(vscode.Uri.parse('https://openrouter.ai/keys'));
    });
}

async function promptSetApiKey(provider) {
  const key = await vscode.window.showInputBox({ prompt: 'Enter your OpenRouter API key', password: true, ignoreFocusOut: true, placeHolder: 'sk-or-v1-...' });
  if (key) {
    await vscode.workspace.getConfiguration('novaura').update('openrouterApiKey', key, true);
    vscode.window.showInformationMessage('✅ OpenRouter API key saved!');
    provider.sendMessageToWebview({ type: 'status', text: 'API key configured. Nova is ready!' });
  }
}

function getSystemPrompt() {
  return (
    vscode.workspace.getConfiguration('novaura').get('systemPrompt') ||
    `You are Nova, the NovAura AI Coding Partner inside VS Code.
You can read files, write files, search the workspace, run terminal commands, and edit the active editor.
Use the provided tools proactively when the user asks about their code.
Always be concise and write clean, production-ready code.`
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TOOL EXECUTION (adapted from NovaAgent._executeTool)
//  Maps tool calls to VS Code APIs
// ═══════════════════════════════════════════════════════════════════════════════

async function executeTool(call) {
  const { name, arguments: argsJson } = call.function;
  let args = {};
  try { args = JSON.parse(argsJson || '{}'); } catch {}

  console.log(`[NovaAgent] Tool: ${name}`, args);

  switch (name) {
    case 'read_file': {
      const filePath = resolveWorkspacePath(args.path);
      if (!filePath) return { error: 'Invalid path' };
      const content = fs.readFileSync(filePath, 'utf8');
      return { path: args.path, content: content.slice(0, 15000), size: content.length };
    }

    case 'write_file': {
      const filePath = resolveWorkspacePath(args.path);
      if (!filePath) return { error: 'Invalid path' };
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, args.content, 'utf8');
      return { path: args.path, written: args.content.length };
    }

    case 'list_files': {
      const dirPath = resolveWorkspacePath(args.dir || '.') || '.';
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      return {
        dir: args.dir || '.',
        files: items.filter((i) => i.isFile()).map((i) => i.name),
        folders: items.filter((i) => i.isDirectory()).map((i) => i.name),
      };
    }

    case 'search_files': {
      if (args.byContent) {
        // Simple content search — VS Code's findFiles is for globs, so we do a basic grep
        return { error: 'Content search not yet implemented. Use glob patterns instead.' };
      }
      const files = await vscode.workspace.findFiles(args.query, '**/node_modules/**', 50);
      return { query: args.query, results: files.map((f) => vscode.workspace.asRelativePath(f)) };
    }

    case 'run_terminal': {
      const terminal = vscode.window.createTerminal(args.name || 'Nova');
      terminal.show();
      terminal.sendText(args.command);
      return { terminal: args.name || 'Nova', command: args.command };
    }

    case 'get_open_files': {
      const editors = vscode.window.visibleTextEditors;
      return {
        files: editors.map((e) => ({
          path: vscode.workspace.asRelativePath(e.document.uri),
          language: e.document.languageId,
        })),
      };
    }

    case 'get_current_file': {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return { error: 'No active editor' };
      const doc = editor.document;
      return {
        path: vscode.workspace.asRelativePath(doc.uri),
        language: doc.languageId,
        content: doc.getText().slice(0, 15000),
        selection: doc.getText(editor.selection).slice(0, 500),
      };
    }

    case 'apply_edit': {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return { error: 'No active editor' };
      const doc = editor.document;
      const fullText = doc.getText();
      const idx = fullText.indexOf(args.oldText);
      if (idx === -1) return { error: 'oldText not found in file. Ask the user to confirm the exact text.' };

      const range = new vscode.Range(doc.positionAt(idx), doc.positionAt(idx + args.oldText.length));
      const success = await editor.edit((editBuilder) => editBuilder.replace(range, args.newText));
      return { success, replaced: args.oldText.length, inserted: args.newText.length };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

function resolveWorkspacePath(relPath) {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || !relPath) return null;
  // Use first workspace folder as root
  return path.join(folders[0].uri.fsPath, relPath);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AI CHAT with Native Tool Calling + Free Model Fallback
//  Adapted from AISubsystem._raceProviders + NovaAgent.chat
// ═══════════════════════════════════════════════════════════════════════════════

async function chatWithTools(apiKey, systemPrompt, userMessage, onUpdate) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-12),
    { role: 'user', content: userMessage },
  ];

  let lastError = null;

  for (let i = currentModelIndex; i < FREE_MODEL_CHAIN.length; i++) {
    const model = FREE_MODEL_CHAIN[i];
    try {
      const response = await axios.post(
        OPENROUTER_URL,
        {
          model: model.id,
          messages,
          tools: TOOL_DEFINITIONS,
          tool_choice: 'auto',
          max_tokens: 4096,
          temperature: 0.7,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': OR_REFERER,
            'X-Title': OR_TITLE,
          },
          timeout: 60000,
        }
      );

      const msg = response.data.choices?.[0]?.message;
      if (!msg) throw new Error('Empty message');

      // ── Handle Tool Calls ──────────────────────────────────────────────────
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // Add assistant's tool_call request to history
        conversationHistory.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls });

        const results = [];
        for (const call of msg.tool_calls) {
          const result = await executeTool(call);
          results.push({ tool_call_id: call.id, role: 'tool', content: JSON.stringify(result) });
        }

        // Add tool results to history
        conversationHistory.push(...results);

        // Re-call AI with tool results for final response
        const followUpMessages = [
          { role: 'system', content: systemPrompt },
          ...conversationHistory.slice(-16),
        ];

        const followUp = await axios.post(
          OPENROUTER_URL,
          { model: model.id, messages: followUpMessages, max_tokens: 4096, temperature: 0.7 },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
              'HTTP-Referer': OR_REFERER,
              'X-Title': OR_TITLE,
            },
            timeout: 60000,
          }
        );

        const finalMsg = followUp.data.choices?.[0]?.message;
        const finalText = finalMsg?.content || '';

        conversationHistory.push({ role: 'assistant', content: finalText });
        currentModelIndex = 0;

        if (onUpdate) onUpdate({ text: finalText, done: true, model: model.name, usedTools: true });
        return { text: finalText, modelName: model.name, usedTools: true };
      }

      // ── Plain Text Response ────────────────────────────────────────────────
      const text = msg.content || '';
      if (!text.trim()) throw new Error('Empty text response');

      conversationHistory.push({ role: 'user', content: userMessage });
      conversationHistory.push({ role: 'assistant', content: text });
      currentModelIndex = 0;

      if (onUpdate) onUpdate({ text, done: true, model: model.name });
      return { text, modelName: model.name };
    } catch (err) {
      lastError = err;
      console.warn(`[AISubsystem] ${model.name} failed:`, err.message);
      if (onUpdate) onUpdate({ text: `\n[${model.name} unavailable, trying fallback...]\n`, done: false });
      continue;
    }
  }

  currentModelIndex = 0;
  const errorMsg = '❌ All free models are currently unavailable. Try again in a moment.';
  if (onUpdate) onUpdate({ text: errorMsg, done: true, error: true });
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMMAND HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

async function synthesizeCurrentFile(provider) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active file open to synthesize.');
    return;
  }

  const apiKey = await getApiKey();
  if (!apiKey) { promptForApiKey(); return; }

  const doc = editor.document;
  const text = doc.getText();
  const language = doc.languageId;
  const fileName = path.basename(doc.fileName);

  vscode.window.showInformationMessage(`Cybeni is synthesizing ${fileName}...`);

  const systemPrompt = getSystemPrompt();
  const prompt = `Please review and improve this ${language} file (${fileName}). Apply NovAura aesthetic where relevant (dark #020205, glassmorphism, cyan/purple/pink accents). Return the complete improved code in a markdown block.\n\n${text.slice(0, 12000)}`;

  const result = await chatWithTools(apiKey, systemPrompt, prompt, (update) => {
    if (update.done && !update.error) {
      let code = update.text;
      const blockMatch = code.match(/```(?:\w+)?\n([\s\S]*?)```/);
      if (blockMatch) code = blockMatch[1].trim();

      editor.edit((eb) => {
        eb.replace(new vscode.Range(doc.positionAt(0), doc.positionAt(text.length)), code);
      });
      vscode.window.showInformationMessage(`✅ Synthesized with ${update.model}!`);
    }
  });

  if (!result) {
    vscode.window.showErrorMessage('❌ Synthesis failed — all models exhausted.');
  }
}

async function quickAsk(provider) {
  const question = await vscode.window.showInputBox({
    prompt: 'Ask Nova anything...',
    placeHolder: 'e.g., "Refactor this to use React hooks"',
  });
  if (!question) return;

  const apiKey = await getApiKey();
  if (!apiKey) { promptForApiKey(); return; }

  provider.sendMessageToWebview({ type: 'addUserMessage', text: question });
  await runChatTurn(provider, apiKey, question);
}

async function runChatTurn(provider, apiKey, text) {
  provider.sendMessageToWebview({ type: 'status', text: 'Nova is thinking...' });

  const systemPrompt = getSystemPrompt();
  await chatWithTools(apiKey, systemPrompt, text, (update) => {
    if (update.done) {
      provider.sendMessageToWebview({
        type: 'addAiMessage',
        text: update.text,
        model: update.model,
        usedTools: update.usedTools,
      });
      provider.sendMessageToWebview({ type: 'status', text: update.error ? 'Error' : 'Ready' });
    } else if (!update.error) {
      provider.sendMessageToWebview({ type: 'appendAiText', text: update.text });
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  WEBVIEW PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

class NovAuraSidebarProvider {
  constructor(_extensionUri, context) {
    this._extensionUri = _extensionUri;
    this._context = context;
    this._view = null;
  }

  resolveWebviewView(webviewView, context, _token) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this._getHtmlForWebview();

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'sendMessage': {
          const apiKey = await getApiKey();
          if (!apiKey) { promptForApiKey(); return; }
          await runChatTurn(this, apiKey, message.text);
          break;
        }
        case 'checkKey': {
          const resolved = await resolveApiKey();
          this.sendMessageToWebview({
            type: 'status',
            text: resolved
              ? `Nova online · key from ${resolved.source}`
              : 'No API key. Click ⚙️ to configure.',
          });
          break;
        }
        case 'getContext': {
          const editor = vscode.window.activeTextEditor;
          this.sendMessageToWebview({
            type: 'contextUpdate',
            fileName: editor ? path.basename(editor.document.fileName) : null,
            language: editor ? editor.document.languageId : null,
          });
          break;
        }
      }
    });

    setTimeout(async () => {
      const resolved = await resolveApiKey();
      this.sendMessageToWebview({
        type: 'status',
        text: resolved ? `Nova online · ${resolved.source}` : 'No API key. Click ⚙️ to configure.',
      });
    }, 400);
  }

  sendMessageToWebview(message) {
    if (this._view) this._view.webview.postMessage(message);
  }

  _getHtmlForWebview() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; }
    body {
      background: #020205; color: #e2e8f0;
      font-family: 'Segoe UI', system-ui, sans-serif;
      margin: 0; padding: 0; height: 100vh;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .header {
      padding: 12px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      background: linear-gradient(135deg, rgba(6,182,212,0.08), rgba(168,85,247,0.08));
    }
    .header h2 { margin: 0; font-size: 15px;
      background: linear-gradient(to right, #06b6d4, #a855f7, #ec4899);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }
    .header .subtitle { font-size: 10px; opacity: 0.5; margin-top: 2px; }
    .status-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 14px; font-size: 10px; color: #64748b;
      border-bottom: 1px solid rgba(255,255,255,0.04);
    }
    .status-bar .indicator { display: inline-flex; align-items: center; gap: 5px; }
    .status-bar .dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; animation: pulse 2s infinite; }
    .status-bar .dot.offline { background: #ef4444; animation: none; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    .chat-box { flex: 1; overflow-y: auto; padding: 10px 14px; display: flex; flex-direction: column; gap: 10px; }
    .message { max-width: 92%; padding: 10px 12px; border-radius: 10px; font-size: 12.5px; line-height: 1.55; word-wrap: break-word; animation: fadeIn 0.2s ease; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:translateY(0) } }
    .message.user { align-self: flex-end; background: linear-gradient(135deg, rgba(6,182,212,0.15), rgba(168,85,247,0.15)); border: 1px solid rgba(6,182,212,0.2); color: #e2e8f0; }
    .message.ai { align-self: flex-start; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); color: #cbd5e1; }
    .message.ai.error { border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.06); }
    .message.ai.tool { border-color: rgba(168,85,247,0.3); background: rgba(168,85,247,0.08); }
    .message .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.5; margin-bottom: 4px; font-weight: 600; }
    .message pre { background: rgba(0,0,0,0.35); padding: 8px; border-radius: 6px; overflow-x: auto; font-size: 11px; margin: 6px 0; border: 1px solid rgba(255,255,255,0.05); }
    .message code { font-family: 'Fira Code', 'Cascadia Code', monospace; color: #67e8f9; }
    .message p { margin: 0 0 6px 0; }
    .message p:last-child { margin-bottom: 0; }
    .input-area { padding: 10px 14px 14px; border-top: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.2); }
    .input-row { display: flex; gap: 8px; align-items: flex-end; }
    textarea { flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #e2e8f0; padding: 8px 10px; border-radius: 8px; font-size: 12.5px; resize: none; outline: none; font-family: inherit; min-height: 36px; max-height: 120px; line-height: 1.4; }
    textarea:focus { border-color: rgba(6,182,212,0.4); background: rgba(255,255,255,0.06); }
    .send-btn { background: linear-gradient(135deg, #06b6d4, #a855f7); border: none; color: white; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: opacity 0.15s; flex-shrink: 0; }
    .send-btn:hover { opacity: 0.85; }
    .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .toolbar { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
    .toolbar button { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #94a3b8; font-size: 10px; padding: 4px 10px; border-radius: 5px; cursor: pointer; transition: all 0.15s; }
    .toolbar button:hover { background: rgba(255,255,255,0.08); color: #e2e8f0; }
    .context-pill { font-size: 9px; color: #06b6d4; background: rgba(6,182,212,0.08); padding: 2px 8px; border-radius: 10px; border: 1px solid rgba(6,182,212,0.15); }
  </style>
</head>
<body>
  <div class="header">
    <h2>Cybeni & Nova</h2>
    <div class="subtitle">NovAura AI Coding Partner · Tool-Enabled</div>
  </div>
  <div class="status-bar">
    <span class="indicator"><span class="dot" id="statusDot"></span><span id="statusText">Connecting...</span></span>
    <span id="contextPill"></span>
  </div>
  <div class="chat-box" id="chatBox">
    <div class="message ai">
      <div class="label">Nova</div>
      <p>Hey! I'm Nova, your coding partner with <strong>tool access</strong>. I can:</p>
      <p>• Read & write files in your workspace<br>• Run terminal commands<br>• Search files<br>• Edit your active editor</p>
      <p style="margin-top:6px;opacity:0.6;font-size:11px;">I'm connected to OpenRouter's free model pool with automatic fallback.</p>
    </div>
  </div>
  <div class="input-area">
    <div class="input-row">
      <textarea id="input" placeholder="Ask Nova to code, refactor, or explore your project..." rows="1"></textarea>
      <button class="send-btn" id="sendBtn">➤</button>
    </div>
    <div class="toolbar">
      <button onclick="sendQuick('Explain this file')">💡 Explain</button>
      <button onclick="sendQuick('Refactor for performance')">⚡ Refactor</button>
      <button onclick="sendQuick('Find all TODOs in the project')">🔍 Search</button>
      <button onclick="sendQuick('Run npm test')">▶️ Run</button>
      <button onclick="vscode.postMessage({type:'checkKey'})">⚙️ Key</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const chatBox = document.getElementById('chatBox');
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('sendBtn');
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');
    const contextPill = document.getElementById('contextPill');

    let isLoading = false;
    let currentAiMsg = null;

    function mdToHtml(text) {
      return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\`\`\`(\w+)?\n([\s\S]*?)\`\`\`/g, '<pre><code>$2</code></pre>')
        .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<p></p>');
    }

    function startAiMessage(model, usedTools) {
      const div = document.createElement('div');
      div.className = 'message ai' + (usedTools ? ' tool' : '');
      const label = model ? 'Nova · ' + model + (usedTools ? ' · 🛠️ tools' : '') : 'Nova';
      div.innerHTML = '<div class="label">' + label + '</div><div class="ai-body"></div>';
      chatBox.appendChild(div);
      chatBox.scrollTop = chatBox.scrollHeight;
      currentAiMsg = div.querySelector('.ai-body');
      return currentAiMsg;
    }

    function addMessage(text, sender, options = {}) {
      const div = document.createElement('div');
      div.className = 'message ' + sender + (options.isError ? ' error' : '') + (options.usedTools ? ' tool' : '');
      const label = options.model ? (sender === 'ai' ? 'Nova · ' + options.model : 'You') + (options.usedTools ? ' · 🛠️' : '') : (sender === 'ai' ? 'Nova' : 'You');
      div.innerHTML = '<div class="label">' + label + '</div>' + mdToHtml(text);
      chatBox.appendChild(div);
      chatBox.scrollTop = chatBox.scrollHeight;
    }

    function sendMessage() {
      const text = input.value.trim();
      if (!text || isLoading) return;
      addMessage(text, 'user');
      input.value = '';
      input.style.height = 'auto';
      isLoading = true;
      sendBtn.disabled = true;
      statusText.textContent = 'Nova is thinking...';
      statusDot.className = 'dot';
      currentAiMsg = null;
      vscode.postMessage({ type: 'sendMessage', text });
    }

    function sendQuick(text) {
      input.value = text;
      sendMessage();
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      switch (msg.type) {
        case 'addUserMessage':
          addMessage(msg.text, 'user');
          isLoading = true; sendBtn.disabled = true;
          break;
        case 'addAiMessage':
          addMessage(msg.text, 'ai', msg);
          isLoading = false; sendBtn.disabled = false;
          statusText.textContent = 'Ready';
          statusDot.className = 'dot';
          currentAiMsg = null;
          break;
        case 'appendAiText':
          if (!currentAiMsg) currentAiMsg = startAiMessage(null, false);
          currentAiMsg.innerHTML = mdToHtml(msg.text);
          chatBox.scrollTop = chatBox.scrollHeight;
          break;
        case 'clearChat':
          chatBox.innerHTML = '';
          break;
        case 'status':
          statusText.textContent = msg.text;
          statusDot.className = msg.text.includes('offline') || msg.text.includes('No API') || msg.text.includes('Error') ? 'dot offline' : 'dot';
          break;
        case 'contextUpdate':
          contextPill.innerHTML = msg.fileName ? '<span class="context-pill">' + (msg.language || 'file') + ': ' + msg.fileName + '</span>' : '';
          break;
      }
    });

    vscode.postMessage({ type: 'getContext' });
    vscode.postMessage({ type: 'checkKey' });
  </script>
</body>
</html>`;
  }
}

function deactivate() {}

module.exports = { activate, deactivate };
