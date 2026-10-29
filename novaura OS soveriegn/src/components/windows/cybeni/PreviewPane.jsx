import React, { useState } from 'react';
import { RefreshCw, Monitor, Tablet, Smartphone, AlertTriangle, Terminal, Trash2, ShieldCheck } from 'lucide-react';

const WIDTHS = { desktop: '100%', tablet: '820px', mobile: '390px' };

export default function PreviewPane({ doc, frameRef, consoleEntries, onClearConsole, onReload, building, staticIssues }) {
  const [device, setDevice] = useState('desktop');
  const [showConsole, setShowConsole] = useState(true);
  const errors = consoleEntries.filter(e => e.level === 'error');

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-950">
      <div className="h-9 px-2 flex items-center gap-1.5 border-b border-slate-800 bg-slate-900/70 shrink-0">
        {[['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]].map(([id, Icon]) => (
          <button key={id} onClick={() => setDevice(id)} title={id} className={`p-1 rounded ${device === id ? 'text-cyan-300 bg-cyan-950/50' : 'text-slate-500 hover:text-slate-200'}`}>
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}
        <button onClick={onReload} title="Rebuild preview" className="p-1 rounded text-slate-400 hover:text-white"><RefreshCw className={`w-3.5 h-3.5 ${building ? 'animate-spin' : ''}`} /></button>
        <span className="flex items-center gap-1 text-[10px] text-emerald-400/80 ml-1" title="Runs on its own origin, isolated from the OS, its data and its commands">
          <ShieldCheck className="w-3 h-3" /> Isolated sandbox
        </span>
        <button onClick={() => setShowConsole(s => !s)} className={`ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${errors.length ? 'border-rose-500/60 text-rose-300' : 'border-slate-700 text-slate-400'}`}>
          <Terminal className="w-3 h-3" /> Console {errors.length ? `· ${errors.length} error${errors.length === 1 ? '' : 's'}` : ''}
        </button>
      </div>

      {staticIssues?.length > 0 && (
        <div className="px-3 py-1.5 bg-amber-950/40 border-b border-amber-700/40 text-[11px] text-amber-200 flex gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div>{staticIssues.slice(0, 3).map((i, n) => <div key={n}>{i.message}</div>)}</div>
        </div>
      )}

      <div className="flex-1 min-h-0 flex justify-center bg-[radial-gradient(circle_at_center,_#0f172a,_#020617)] overflow-auto">
        {doc ? (
          <iframe
            ref={frameRef}
            key={doc.key}
            title="Cybeni preview"
            src={doc.src}
            srcDoc={doc.srcdoc}
            sandbox={doc.sandbox}
            className="h-full bg-white border-x border-slate-800 transition-all"
            style={{ width: WIDTHS[device] }}
          />
        ) : (
          <div className="self-center text-[12px] text-slate-500">{building ? 'Building preview…' : 'Nothing to preview yet.'}</div>
        )}
      </div>

      {showConsole && (
        <div className="h-32 shrink-0 border-t border-slate-800 bg-slate-950 flex flex-col">
          <div className="flex items-center px-2 py-0.5 text-[10px] text-slate-500 border-b border-slate-900">
            <span>Preview console</span>
            <button onClick={onClearConsole} className="ml-auto hover:text-white" title="Clear"><Trash2 className="w-3 h-3" /></button>
          </div>
          <div className="flex-1 overflow-y-auto font-mono text-[10.5px] px-2 py-1 space-y-0.5">
            {consoleEntries.length === 0 && <div className="text-slate-600">No output.</div>}
            {consoleEntries.map((e, i) => (
              <div key={i} className={e.level === 'error' ? 'text-rose-300' : e.level === 'warn' ? 'text-amber-300' : 'text-slate-400'}>
                {e.level === 'error' ? '✖ ' : e.level === 'warn' ? '⚠ ' : '› '}{e.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
