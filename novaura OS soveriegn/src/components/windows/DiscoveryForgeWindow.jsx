import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Search, Sparkles, Loader2, GitBranch, Box, Gamepad2, Image as ImageIcon, HardDrive, Star, Heart, Download, ExternalLink,
  ShieldCheck, AlertTriangle, Wand2, Hammer, CheckCircle2, XCircle, Circle, MinusCircle, Palette, Rocket, Monitor, Store,
  Code2, Send, Lightbulb, RefreshCw, FileArchive, X,
} from 'lucide-react';
import {
  discover, importResult, getBrandProfile, setBrandProfile, rebrandProject, runForgeChange, suggestEnhancements,
  forgeProjects, generateAppIcon, integrateAsApp, installToDesktop, publishProject, listUserApps,
} from '../../services/forge/forgeService.js';
import { VERDICT_TONE } from '../../services/forge/licenses.js';
import { phasesFor, MODES } from '../../services/cybeni/pipeline.js';
import { loadProjectFiles, buildZip, downloadBytes, updateProject } from '../../services/cybeni/projectStore.js';
import { publishPreview, clearPreview, newSessionId } from '../../services/cybeni/previewHost.js';
import { Cover } from './music/shared.jsx';

const SOURCE_CHIPS = [
  ['github', 'GitHub', GitBranch], ['hf_spaces', 'HF Spaces', Box], ['hf_models', 'HF Models', Sparkles],
  ['itch', 'itch.io games', Gamepad2], ['itch_assets', 'itch.io assets', ImageIcon], ['drive', 'Google Drive', HardDrive],
];
const TONE = { good: 'border-emerald-500/50 text-emerald-300 bg-emerald-950/30', warn: 'border-amber-500/50 text-amber-300 bg-amber-950/30', bad: 'border-rose-500/50 text-rose-300 bg-rose-950/30' };
const EXAMPLES = ['A habit tracker web app I can rebrand and sell', 'Free pixel art tilesets for a cozy farming game', 'A lightweight markdown note-taking app', 'An image upscaling model that runs locally', 'A browser-based music visualizer'];

function fmtNum(n) {
  if (!n) return '0';
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n);
}

function openLink(url) {
  window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: { appId: 'browser', props: { url } } }));
}

function ResultCard({ r, onImport, importing }) {
  const [open, setOpen] = useState(false);
  const tone = TONE[VERDICT_TONE[r.license.category] || 'bad'];
  return (
    <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-600 transition-colors">
      <div className="flex gap-3">
        {r.thumb && <img src={r.thumb} alt="" className="w-20 h-16 rounded-md object-cover shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold text-white">{r.title}</span>
            <span className="text-[11px] text-slate-400">by {r.author}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{SOURCE_CHIPS.find(s => s[0] === r.source || (r.source === 'itch' && s[0] === 'itch'))?.[1] || r.source}</span>
            {typeof r.fit === 'number' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-900/60 text-indigo-200">fit {r.fit}/10</span>}
          </div>
          <div className="text-[12px] text-slate-300 mt-0.5">{r.summary || r.description || 'No description.'}</div>
          {r.watchOut && <div className="text-[11px] text-amber-300 mt-0.5 flex gap-1"><AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{r.watchOut}</div>}
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 flex-wrap">
            {r.stats.stars != null && <span className="flex items-center gap-1"><Star className="w-3 h-3" />{fmtNum(r.stats.stars)}</span>}
            {r.stats.likes != null && <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{fmtNum(r.stats.likes)}</span>}
            {r.stats.downloads != null && <span className="flex items-center gap-1"><Download className="w-3 h-3" />{fmtNum(r.stats.downloads)}</span>}
            {r.rating && <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-300" />{r.rating.average} from {r.rating.count} reviews</span>}
            {r.price && <span>{r.price}</span>}
            {r.language && <span>{r.language}</span>}
            {r.stats.updated && <span>updated {new Date(r.stats.updated).toLocaleDateString()}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <button onClick={() => setOpen(o => !o)} className={`text-[11px] px-2 py-0.5 rounded border ${tone}`}>
          <ShieldCheck className="w-3 h-3 inline mr-1" />{r.licenseId || 'No license'} · {r.license.verdict}
        </button>
        <span className="ml-auto flex gap-2">
          <button onClick={() => openLink(r.url)} className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-700 text-slate-300 text-[11px] hover:text-white"><ExternalLink className="w-3 h-3" /> Open page</button>
          {r.importable && (
            <button onClick={() => onImport(r)} disabled={importing || !r.license.rebrand} title={r.license.rebrand ? '' : 'Its license does not allow modified versions'} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-600 text-white text-[11px] font-semibold disabled:opacity-40">
              {importing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Hammer className="w-3 h-3" />} Import & rebrand
            </button>
          )}
        </span>
      </div>
      {open && (
        <div className="mt-2 p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
          <div className="font-semibold text-slate-200">{r.license.summary}</div>
          <ul className="mt-1 list-disc pl-4 space-y-0.5">{r.license.obligations.map((o, i) => <li key={i}>{o}</li>)}</ul>
          <div className="mt-1 text-slate-500">White-label: {r.license.whiteLabel ? 'yes' : 'no'} · Commercial use: {r.license.commercial ? 'yes' : 'no'} · Not legal advice.</div>
        </div>
      )}
    </div>
  );
}

function Discover({ onImported, say }) {
  const [request, setRequest] = useState('');
  const [sources, setSources] = useState([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState(null);
  const [importing, setImporting] = useState('');

  const run = async (text = request) => {
    if (!text.trim()) return;
    setBusy(true);
    setFound(null);
    try {
      setFound(await discover(text, { sources, onStatus: setStatus }));
    } catch (err) {
      say(err.message);
    } finally {
      setBusy(false);
      setStatus('');
    }
  };

  const doImport = async (r) => {
    setImporting(r.id);
    try {
      const res = await importResult(r, { onStatus: setStatus });
      say(`Imported "${r.title}": ${res.imported} files${res.assets ? `, ${res.assets} images and media linked to the source` : ''}.`, 'good');
      onImported(res.project);
    } catch (err) {
      say(err.message);
    } finally {
      setImporting('');
      setStatus('');
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-900/30 via-slate-900 to-indigo-900/30 border border-slate-700">
        <div className="flex items-center gap-2 text-white font-semibold"><Sparkles className="w-4 h-4 text-amber-300" /> Ask Aura</div>
        <div className="text-[12px] text-slate-400 mb-2">Describe the app, model or asset you want. Aura searches open source, explains each license, and helps you make it yours.</div>
        <form onSubmit={e => { e.preventDefault(); run(); }} className="flex gap-2">
          <input value={request} onChange={e => setRequest(e.target.value)} placeholder="e.g. a kanban board app I can rebrand for my agency" className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500" />
          <button disabled={busy || !request.trim()} className="flex items-center gap-1.5 px-4 rounded-lg bg-amber-600 text-white text-[13px] font-semibold disabled:opacity-40">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search</button>
        </form>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className="text-[11px] text-slate-500 mr-1 self-center">Sources:</span>
          {SOURCE_CHIPS.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setSources(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]))} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${sources.includes(id) ? 'border-amber-400 text-amber-200 bg-amber-900/30' : 'border-slate-700 text-slate-400'}`}><Icon className="w-3 h-3" />{label}</button>
          ))}
          <span className="text-[11px] text-slate-500 self-center">{sources.length ? '' : '(Aura picks)'}</span>
        </div>
        {!found && !busy && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {EXAMPLES.map(x => <button key={x} onClick={() => { setRequest(x); run(x); }} className="px-2.5 py-1 rounded-lg bg-slate-800/80 text-[11px] text-slate-300 hover:text-white">{x}</button>)}
          </div>
        )}
      </div>
      {status && <div className="flex items-center gap-2 text-[12px] text-amber-200"><Loader2 className="w-4 h-4 animate-spin" />{status}</div>}
      {found && (
        <>
          <div className="text-[12px] text-slate-400">Aura understood: <span className="text-slate-200">{found.plan.intent}</span> · searched {found.plan.sources.join(', ')}{found.plan.planned === 'heuristic' ? ' (no AI model running, so results are ranked by popularity and license)' : ''}</div>
          {Object.entries(found.errors).map(([s, e]) => <div key={s} className="text-[11px] text-rose-300">{s}: {e}</div>)}
          {found.results.length === 0 && <div className="text-[13px] text-slate-400">Nothing found. Try different words or other sources.</div>}
          <div className="space-y-2">{found.results.map(r => <ResultCard key={`${r.source}:${r.id}`} r={r} onImport={doImport} importing={importing === r.id} />)}</div>
        </>
      )}
    </div>
  );
}

function StatusIcon({ status }) {
  if (status === 'running') return <Loader2 className="w-3.5 h-3.5 text-amber-300 animate-spin" />;
  if (status === 'done') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  if (status === 'failed') return <XCircle className="w-3.5 h-3.5 text-rose-400" />;
  if (status === 'skipped') return <MinusCircle className="w-3.5 h-3.5 text-slate-500" />;
  return <Circle className="w-3.5 h-3.5 text-slate-700" />;
}

function Workbench({ projects, selected, setSelected, brand, say, refresh }) {
  const project = projects.find(p => p.slug === selected) || projects[0];
  const [mode, setMode] = useState('standard');
  const [running, setRunning] = useState(false);
  const [phases, setPhases] = useState([]);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [doc, setDoc] = useState(null);
  const [ideas, setIdeas] = useState([]);
  const [thinking, setThinking] = useState(false);
  const [change, setChange] = useState('');
  const [summary, setSummary] = useState('');
  const session = useRef(newSessionId());
  const cancel = useRef(false);
  const liveTimer = useRef(null);

  const preview = useCallback(async (files) => {
    if (!project) return;
    const list = files || await loadProjectFiles(project.slug);
    setDoc({ ...(await publishPreview(session.current, list)), key: Date.now() });
  }, [project]);

  useEffect(() => {
    if (project) { preview(); setIdeas([]); setSummary(''); setPhases([]); }
    const s = session.current;
    return () => { clearPreview(s); };
  }, [project?.slug]); // reload only when a different project is selected

  if (!project) return <div className="h-full flex items-center justify-center text-[13px] text-slate-400">Import something from Discover to start.</div>;

  const hooks = {
    onPhase: (id, patch) => setPhases(ps => ps.map(p => (p.id === id ? { ...p, ...patch } : p))),
    onFiles: (files) => { clearTimeout(liveTimer.current); liveTimer.current = setTimeout(() => preview(files), 1500); },
    ask: (text) => new Promise(resolve => setQuestion({ text, resolve })),
    isCancelled: () => cancel.current,
  };

  const run = async (label, fn, m) => {
    setRunning(true);
    cancel.current = false;
    setPhases(phasesFor(m).map(p => ({ ...p, status: 'pending' })));
    setSummary('');
    try {
      const res = await fn();
      setSummary(res.status === 'done' ? (res.summary || `${label}: ${res.changed.length} files changed.`) : `${label} ${res.status}: ${res.error || ''}`);
      await preview();
      await refresh();
    } catch (err) {
      say(err.message);
    } finally {
      setRunning(false);
      setQuestion(null);
    }
  };

  const rebrand = () => run('Rebrand', () => rebrandProject(project.slug, { brand, mode, hooks }), mode);
  const apply = (instruction, label = 'Change') => run(label, () => runForgeChange(project.slug, instruction, { mode: 'quick', hooks }), 'quick');
  const review = async () => {
    setThinking(true);
    try { setIdeas(await suggestEnhancements(project.slug)); } catch (err) { say(err.message); } finally { setThinking(false); }
  };

  return (
    <div className="h-full flex min-h-0">
      <div className="w-[340px] shrink-0 border-r border-slate-800 flex flex-col min-h-0">
        <div className="p-3 border-b border-slate-800">
          <select value={project.slug} onChange={e => setSelected(e.target.value)} disabled={running} className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-[13px] text-white">
            {projects.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </select>
          <div className="text-[11px] text-slate-400 mt-1.5">From <button onClick={() => openLink(project.origin.url)} className="underline">{project.origin.id}</button> by {project.origin.author}</div>
          <div className="text-[11px] mt-1 text-emerald-300/90">{project.origin.license || 'license in project'} · {project.origin.licenseVerdict}</div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-700">
            <div className="text-[12px] font-semibold text-white flex items-center gap-1.5"><Palette className="w-3.5 h-3.5 text-amber-300" /> Rebrand as {brand.name || '(set your brand)'}</div>
            <div className="flex gap-1.5 mt-2">{Object.entries(MODES).map(([id, m]) => <button key={id} onClick={() => setMode(id)} title={m.description} className={`px-2 py-0.5 rounded text-[11px] border ${mode === id ? 'border-amber-400 text-amber-200' : 'border-slate-700 text-slate-400'}`}>{m.label}</button>)}</div>
            <button onClick={rebrand} disabled={running || !brand.name} className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-rose-600 text-white text-[12px] font-semibold disabled:opacity-40">{running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Rebrand, review & self-repair</button>
            {!brand.name && <div className="text-[11px] text-amber-300 mt-1">Set your brand in the Brand tab first.</div>}
          </div>

          {question && (
            <div className="p-2.5 rounded-lg border border-amber-500/40 bg-amber-950/30 text-[12px]">
              <div className="text-amber-200 font-semibold">The AI needs your input</div>
              <div className="text-white mt-1">{question.text}</div>
              <form onSubmit={e => { e.preventDefault(); question.resolve(answer || 'Use your best judgement.'); setQuestion(null); setAnswer(''); }} className="flex gap-1.5 mt-2">
                <input autoFocus value={answer} onChange={e => setAnswer(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white" />
                <button className="px-2 rounded bg-amber-600 text-white">Answer</button>
              </form>
            </div>
          )}

          {phases.length > 0 && (
            <div className="space-y-0.5">
              {phases.map(p => (
                <div key={p.id} className="flex gap-2 text-[11px]">
                  <StatusIcon status={p.status} />
                  <div className="min-w-0"><span className={p.status === 'pending' ? 'text-slate-500' : 'text-slate-200'}>{p.label}</span>{p.note && p.status !== 'pending' && <div className="text-slate-400 leading-snug">{p.note}</div>}</div>
                </div>
              ))}
              {running && <button onClick={() => { cancel.current = true; }} className="mt-1 text-[11px] text-rose-300">Stop</button>}
            </div>
          )}
          {summary && <div className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-slate-200 whitespace-pre-wrap">{summary}</div>}

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-700">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-white"><Lightbulb className="w-3.5 h-3.5 text-yellow-300" /> Enhancements & new ideas</div>
            <button onClick={review} disabled={thinking || running} className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-slate-600 text-slate-200 text-[12px] disabled:opacity-40">{thinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Ask the AI for improvements</button>
            <div className="space-y-1.5 mt-2">
              {ideas.map((x, i) => (
                <div key={i} className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-2"><span className="text-[12px] font-semibold text-white">{x.title}</span><span className="ml-auto text-[10px] text-slate-500">{x.effort}</span></div>
                  <div className="text-[11px] text-slate-400">{x.why}</div>
                  <button onClick={() => apply(x.change, x.title)} disabled={running} className="mt-1 text-[11px] text-amber-300 hover:text-amber-100 disabled:opacity-40">Apply with one click</button>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-700">
            <div className="text-[12px] font-semibold text-white">Tell the AI what to change</div>
            <form onSubmit={e => { e.preventDefault(); if (change.trim()) { apply(change.trim()); setChange(''); } }} className="mt-2 space-y-1.5">
              <textarea value={change} onChange={e => setChange(e.target.value)} rows={3} placeholder="e.g. add a dark mode toggle and move the stats to a sidebar" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-[12px] text-white resize-none" />
              <div className="flex gap-2">
                <button disabled={running || !change.trim()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[12px] disabled:opacity-40"><Send className="w-3.5 h-3.5" /> Make the change</button>
                <button type="button" onClick={() => { window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: { appId: 'cybeni', props: { project: project.slug } } })); window.dispatchEvent(new CustomEvent('novaura:cybeni_open_project', { detail: project.slug })); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-600 text-slate-200 text-[12px]"><Code2 className="w-3.5 h-3.5" /> Open in Cybeni</button>
              </div>
            </form>
          </div>

          {project.forge?.status !== 'complete' && (
            <button onClick={async () => { await updateProject(project.slug, { forge: { ...(project.forge || {}), status: 'complete' } }); refresh(); say('Moved to Completed.', 'good'); }} className="w-full text-[11px] text-slate-500 hover:text-slate-300">Mark as complete</button>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-8 px-3 flex items-center gap-2 border-b border-slate-800 text-[11px] text-slate-400">
          <ShieldCheck className="w-3 h-3 text-emerald-400" /> Live preview, isolated sandbox
          <button onClick={() => preview()} className="ml-auto text-slate-400 hover:text-white"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
        <div className="flex-1 bg-white">{doc && <iframe key={doc.key} title="Forge preview" src={doc.src} srcDoc={doc.srcdoc} sandbox={doc.sandbox} className="w-full h-full border-0" />}</div>
      </div>
    </div>
  );
}

function Completed({ projects, say, refresh, openWorkbench }) {
  const done = projects.filter(p => p.forge?.status === 'complete');
  const [busy, setBusy] = useState({});
  const [installed, setInstalled] = useState([]);
  useEffect(() => { listUserApps().then(a => setInstalled(a.map(x => x.slug))); }, [projects]);

  const act = async (slug, label, fn) => {
    setBusy(b => ({ ...b, [slug]: label }));
    try { await fn(); } catch (err) { say(err.message); } finally { setBusy(b => ({ ...b, [slug]: '' })); }
  };

  if (!done.length) return <div className="h-full flex items-center justify-center text-[13px] text-slate-400 p-6 text-center">Rebranded apps land here, ready to add to Sovereign, install on your PC, or publish.</div>;

  return (
    <div className="h-full overflow-y-auto p-4 grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 content-start">
      {done.map(p => (
        <div key={p.slug} className="p-3 rounded-xl bg-slate-900/80 border border-slate-700">
          <div className="flex gap-3">
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-slate-800 shrink-0">
              <Cover blobId={p.iconBlobId} title={p.name} className="w-full h-full" />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-white truncate">{p.name}</div>
              <div className="text-[11px] text-slate-400 truncate">{p.brand?.tagline || 'Rebranded app'}</div>
              <div className="text-[10px] text-slate-500 truncate">Based on {p.origin.id} ({p.origin.license || 'see attribution'})</div>
            </div>
          </div>
          {busy[p.slug] && <div className="flex items-center gap-1.5 text-[11px] text-amber-200 mt-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />{busy[p.slug]}</div>}
          <div className="grid grid-cols-2 gap-1.5 mt-3 text-[11px]">
            <button onClick={() => act(p.slug, 'Generating icon…', async () => { const iconBlobId = await generateAppIcon(p.name, p.brand?.tagline || ''); await updateProject(p.slug, { iconBlobId }); refresh(); })} className="flex items-center gap-1 justify-center py-1.5 rounded-lg border border-slate-600 text-slate-200"><ImageIcon className="w-3.5 h-3.5" /> {p.iconBlobId ? 'New icon' : 'Generate icon'}</button>
            <button onClick={() => act(p.slug, 'Adding to Sovereign…', async () => { await integrateAsApp(p.slug, { name: p.name, color: p.brand?.primary, iconBlobId: p.iconBlobId }); setInstalled(i => [...i, p.slug]); say(`${p.name} is now an app in your launcher.`, 'good'); })} className="flex items-center gap-1 justify-center py-1.5 rounded-lg bg-emerald-700 text-white"><Rocket className="w-3.5 h-3.5" /> {installed.includes(p.slug) ? 'Update in Sovereign' : 'Add to Sovereign'}</button>
            <button onClick={() => act(p.slug, 'Installing to your desktop…', async () => { const link = await installToDesktop(p.slug, { name: p.name, iconBlobId: p.iconBlobId }); say(`Installed. Shortcut: ${link}`, 'good'); })} className="flex items-center gap-1 justify-center py-1.5 rounded-lg border border-slate-600 text-slate-200"><Monitor className="w-3.5 h-3.5" /> Install on this PC</button>
            <button onClick={() => act(p.slug, 'Packing…', async () => downloadBytes(`${p.slug}.zip`, buildZip(await loadProjectFiles(p.slug)), 'application/zip'))} className="flex items-center gap-1 justify-center py-1.5 rounded-lg border border-slate-600 text-slate-200"><FileArchive className="w-3.5 h-3.5" /> Export .zip</button>
            <button onClick={() => act(p.slug, 'Publishing…', async () => { await publishProject(p.slug, { category: 'apps' }); say('Published to the App Store.', 'good'); })} className="flex items-center gap-1 justify-center py-1.5 rounded-lg border border-slate-600 text-slate-200"><Store className="w-3.5 h-3.5" /> Publish app</button>
            <button onClick={() => act(p.slug, 'Publishing…', async () => { await publishProject(p.slug, { category: 'assets' }); say('Published to the Assets market.', 'good'); })} className="flex items-center gap-1 justify-center py-1.5 rounded-lg border border-slate-600 text-slate-200"><Box className="w-3.5 h-3.5" /> Publish as asset</button>
          </div>
          <button onClick={() => openWorkbench(p.slug)} className="mt-2 w-full text-[11px] text-slate-400 hover:text-white">Keep improving in the Workbench</button>
        </div>
      ))}
    </div>
  );
}

function Brand({ brand, setBrand }) {
  const [form, setForm] = useState(brand);
  useEffect(() => setForm(brand), [brand]);
  const save = async () => setBrand(await setBrandProfile(form));
  const field = (key, label, placeholder) => (
    <label className="block text-[11px] text-slate-400">{label}
      <input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} className="mt-0.5 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-[13px] text-white" />
    </label>
  );
  return (
    <div className="h-full overflow-y-auto p-4 max-w-xl space-y-3">
      <div className="text-lg font-bold text-white">Your brand</div>
      <div className="text-[12px] text-slate-400">Used when rebranding imported apps, generating icons and publishing.</div>
      {field('name', 'Brand or product name', 'e.g. Nova Notes')}
      {field('tagline', 'Tagline', 'e.g. Notes that think with you')}
      {field('company', 'Company or creator', 'e.g. NovAura')}
      {field('tone', 'Voice and tone', 'e.g. warm, confident, minimal')}
      <div className="flex gap-4">
        {[['primary', 'Primary colour'], ['secondary', 'Secondary colour']].map(([k, l]) => (
          <label key={k} className="text-[11px] text-slate-400">{l}
            <div className="flex items-center gap-2 mt-0.5"><input type="color" value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} className="w-10 h-8 rounded bg-transparent" /><span className="font-mono text-slate-300">{form[k]}</span></div>
          </label>
        ))}
      </div>
      <div className="p-4 rounded-xl" style={{ background: `linear-gradient(135deg, ${form.primary}, ${form.secondary})` }}>
        <div className="text-white text-xl font-black drop-shadow">{form.name || 'Your brand'}</div>
        <div className="text-white/85 text-[13px]">{form.tagline || 'Your tagline'}</div>
      </div>
      <button onClick={save} className="px-4 py-2 rounded-lg bg-amber-600 text-white text-[13px] font-semibold">Save brand</button>
    </div>
  );
}

export default function DiscoveryForgeWindow() {
  const [tab, setTab] = useState('discover');
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState('');
  const [brand, setBrand] = useState({ name: '', tagline: '', primary: '#7c3aed', secondary: '#06b6d4', tone: '', company: '' });
  const [notice, setNotice] = useState(null);

  const say = useCallback((text, tone = 'bad') => {
    setNotice({ text, tone });
    setTimeout(() => setNotice(n => (n?.text === text ? null : n)), 6000);
  }, []);
  const refresh = useCallback(async () => setProjects(await forgeProjects()), []);

  useEffect(() => { refresh(); getBrandProfile().then(setBrand); }, [refresh]);

  const tabs = [['discover', 'Discover', Search], ['workbench', 'Workbench', Hammer], ['completed', 'Completed', CheckCircle2], ['brand', 'Brand', Palette]];
  const tones = { good: 'bg-emerald-600', bad: 'bg-rose-600' };

  return (
    <div className="relative flex flex-col h-full bg-slate-950 text-slate-100">
      <div className="h-11 px-3 flex items-center gap-1 border-b border-slate-800 bg-slate-900/80">
        <Hammer className="w-4 h-4 text-amber-400 mr-1" /><span className="font-bold text-[13px] mr-3">Discovery Forge</span>
        {tabs.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] ${tab === id ? 'bg-amber-600/25 text-amber-200' : 'text-slate-400 hover:text-white'}`}>
            <Icon className="w-3.5 h-3.5" />{label}
            {id === 'workbench' && projects.length > 0 && <span className="text-[10px] text-slate-500">{projects.length}</span>}
            {id === 'completed' && <span className="text-[10px] text-slate-500">{projects.filter(p => p.forge?.status === 'complete').length || ''}</span>}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        {tab === 'discover' && <Discover say={say} onImported={(p) => { refresh(); setSelected(p.slug); setTab('workbench'); }} />}
        {tab === 'workbench' && <Workbench projects={projects} selected={selected} setSelected={setSelected} brand={brand} say={say} refresh={refresh} />}
        {tab === 'completed' && <Completed projects={projects} say={say} refresh={refresh} openWorkbench={(slug) => { setSelected(slug); setTab('workbench'); }} />}
        {tab === 'brand' && <Brand brand={brand} setBrand={setBrand} />}
      </div>
      {notice && (
        <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] text-white shadow-2xl z-50 ${tones[notice.tone] || tones.bad}`}>
          {notice.text}<button onClick={() => setNotice(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </div>
  );
}
