import React, { useEffect, useRef, useState } from 'react';
import { Puzzle, Globe, HardDrive, Trash2, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { listAdditions, setGrants, setQuota, removeAddition } from '../../../services/additions/registry.js';
import { getAdditionData } from '../../../services/additions/dataStore.js';
import { describeAddition, formatBytes, QUOTA_CHOICES } from '../../../services/additions/panelModel.js';
import { takePendingAdditionFocus } from '../../../services/additions/settingsLink.js';

async function collect() {
  const list = await listAdditions();
  const data = getAdditionData();
  return Promise.all(list.map(async (a) => ({ raw: a, view: describeAddition(a, await data.usage(a.id).catch(() => 0)) })));
}

/** Settings → Additions: each addition's permissions, network access, storage, and removal. */
export default function AdditionsPanel() {
  const [items, setItems] = useState(null);
  const [focus, setFocus] = useState(() => takePendingAdditionFocus());
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => { collect().then((rows) => { if (alive) setItems(rows); }).catch(() => {}); };
    refresh();
    const onFocus = (e) => { takePendingAdditionFocus(); setFocus(e.detail || null); };
    window.addEventListener('novaura:user_apps_changed', refresh);
    window.addEventListener('novaura:focus_addition', onFocus);
    return () => {
      alive = false;
      window.removeEventListener('novaura:user_apps_changed', refresh);
      window.removeEventListener('novaura:focus_addition', onFocus);
    };
  }, []);

  const act = async (fn, done) => {
    try {
      await fn();
      if (done) setMessage({ tone: 'good', text: done });
    } catch (err) {
      setMessage({ tone: 'bad', text: String(err?.message || err) });
    }
  };

  return (
    <div className="max-w-4xl space-y-5">
      <div className="pb-4 border-b border-slate-800">
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2"><Puzzle className="w-4 h-4 text-cyan-400" /> Additions</h2>
        <p className="text-xs text-slate-400 mt-1">
          Apps you added to Sovereign from Cybeni or the Forge. Each one runs on its own, apart from the OS and from every other addition, and can only use what you allow here.
        </p>
      </div>
      {message && (
        <div className={`text-xs rounded-lg px-3 py-2 border ${message.tone === 'good' ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-rose-300 border-rose-500/30 bg-rose-500/10'}`}>{message.text}</div>
      )}
      {items === null && <p className="text-xs text-slate-500">Loading…</p>}
      {items?.length === 0 && <p className="text-xs text-slate-400">No additions yet. Build an app in Cybeni and choose “Add to Sovereign”.</p>}
      {items?.map(({ raw, view }) => (
        <AdditionCard key={view.id} addition={raw} view={view} focused={focus === view.id} act={act} />
      ))}
    </div>
  );
}

function AdditionCard({ addition, view, focused, act }) {
  const ref = useRef(null);
  const [confirming, setConfirming] = useState(false);
  const [keepData, setKeepData] = useState(true);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focused]);

  const toggleOrigin = (origin, on) => {
    const next = on ? [...addition.grants.network, origin] : addition.grants.network.filter((o) => o !== origin);
    act(() => setGrants(addition.id, { network: next }), on ? `${view.title} can now connect to ${origin}. It restarted to use it.` : `${view.title} can no longer connect to ${origin}.`);
  };
  const togglePermission = (id, on) => {
    const next = on ? [...addition.grants.permissions, id] : addition.grants.permissions.filter((p) => p !== id);
    act(() => setGrants(addition.id, { permissions: next }));
  };
  const copyAgain = async () => {
    setCopying(true);
    await act(async () => {
      const { copyOldDataAgain } = await import('../../../services/additions/migrate.js');
      const n = await copyOldDataAgain(addition.id);
      if (!n) throw new Error(`No older data was found for ${view.title}.`);
    }, `${view.title}'s older data was copied again.`);
    setCopying(false);
  };
  const quotaChoices = QUOTA_CHOICES.includes(view.quotaBytes) ? QUOTA_CHOICES : [...QUOTA_CHOICES, view.quotaBytes].sort((a, b) => a - b);

  return (
    <section ref={ref} className={`rounded-xl border p-4 space-y-4 bg-slate-900/40 ${focused ? 'border-cyan-500/60' : 'border-slate-800'}`}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{view.title}</h3>
          <p className="text-[11px] text-slate-400">Version {view.version} · {view.publisher}</p>
        </div>
        {view.legacy && (
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/40 text-amber-300 bg-amber-500/10" title="Added before additions had permissions. It has been given none; review what it needs.">Added before permissions</span>
        )}
      </header>

      {view.notes.map((note) => (
        <p key={note} className="flex items-start gap-2 text-[11px] text-amber-200"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {note}</p>
      ))}

      <div className="space-y-1.5">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Permissions</h4>
        {view.permissions.length === 0
          ? <p className="text-xs text-slate-400">Asks for none. It can keep its own data and match your theme.</p>
          : view.permissions.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-xs text-slate-200">
              <input type="checkbox" checked={p.granted} onChange={(e) => togglePermission(p.id, e.target.checked)} className="accent-cyan-500" />
              {p.label}
            </label>
          ))}
      </div>

      <div className="space-y-1.5">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Network</h4>
        {view.network.length === 0
          ? <p className="text-xs text-slate-400">Can't load or fetch anything outside this computer.</p>
          : view.network.map((n) => (
            <label key={n.origin} className="flex items-center gap-2 text-xs text-slate-200">
              <input type="checkbox" checked={n.granted} onChange={(e) => toggleOrigin(n.origin, e.target.checked)} className="accent-cyan-500" />
              <span className="font-mono">{n.origin.replace(/^https:\/\//, '')}</span>
              <span className="text-[10px] text-slate-500">{n.declared ? 'it says it needs this' : 'it tried to connect'}</span>
            </label>
          ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
        <HardDrive className="w-3.5 h-3.5 text-slate-500" />
        <span>Uses {view.usage} of</span>
        <select
          value={view.quotaBytes}
          onChange={(e) => act(() => setQuota(addition.id, Number(e.target.value)), `${view.title} can now keep up to ${formatBytes(Number(e.target.value))}.`)}
          className="bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-600"
        >
          {quotaChoices.map((q) => <option key={q} value={q}>{formatBytes(q)}</option>)}
        </select>
      </div>

      <footer className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
        {view.legacy && (
          <button onClick={copyAgain} disabled={copying} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-50">
            <RotateCcw className="w-3.5 h-3.5" /> {copying ? 'Copying…' : 'Copy old data again'}
          </button>
        )}
        {!confirming && (
          <button onClick={() => setConfirming(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-rose-300 hover:bg-rose-500/10">
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </button>
        )}
        {confirming && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-200">
            <span>Remove {view.title} from Sovereign?</span>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={keepData} onChange={(e) => setKeepData(e.target.checked)} className="accent-cyan-500" /> Keep its data
            </label>
            <button onClick={() => act(() => removeAddition(addition.id, { keepData }), `${view.title} was removed${keepData ? '; its data was kept' : ''}.`)} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-500">Remove</button>
            <button onClick={() => setConfirming(false)} className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white">Cancel</button>
          </div>
        )}
      </footer>
    </section>
  );
}
