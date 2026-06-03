import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal as TerminalIcon, Zap, Sparkles, Wifi, WifiOff } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { smartChat } from '../../services/aiService';
import { listFiles, saveFile, createFolder } from '../../services/fileStorageService';

// Virtual FS backed by localStorage for simple terminal ops
const VFS = {
  get(path) {
    try { return JSON.parse(localStorage.getItem(`nova_vfs:${path}`)); } catch { return null; }
  },
  set(path, content) {
    localStorage.setItem(`nova_vfs:${path}`, JSON.stringify(content));
  },
  delete(path) {
    localStorage.removeItem(`nova_vfs:${path}`);
  },
};

// ─── Virtual filesystem state (in-memory + IndexedDB via fileStorageService) ──
let virtualCwd = '/home/user';

// ─── Built-in commands ─────────────────────────────────────────────────────────
async function runCommand(raw, setCwd) {
  const parts = raw.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case 'help':
      return `Aura Terminal — available commands:
  help                  Show this help
  clear                 Clear terminal
  pwd                   Print working directory
  ls [path]             List files/folders
  cd <path>             Change directory
  cat <file>            Read file contents
  mkdir <dir>           Create directory
  touch <file>          Create empty file
  rm <file>             Delete file
  echo <text>           Print text
  whoami                Show current user
  date                  Show current date/time
  env                   Show environment info
  git status            Show git status (stub)
  git log               Show recent commits (stub)
  npm install           Simulate npm install
  npm run dev           Simulate dev server
  node -e <code>        Evaluate JS expression
  ai <query>            Ask Nova AI anything
  aura <query>          Alias for ai`;

    case 'pwd':
      return virtualCwd;

    case 'whoami':
      return 'novaura-user';

    case 'date':
      return new Date().toLocaleString();

    case 'env':
      return `TERM=aura-terminal
USER=novaura-user
HOME=/home/user
SHELL=/bin/aura
NODE_ENV=development
PWD=${virtualCwd}`;

    case 'echo':
      return args.join(' ');

    case 'clear':
      return '__CLEAR__';

    case 'cd': {
      const target = args[0];
      if (!target || target === '~') {
        virtualCwd = '/home/user';
        setCwd('/home/user');
        return '';
      }
      if (target === '..') {
        const parts2 = virtualCwd.split('/').filter(Boolean);
        parts2.pop();
        virtualCwd = '/' + parts2.join('/') || '/';
        setCwd(virtualCwd);
        return '';
      }
      if (target.startsWith('/')) {
        virtualCwd = target;
      } else {
        virtualCwd = virtualCwd.endsWith('/') ? virtualCwd + target : virtualCwd + '/' + target;
      }
      setCwd(virtualCwd);
      return '';
    }

    case 'ls': {
      try {
        const path = args[0] || virtualCwd;
        const files = await listFiles(path);
        if (files && files.length > 0) {
          return files.map(f => {
            const isDir = f.type === 'folder' || f.isDirectory;
            return isDir ? `${f.name}/` : f.name;
          }).join('  ');
        }
      } catch { /* fall through to virtual */ }
      // Fallback virtual listing
      const map = {
        '/home/user': 'Desktop  Documents  Downloads  projects  scripts  .config',
        '/home/user/projects': 'my-app  portfolio  api-server',
        '/home/user/Desktop': 'novaura.lnk',
        '/': 'bin  etc  home  tmp  usr  var',
      };
      return map[virtualCwd] || '(empty)';
    }

    case 'cat': {
      if (!args[0]) return 'Usage: cat <file>';
      const fp = args[0].startsWith('/') ? args[0] : `${virtualCwd}/${args[0]}`;
      const data = VFS.get(fp);
      if (data === null) return `cat: ${args[0]}: No such file`;
      return data || '(empty file)';
    }

    case 'touch': {
      if (!args[0]) return 'Usage: touch <filename>';
      const fp = args[0].startsWith('/') ? args[0] : `${virtualCwd}/${args[0]}`;
      VFS.set(fp, '');
      try {
        const name = args[0].split('/').pop();
        const parent = fp.split('/').slice(0, -1).join('/') || '/';
        await saveFile(name, '', 'text/plain', parent);
      } catch { /* non-fatal */ }
      return '';
    }

    case 'mkdir': {
      if (!args[0]) return 'Usage: mkdir <directory>';
      try {
        const name = args[0].split('/').pop();
        const parent = (args[0].startsWith('/') ? args[0] : `${virtualCwd}/${args[0]}`).split('/').slice(0, -1).join('/') || virtualCwd;
        await createFolder(name, parent);
        return '';
      } catch (e) {
        return `mkdir: ${e.message}`;
      }
    }

    case 'rm': {
      if (!args[0]) return 'Usage: rm <file>';
      const fp = args[0].startsWith('/') ? args[0] : `${virtualCwd}/${args[0]}`;
      VFS.delete(fp);
      return `removed '${args[0]}'`;
    }

    case 'git': {
      const sub = args[0];
      if (sub === 'status') {
        return `On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean`;
      }
      if (sub === 'log') {
        return `commit a3f9e2b (HEAD -> main)
Author: NovAura User <user@novaura.life>
Date:   ${new Date().toDateString()}

    chore: auto-save project state

commit 7c1d5a8
Author: NovAura User <user@novaura.life>
Date:   ${new Date(Date.now() - 86400000).toDateString()}

    feat: initial commit`;
      }
      if (sub === 'branch') {
        return `* main
  develop
  feature/ui-updates`;
      }
      if (sub === 'init') {
        return 'Initialized empty Git repository in .git/';
      }
      return `git: '${sub || ''}' is not a recognized command. Use the Git window for full operations.`;
    }

    case 'npm': {
      const sub = args[0];
      if (sub === 'install' || sub === 'i') {
        return `npm warn saveError ENOENT: no such file or directory, open '${virtualCwd}/package.json'
\nCreating a virtual install...\nadded 0 packages in 0.1s`;
      }
      if (sub === 'run') {
        const script = args[1];
        if (script === 'dev') return `\n> project@0.1.0 dev\n> vite\n\n  VITE v5.0.0  ready in 312 ms\n\n  ➜  Local:   http://localhost:5173/\n  ➜  Network: use --host to expose`;
        if (script === 'build') return `\n> project@0.1.0 build\n> vite build\n\n✓ built in 2.14s`;
        if (script === 'test') return 'No tests configured. Add a test runner like Vitest.';
        return `npm error Missing script: "${script}"`;
      }
      if (sub === 'list' || sub === 'ls') {
        return 'Use a real Node.js environment for package management.';
      }
      return `npm: unknown command "${sub}"`;
    }

    case 'node': {
      if (args[0] === '-e' && args[1]) {
        try {
          // Safe eval of simple expressions
          const expr = args.slice(1).join(' ');
          // Allow only simple math/string expressions
          if (/^[\d\s+\-*/%.()'"a-zA-Z,]+$/.test(expr)) {
            // eslint-disable-next-line no-new-func
            const result = new Function(`"use strict"; return (${expr})`)();
            return String(result);
          }
          return 'node: unsafe expression blocked for security';
        } catch (e) {
          return `node: ${e.message}`;
        }
      }
      return 'Interactive Node REPL not available. Use -e flag: node -e "1+1"';
    }

    case 'ai':
    case 'aura':
    case 'nova': {
      const query = args.join(' ');
      if (!query) return `Usage: ${cmd} <question or task>`;
      return '__AI__:' + query;
    }

    default:
      return `${cmd}: command not found. Type 'help' for available commands.`;
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

const INITIAL_OUTPUT = [
  { type: 'system', content: '╔══════════════════════════════════════════╗' },
  { type: 'system', content: '║     Aura Terminal v2.0 — NovAura OS     ║' },
  { type: 'system', content: '║  Type "help" for commands, "ai" for AI  ║' },
  { type: 'system', content: '╚══════════════════════════════════════════╝' },
];

export default function TerminalWindow() {
  const [output, setOutput] = useState(INITIAL_OUTPUT);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [cwd, setCwd] = useState('/home/user');
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addLine = useCallback((type, content) => {
    setOutput(prev => [...prev, { type, content }]);
  }, []);

  const executeCommand = useCallback(async (cmd) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    setHistory(prev => [trimmed, ...prev.slice(0, 99)]);
    setHistoryIndex(-1);
    addLine('command', `${cwd} $ ${trimmed}`);

    let result;
    try {
      result = await runCommand(trimmed, setCwd);
    } catch (err) {
      addLine('error', `Error: ${err.message}`);
      return;
    }

    if (result === '__CLEAR__') {
      setOutput([]);
      return;
    }

    if (typeof result === 'string' && result.startsWith('__AI__:')) {
      const query = result.slice(7);
      addLine('ai', `Nova is thinking...`);
      setIsAIProcessing(true);
      try {
        const response = await smartChat(query, 'general');
        setOutput(prev => {
          const next = [...prev];
          const idx = next.findLastIndex(l => l.type === 'ai' && l.content === 'Nova is thinking...');
          if (idx !== -1) next.splice(idx, 1);
          return next;
        });
        addLine('ai', response || '(no response)');
      } catch (err) {
        setOutput(prev => {
          const next = [...prev];
          const idx = next.findLastIndex(l => l.type === 'ai');
          if (idx !== -1) next.splice(idx, 1);
          return next;
        });
        addLine('error', `AI error: ${err.message}`);
      } finally {
        setIsAIProcessing(false);
      }
      return;
    }

    if (result) {
      // Handle multi-line output
      result.split('\n').forEach(line => {
        addLine('output', line);
      });
    }
  }, [cwd, addLine]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isAIProcessing) return;
    executeCommand(input);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = historyIndex === -1 ? 0 : Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(next);
      setInput(history[next] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex <= 0) {
        setHistoryIndex(-1);
        setInput('');
      } else {
        const next = historyIndex - 1;
        setHistoryIndex(next);
        setInput(history[next] || '');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Basic tab completion for commands
      const commands = ['help', 'clear', 'pwd', 'ls', 'cd', 'cat', 'mkdir', 'touch', 'rm', 'echo', 'whoami', 'date', 'env', 'git', 'npm', 'node', 'ai', 'aura'];
      const match = commands.find(c => c.startsWith(input));
      if (match) setInput(match);
    } else if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      if (isAIProcessing) {
        setIsAIProcessing(false);
        addLine('system', '^C');
      } else {
        addLine('command', `${cwd} $ ${input}`);
        addLine('system', '^C');
        setInput('');
      }
    }
  };

  const getLineColor = (type) => {
    switch (type) {
      case 'system': return 'text-primary/70';
      case 'command': return 'text-success';
      case 'output': return 'text-[#b3b1ad]';
      case 'error': return 'text-destructive';
      case 'ai': return 'text-secondary';
      default: return 'text-[#b3b1ad]';
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-[#0a0e14] text-[#b3b1ad] font-mono"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#0d1117] border-b border-primary/20 flex-shrink-0">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
          <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
        </div>
        <TerminalIcon className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs text-muted-foreground font-black uppercase tracking-widest">Aura Terminal</span>
        <span className="text-xs text-muted-foreground/50 ml-1">{cwd}</span>
        <div className="ml-auto flex items-center gap-3">
          {isAIProcessing && (
            <div className="flex items-center gap-1.5 text-xs text-secondary animate-pulse">
              <Sparkles className="w-3 h-3" />
              <span>Nova thinking...</span>
            </div>
          )}
          <button
            onClick={() => executeCommand('ai help me with my project')}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-[10px] text-primary hover:bg-primary/20 transition-all font-black uppercase tracking-tighter"
          >
            <Sparkles className="w-3 h-3" />
            Ask AI
          </button>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Zap className="w-3 h-3 text-success" />
            <span className="uppercase font-bold">Ready</span>
          </div>
        </div>
      </div>

      {/* Output */}
      <div className="flex-1 overflow-y-auto p-4 space-y-0.5 scrollbar-custom">
        {output.map((item, i) => (
          <div
            key={i}
            className={`text-[13px] leading-5 whitespace-pre-wrap break-all ${getLineColor(item.type)}`}
          >
            {item.type === 'ai' && (
              <span className="text-secondary/60 mr-2">◆</span>
            )}
            {item.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-4 py-2 border-t border-primary/10 bg-[#0d1117] flex-shrink-0"
      >
        <span className="text-success text-sm flex-shrink-0">
          {cwd.split('/').pop() || '~'} $
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isAIProcessing}
          className="flex-1 bg-transparent outline-none text-[13px] text-[#b3b1ad] caret-primary disabled:opacity-50"
          spellCheck={false}
          autoComplete="off"
        />
      </form>
    </div>
  );
}
