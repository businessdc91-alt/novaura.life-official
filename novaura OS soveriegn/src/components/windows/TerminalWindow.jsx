import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Sparkles, CornerDownLeft, Shield, Cpu } from 'lucide-react';
import { useKernel } from '../../kernel/useKernel.js';
import { db } from '../../database/sovereignDatabase.js';
import { getFileByPath } from '../../services/fileStorageService.js';

export default function TerminalWindow() {
  const { kernel } = useKernel();
  const [cwd, setCwd] = useState('/documents');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [input, setInput] = useState('');
  const [lines, setLines] = useState([
    { type: 'system', text: 'Sovereign OS Terminal [Version 2.4.0-decentralized]' },
    { type: 'system', text: 'Private host cloud database attached. Type "help" for command matrix.' },
    { type: 'prompt', text: '' },
  ]);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!kernel?.ipc) return;
    const unsub = kernel.ipc.on('terminal:run_command', ({ command }) => {
      if (command) {
        executeCommand(command);
      }
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [kernel]);

  const appendLine = (line) => {
    setLines(prev => [...prev.filter(l => l.type !== 'prompt'), line, { type: 'prompt', text: '' }]);
  };

  const executeCommand = async (rawCmd) => {
    const cmd = rawCmd.trim();
    if (!cmd) return;

    setHistory(prev => [...prev, cmd]);
    setHistoryIndex(-1);

    // Echo command
    setLines(prev => [
      ...prev.filter(l => l.type !== 'prompt'),
      { type: 'command', text: `${cwd} $ ${cmd}` },
    ]);

    const parts = cmd.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const base = parts[0]?.toLowerCase();
    const args = parts.slice(1).map(p => p.replace(/^"|"$/g, ''));

    switch (base) {
      case 'clear':
        setLines([{ type: 'prompt', text: '' }]);
        return;

      case 'help':
        appendLine({
          type: 'output',
          text: `Sovereign OS Command Matrix:
  help                     Show this reference guide
  clear                    Clear terminal display
  pwd                      Print current working directory
  cd <dir>                 Change directory (.. to go up)
  ls [path]                List directory contents in private DB
  cat <file>               Display contents of a file
  touch <file>             Create an empty file
  echo <text> [> file]     Print text or write to file
  rm <file>                Delete a file or folder
  mkdir <dir>              Create a directory
  ai <prompt>              Run real local/cloud AI inference
  sysinfo                  Display OS kernel and hardware telemetry
  ps                       List active kernel processes
  kill <pid>               Terminate a running process
  open <app>               Launch window (cybeni, files, browser, etc.)
  vault <list|set <k> <v>> Manage secure local API keys
  history                  View command history`,
        });
        break;

      case 'pwd':
        appendLine({ type: 'output', text: cwd });
        break;

      case 'cd': {
        const target = args[0] || '/';
        if (target === '..') {
          const parts = cwd.split('/').filter(Boolean);
          parts.pop();
          setCwd('/' + parts.join('/'));
        } else if (target.startsWith('/')) {
          setCwd(target);
        } else {
          setCwd((cwd === '/' ? '' : cwd) + '/' + target);
        }
        appendLine({ type: 'output', text: `Directory changed.` });
        break;
      }

      case 'ls': {
        const pathToList = args[0] || cwd;
        const docs = await db.documents.toArray();
        const normTarget = ('/' + pathToList).replace(/\/+/g, '/').replace(/\/$/, '') || '/';
        const matches = docs.filter(d => (d.parentPath || '/') === normTarget);

        if (matches.length === 0) {
          appendLine({ type: 'output', text: '(directory is empty)' });
        } else {
          const formatted = matches
            .map(m => `${m.type === 'folder' ? '[DIR] ' : '      '}${m.name.padEnd(24)} ${(m.size || 0).toString().padStart(8)} B   ${new Date(m.updated_at || Date.now()).toLocaleDateString()}`)
            .join('\n');
          appendLine({ type: 'output', text: formatted });
        }
        break;
      }

      case 'cat': {
        if (!args[0]) {
          appendLine({ type: 'error', text: 'Usage: cat <filename>' });
          break;
        }
        const filePath = args[0].startsWith('/') ? args[0] : `${cwd}/${args[0]}`.replace(/\/+/g, '/');
        const doc = await getFileByPath(filePath);
        if (!doc) {
          appendLine({ type: 'error', text: `File not found: ${filePath}` });
        } else {
          appendLine({ type: 'output', text: typeof doc.content === 'string' ? doc.content : '[Binary Data]' });
        }
        break;
      }

      case 'touch': {
        if (!args[0]) {
          appendLine({ type: 'error', text: 'Usage: touch <filename>' });
          break;
        }
        const filePath = args[0].startsWith('/') ? args[0] : `${cwd}/${args[0]}`.replace(/\/+/g, '/');
        await kernel?.fs?.writeFile(filePath, '');
        appendLine({ type: 'output', text: `Created file: ${filePath}` });
        break;
      }

      case 'mkdir': {
        if (!args[0]) {
          appendLine({ type: 'error', text: 'Usage: mkdir <folder_name>' });
          break;
        }
        const full = args[0].startsWith('/') ? args[0] : `${cwd}/${args[0]}`.replace(/\/+/g, '/');
        await kernel?.fs?.createDirectory(full);
        appendLine({ type: 'output', text: `Created directory: ${full}` });
        break;
      }

      case 'rm': {
        if (!args[0]) {
          appendLine({ type: 'error', text: 'Usage: rm <filename>' });
          break;
        }
        const filePath = args[0].startsWith('/') ? args[0] : `${cwd}/${args[0]}`.replace(/\/+/g, '/');
        const doc = await getFileByPath(filePath);
        if (doc) {
          await db.documents.delete(doc.id);
          appendLine({ type: 'output', text: `Removed: ${filePath}` });
        } else {
          appendLine({ type: 'error', text: `No such file or directory: ${filePath}` });
        }
        break;
      }

      case 'echo': {
        const text = args.join(' ');
        const redirectIdx = args.indexOf('>');
        if (redirectIdx !== -1 && args[redirectIdx + 1]) {
          const content = args.slice(0, redirectIdx).join(' ');
          const fileName = args[redirectIdx + 1];
          const fullPath = fileName.startsWith('/') ? fileName : `${cwd}/${fileName}`.replace(/\/+/g, '/');
          await kernel?.fs?.writeFile(fullPath, content);
          appendLine({ type: 'output', text: `Written to ${fullPath}` });
        } else {
          appendLine({ type: 'output', text });
        }
        break;
      }

      case 'ai': {
        const prompt = args.join(' ');
        if (!prompt) {
          appendLine({ type: 'error', text: 'Usage: ai <prompt text>' });
          break;
        }
        appendLine({ type: 'output', text: 'Querying Sovereign AI engine...' });
        try {
          const reply = await kernel?.ai?.chat([
            { role: 'user', content: prompt }
          ], { persona: 'nova' });
          appendLine({ type: 'output', text: `[Nova]:\n${reply}` });
        } catch (err) {
          appendLine({ type: 'error', text: `AI failed: ${err.message}` });
        }
        break;
      }

      case 'sysinfo': {
        const status = kernel?.localModel?.getStatus?.() || {};
        const openWins = kernel?.wm?.getOpenWindows?.() || [];
        appendLine({
          type: 'output',
          text: `Sovereign OS Telemetry:
  Kernel Boot Status: ${kernel?.bootPhase || 'ready'}
  Active Subsystems: 14 loaded
  Local Model Backend: ${status.backend || 'none'} (${status.state || 'idle'})
  Active Windows: ${openWins.length}
  Identity: ${kernel?.auth?.currentUser?.name || 'Local Sovereign Operator'}
  Database: 100% On-PC Private Dexie Cloud Database`,
        });
        break;
      }

      case 'ps': {
        const procs = kernel?.processes?.getAll ? kernel.processes.getAll() : (kernel?.processes?.list?.() || []);
        const table = procs.map(p => `${p.pid?.toString().padEnd(16)} ${p.name?.padEnd(20)} ${(p.status || p.state || 'running').padEnd(10)} ${p.type?.padEnd(12) || 'window'}`).join('\n');
        appendLine({ type: 'output', text: `PID              NAME                 STATUS     TYPE\n${table || 'kernel           NovaKernel           running    service'}` });
        break;
      }

      case 'open': {
        const app = args[0];
        if (!app) {
          appendLine({ type: 'error', text: 'Usage: open <app_id> (e.g., cybeni, files, browser, settings, card_forge)' });
          break;
        }
        kernel?.wm?.openWindow(app);
        appendLine({ type: 'output', text: `Dispatched launch event for app: ${app}` });
        break;
      }

      case 'vault': {
        const sub = args[0]?.toLowerCase();
        if (sub === 'list') {
          const keys = await db.vault.toArray();
          const list = keys.map(k => `• ${k.key.padEnd(16)} (category: ${k.category})`).join('\n');
          appendLine({ type: 'output', text: list || 'Vault is empty.' });
        } else if (sub === 'set' && args[1] && args[2]) {
          await db.vault.put({
            key: args[1].toLowerCase(),
            value: args[2],
            category: 'api_key',
            updated_at: new Date().toISOString(),
          });
          kernel?.ipc?.emit('vault:keys_updated');
          appendLine({ type: 'output', text: `Saved key "${args[1]}" to local vault.` });
        } else {
          appendLine({ type: 'error', text: 'Usage: vault list  OR  vault set <provider> <key>' });
        }
        break;
      }

      case 'history': {
        appendLine({ type: 'output', text: history.map((h, i) => `${(i + 1).toString().padStart(4)}  ${h}`).join('\n') });
        break;
      }

      default:
        appendLine({ type: 'error', text: `Command not recognized: "${base}". Type "help" for valid commands.` });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIdx);
        setInput(history[nextIdx] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const nextIdx = historyIndex + 1;
        if (nextIdx >= history.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(nextIdx);
          setInput(history[nextIdx] || '');
        }
      }
    }
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className="h-full bg-slate-950 text-emerald-400 font-mono text-xs p-4 flex flex-col overflow-hidden select-text"
    >
      <div className="flex-1 overflow-y-auto space-y-1 pr-2">
        {lines.map((l, i) => {
          if (l.type === 'system') {
            return <div key={i} className="text-cyan-400/80 mb-1 font-medium">{l.text}</div>;
          }
          if (l.type === 'command') {
            return <div key={i} className="text-slate-300 font-semibold">{l.text}</div>;
          }
          if (l.type === 'error') {
            return <div key={i} className="text-red-400 whitespace-pre-wrap">{l.text}</div>;
          }
          if (l.type === 'output') {
            return <div key={i} className="text-slate-300 whitespace-pre-wrap pl-2 border-l border-slate-800">{l.text}</div>;
          }
          return null;
        })}

        {/* Input line */}
        <div className="flex items-center gap-2 pt-1 text-slate-100">
          <span className="text-cyan-400 shrink-0 font-bold">{cwd} $</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="flex-1 bg-transparent text-emerald-300 outline-none border-none font-mono text-xs caret-cyan-400"
          />
        </div>

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
