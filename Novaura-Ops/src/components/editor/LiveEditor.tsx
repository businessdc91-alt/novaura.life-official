import { useEffect, useState, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { invoke } from '@tauri-apps/api/tauri';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save, ChevronRight, FolderOpen, X, FileCode, Bot,
  RefreshCw, FolderTree, Terminal
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';

const EXT_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  rs: 'rust', py: 'python', json: 'json', md: 'markdown', css: 'css',
  html: 'html', sql: 'sql', sh: 'shell', bash: 'shell', toml: 'toml',
};

interface FileEntry { name: string; path: string; is_dir: boolean; extension?: string; }

export default function LiveEditor() {
  const { openFiles, activeFile, openFile, closeFile, setActivePanel } = useAppStore();
  const [content, setContent] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [fileTree, setFileTree] = useState<FileEntry[]>([]);
  const [treeRoot, setTreeRoot] = useState('z:/Novaura platform/NovAura-WebOS/platform/src');
  const [showTree, setShowTree] = useState(true);
  const [saving, setSaving] = useState(false);
  const [termOutput, setTermOutput] = useState('');
  const [termInput, setTermInput] = useState('');
  const [showTerm, setShowTerm] = useState(false);

  useEffect(() => {
    loadTree(treeRoot);
  }, [treeRoot]);

  useEffect(() => {
    if (activeFile && !content[activeFile]) loadFile(activeFile);
  }, [activeFile]);

  const loadTree = async (path: string) => {
    try {
      const entries = await invoke<FileEntry[]>('list_directory', { path });
      setFileTree(entries);
    } catch {}
  };

  const loadFile = async (path: string) => {
    try {
      const text = await invoke<string>('read_file', { path });
      setContent(prev => ({ ...prev, [path]: text }));
    } catch {}
  };

  const saveFile = async (path: string) => {
    if (!dirty[path] || !content[path]) return;
    setSaving(true);
    try {
      await invoke('write_file', { path, contents: content[path] });
      setDirty(prev => ({ ...prev, [path]: false }));
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (val: string | undefined) => {
    if (!activeFile || val === undefined) return;
    setContent(prev => ({ ...prev, [activeFile]: val }));
    setDirty(prev => ({ ...prev, [activeFile]: true }));
  };

  const runTerm = async () => {
    if (!termInput.trim()) return;
    const cmd = termInput;
    setTermInput('');
    setTermOutput(prev => prev + `\n$ ${cmd}\n`);
    try {
      const out = await invoke<{ stdout: string; stderr: string; exit_code: number }>('terminal_execute', {
        cmd,
        cwd: 'z:/Novaura platform/NovAura-WebOS/platform',
      });
      setTermOutput(prev => prev + (out.stdout || '') + (out.stderr ? `\n[stderr] ${out.stderr}` : '') + '\n');
    } catch (e: any) {
      setTermOutput(prev => prev + `Error: ${e}\n`);
    }
  };

  const lang = activeFile ? EXT_LANG[activeFile.split('.').pop() || ''] || 'plaintext' : 'plaintext';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tabs bar */}
      <div className="flex-shrink-0 flex items-center gap-0 border-b border-white/5 bg-void-light overflow-x-auto">
        <button
          onClick={() => setShowTree(!showTree)}
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-white/30 hover:text-white/70 transition-colors border-r border-white/5"
          title="Toggle file tree"
        >
          <FolderTree className="w-4 h-4" />
        </button>
        {openFiles.map(path => {
          const name = path.split('/').pop() || path.split('\\').pop() || path;
          const isActive = path === activeFile;
          return (
            <div
              key={path}
              className={`flex items-center gap-2 px-4 h-10 text-xs border-r border-white/5 cursor-pointer flex-shrink-0 transition-all ${isActive ? 'bg-void text-white' : 'text-white/40 hover:text-white/70'}`}
              onClick={() => openFile(path)}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>{name}</span>
              {dirty[path] && <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan" />}
              <button
                onClick={e => { e.stopPropagation(); if (dirty[path]) saveFile(path); closeFile(path); }}
                className="text-white/30 hover:text-white transition-colors ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
        <div className="flex items-center gap-2 ml-auto px-3 flex-shrink-0">
          {activeFile && dirty[activeFile] && (
            <button onClick={() => saveFile(activeFile!)}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-xs font-semibold hover:bg-neon-cyan/20 transition-all disabled:opacity-50">
              <Save className="w-3 h-3" /> {saving ? 'Saving...' : 'Save'}
            </button>
          )}
          <button onClick={() => setShowTerm(!showTerm)}
            className="text-white/30 hover:text-white/70 transition-colors">
            <Terminal className="w-4 h-4" />
          </button>
          <button onClick={() => setActivePanel('ai')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-white/30 hover:text-white/70 text-xs transition-colors"
            title="Send to AI">
            <Bot className="w-3.5 h-3.5" /> AI
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* File tree */}
        <AnimatePresence>
          {showTree && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 220, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex-shrink-0 border-r border-white/5 bg-void-light overflow-y-auto"
            >
              <div className="p-2">
                <div className="flex items-center gap-1 px-2 mb-2">
                  <select
                    value={treeRoot}
                    onChange={e => setTreeRoot(e.target.value)}
                    className="w-full bg-transparent text-white/40 text-[10px] outline-none truncate"
                  >
                    <option value="z:/Novaura platform/NovAura-WebOS/platform/src">platform/src</option>
                    <option value="z:/Novaura platform/NovAura-WebOS/src">WebOS/src</option>
                    <option value="z:/Novaura platform/Novaura-Ops/src">Ops/src</option>
                    <option value="z:/Novaura platform">Root</option>
                  </select>
                </div>
                {fileTree.map(entry => (
                  <button
                    key={entry.path}
                    onClick={() => entry.is_dir ? loadTree(entry.path) : openFile(entry.path)}
                    className={`w-full flex items-center gap-2 px-2 py-1 rounded-lg text-xs transition-all text-left ${activeFile === entry.path ? 'bg-white/5 text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
                  >
                    {entry.is_dir
                      ? <FolderOpen className="w-3.5 h-3.5 text-yellow-500/60 flex-shrink-0" />
                      : <FileCode className="w-3.5 h-3.5 text-neon-cyan/40 flex-shrink-0" />
                    }
                    <span className="truncate font-mono">{entry.name}</span>
                  </button>
                ))}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeFile ? (
            <MonacoEditor
              height={showTerm ? 'calc(100% - 200px)' : '100%'}
              language={lang}
              value={content[activeFile] || ''}
              onChange={handleChange}
              theme="vs-dark"
              options={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 13,
                lineHeight: 1.6,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                renderLineHighlight: 'line',
                cursorBlinking: 'smooth',
                smoothScrolling: true,
                tabSize: 2,
                wordWrap: 'off',
                padding: { top: 16, bottom: 16 },
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-white/20 text-sm">
              Open a file from the tree or a task link
            </div>
          )}

          {/* Terminal */}
          <AnimatePresence>
            {showTerm && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 200 }}
                exit={{ height: 0 }}
                className="flex-shrink-0 border-t border-white/5 bg-void flex flex-col overflow-hidden"
              >
                <div className="flex-1 overflow-y-auto p-3 font-mono text-xs text-green-300 whitespace-pre selectable">
                  {termOutput || 'Terminal ready. CWD: NovAura-WebOS/platform\n'}
                </div>
                <div className="flex items-center gap-2 px-3 py-2 border-t border-white/5">
                  <span className="text-green-400/60 font-mono text-xs">$</span>
                  <input
                    className="flex-1 bg-transparent font-mono text-xs text-green-300 outline-none selectable"
                    value={termInput}
                    onChange={e => setTermInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') runTerm(); }}
                    placeholder="npm run dev, git status, etc..."
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
