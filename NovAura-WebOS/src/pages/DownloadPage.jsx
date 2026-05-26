import React, { useState, useEffect } from 'react';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '../config/firebase';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { googleProvider } from '../config/firebase';
import {
  Monitor, Smartphone, Code, Briefcase,
  ArrowDownToLine, CheckCircle2, Shield, Loader2,
  LogIn, Clock, ExternalLink
} from 'lucide-react';

const DOWNLOADS = [
  {
    id: 'desktop',
    label: 'NovAura Desktop',
    description: 'Full WebOS for your PC. Local AI inference, native game launching, offline capabilities.',
    icon: Monitor,
    color: '#06b6d4',
    platforms: [
      { name: 'Windows', ext: '.exe', storagePath: 'downloads/desktop/novaura-setup.exe' },
      { name: 'macOS',   ext: '.dmg', storagePath: 'downloads/desktop/novaura.dmg' },
      { name: 'Linux',   ext: '.AppImage', storagePath: 'downloads/desktop/novaura.AppImage' },
    ],
  },
  {
    id: 'mobile',
    label: 'NovAura Mobile',
    description: 'Your workspace on the go. AI chat, file access, and notifications on Android.',
    icon: Smartphone,
    color: '#a855f7',
    platforms: [
      { name: 'Android', ext: '.apk', storagePath: 'downloads/mobile/novaura.apk' },
    ],
  },
  {
    id: 'code-partner',
    label: 'NovAura Code Partner',
    description: 'VS Code extension with Cybeni & Nova inside your IDE. Tool-calling, workspace-aware AI.',
    icon: Code,
    color: '#ec4899',
    platforms: [
      { name: 'VS Code', ext: '.vsix', storagePath: 'downloads/vscode/novaura-coding-partner.vsix' },
    ],
  },
];

const STAFF_EMAILS = ['business.dc91@gmail.com'];

function isStaff(user) {
  return user && STAFF_EMAILS.includes(user.email);
}

export default function DownloadPage() {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [urls, setUrls] = useState({});
  const [downloading, setDownloading] = useState(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return unsub;
  }, []);

  // Resolve Storage URLs once authenticated
  useEffect(() => {
    if (!user || !storage) return;
    const all = DOWNLOADS.flatMap(d => d.platforms);
    all.forEach(async (p) => {
      try {
        const url = await getDownloadURL(ref(storage, p.storagePath));
        setUrls(prev => ({ ...prev, [p.storagePath]: url }));
      } catch {
        setUrls(prev => ({ ...prev, [p.storagePath]: null }));
      }
    });
  }, [user]);

  const handleSignIn = async () => {
    setSigningIn(true);
    try { await signInWithPopup(auth, googleProvider); } catch {}
    setSigningIn(false);
  };

  const handleDownload = (storagePath, name) => {
    const url = urls[storagePath];
    if (!url) return;
    setDownloading(storagePath);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => setDownloading(null), 2000);
  };

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-[#020205] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
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
          <span className="text-sm font-medium text-white">Download Center</span>
        </div>
        {user ? (
          <div className="flex items-center gap-2 text-xs text-white/50">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            {user.email}
          </div>
        ) : (
          <button
            onClick={handleSignIn}
            disabled={signingIn}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs hover:bg-cyan-500/20 transition-all"
          >
            {signingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
            Sign in to download
          </button>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="mb-16 text-center">
          <h1 className="text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Native Clients
            </span>
          </h1>
          <p className="text-white/50 text-sm max-w-md mx-auto">
            Get the full NovAura experience on any device. Downloads require a NovAura account.
          </p>
        </div>

        {!user && (
          <div className="mb-12 p-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 text-center">
            <LogIn className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
            <p className="text-sm text-white/70 mb-4">Sign in to unlock downloads</p>
            <button
              onClick={handleSignIn}
              disabled={signingIn}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {signingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              Continue with Google
            </button>
          </div>
        )}

        {/* Download Cards */}
        <div className="space-y-6">
          {DOWNLOADS.map(app => {
            const Icon = app.icon;
            return (
              <div
                key={app.id}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden"
                style={{ boxShadow: `0 0 40px ${app.color}08` }}
              >
                <div className="p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${app.color}15`, border: `1px solid ${app.color}25` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: app.color }} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-white font-semibold text-base">{app.label}</h2>
                    <p className="text-white/50 text-xs mt-1 leading-relaxed">{app.description}</p>
                  </div>
                </div>

                <div className="border-t border-white/[0.05] px-6 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {app.platforms.map(platform => {
                    const url = urls[platform.storagePath];
                    const isReady = url !== undefined;
                    const isAvailable = url !== null && url !== undefined;
                    const isThisDownloading = downloading === platform.storagePath;

                    return (
                      <div
                        key={platform.name}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                      >
                        <div>
                          <p className="text-sm text-white font-medium">{platform.name}</p>
                          <p className="text-[10px] text-white/30 font-mono">{platform.ext}</p>
                        </div>
                        {!user ? (
                          <span className="text-[10px] text-white/20">Login required</span>
                        ) : !isReady ? (
                          <Loader2 className="w-4 h-4 text-white/20 animate-spin" />
                        ) : !isAvailable ? (
                          <span className="flex items-center gap-1 text-[10px] text-white/30">
                            <Clock className="w-3 h-3" /> Coming soon
                          </span>
                        ) : isThisDownloading ? (
                          <span className="flex items-center gap-1 text-[10px] text-green-400">
                            <CheckCircle2 className="w-3 h-3 animate-pulse" /> Downloading
                          </span>
                        ) : (
                          <button
                            onClick={() => handleDownload(platform.storagePath, `novaura${platform.ext}`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all"
                            style={{ background: `${app.color}20`, border: `1px solid ${app.color}30` }}
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
            );
          })}
        </div>

        {/* Staff Link */}
        {user && isStaff(user) && (
          <div className="mt-10 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Briefcase className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-300">Staff tools available</span>
            </div>
            <a
              href="/staff"
              className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              Command Center <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Security Notice */}
        <div className="mt-10 p-4 rounded-xl border border-white/[0.05] bg-white/[0.02] flex items-start gap-3">
          <Shield className="w-4 h-4 text-white/30 mt-0.5 shrink-0" />
          <p className="text-[11px] text-white/30 leading-relaxed">
            All binaries are distributed via Firebase Storage and tied to your authenticated session.
            Links expire after 1 hour for security.
          </p>
        </div>
      </div>
    </div>
  );
}