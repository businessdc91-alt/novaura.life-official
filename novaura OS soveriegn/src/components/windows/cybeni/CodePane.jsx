import React, { useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { FileCode, FilePlus, Trash2, Pencil, X, Save, Folder } from 'lucide-react';

const LANGUAGES = { js: 'javascript', jsx: 'javascript', mjs: 'javascript', ts: 'typescript', tsx: 'typescript', css: 'css', html: 'html', json: 'json', md: 'markdown', svg: 'xml' };
const languageFor = (path) => LANGUAGES[(path.split('.').pop() || '').toLowerCase()] || 'plaintext';

export default function CodePane({
  files, openTabs, activePath, drafts, changedPaths,
  onOpen, onClose, onChange, onSave, onNewFile, onDeleteFile, onRenameFile,
}) {
  const tree = useMemo(() => {
    const rows = [];
    const seen = new Set();
    for (const f of files) {
      const parts = f.path.split('/');
      for (let i = 1; i < parts.length; i++) {
        const dir = parts.slice(0, i).join('/');
        if (!seen.has(dir)) {
          seen.add(dir);
          rows.push({ type: 'dir', path: dir, name: parts[i - 1], depth: i - 1 });
        }
      }
      rows.push({ type: 'file', path: f.path, name: parts[parts.length - 1], depth: parts.length - 1 });
    }
    return rows;
  }, [files]);

  const activeFile = files.find(f => f.path === activePath);
  const value = activePath in drafts ? drafts[activePath] : activeFile?.content ?? '';

  return (
    <div className="flex h-full min-h-0">
      <div className="w-48 shrink-0 border-r border-slate-800 bg-slate-900/50 flex flex-col">
        <div className="flex items-center px-2 py-1.5 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
          Files
          <button onClick={onNewFile} title="New file" className="ml-auto text-slate-400 hover:text-white"><FilePlus className="w-3.5 h-3.5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {tree.map(row => (row.type === 'dir' ? (
            <div key={`d:${row.path}`} className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-slate-500" style={{ paddingLeft: 8 + row.depth * 10 }}>
              <Folder className="w-3 h-3" /> {row.name}
            </div>
          ) : (
            <div
              key={row.path}
              onClick={() => onOpen(row.path)}
              className={`group flex items-center gap-1 px-2 py-0.5 text-[11px] cursor-pointer ${row.path === activePath ? 'bg-purple-900/40 text-white' : 'text-slate-300 hover:bg-slate-800/60'}`}
              style={{ paddingLeft: 8 + row.depth * 10 }}
            >
              <FileCode className="w-3 h-3 shrink-0 text-slate-500" />
              <span className="truncate">{row.name}</span>
              {changedPaths.includes(row.path) && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" title="Changed by the last run" />}
              {row.path in drafts && <span className="text-amber-300" title="Unsaved">•</span>}
              <span className="ml-auto hidden group-hover:flex gap-1">
                <button onClick={(e) => { e.stopPropagation(); onRenameFile(row.path); }} title="Rename" className="text-slate-500 hover:text-white"><Pencil className="w-3 h-3" /></button>
                <button onClick={(e) => { e.stopPropagation(); onDeleteFile(row.path); }} title="Delete" className="text-slate-500 hover:text-rose-300"><Trash2 className="w-3 h-3" /></button>
              </span>
            </div>
          )))}
          {!files.length && <div className="px-2 text-[11px] text-slate-500">No files yet.</div>}
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-8 flex items-center border-b border-slate-800 bg-slate-900/70 overflow-x-auto shrink-0">
          {openTabs.map(p => (
            <div key={p} onClick={() => onOpen(p)} className={`h-full flex items-center gap-1.5 px-2.5 text-[11px] border-r border-slate-800 cursor-pointer shrink-0 ${p === activePath ? 'bg-slate-950 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              {p.split('/').pop()}{p in drafts ? <span className="text-amber-300">•</span> : null}
              <button onClick={(e) => { e.stopPropagation(); onClose(p); }} className="text-slate-500 hover:text-white"><X className="w-3 h-3" /></button>
            </div>
          ))}
          {activePath && (
            <button onClick={onSave} disabled={!(activePath in drafts)} title="Save (Ctrl+S)" className="ml-auto mr-2 flex items-center gap-1 text-[10px] text-slate-300 hover:text-white disabled:opacity-30">
              <Save className="w-3 h-3" /> Save
            </button>
          )}
        </div>
        <div
          className="flex-1 min-h-0"
          onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); onSave(); } }}
        >
          {activePath ? (
            <Editor
              path={activePath}
              language={languageFor(activePath)}
              value={value}
              theme="vs-dark"
              onChange={(v) => onChange(activePath, v ?? '')}
              options={{ fontSize: 12, minimap: { enabled: false }, wordWrap: 'on', scrollBeyondLastLine: false, automaticLayout: true }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-[12px] text-slate-500">Open a file from the tree.</div>
          )}
        </div>
      </div>
    </div>
  );
}
