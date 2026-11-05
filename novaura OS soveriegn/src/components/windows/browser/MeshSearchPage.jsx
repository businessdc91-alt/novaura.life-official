import { useEffect, useRef, useState } from 'react';
import { Search, Loader2, ShieldCheck, Users, Globe, AtSign } from 'lucide-react';
import { searchMeshWeb } from '../../../services/web/meshWebSearch.js';
import { MESH_TLDS, TLD_INFO, parseMeshName } from '../../../services/web/novaNames.js';

export function openRegistry(name = '') {
  const props = { name, openId: `${Date.now()}` };
  window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: { appId: 'nova_registry', props, toggle: false } }));
  window.dispatchEvent(new CustomEvent('novaura:app_context', { detail: { appId: 'nova_registry', props } }));
}

const shortKey = (hex) => (hex ? `${hex.slice(0, 6)}…${hex.slice(-4)}` : '');

/** Nova Search: the mesh web's front page (nova://search). */
export default function MeshSearchPage({ initialQuery = '', onOpen, onSearch }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [askPeers, setAskPeers] = useState(true);
  const runId = useRef(0);

  const run = async (q) => {
    const text = String(q || '').trim();
    if (!text) { setResults(null); return; }
    const id = ++runId.current;
    setBusy(true);
    try {
      const final = await searchMeshWeb(text, { askPeers, onUpdate: (list) => { if (id === runId.current) setResults(list); } });
      if (id === runId.current) setResults(final);
    } finally {
      if (id === runId.current) setBusy(false);
    }
  };

  useEffect(() => {
    setQuery(initialQuery);
    run(initialQuery);
  }, [initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e) => {
    e.preventDefault();
    onSearch?.(query.trim());
    if (!onSearch) run(query);
  };

  const asName = parseMeshName(query);

  return (
    <div className="w-full h-full overflow-y-auto bg-slate-950">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div className="text-center space-y-1">
          <div className="text-3xl font-black tracking-tight text-white">Nova <span className="text-cyan-400">Search</span></div>
          <div className="text-[12px] text-slate-400">The mesh web: {MESH_TLDS.map(t => TLD_INFO[t].label).join(' ')} sites, found on this PC and on connected peers.</div>
        </div>

        <form onSubmit={submit} className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 focus-within:border-cyan-500">
            <Search className="w-4 h-4 text-slate-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the mesh web"
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-slate-500 select-text"
            />
            {busy && <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />}
          </div>
          <button type="submit" className="px-5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold">Search</button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={askPeers} onChange={(e) => setAskPeers(e.target.checked)} />
            Ask connected peers too (they see your search words)
          </label>
          <button onClick={() => openRegistry(asName?.registrable || '')} className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300">
            <AtSign className="w-3.5 h-3.5" /> Get a name of your own
          </button>
        </div>

        {asName && (
          <button onClick={() => onOpen?.(asName.host)} className="w-full text-left p-3 rounded-xl border border-cyan-500/30 bg-cyan-950/30 text-[13px] text-cyan-200 hover:bg-cyan-950/60">
            Go to <b className="font-mono">{asName.host}</b>
          </button>
        )}

        {results && (
          <div className="space-y-3">
            <div className="text-[11px] text-slate-500">
              {results.length ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'Nothing on the mesh matches that yet.'}
              {busy && askPeers ? ' · still hearing from peers…' : ''}
            </div>
            {results.map(r => (
              <div key={r.domain} className="p-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-slate-600">
                <button onClick={() => onOpen?.(r.domain)} className="text-left w-full">
                  <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400">
                    <span>{r.favicon || <Globe className="w-3 h-3 inline" />}</span>
                    <span>{r.domain}</span>
                  </div>
                  <div className="text-[15px] font-semibold text-cyan-300 hover:underline">{r.title}</div>
                  <div className="text-[12px] text-slate-400 leading-relaxed mt-0.5">{r.snippet}</div>
                </button>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px] text-slate-500">
                  {r.registered && <span className="flex items-center gap-1 text-emerald-400"><ShieldCheck className="w-3 h-3" /> Registered name</span>}
                  {r.source === 'local'
                    ? <span>{r.builtin ? 'Built into Sovereign' : r.signed ? `On this PC · signed by ${shortKey(r.publisherPubkey)}` : 'On this PC · not published'}</span>
                    : <span className="flex items-center gap-1"><Users className="w-3 h-3" /> From a peer; opening it fetches the site and checks its signature</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {!results && (
          <div className="grid grid-cols-2 gap-3">
            {MESH_TLDS.map(t => (
              <div key={t} className="p-3 rounded-xl border border-slate-800 bg-slate-900/40">
                <div className="font-mono text-cyan-300 text-sm">{TLD_INFO[t].label}</div>
                <div className="text-[11px] text-slate-400">{TLD_INFO[t].blurb}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
