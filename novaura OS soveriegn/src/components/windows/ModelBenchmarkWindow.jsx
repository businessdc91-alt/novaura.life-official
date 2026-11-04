import React, { useEffect, useMemo, useState } from 'react';
import { Trophy, Cpu, Gauge, ExternalLink, Download, Loader2, Info, ArrowUpDown, Check } from 'lucide-react';
import { OPEN_MODELS, FRONTIER, BENCHMARKS, RETRIEVED, scoreOf } from '../../services/benchmarks/modelBenchmarks.js';
import { getNativeHardwareSpec } from '../../services/nativeService.js';
import { listBuiltinModels, speedTest, speedTestHistory, subscribeBuiltinAi } from '../../services/engines/builtinAi.js';

const TABS = [
  ['open', 'Open models for your PC', Cpu],
  ['frontier', 'Frontier models', Trophy],
  ['local', 'Test on this PC', Gauge],
];

function openGetIt(download) {
  const props = { ...(download.builtin ? { builtinModel: download.builtin } : { hfRepo: download.repo }), openId: `${Date.now()}` };
  window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: { appId: 'ai_engines', props, toggle: false } }));
  window.dispatchEvent(new CustomEvent('novaura:app_context', { detail: { appId: 'ai_engines', props } }));
}

function ScoreCell({ cell, best }) {
  if (!cell) return <td className="px-2 py-1.5 text-center text-slate-600">—</td>;
  return (
    <td className="px-2 py-1.5 text-center relative" title={cell.note ? `${cell.value} (${cell.note})` : String(cell.value)}>
      <div className="absolute inset-y-1 left-1 rounded bg-cyan-500/10" style={{ width: `calc(${Math.min(100, cell.value)}% - 0.5rem)` }} />
      <span className={`relative font-mono ${best ? 'text-cyan-200 font-semibold' : 'text-slate-200'}`}>{cell.value.toFixed(1)}</span>
      {cell.note && <span className="relative ml-0.5 text-[9px] text-amber-300/90 align-super">{cell.note}</span>}
    </td>
  );
}

function OpenModels({ memoryGb }) {
  const [sort, setSort] = useState({ key: 'gpqa', dir: -1 });
  const [fitsOnly, setFitsOnly] = useState(false);
  const rows = useMemo(() => {
    const list = OPEN_MODELS.filter(m => !fitsOnly || !memoryGb || m.gb * 1.2 <= memoryGb);
    const val = (m) => (sort.key === 'gb' ? m.gb : sort.key === 'released' ? m.released : scoreOf(m, sort.key)?.value ?? -1);
    return [...list].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [sort, fitsOnly, memoryGb]);
  const bestOf = Object.fromEntries(BENCHMARKS.map(b => [b.key, Math.max(...rows.map(m => (scoreOf(m, b.key)?.note ? -1 : scoreOf(m, b.key)?.value ?? -1)))]));
  const head = (key, label, title) => (
    <th key={key} title={title} onClick={() => setSort(s => ({ key, dir: s.key === key ? -s.dir : -1 }))} className="px-2 py-2 font-semibold text-slate-300 cursor-pointer hover:text-white whitespace-nowrap select-none">
      <span className="inline-flex items-center gap-1">{label}{sort.key === key && <ArrowUpDown className="w-3 h-3 text-cyan-300" />}</span>
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="text-[12px] text-slate-400 leading-relaxed">
        Scores are each maker's own published results for the instruction-tuned model, linked on every row. A small note on a number
        means it is a different version of that test (for example LiveCodeBench v5, AIME 2025, or SWE-bench Pro), so it is not directly comparable with the rest of its column.
        The size is the 4-bit download the built-in AI uses.
      </div>
      <label className="flex items-center gap-2 text-[12px] text-slate-300">
        <input type="checkbox" checked={fitsOnly} onChange={e => setFitsOnly(e.target.checked)} />
        Only models that fit this PC{memoryGb ? ` (${Math.round(memoryGb)} GB of RAM and graphics memory)` : ''}
      </label>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-[12px]">
          <thead className="bg-slate-900/80 text-left">
            <tr>
              {head('name', 'Model')}
              {head('released', 'Released')}
              {head('gb', 'Size')}
              {BENCHMARKS.map(b => head(b.key, b.label, b.about))}
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map(m => (
              <tr key={m.name} className={`border-t border-slate-800/80 ${m.pick ? 'bg-cyan-950/20' : 'hover:bg-slate-900/50'}`}>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    {m.name}
                    {m.pick && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-600/30 text-cyan-200">Built-in default</span>}
                    <a href={m.source.url} target="_blank" rel="noreferrer" title={`Source: ${m.source.label}`} className="text-slate-500 hover:text-cyan-300"><ExternalLink className="w-3 h-3" /></a>
                  </div>
                  <div className="text-[10px] text-slate-500">{m.maker} · {m.params} · {m.license}</div>
                </td>
                <td className="px-2 py-1.5 text-slate-400 whitespace-nowrap">{m.released}</td>
                <td className="px-2 py-1.5 text-slate-300 whitespace-nowrap font-mono">{m.gb.toFixed(1)} GB</td>
                {BENCHMARKS.map(b => <ScoreCell key={b.key} cell={scoreOf(m, b.key)} best={scoreOf(m, b.key)?.value === bestOf[b.key] && !scoreOf(m, b.key)?.note} />)}
                <td className="px-2 py-1.5">
                  <button onClick={() => openGetIt(m.download)} className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-cyan-800 text-[11px] text-slate-200 whitespace-nowrap" title={m.download.builtin ? 'Download with the built-in AI' : `Open ${m.download.repo} in the built-in AI`}>
                    <Download className="w-3 h-3" /> Get it
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Frontier() {
  const max = Math.max(...FRONTIER.map(f => f.index));
  return (
    <div className="space-y-3">
      <div className="text-[12px] text-slate-400 leading-relaxed">
        Makers test their models on different benchmarks, so this list uses one independent score instead: the
        {' '}<a className="text-cyan-300 hover:underline" href="https://artificialanalysis.ai/leaderboards/models" target="_blank" rel="noreferrer">Artificial Analysis Intelligence Index v5</a>,
        {' '}which runs the same evaluations (many of them private) on every model. Higher is better. The open models here are server-class; most need far more memory than a PC has.
      </div>
      <div className="space-y-1.5">
        {FRONTIER.map(f => (
          <div key={f.name} className="flex items-center gap-3 text-[12px]">
            <div className="w-52 shrink-0">
              <div className="text-white font-semibold">{f.name}{f.setting && <span className="text-slate-500 font-normal"> ({f.setting})</span>}</div>
              <div className="text-[10px] text-slate-500">{f.maker}{f.released ? ` · ${f.released}` : ''} · {f.weights}{f.access ? ` · ${f.access}` : ''}</div>
            </div>
            <div className="flex-1 h-5 bg-slate-900 rounded relative overflow-hidden">
              <div className={`h-full ${f.weights === 'Closed' ? 'bg-gradient-to-r from-purple-600 to-fuchsia-500' : 'bg-gradient-to-r from-cyan-700 to-cyan-400'}`} style={{ width: `${(f.index / max) * 100}%` }} />
            </div>
            <span className="w-8 text-right font-mono text-slate-100">{f.index}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-fuchsia-500" /> Closed weights</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-cyan-500" /> Open weights</span>
      </div>
    </div>
  );
}

function LocalTest() {
  const [models, setModels] = useState([]);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const refresh = async () => {
    setModels((await listBuiltinModels().catch(() => [])).filter(m => m.complete));
    setHistory(await speedTestHistory());
  };
  useEffect(() => { refresh(); return subscribeBuiltinAi(refresh); }, []);

  const run = async (id) => {
    setBusy(id);
    setError('');
    try { await speedTest(id); } catch (e) { setError(e.message); } finally { setBusy(''); refresh(); }
  };

  if (!models.length) {
    return (
      <div className="text-[12px] text-slate-400 space-y-2">
        <div>Download a model with the built-in AI, then measure how fast it runs on this PC.</div>
        <button onClick={() => openGetIt({ builtin: 'gemma-4-e4b' })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-700 text-white text-[12px]"><Download className="w-3.5 h-3.5" /> Set up the built-in AI</button>
      </div>
    );
  }
  const latest = Object.fromEntries([...history].reverse().map(h => [h.modelId, h]));
  return (
    <div className="space-y-3">
      <div className="text-[12px] text-slate-400">Each test writes the same 200-word story and reads llama.cpp's own timings. Reading speed is how fast the prompt is taken in; writing speed is how fast the reply comes out (about 5 words a second reads comfortably).</div>
      {error && <div className="text-[12px] text-rose-300">{error}</div>}
      <div className="space-y-1.5">
        {models.map(m => {
          const r = latest[m.id];
          return (
            <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg border border-slate-800 text-[12px]">
              <span className="flex-1 text-white truncate">{m.id}</span>
              {r ? (
                <span className="text-slate-300 font-mono">{r.genTps} tokens/s writing · {r.promptTps} reading{r.cpuOnly ? ' · CPU' : ''}</span>
              ) : <span className="text-slate-500">Not tested yet</span>}
              <button onClick={() => run(m.id)} disabled={Boolean(busy)} className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-cyan-800 text-slate-200 disabled:opacity-40">
                {busy === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gauge className="w-3.5 h-3.5" />} {busy === m.id ? 'Testing…' : r ? 'Test again' : 'Test'}
              </button>
            </div>
          );
        })}
      </div>
      {history.length > 0 && (
        <details className="text-[11px] text-slate-400">
          <summary className="cursor-pointer hover:text-slate-200">All results</summary>
          <div className="mt-1 space-y-0.5 font-mono">
            {history.map(h => <div key={h.at}>{h.at.slice(0, 16).replace('T', ' ')} · {h.modelId} · {h.genTps} t/s writing · {h.promptTps} t/s reading · {h.genTokens} tokens in {h.seconds}s{h.cpuOnly ? ' · CPU only' : ''}</div>)}
          </div>
        </details>
      )}
    </div>
  );
}

/** Real, sourced model benchmarks, plus a speed test of the models on this PC. */
export default function ModelBenchmarkWindow() {
  const [tab, setTab] = useState('open');
  const [memoryGb, setMemoryGb] = useState(0);
  useEffect(() => {
    getNativeHardwareSpec().then(s => setMemoryGb((Number(s?.ram_gb) || 0) + (Number(s?.total_vram_gb) || 0))).catch(() => {});
  }, []);

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100">
      <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-3 shrink-0">
        <Trophy className="w-5 h-5 text-cyan-300" />
        <div>
          <div className="text-sm font-bold">AI Benchmarks</div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1"><Info className="w-3 h-3" /> Published results, checked {RETRIEVED}. Every number links to where it came from.</div>
        </div>
        <div className="ml-auto flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
          {TABS.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] ${tab === id ? 'bg-cyan-700 text-white' : 'text-slate-400 hover:text-white'}`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {tab === 'open' && <OpenModels memoryGb={memoryGb} />}
        {tab === 'frontier' && <Frontier />}
        {tab === 'local' && <LocalTest />}
      </div>
      <div className="px-5 py-2 border-t border-slate-800 text-[10px] text-slate-500 flex items-center gap-1 shrink-0">
        <Check className="w-3 h-3" /> Benchmarks measure narrow skills under each maker's own settings; they are a guide, not a guarantee of how a model will do on your work.
      </div>
    </div>
  );
}
