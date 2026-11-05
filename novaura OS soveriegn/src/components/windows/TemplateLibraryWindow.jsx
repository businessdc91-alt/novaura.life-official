import { useEffect, useRef, useState } from 'react';
import { Package, Upload, FolderOpen, ShieldCheck, AlertTriangle, Loader2, FileText, Download, CheckCircle2, X } from 'lucide-react';
import { KINDS, ACCEPT_USES, LICENSE_ID, BUNDLE_EXT, royaltySummary, royaltyClause } from '../../services/templates/novaTemplates.js';
import { analyzeLicense } from '../../services/forge/licenses.js';
import {
  openBundle, installTemplate, listInstalls, forgetInstall, openInstallFolder, listAcceptances, receivedAcceptancesCsv,
} from '../../services/templates/templateLibrary.js';

const TABS = [['library', 'Library', Package], ['licenses', 'Licenses', FileText]];
const shortKey = (hex) => (hex ? `${hex.slice(0, 8)}…${hex.slice(-6)}` : '');
const mb = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);
const day = (ms) => (ms ? new Date(ms).toLocaleDateString() : '—');

function useTemplateEvents(refresh) {
  useEffect(() => {
    refresh();
    window.addEventListener('novaura:templates_changed', refresh);
    return () => window.removeEventListener('novaura:templates_changed', refresh);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

function PrototypeBanner() {
  return (
    <div className="flex gap-3 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-100">
      <AlertTriangle className="w-5 h-5 shrink-0 text-amber-300 mt-0.5" />
      <div className="text-[12px] leading-relaxed">
        <div className="font-semibold text-amber-200">Pre-alpha prototypes</div>
        These templates are early builds of NovAura projects. Parts of them work, parts don't, and some features are placeholders.
        They are shared as references and starting points to build from, not as finished products. Each one says what works and what doesn't before you install it.
      </div>
    </div>
  );
}

function StageBadge({ stage }) {
  const pre = stage === 'pre-alpha prototype';
  return <span className={`text-[10px] font-bold tracking-wide px-2 py-0.5 rounded ${pre ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700 text-slate-200'}`}>{stage.toUpperCase()}</span>;
}

function Signer({ official, pub, name }) {
  return official
    ? <span className="flex items-center gap-1 text-[11px] text-emerald-300"><ShieldCheck className="w-3.5 h-3.5" /> NovAura Original, signed by the NovAura authority key</span>
    : <span className="flex items-center gap-1 text-[11px] text-amber-300"><AlertTriangle className="w-3.5 h-3.5" /> Signed by {name || 'a node'} ({shortKey(pub)}), not a NovAura Original. Install templates only from people you trust.</span>;
}

function Section({ title, items, tone = 'text-slate-300' }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">{title}</div>
      <ul className={`text-[12px] ${tone} space-y-1 list-disc pl-5`}>{items.map((s, i) => <li key={i}>{s}</li>)}</ul>
    </div>
  );
}

function Parts({ parts }) {
  if (!parts?.length) return <div className="text-[12px] text-slate-400">No parts with their own licenses: the template license covers everything in it.</div>;
  // One heading per license, so a dozen GPL paths do not repeat the same summary.
  const byLicense = new Map();
  for (const p of parts) byLicense.set(p.license, [...(byLicense.get(p.license) || []), p]);
  return (
    <div className="space-y-3">
      {[...byLicense].map(([license, list]) => {
        const known = analyzeLicense(license);
        return (
          <div key={license}>
            <div className="text-[12px] font-semibold text-white">{license} <span className="font-normal text-slate-500">· {list.length} {list.length === 1 ? 'path' : 'paths'}</span></div>
            {known.category !== 'unknown' && known.category !== 'unlicensed' && <div className="text-[11px] text-slate-400">{known.summary}</div>}
            <ul className="mt-1 space-y-0.5 text-[12px] text-slate-300">
              {list.map(p => <li key={p.path}><span className="font-mono text-cyan-300">{p.path}</span>{p.note && <span className="text-slate-400"> · {p.note}</span>}</li>)}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function Review({ opened, onInstalled, onCancel }) {
  const m = opened.manifest;
  const [use, setUse] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [showLicense, setShowLicense] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const ready = use && understood && accepted && !busy;

  const install = async () => {
    setBusy(true);
    setError('');
    try {
      onInstalled(await installTemplate(opened, { use, onProgress: setProgress }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {m.stage === 'pre-alpha prototype' && <PrototypeBanner />}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-white">{m.title}</div>
            <div className="text-[12px] text-slate-400">{KINDS[m.kind]} · version {m.version} · {m.files.length} files, {mb(m.files.reduce((n, f) => n + f.size, 0))}</div>
          </div>
          <StageBadge stage={m.stage} />
        </div>
        <Signer official={opened.official} pub={m.publisher.pub} name={m.publisher.name} />
        {m.summary && <p className="text-[13px] text-slate-200 leading-relaxed">{m.summary}</p>}
        {opened.installed.length > 0 && <div className="text-[11px] text-cyan-300">Already installed {opened.installed.length === 1 ? 'once' : `${opened.installed.length} times`}; installing again makes a new folder and leaves the old one as it is.</div>}
      </div>

      <div className="grid gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/40">
        <Section title="What works, as far as the publisher checked" items={m.works} tone="text-emerald-200" />
        <Section title="Unfinished or not working" items={m.unfinished} tone="text-amber-100" />
        <Section title="Not included" items={m.notIncluded} />
        <Section title="You will need" items={m.requirements} />
        {m.openWith && <div><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">How to open it</div><div className="text-[12px] text-slate-300">{m.openWith}</div></div>}
      </div>

      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
        <div className="text-sm font-semibold text-white">License: {m.license.id}</div>
        <div className="text-[12px] text-slate-200">{royaltySummary(m.license)}</div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Parts with their own licenses (no royalty on these)</div>
          <Parts parts={m.parts} />
        </div>
        <button onClick={() => setShowLicense(v => !v)} className="text-[12px] text-cyan-300 hover:text-cyan-200">{showLicense ? 'Hide the full license' : 'Read the full license'}</button>
        {showLicense && <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300 bg-slate-950 border border-slate-800 rounded-lg p-3 select-text">{opened.licenseText}</pre>}
      </div>

      <div className="p-4 rounded-xl border border-cyan-900/60 bg-cyan-950/20 space-y-3">
        <div className="text-sm font-semibold text-white">How will you use it?</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ACCEPT_USES).map(([id, label]) => (
            <button key={id} onClick={() => setUse(id)} className={`px-3 py-1.5 rounded-lg text-[12px] border ${use === id ? 'border-cyan-400 bg-cyan-700/40 text-white' : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-white'}`}>{label}</button>
          ))}
        </div>
        <label className="flex gap-2 text-[12px] text-slate-200 cursor-pointer">
          <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-0.5" />
          <span>I understand this is a {m.stage}: it only partly works, comes with no warranty, and is a reference or starting point rather than a finished product.</span>
        </label>
        <label className="flex gap-2 text-[12px] text-slate-200 cursor-pointer">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5" />
          <span>I accept the {LICENSE_ID === m.license.id ? 'NovAura Template License' : m.license.id}, including {royaltyClause(m.license)}.</span>
        </label>
        <div className="text-[11px] text-slate-400 leading-relaxed">
          {m.receiptsTo
            ? <>Accepting signs a record with your node key: the template, its version, the license's fingerprint, the time and the use you chose. It is kept on this PC and sent to the publisher's node ({shortKey(m.receiptsTo.replace('did:nova:', ''))}) over the mesh, so you both hold the same copy.</>
            : <>Accepting signs a record with your node key (the template, its version, the license's fingerprint, the time and the use you chose) and keeps it on this PC. This bundle names no publisher node to send it to.</>}
        </div>
        {error && <div className="text-[12px] text-rose-300">{error}</div>}
        {progress && busy && <div className="text-[12px] text-cyan-200">{progress.phase === 'checking' ? 'Checking' : 'Writing'} files: {progress.done} of {progress.total}</div>}
        <div className="flex gap-2">
          <button onClick={install} disabled={!ready} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-40 flex items-center gap-1.5">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Accept and install
          </button>
          <button onClick={onCancel} disabled={busy} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm disabled:opacity-40">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function InstalledCard({ item }) {
  const [show, setShow] = useState('');
  const [message, setMessage] = useState('');
  const m = item.manifest;
  const open = () => openInstallFolder(item).catch(e => setMessage(e.message));
  return (
    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-white">{m.title}</div>
          <div className="text-[11px] text-slate-400">version {item.version} · {item.fileCount} files, {mb(item.totalBytes)} · installed {day(item.installedAt)} · {ACCEPT_USES[item.use]}</div>
        </div>
        <StageBadge stage={m.stage} />
      </div>
      <Signer official={item.official} pub={m.publisher.pub} name={m.publisher.name} />
      <div className="text-[11px] text-slate-500 font-mono break-all select-text">{item.path}</div>
      <div className="flex flex-wrap gap-2">
        <button onClick={open} className="px-3 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-[12px] flex items-center gap-1"><FolderOpen className="w-3.5 h-3.5" /> Open folder</button>
        <button onClick={() => setShow(s => (s === 'notice' ? '' : 'notice'))} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[12px]">Read me first</button>
        <button onClick={() => setShow(s => (s === 'license' ? '' : 'license'))} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[12px]">License</button>
        <button onClick={() => forgetInstall(item.id)} title="Removes it from this list; the folder and its files stay" className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-[12px] flex items-center gap-1"><X className="w-3.5 h-3.5" /> Remove from list</button>
      </div>
      {message && <div className="text-[12px] text-rose-300">{message}</div>}
      {show && <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300 bg-slate-950 border border-slate-800 rounded-lg p-3 select-text">{show === 'notice' ? item.noticeText : item.licenseText}</pre>}
    </div>
  );
}

function Library() {
  const [installs, setInstalls] = useState([]);
  const [opened, setOpened] = useState(null);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef(null);
  useTemplateEvents(async () => setInstalls(await listInstalls()));

  const pick = async (file) => {
    if (!file) return;
    setBusy(true);
    setError('');
    setDone(null);
    try {
      setOpened(await openBundle(file));
    } catch (e) {
      setError(`${file.name}: ${e.message}`);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  if (opened) {
    return <Review opened={opened} onCancel={() => setOpened(null)} onInstalled={(item) => { setOpened(null); setDone(item); }} />;
  }
  return (
    <div className="space-y-4" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}>
      <PrototypeBanner />
      <div className="p-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 flex items-center justify-between gap-3">
        <div className="text-[12px] text-slate-300">
          Open a template file ({BUNDLE_EXT}) to see what it is, what works, and its license before anything is installed. You can also drop one here.
        </div>
        <button onClick={() => input.current?.click()} disabled={busy} className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm flex items-center gap-1.5 shrink-0 disabled:opacity-40">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Open a template
        </button>
        <input ref={input} type="file" accept={`${BUNDLE_EXT},.zip`} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {error && <div className="text-[12px] text-rose-300">{error}</div>}
      {done && <div className="p-3 rounded-xl border border-emerald-700/50 bg-emerald-900/20 text-[12px] text-emerald-200">Installed {done.manifest.title} to <span className="font-mono select-text">{done.path}</span>. Read PROTOTYPE-NOTICE.md there first.</div>}
      <div className="space-y-3">
        {installs.length === 0
          ? <div className="text-[12px] text-slate-500">No templates installed yet.</div>
          : installs.map(item => <InstalledCard key={item.id} item={item} />)}
      </div>
    </div>
  );
}

const GIVEN_STATUS = {
  sending: ['Waiting for the publisher to confirm', 'text-amber-300'],
  confirmed: ['Confirmed by the publisher', 'text-emerald-300'],
  kept: ['Kept on this PC', 'text-slate-300'],
  unconfirmed: ['Not confirmed after 30 days', 'text-rose-300'],
};

function Licenses() {
  const [given, setGiven] = useState([]);
  const [received, setReceived] = useState([]);
  useTemplateEvents(async () => {
    setGiven(await listAcceptances('given'));
    setReceived(await listAcceptances('received'));
  });

  const exportCsv = async () => {
    const url = URL.createObjectURL(new Blob([await receivedAcceptancesCsv()], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-acceptances-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="text-sm font-semibold text-white">Licenses you accepted</div>
        {given.length === 0 && <div className="text-[12px] text-slate-500">None yet.</div>}
        {given.map(r => {
          const [label, color] = GIVEN_STATUS[r.status] || [r.status, 'text-slate-300'];
          return (
            <div key={r.id} className="p-3 rounded-xl border border-slate-800 bg-slate-900/50 flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] text-white">{r.acceptance.title} <span className="text-slate-500">{r.acceptance.version}</span></div>
                <div className="text-[11px] text-slate-400">{day(r.at)} · {ACCEPT_USES[r.acceptance.use]} · {r.acceptance.licenseId}</div>
              </div>
              <span className={`text-[11px] ${color}`}>{label}</span>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-white">Acceptances your node received</div>
          {received.length > 0 && <button onClick={exportCsv} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[12px] flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Export CSV</button>}
        </div>
        <div className="text-[11px] text-slate-500">When you publish a template with your node as its receipts address, each person's signed acceptance arrives here: your record of who may owe a royalty.</div>
        {received.map(r => (
          <div key={r.id} className="p-3 rounded-xl border border-slate-800 bg-slate-900/50 flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] text-white">{r.acceptance.title} <span className="text-slate-500">{r.acceptance.version}</span></div>
              <div className="text-[11px] text-slate-400 font-mono">{shortKey(r.acceptance.acceptor)} · {day(r.at)}</div>
            </div>
            <span className={`text-[11px] ${r.acceptance.use === 'commercial' ? 'text-amber-300' : 'text-slate-300'}`}>{ACCEPT_USES[r.acceptance.use]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TemplateLibraryWindow() {
  const [tab, setTab] = useState('library');
  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100">
      <div className="px-5 pt-4 pb-3 border-b border-slate-800">
        <div className="text-lg font-bold text-white">Templates</div>
        <div className="text-[12px] text-slate-400">NovAura prototype projects to learn from and build on, signed and checked before they touch your disk.</div>
        <div className="flex gap-1 mt-3">
          {TABS.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] ${tab === id ? 'bg-cyan-700 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {tab === 'library' ? <Library /> : <Licenses />}
      </div>
    </div>
  );
}
