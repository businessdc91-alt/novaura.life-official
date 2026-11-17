import React, { useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  FileCode, FilePlus, Trash2, Pencil, X, Save, Folder, GitCompare, RotateCcw, ImagePlus, FileImage,
} from 'lucide-react';
import { computeLineDiff } from '../../../services/cybeni/offlineShims.js';

const LANGUAGES = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', ts: 'typescript', tsx: 'typescript',
  css: 'css', html: 'html', json: 'json', md: 'markdown', svg: 'xml',
  c: 'c', h: 'cpp', cc: 'cpp', cpp: 'cpp', cxx: 'cpp', hpp: 'cpp', hxx: 'cpp',
  cs: 'csharp', csx: 'csharp', csproj: 'xml', sln: 'plaintext', xaml: 'xml',
  cmake: 'plaintext', ps1: 'powershell', bat: 'bat', cmd: 'bat', sh: 'shell',
};
const languageFor = (path) => LANGUAGES[(path.split('.').pop() || '').toLowerCase()] || 'plaintext';
const isBinaryPreview = (path, content) => (
  /^data:(image|audio|video)\//i.test(String(content || ''))
  || (/\.(svg|png|jpe?g|gif|webp|ico)$/i.test(String(path || '')) && (String(content || '').trim().startsWith('<svg') || String(content || '').trim().startsWith('data:')))
);

export default function CodePane({
  files,
  openTabs,
  activePath,
  drafts,
  changedPaths,
  checkpointFiles = null,
  onOpen,
  onClose,
  onChange,
  onSave,
  onNewFile,
  onDeleteFile,
  onRenameFile,
  onRevertFile,
  onUploadAsset,
}) {
  const [diffMode, setDiffMode] = useState(false);
  const assetInputRef = useRef(null);

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

  const hasBaseline = Boolean(activePath && checkpointFiles && Object.prototype.hasOwnProperty.call(checkpointFiles, activePath));
  const baselineText = hasBaseline ? checkpointFiles[activePath] : '';
  const diffResult = useMemo(() => {
    if (!activePath || !checkpointFiles || !changedPaths.includes(activePath) && (!hasBaseline || baselineText === value)) {
      return null;
    }
    if (hasBaseline && baselineText === value) return null;
    return computeLineDiff(hasBaseline ? baselineText : '', value);
  }, [activePath, checkpointFiles, changedPaths, hasBaseline, baselineText, value]);

  const binaryAsset = activePath && isBinaryPreview(activePath, value);

  return (
    <div className="flex h-full min-h-0">
      <div className="w-48 shrink-0 border-r border-slate-800 bg-slate-900/50 flex flex-col">
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
          Files
          <button onClick={onNewFile} title="New file" className="ml-auto text-slate-400 hover:text-white"><FilePlus className="w-3.5 h-3.5" /></button>
          {onUploadAsset && (
            <>
              <button
                onClick={() => assetInputRef.current?.click()}
                title="Upload image / SVG / audio asset to assets/"
                className="text-slate-400 hover:text-cyan-300"
              >
                <ImagePlus className="w-3.5 h-3.5" />
              </button>
              <input
                ref={assetInputRef}
                type="file"
                multiple
                accept="image/*,audio/*,.svg,.png,.jpg,.jpeg,.gif,.webp,.mp3,.wav,.ogg"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) onUploadAsset(e.target.files);
                  e.target.value = '';
                }}
              />
            </>
          )}
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
              {/\.(png|jpe?g|gif|webp|svg|ico)$/i.test(row.name)
                ? <FileImage className="w-3 h-3 shrink-0 text-cyan-400" />
                : <FileCode className="w-3 h-3 shrink-0 text-slate-500" />}
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
            <div className="ml-auto mr-2 flex items-center gap-1.5 shrink-0">
              {diffResult && !binaryAsset && (
                <button
                  onClick={() => setDiffMode(d => !d)}
                  title="Toggle unified diff against pre-run checkpoint"
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${diffMode ? 'border-cyan-500/60 bg-cyan-950/60 text-cyan-200' : 'border-slate-700 text-slate-300 hover:text-white'}`}
                >
                  <GitCompare className="w-3 h-3" />
                  <span>Diff</span>
                  <span className="text-emerald-300">+{diffResult.added}</span>
                  <span className="text-rose-300">-{diffResult.removed}</span>
                </button>
              )}
              {hasBaseline && baselineText !== value && onRevertFile && (
                <button
                  onClick={() => onRevertFile(activePath)}
                  title="Revert this file to pre-run state"
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border border-amber-600/50 text-amber-200 hover:bg-amber-950/50"
                >
                  <RotateCcw className="w-3 h-3" /> Revert
                </button>
              )}
              <button onClick={onSave} disabled={!(activePath in drafts)} title="Save (Ctrl+S)" className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-white disabled:opacity-30">
                <Save className="w-3 h-3" /> Save
              </button>
            </div>
          )}
        </div>
        <div
          className="flex-1 min-h-0"
          onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); onSave(); } }}
        >
          {activePath ? (
            binaryAsset ? (
              <div className="h-full overflow-auto p-6 flex flex-col items-center justify-center gap-4 bg-slate-950">
                {/^data:audio\//i.test(value) ? (
                  <audio controls src={value} className="max-w-md w-full" />
                ) : (
                  <div className="p-4 rounded-xl border border-slate-800 bg-[repeating-conic-gradient(#1e293b_0%_25%,#0f172a_0%_50%)] bg-[length:20px_20px]">
                    <img
                      src={value.trim().startsWith('<svg') ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}` : value}
                      alt={activePath}
                      className="max-w-full max-h-72 object-contain"
                    />
                  </div>
                )}
                <div className="text-center space-y-1">
                  <div className="text-[12px] font-semibold text-slate-200">{activePath}</div>
                  <div className="text-[11px] font-mono text-cyan-300 bg-slate-900 border border-slate-800 px-3 py-1 rounded">
                    import asset from './{activePath}';
                  </div>
                </div>
              </div>
            ) : diffMode && diffResult ? (
              <div className="h-full overflow-auto bg-slate-950 font-mono text-[11.5px] leading-5 py-2">
                {diffResult.lines.map((row, idx) => (
                  <div
                    key={idx}
                    className={`flex px-3 whitespace-pre-wrap break-all ${row.type === 'add' ? 'bg-emerald-950/45 text-emerald-200' : row.type === 'del' ? 'bg-rose-950/45 text-rose-200' : 'text-slate-400'}`}
                  >
                    <span className="w-9 shrink-0 text-right pr-2 text-slate-600 select-none">{row.oldLineNo ?? ''}</span>
                    <span className="w-9 shrink-0 text-right pr-2 text-slate-600 select-none">{row.newLineNo ?? ''}</span>
                    <span className="w-4 shrink-0 select-none">{row.type === 'add' ? '+' : row.type === 'del' ? '-' : ' '}</span>
                    <span className="flex-1">{row.line || ' '}</span>
                  </div>
                ))}
              </div>
            ) : (
              <Editor
                path={activePath}
                language={languageFor(activePath)}
                value={value}
                theme="vs-dark"
                onChange={(v) => onChange(activePath, v ?? '')}
                options={{ fontSize: 12, minimap: { enabled: false }, wordWrap: 'on', scrollBeyondLastLine: false, automaticLayout: true }}
              />
            )
          ) : (
            <div className="h-full flex items-center justify-center text-[12px] text-slate-500">Open a file from the tree.</div>
          )}
        </div>
      </div>
    </div>
  );
}
