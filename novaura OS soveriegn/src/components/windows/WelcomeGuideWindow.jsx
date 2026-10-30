import React, { useEffect, useMemo, useState } from 'react';
import {
  Sparkles, LayoutGrid, Map as MapIcon, Globe, Cpu, Search, ExternalLink, Command, MousePointerClick,
  Boxes, Inbox, FolderPlus, ArrowRight, ShieldCheck, Server, Users, Coins, Lock, CheckCircle2,
} from 'lucide-react';
import { FEATURE_GROUPS, STATUS, ROADMAP, VISION, INFERENCE_NETWORK } from '../../config/welcomeGuide.js';
import { getAppById } from '../../config/appRegistry.js';
import { openWindow } from '../../services/desktopActions.js';

const SECTIONS = [
  { id: 'welcome', label: 'Welcome', icon: Sparkles },
  { id: 'features', label: 'Features', icon: LayoutGrid },
  { id: 'roadmap', label: 'Roadmap', icon: MapIcon },
  { id: 'web', label: 'Decentralized web', icon: Globe },
  { id: 'network', label: 'AI network', icon: Cpu },
];

const TIPS = [
  { icon: MousePointerClick, title: 'Right-click the desktop', text: 'New folders, new bubbles, add your Cybeni projects, and every arranging option.' },
  { icon: Boxes, title: 'Bubbles', text: 'Drag icons into a bubble to group them. Press – to minimize it into the corner tray.' },
  { icon: Inbox, title: 'The icon tray', text: 'Click the grid button in the corner. Drop icons in to keep your background clear.' },
  { icon: FolderPlus, title: 'Folders & zips', text: 'Drag files from Files onto the desktop. Right-click a folder to compress it, or a .zip to extract it.' },
  { icon: Command, title: 'Ctrl + K', text: 'Open the app launcher from anywhere and search every app.' },
];

const START = ['setupguide', 'cybeni', 'music_studio', 'ailounge', 'onboarding_guide'];

function StatusChip({ status }) {
  const s = STATUS[status];
  return (
    <span
      className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border"
      style={{ color: s.color, borderColor: `${s.color}55`, background: `${s.color}14` }}
    >
      {s.label}
    </span>
  );
}

function OpenButton({ appId, label = 'Open' }) {
  if (!getAppById(appId)) return null;
  return (
    <button
      onClick={() => openWindow(appId)}
      className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-200 transition-colors"
    >
      {label} <ExternalLink className="w-3 h-3" />
    </button>
  );
}

function WelcomeSection({ onNavigate }) {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 p-6 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.18),transparent_55%),radial-gradient(circle_at_90%_100%,rgba(167,139,250,0.18),transparent_55%)]">
        <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-300 font-semibold">Novaura Sovereign OS</div>
        <h1 className="mt-2 text-2xl font-bold text-white">Your computer. Your AI. Your web.</h1>
        <p className="mt-3 text-sm text-slate-300 leading-relaxed max-w-2xl">
          Sovereign is a desktop where everything you make, say and run stays in your hands. Build apps with a team of AI models,
          make music and art on your own GPU, write, mail and call people directly, and share your AI with people you trust, with no
          company in the middle holding a copy of your life.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={() => onNavigate('features')} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold">
            Explore the features <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onNavigate('network')} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold">
            The people-powered AI network
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Getting around</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {TIPS.map(t => (
            <div key={t.title} className="flex gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <t.icon className="w-4.5 h-4.5 text-cyan-300 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-slate-100">{t.title}</div>
                <div className="text-[11px] text-slate-400 leading-relaxed mt-0.5">{t.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Good places to start</h2>
        <div className="flex flex-wrap gap-2">
          {START.map(id => {
            const app = getAppById(id);
            if (!app) return null;
            const Icon = app.icon;
            return (
              <button
                key={id}
                onClick={() => openWindow(id)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/70 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-100 transition-colors"
              >
                <Icon className="w-4 h-4" style={{ color: app.color }} />
                {app.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FeaturesSection() {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const q = query.trim().toLowerCase();

  const groups = useMemo(() => FEATURE_GROUPS
    .filter(g => group === 'all' || g.id === group)
    .map(g => ({
      ...g,
      features: g.features.filter(f => !q || [f.name, f.summary, ...f.details].join(' ').toLowerCase().includes(q)),
    }))
    .filter(g => g.features.length), [q, group]);

  const total = FEATURE_GROUPS.reduce((n, g) => n + g.features.length, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${total} features…`}
            className="w-full pl-8 pr-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500"
          />
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          {Object.keys(STATUS).map(k => <span key={k} className="flex items-center gap-1"><StatusChip status={k} /></span>)}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[{ id: 'all', title: 'Everything' }, ...FEATURE_GROUPS].map(g => (
          <button
            key={g.id}
            onClick={() => setGroup(g.id)}
            className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
              group === g.id ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-100' : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {g.title}
          </button>
        ))}
      </div>

      {groups.length === 0 && <p className="text-xs text-slate-500 py-8 text-center">No features match "{query}".</p>}

      {groups.map(g => (
        <section key={g.id} className="space-y-2.5">
          <div>
            <h2 className="text-sm font-semibold text-white">{g.title}</h2>
            <p className="text-[11px] text-slate-400">{g.blurb}</p>
          </div>
          {g.features.map(f => {
            const app = getAppById(f.appId);
            const Icon = app?.icon || Sparkles;
            return (
              <article key={f.appId + f.name} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center border shrink-0"
                    style={{ borderColor: `${app?.color || '#22d3ee'}55`, background: `${app?.color || '#22d3ee'}14` }}
                  >
                    <Icon className="w-4.5 h-4.5" style={{ color: app?.color || '#22d3ee' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[13px] font-semibold text-white">{f.name}</h3>
                      <StatusChip status={f.status} />
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">{f.summary}</p>
                  </div>
                  <OpenButton appId={f.appId} />
                </div>
                <div className="mt-3 pl-12 space-y-2">
                  {f.details.map((d, i) => <p key={i} className="text-[11.5px] text-slate-400 leading-relaxed">{d}</p>)}
                </div>
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function RoadmapSection() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-white">Roadmap</h1>
        <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
          Sovereign is early and built in the open. Here is what is being worked on now, what comes next, and where it is all heading.
          Updates install from inside the app as they land.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {ROADMAP.map(stage => (
          <div key={stage.stage} className="rounded-xl border bg-slate-900/60 p-4" style={{ borderColor: `${stage.color}40` }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: stage.color, boxShadow: `0 0 10px ${stage.color}` }} />
              <h2 className="text-sm font-semibold" style={{ color: stage.color }}>{stage.stage}</h2>
            </div>
            <ol className="space-y-3">
              {stage.items.map(item => (
                <li key={item.title}>
                  <div className="text-xs font-semibold text-slate-100">{item.title}</div>
                  <div className="text-[11px] text-slate-400 leading-relaxed mt-0.5">{item.text}</div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-500">
        Found a bug or want something built? Send it from <button onClick={() => openWindow('beta_hub')} className="text-cyan-300 hover:underline">Beta Diagnostics</button>. It goes straight to the team, encrypted, over the mesh.
      </p>
    </div>
  );
}

const PILLAR_ICONS = [Lock, ShieldCheck, Cpu, Globe];

function WebSection() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-white">{VISION.title}</h1>
        {VISION.paragraphs.map((p, i) => <p key={i} className="text-xs text-slate-300 mt-2 max-w-2xl leading-relaxed">{p}</p>)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {VISION.pillars.map((p, i) => {
          const Icon = PILLAR_ICONS[i % PILLAR_ICONS.length];
          return (
            <div key={p.title} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-cyan-300" />
                <h3 className="text-xs font-semibold text-white">{p.title}</h3>
              </div>
              <p className="text-[11.5px] text-slate-400 leading-relaxed mt-1.5">{p.text}</p>
            </div>
          );
        })}
      </div>
      <div className="p-4 rounded-xl border border-violet-500/30 bg-violet-500/5 flex gap-3">
        <Server className="w-4.5 h-4.5 text-violet-300 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-300 leading-relaxed">{VISION.closing}</p>
      </div>
    </div>
  );
}

const STEP_ICONS = [Server, Users, Coins, Cpu];

function NetworkSection() {
  const n = INFERENCE_NETWORK;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-white">{n.title}</h1>
        <p className="text-xs text-slate-300 mt-2 max-w-2xl leading-relaxed">{n.intro}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {n.steps.map((s, i) => {
          const Icon = STEP_ICONS[i % STEP_ICONS.length];
          return (
            <div key={s.title} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-200 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                <Icon className="w-4 h-4 text-cyan-300" />
                <h3 className="text-xs font-semibold text-white">{s.title}</h3>
              </div>
              <p className="text-[11.5px] text-slate-400 leading-relaxed mt-1.5">{s.text}</p>
            </div>
          );
        })}
      </div>

      <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
          <CheckCircle2 className="w-4 h-4" /> Working today
        </div>
        <p className="text-xs text-slate-300 leading-relaxed mt-1.5">{n.today}</p>
        <div className="mt-3"><OpenButton appId="ailounge" label="Open the Inference Exchange" /></div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-white mb-2">Straight talk</h2>
        <ul className="space-y-2">
          {n.honesty.map((h, i) => (
            <li key={i} className="flex gap-2 text-[11.5px] text-slate-400 leading-relaxed">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" /> {h}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-white mb-2">How it rolls out</h2>
        <div className="flex flex-wrap items-center gap-2">
          {n.sequence.map((s, i) => (
            <React.Fragment key={s}>
              <span className="px-3 py-1.5 rounded-lg bg-slate-900/70 border border-slate-700 text-[11px] text-slate-200">
                <span className="text-cyan-300 font-semibold mr-1.5">{i + 1}</span>{s}
              </span>
              {i < n.sequence.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-slate-600" />}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WelcomeGuideWindow({ props: windowProps } = {}) {
  const [section, setSection] = useState(SECTIONS.some(s => s.id === windowProps?.section) ? windowProps.section : 'welcome');

  // The desktop's welcome card can jump straight to a section while the guide is open.
  useEffect(() => {
    const onSection = (e) => { if (SECTIONS.some(s => s.id === e.detail)) setSection(e.detail); };
    window.addEventListener('novaura:welcome_section', onSection);
    return () => window.removeEventListener('novaura:welcome_section', onSection);
  }, []);

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <nav className="w-48 shrink-0 bg-slate-900/60 border-r border-slate-800 p-3 flex flex-col gap-1">
        <div className="flex items-center gap-2 px-2 py-2 mb-2 text-cyan-300 text-sm font-semibold">
          <Sparkles className="w-4.5 h-4.5" /> Welcome Guide
        </div>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              section === s.id ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/30' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'
            }`}
          >
            <s.icon className="w-4 h-4" /> {s.label}
          </button>
        ))}
      </nav>
      <main className="flex-1 overflow-y-auto p-6">
        {section === 'welcome' && <WelcomeSection onNavigate={setSection} />}
        {section === 'features' && <FeaturesSection />}
        {section === 'roadmap' && <RoadmapSection />}
        {section === 'web' && <WebSection />}
        {section === 'network' && <NetworkSection />}
      </main>
    </div>
  );
}
