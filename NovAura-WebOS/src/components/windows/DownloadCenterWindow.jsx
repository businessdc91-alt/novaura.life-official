import React, { useState } from 'react';
import { Download, Monitor, Smartphone, Briefcase, Code, ChevronRight, Apple, ArrowDownToLine, CheckCircle2, Shield } from 'lucide-react';

const DOWNLOADS = [
  {
    id: 'desktop',
    name: 'NovAura Desktop',
    version: '1.2.0',
    description: 'The full WebOS experience for your PC. Supports native game launching, local AI inference with WebGPU, and offline capabilities.',
    icon: Monitor,
    color: 'blue',
    platforms: [
      { name: 'Windows', size: '142 MB', type: '.exe' },
      { name: 'macOS', size: '135 MB', type: '.dmg' },
      { name: 'Linux', size: '110 MB', type: '.AppImage' }
    ],
    tags: ['Stable', 'Recommended']
  },
  {
    id: 'mobile',
    name: 'NovAura Mobile',
    version: '0.9.5-beta',
    description: 'Stay connected on the go. Access your workspace, chat with AI, and manage files directly from your smartphone.',
    icon: Smartphone,
    color: 'emerald',
    platforms: [
      { name: 'Android', size: '45 MB', type: '.apk' },
      { name: 'iOS', size: '42 MB', type: 'App Store' }
    ],
    tags: ['Beta']
  },
  {
    id: 'code-partner',
    name: 'NovAura Code Partner',
    version: '2.1.0',
    description: 'A dedicated IDE plugin and standalone utility for developers to pair program directly with the NovAura Swarm orchestrator.',
    icon: Code,
    color: 'purple',
    platforms: [
      { name: 'VS Code', size: '5 MB', type: '.vsix' },
      { name: 'Standalone', size: '65 MB', type: '.exe' }
    ],
    tags: ['Developer Tool']
  },
  {
    id: 'ops',
    name: 'NovAura Ops',
    version: '1.0.0-rc',
    description: 'Staff-only client for managing platform deployments, monitoring AI Swarm health, and accessing the master control console.',
    icon: Briefcase,
    color: 'amber',
    platforms: [
      { name: 'Windows', size: '120 MB', type: '.exe' }
    ],
    tags: ['Staff Only', 'Restricted']
  }
];

const colorMap = {
  blue: 'bg-blue-500 text-blue-500 from-blue-600 to-indigo-600',
  emerald: 'bg-emerald-500 text-emerald-500 from-emerald-600 to-teal-600',
  purple: 'bg-purple-500 text-purple-500 from-purple-600 to-pink-600',
  amber: 'bg-amber-500 text-amber-500 from-amber-600 to-orange-600',
};

export default function DownloadCenterWindow() {
  const [selectedApp, setSelectedApp] = useState(DOWNLOADS[0]);
  const [downloading, setDownloading] = useState(null);

  const handleDownload = (appId, platformName) => {
    setDownloading(`${appId}-${platformName}`);
    // Simulate download
    setTimeout(() => {
      setDownloading(null);
    }, 2000);
  };

  return (
    <div className="flex h-full bg-[#0a0a0f] text-gray-200">
      {/* Sidebar */}
      <div className="w-64 border-r border-white/10 bg-[#12121e] flex flex-col">
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/80 to-purple-600 flex items-center justify-center">
            <Download className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white text-sm">Download Center</h2>
            <p className="text-[10px] text-gray-400">Get native clients</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {DOWNLOADS.map(app => {
            const Icon = app.icon;
            const isSelected = selectedApp.id === app.id;
            return (
              <button
                key={app.id}
                onClick={() => setSelectedApp(app)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                  isSelected 
                    ? 'bg-primary/20 border border-primary/30' 
                    : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-opacity-20 ${colorMap[app.color].split(' ')[0]}`}>
                  <Icon className={`w-4 h-4 ${colorMap[app.color].split(' ')[1]}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                    {app.name}
                  </div>
                  <div className="text-[10px] text-gray-500">v{app.version}</div>
                </div>
                {isSelected && <ChevronRight className="w-4 h-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-gradient-to-br from-[#0a0a0f] to-[#12121e]">
        {/* Banner */}
        <div className={`h-40 shrink-0 bg-gradient-to-r ${colorMap[selectedApp.color].split(' ')[2]} p-8 flex items-end relative overflow-hidden`}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute -right-10 -bottom-10 opacity-20">
            <selectedApp.icon className="w-64 h-64" />
          </div>
          
          <div className="relative z-10 flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl">
              <selectedApp.icon className="w-10 h-10 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-bold text-white tracking-tight">{selectedApp.name}</h1>
                {selectedApp.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 rounded-full bg-black/30 text-white/90 text-[10px] font-medium backdrop-blur-sm border border-white/10">
                    {tag}
                  </span>
                ))}
              </div>
              <p className="text-white/80 text-sm">Version {selectedApp.version}</p>
            </div>
          </div>
        </div>

        {/* Details & Downloads */}
        <div className="p-8 max-w-4xl">
          <div className="mb-10">
            <h3 className="text-sm font-semibold text-white mb-2">Overview</h3>
            <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">
              {selectedApp.description}
            </p>
          </div>

          <h3 className="text-sm font-semibold text-white mb-4">Available Platforms</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {selectedApp.platforms.map(platform => {
              const downloadId = `${selectedApp.id}-${platform.name}`;
              const isDownloading = downloading === downloadId;
              
              return (
                <div key={platform.name} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-colors flex flex-col h-full group">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-white font-medium text-sm">{platform.name}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{platform.type} • {platform.size}</p>
                    </div>
                    {platform.name === 'macOS' || platform.name === 'iOS' ? (
                      <Apple className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                    ) : platform.name === 'Windows' ? (
                      <Monitor className="w-5 h-5 text-gray-400 group-hover:text-blue-400 transition-colors" />
                    ) : (
                      <Monitor className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                    )}
                  </div>
                  
                  <div className="mt-auto pt-4">
                    <button 
                      onClick={() => handleDownload(selectedApp.id, platform.name)}
                      disabled={isDownloading}
                      className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                        isDownloading 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                          : 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5'
                      }`}
                    >
                      {isDownloading ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 animate-pulse" />
                          Downloading...
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
          
          <div className="mt-12 p-4 bg-primary/10 border border-primary/20 rounded-xl flex items-start gap-4">
            <div className="p-2 bg-primary/20 rounded-lg shrink-0">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-white">Secure Verification</h4>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                All downloads are cryptographically signed and verified by the NovAura Swarm Orchestrator. 
                Executables are scanned for vulnerabilities prior to distribution.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
