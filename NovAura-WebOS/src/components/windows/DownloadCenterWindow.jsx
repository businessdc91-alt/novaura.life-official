import React, { useState, useEffect, useCallback } from 'react';
import { Download, Monitor, Smartphone, Briefcase, Code, ChevronRight, Apple, ArrowDownToLine, CheckCircle2, Shield, Lock, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://novaura.life/api';

const ICON_MAP = { desktop: Monitor, mobile: Smartphone, 'code-partner': Code, ops: Briefcase };
const COLOR_MAP = {
  desktop: { bg: 'bg-blue-500', text: 'text-blue-400', grad: 'from-blue-600 to-indigo-600' },
  mobile:  { bg: 'bg-emerald-500', text: 'text-emerald-400', grad: 'from-emerald-600 to-teal-600' },
  'code-partner': { bg: 'bg-purple-500', text: 'text-purple-400', grad: 'from-purple-600 to-pink-600' },
  ops:     { bg: 'bg-amber-500', text: 'text-amber-400', grad: 'from-amber-600 to-orange-600' },
};

function fallbackColor(id) {
  return COLOR_MAP[id] || { bg: 'bg-gray-500', text: 'text-gray-400', grad: 'from-gray-600 to-gray-700' };
}

export default function DownloadCenterWindow() {
  const { user } = useAuth();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [dlError, setDlError] = useState(null);

  const fetchManifest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = {};
      try {
        if (user?.getIdToken) {
          const token = await user.getIdToken();
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch {}
      const res = await fetch(`${BACKEND}/downloads`, { headers });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load downloads');
      setApps(data.apps || []);
      setSelected(prev => prev ? (data.apps.find(a => a.id === prev.id) || data.apps[0]) : data.apps[0]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchManifest(); }, [fetchManifest]);

  const handleDownload = async (platformId) => {
    if (!selected || downloading) return;
    const key = `${selected.id}-${platformId}`;
    setDownloading(key);
    setDlError(null);
    try {
      const headers = { 'Content-Type': 'application/json' };
      try {
        if (user?.getIdToken) {
          const token = await user.getIdToken();
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch {}
      const res = await fetch(`${BACKEND}/downloads/${selected.id}/${platformId}/url`, { headers });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'not_ready') {
          setDlError(data.message || 'Release artifacts are being finalized. Check back soon.');
        } else if (res.status === 403) {
          setDlError('Staff access required for this download.');
        } else {
          setDlError(data.message || data.error || 'Download failed.');
        }
        return;
      }

      if (data.url) {
        const a = document.createElement('a');
        a.href = data.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.click();
      }
    } catch (err) {
      setDlError('Connection error. Please try again.');
    } finally {
      setTimeout(() => setDownloading(null), 1500);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0f] text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading downloads...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0f] text-gray-400 flex-col gap-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm">{error}</p>
        <button onClick={fetchManifest} className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20 transition-colors">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  const colors = selected ? fallbackColor(selected.id) : fallbackColor('desktop');
  const AppIcon = selected ? (ICON_MAP[selected.id] || Download) : Download;

  return (
    <div className="flex h-full bg-[#0a0a0f] text-gray-200 overflow-hidden">
      {/* Sidebar */}
      <div className="w-60 shrink-0 border-r border-white/10 bg-[#12121e] flex flex-col">
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/80 to-purple-600 flex items-center justify-center">
            <Download className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white text-sm">Download Center</h2>
            <p className="text-[10px] text-gray-400">Native clients</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {apps.map(app => {
            const Icon = ICON_MAP[app.id] || Download;
            const c = fallbackColor(app.id);
            const isSelected = selected?.id === app.id;
            return (
              <button
                key={app.id}
                onClick={() => { setSelected(app); setDlError(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                  isSelected ? 'bg-primary/20 border border-primary/30' : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${c.bg} bg-opacity-20`}>
                  <Icon className={`w-4 h-4 ${c.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium truncate flex items-center gap-1.5 ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                    {app.name}
                    {app.locked && <Lock className="w-3 h-3 text-amber-400 shrink-0" />}
                  </div>
                  <div className="text-[10px] text-gray-500">v{app.version}</div>
                </div>
                {isSelected && <ChevronRight className="w-4 h-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-y-auto bg-gradient-to-br from-[#0a0a0f] to-[#12121e]">
        {selected && (
          <>
            {/* Banner */}
            <div className={`h-40 shrink-0 bg-gradient-to-r ${colors.grad} p-8 flex items-end relative overflow-hidden`}>
              <div className="absolute inset-0 bg-black/20" />
              <div className="absolute -right-10 -bottom-10 opacity-20">
                <AppIcon className="w-64 h-64" />
              </div>
              <div className="relative z-10 flex items-center gap-5">
                <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl">
                  <AppIcon className="w-10 h-10 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-3xl font-bold text-white tracking-tight">{selected.name}</h1>
                    {selected.locked && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 text-[10px] font-medium border border-amber-500/30 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Staff Only
                      </span>
                    )}
                    {selected.staffOnly && !selected.locked && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 text-[10px] font-medium border border-amber-500/30 flex items-center gap-1">
                        <Shield className="w-3 h-3" /> Staff
                      </span>
                    )}
                  </div>
                  <p className="text-white/80 text-sm">Version {selected.version}</p>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="p-8 max-w-4xl">
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-white mb-2">Overview</h3>
                <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">{selected.description}</p>
              </div>

              {selected.locked ? (
                <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-4">
                  <Lock className="w-6 h-6 text-amber-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-300">Staff Access Required</p>
                    <p className="text-xs text-amber-400/70 mt-1">This tool is only available to NovAura staff. Contact Dillan if you need access.</p>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-white mb-4">Available Platforms</h3>
                  {dlError && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-sm text-red-300">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {dlError}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {(selected.platforms || []).map(platform => {
                      const dlKey = `${selected.id}-${platform.id}`;
                      const isDownloading = downloading === dlKey;
                      const isExternal = !platform.storagePath && !platform.externalUrl;

                      return (
                        <div key={platform.id} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-colors flex flex-col group">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h4 className="text-white font-medium text-sm">{platform.name}</h4>
                              <p className="text-xs text-gray-500 mt-0.5">{platform.type}{platform.size ? ` • ${platform.size}` : ''}</p>
                            </div>
                            {(platform.name === 'macOS' || platform.name === 'iOS') ? (
                              <Apple className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                            ) : (
                              <Monitor className="w-5 h-5 text-gray-400 group-hover:text-blue-400 transition-colors" />
                            )}
                          </div>

                          <div className="mt-auto pt-4">
                            <button
                              onClick={() => handleDownload(platform.id)}
                              disabled={isDownloading || !!downloading}
                              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                                isDownloading
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-not-allowed'
                                  : downloading
                                  ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                                  : 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5'
                              }`}
                            >
                              {isDownloading ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Preparing...
                                </>
                              ) : (
                                <>
                                  <ArrowDownToLine className="w-4 h-4" />
                                  Download
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="mt-10 p-4 bg-primary/10 border border-primary/20 rounded-xl flex items-start gap-4">
                <div className="p-2 bg-primary/20 rounded-lg shrink-0">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white">Secure Distribution</h4>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    All downloads are served via time-limited signed URLs from NovAura Storage.
                    Executables are scanned and signed before distribution.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
