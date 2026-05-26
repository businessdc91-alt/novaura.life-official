import React, { useState, useEffect } from 'react';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '../config/firebase';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { googleProvider } from '../config/firebase';
import {
  Briefcase, Monitor, Code2, Activity, Zap,
  ArrowDownToLine, CheckCircle2, Loader2, LogIn,
  ShieldAlert, ExternalLink, Clock, Terminal,
  Users, Server, Cpu
} from 'lucide-react';

const STAFF_EMAILS = ['business.dc91@gmail.com'];

const OPS_DOWNLOADS = [
  {
    name: 'Windows',
    ext: '.exe',
    storagePath: 'downloads/staff/novaura-ops-setup.exe',
    description: 'Command Center + Live Sync IDE'
  },
];

const STAFF_TOOLS = [
  {
    id: 'os-ide',
    label: 'BuilderBot IDE',
    description: 'Full VS Code-like IDE inside the WebOS',
    icon: Code2,
    href: '/os/',
    badge: 'WebOS'
  },
  {
    id: 'admin',
    label: 'Admin Panel',
    description: 'User management, tier overrides, system flags',
    icon: Users,
    href: '/os/',
    badge: 'WebOS → Admin Panel',
    window: 'admin-panel'
  },
  {
    id: 'catalyst',
    label: 'Catalyst Command Station',
    description: 'Master control — deployments, AI swarm health, incident response',
    icon: Zap,
    href: '/os/',
    badge: 'WebOS → Catalyst',
    window: 'catalyst'
  },
  {
    id: 'nova-ops',
    label: 'Nova Ops Agent',
    description: 'Autonomous deployment and monitoring agent',
    icon: Cpu,
    href: '/os/',
    badge: 'WebOS → Nova Ops',
    window: 'business-operator'
  },
  {
    id: 'diagnostics',
    label: 'System Diagnostics',
    description: 'Real-time kernel telemetry, memory, CPU, network',
    icon: Activity,
    href: '/os/',
    badge: 'WebOS',
    window: 'system-diagnostics'
  },
];

export default function StaffPage() {
  const [user, setUser] = useState(undefined);
  const [opsUrls, setOpsUrls] = useState({});
  const [downloading, setDownloading] = useState(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return unsub;
  }, []);

  useEffect(() => {
    if (!user || !storage || !STAFF_EMAILS.includes(user?.email)) return;
    OPS_DOWNLOADS.forEach(async (d) => {
      try {
        const url = await getDownloadURL(ref(storage, d.storagePath));
        setOpsUrls(prev => ({ ...prev, [d.storagePath]: url }));
      } catch {
        setOpsUrls(prev => ({ ...prev, [d.storagePath]: null }));
      }
    });
  }, [user]);

  const handleSignIn = async () => {
    setSigningIn(true);
    try { await signInWithPopup(auth, googleProvider); } catch {}
    setSigningIn(false);
  };

  const handleDownload = (storagePath, name) => {
    const url = opsUrls[storagePath];
    if (!url) return;
    setDownloading(storagePath);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => setDownloading(null), 2000);
  };

  const openInOS = (windowId) => {
    window.location.href = `/os/?window=${windowId}`;
  };

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-[#020205] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020205] text-gray-200 font-sans">
      {/* Header */}
      <div className="border-b border-white/[0.06] bg-black/30 backdrop-blur-xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="text-white/40 hover:text-white/70 text-xs transition-colors">← novaura.life</a>
          <span className="text-white/20">/</span>
          <span className="text-sm font-medium text-white">Staff</span>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-medium">
            Restricted
          </span>
        </div>
        {user && (
          <div className="flex items-center gap-2 text-xs text-white/50">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            {user.email}
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16">

        {/* Not logged in */}
        {!user && (
          <div className="text-center py-24">
            <ShieldAlert className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Staff Access Required</h1>
            <p className="text-white/50 text-sm mb-8 max-w-sm mx-auto">
              This area is restricted to NovAura team members. Sign in with your staff account to continue.
            </p>
            <button
              onClick={handleSignIn}
              disabled={signingIn}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {signingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              Sign in with Google
            </button>
          </div>
        )}

        {/* Logged in but not staff */}
        {user && !STAFF_EMAILS.includes(user.email) && (
          <div className="text-center py-24">
            <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
            <p className="text-white/50 text-sm mb-2">
              <span className="text-white/70">{user.email}</span> is not on the staff list.
            </p>
            <a href="/" className="text-xs text-cyan-400 hover:underline">Return home</a>
          </div>
        )}

        {/* Staff view */}
        {user && STAFF_EMAILS.includes(user.email) && (
          <>
            <div className="mb-12">
              <h1 className="text-3xl font-bold mb-2">
                <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  Command Center
                </span>
              </h1>
              <p className="text-white/50 text-sm">NovAura staff tools and downloads</p>
            </div>

            {/* Ops Download */}
            <section className="mb-10">
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-4">
                Desktop Client — Novaura Ops
              </h2>
              <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 overflow-hidden">
                <div className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-500/10 border border-amber-500/20 shrink-0">
                    <Briefcase className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Novaura Ops</h3>
                    <p className="text-white/50 text-xs mt-0.5">
                      Live sync IDE · deployment console · AI swarm monitor · master control
                    </p>
                  </div>
                </div>
                <div className="border-t border-white/[0.05] px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {OPS_DOWNLOADS.map(d => {
                    const url = opsUrls[d.storagePath];
                    const isReady = url !== undefined;
                    const isAvailable = url !== null;
                    const isThisDownloading = downloading === d.storagePath;

                    return (
                      <div key={d.name} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <div>
                          <p className="text-sm text-white font-medium">{d.name}</p>
                          <p className="text-[10px] text-white/30">{d.description}</p>
                        </div>
                        {!isReady ? (
                          <Loader2 className="w-4 h-4 text-white/20 animate-spin" />
                        ) : !isAvailable ? (
                          <span className="flex items-center gap-1 text-[10px] text-white/30">
                            <Clock className="w-3 h-3" /> Upload pending
                          </span>
                        ) : isThisDownloading ? (
                          <span className="flex items-center gap-1 text-[10px] text-green-400">
                            <CheckCircle2 className="w-3 h-3 animate-pulse" /> Downloading
                          </span>
                        ) : (
                          <button
                            onClick={() => handleDownload(d.storagePath, `novaura-ops${d.ext}`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                          >
                            <ArrowDownToLine className="w-3 h-3" />
                            Download
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Web Tools */}
            <section>
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-4">
                Web Tools — Launch in OS
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STAFF_TOOLS.map(tool => {
                  const Icon = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => tool.window ? openInOS(tool.window) : window.location.href = tool.href}
                      className="text-left p-4 rounded-xl border border-white/[0.07] bg-white/[0.025] hover:border-white/[0.12] hover:bg-white/[0.04] transition-all group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <Icon className="w-4 h-4 text-amber-400" />
                        <span className="text-[9px] text-white/25 font-mono">{tool.badge}</span>
                      </div>
                      <p className="text-sm text-white font-medium">{tool.label}</p>
                      <p className="text-[11px] text-white/40 mt-1 leading-relaxed">{tool.description}</p>
                      <div className="flex items-center gap-1 mt-3 text-[10px] text-white/25 group-hover:text-cyan-400 transition-colors">
                        <ExternalLink className="w-3 h-3" /> Open
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Customer Downloads Link */}
            <div className="mt-10 p-4 rounded-xl border border-white/[0.05] bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Monitor className="w-4 h-4 text-white/30" />
                <span className="text-xs text-white/40">Customer download page</span>
              </div>
              <a href="/download" className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors">
                /download <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}