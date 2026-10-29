import React, { useEffect, useState } from 'react';
import { Key, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, Loader2, Copy, RefreshCw } from 'lucide-react';
import { kernel } from '../../../kernel/NovaKernel.js';
import { db } from '../../../database/sovereignDatabase.js';
import { PROVIDERS, modelSetting, listProviderModels, testProvider } from '../../../services/cloudProviders.js';

// Bring-your-own-key providers: key, model, extra models for Cybeni roles,
// endpoint/region where needed, and a live test. Everything stays in the local vault.

const saveVault = async (name, value) => {
  const id = name.toLowerCase();
  if (kernel?.ai?.setKey) kernel.ai.setKey(id, value);
  else await db.vault.put({ id, key: id, value, category: 'api_key', updated_at: new Date().toISOString() });
  kernel?.ipc?.emit('vault:keys_updated');
};

const readKey = (name) => kernel?.ai?._cloudKey?.(name) || kernel?.ai?.getKey?.(name) || '';

function ProviderCard({ provider, values, onSaved }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({});
  const [models, setModels] = useState(provider.suggested || []);
  const [loading, setLoading] = useState(false);
  const [test, setTest] = useState(null);
  const v = (name) => (name in draft ? draft[name] : values[name] || '');
  const hasKey = Boolean(values[provider.id]);
  const model = v(modelSetting(provider.id)) || provider.defaultModel;

  const save = async () => {
    for (const [name, value] of Object.entries(draft)) await saveVault(name, value.trim());
    setDraft({});
    onSaved(`${provider.label} saved.`);
  };

  const loadModels = async () => {
    setLoading(true);
    setTest(null);
    try {
      if (Object.keys(draft).length) await save();
      const list = await listProviderModels(provider.id, readKey);
      setModels(list.length ? list : provider.suggested || []);
      if (!list.length) setTest({ ok: false, text: 'The provider listed no models for this key.' });
    } catch (err) {
      setTest({ ok: false, text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const runTest = async () => {
    setLoading(true);
    setTest(null);
    const started = performance.now();
    try {
      if (Object.keys(draft).length) await save();
      const reply = await testProvider(provider.id, readKey);
      setTest({ ok: true, text: `Connected in ${((performance.now() - started) / 1000).toFixed(1)} s. Reply: "${String(reply).trim().slice(0, 60)}"` });
    } catch (err) {
      setTest({ ok: false, text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const input = 'w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 outline-none focus:border-cyan-500';

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800/50 text-left">
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
        <span className="text-xs font-semibold text-slate-100">{provider.label}</span>
        <span className="text-[11px] text-slate-500">{provider.vendor}</span>
        <span className="ml-auto text-[11px]">
          {hasKey ? <span className="text-emerald-400">● {model || 'choose a model'}</span> : <span className="text-slate-600">no key</span>}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2.5 bg-slate-950/40">
          {provider.note && <p className="text-[11px] text-slate-400">{provider.note}</p>}
          {provider.custom && (
            <label className="block text-[11px] text-slate-400">Endpoint (OpenAI-compatible base URL)
              <input className={`${input} mt-1 font-mono`} placeholder="https://my-server:8000/v1" value={v('byok_endpoint')} onChange={e => setDraft(d => ({ ...d, byok_endpoint: e.target.value }))} />
            </label>
          )}
          {provider.kind === 'bedrock' && (
            <label className="block text-[11px] text-slate-400">AWS region
              <input className={`${input} mt-1 font-mono`} placeholder={provider.region} value={v('bedrock_region')} onChange={e => setDraft(d => ({ ...d, bedrock_region: e.target.value }))} />
            </label>
          )}
          <label className="block text-[11px] text-slate-400">API key
            <input type="password" className={`${input} mt-1 font-mono`} placeholder={hasKey ? 'Saved. Paste a new key to replace it.' : 'Paste your key'} value={draft[provider.id] ?? ''} onChange={e => setDraft(d => ({ ...d, [provider.id]: e.target.value }))} />
          </label>
          {provider.keyUrl && (
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              Get a key: <span className="font-mono text-slate-300 truncate">{provider.keyUrl}</span>
              <button title="Copy link" onClick={() => navigator.clipboard?.writeText(provider.keyUrl)} className="text-slate-400 hover:text-white"><Copy className="w-3 h-3" /></button>
            </div>
          )}
          <label className="block text-[11px] text-slate-400">Model
            <div className="flex gap-2 mt-1">
              <input list={`models-${provider.id}`} className={`${input} font-mono`} placeholder={provider.defaultModel || 'Load the list or type a model id'} value={v(modelSetting(provider.id))} onChange={e => setDraft(d => ({ ...d, [modelSetting(provider.id)]: e.target.value }))} />
              <datalist id={`models-${provider.id}`}>{models.map(m => <option key={m} value={m} />)}</datalist>
              <button onClick={loadModels} disabled={loading || (!hasKey && !draft[provider.id])} title="Load the models this key can use" className="px-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
            </div>
          </label>
          <label className="block text-[11px] text-slate-400">Extra models for Cybeni roles (comma separated, optional)
            <input className={`${input} mt-1 font-mono`} placeholder="for example a fast model for the architect" value={v(`${provider.id}_extra_models`)} onChange={e => setDraft(d => ({ ...d, [`${provider.id}_extra_models`]: e.target.value }))} />
          </label>
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={!Object.keys(draft).length} className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium">Save</button>
            <button onClick={runTest} disabled={loading || (!hasKey && !draft[provider.id])} className="px-3 py-1.5 border border-slate-700 text-slate-200 hover:border-slate-500 disabled:opacity-40 rounded-lg text-xs flex items-center gap-1.5">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Test connection
            </button>
            {hasKey && (
              <button onClick={async () => { await saveVault(provider.id, ''); onSaved(`${provider.label} key removed.`); }} className="ml-auto text-[11px] text-rose-400 hover:text-rose-300">Remove key</button>
            )}
          </div>
          {test && (
            <div className={`flex items-start gap-1.5 text-[11px] ${test.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
              {test.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />}
              <span className="break-words">{test.text}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CloudKeysPanel() {
  const [values, setValues] = useState({});
  const [notice, setNotice] = useState('');

  const load = async () => {
    try {
      const out = {};
      for (const r of await db.vault.toArray()) if (r.key) out[r.key.toLowerCase()] = r.value || '';
      setValues(out);
    } catch (err) {
      console.warn('[CloudKeys]', err);
    }
  };

  useEffect(() => { load(); }, []);

  const onSaved = (text) => {
    setNotice(text);
    setTimeout(() => setNotice(n => (n === text ? '' : n)), 3000);
    setTimeout(load, 150);
  };

  return (
    <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
      <div className="flex items-center gap-2">
        <Key className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-semibold text-slate-200">Frontier models with your own keys</span>
        {notice && <span className="ml-auto text-[11px] text-emerald-400">{notice}</span>}
      </div>
      <p className="text-[11px] text-slate-400">
        Sovereign runs on your own models first. If you already pay for a provider, add its key here and use it in Aura, Cybeni and every other app.
        Keys stay in this PC's private vault and are only sent to that provider.
      </p>
      <div className="space-y-1.5">
        {PROVIDERS.map(p => <ProviderCard key={p.id} provider={p} values={values} onSaved={onSaved} />)}
      </div>
    </div>
  );
}
