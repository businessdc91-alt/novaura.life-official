import React from 'react';
import {
  Inbox, Send, FileText, Star, Archive, Trash2,
  Plus, ShieldCheck, Radio, Bell, Layers, Key, HelpCircle
} from 'lucide-react';
import { getLocalIdentity } from '../../../services/sovereignMesh.js';

export default function MailSidebar({
  currentFolder,
  onSelectFolder,
  currentCategory,
  onSelectCategory,
  unreadCount,
  starredCount,
  draftsCount,
  onOpenCompose,
  onToggleShortcuts,
}) {
  const identity = getLocalIdentity();
  const cleanPub = (identity?.publicKey || '').replace(/^0x/, '');
  const shortKey = cleanPub ? `${cleanPub.substring(0, 8)}...${cleanPub.substring(cleanPub.length - 6)}` : 'Hardware Enclave';

  const folders = [
    { key: 'inbox', label: 'Inbox', icon: Inbox, count: unreadCount, badgeColor: 'bg-cyan-500 text-slate-950' },
    { key: 'starred', label: 'Starred', icon: Star, count: starredCount, badgeColor: 'bg-amber-500/20 text-amber-300' },
    { key: 'sent', label: 'Sent', icon: Send },
    { key: 'drafts', label: 'Drafts', icon: FileText, count: draftsCount, badgeColor: 'bg-slate-700 text-slate-300' },
    { key: 'archive', label: 'Archive', icon: Archive },
    { key: 'trash', label: 'Trash', icon: Trash2 },
  ];

  const categories = [
    { key: 'all', label: 'All Mail', icon: Layers },
    { key: 'primary', label: 'Primary', icon: Inbox },
    { key: 'swarm', label: 'Swarm / Mesh', icon: Radio },
    { key: 'alerts', label: 'System Alerts', icon: Bell },
  ];

  return (
    <div className="w-56 bg-slate-950/90 border-r border-slate-800/80 flex flex-col justify-between shrink-0 select-none font-sans p-3">
      <div className="space-y-4">
        {/* Compose Button */}
        <button
          onClick={onOpenCompose}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs shadow-lg shadow-cyan-600/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Message</span>
          <kbd className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/30 text-cyan-200">C</kbd>
        </button>

        {/* System Folders */}
        <div className="space-y-1">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 px-2 py-1">
            Mailbox
          </div>
          {folders.map(f => {
            const Icon = f.icon;
            const active = currentFolder === f.key;
            return (
              <button
                key={f.key}
                onClick={() => onSelectFolder(f.key)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                  active
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span className="flex-1 truncate">{f.label}</span>
                {f.count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${f.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                    {f.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Category Views (Active primarily in Inbox) */}
        {currentFolder === 'inbox' && (
          <div className="space-y-1 pt-2 border-t border-slate-900">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 px-2 py-1">
              Views
            </div>
            {categories.map(c => {
              const Icon = c.icon;
              const active = currentCategory === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => onSelectCategory(c.key)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] transition-colors cursor-pointer text-left ${
                    active
                      ? 'text-cyan-300 font-semibold bg-slate-900'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-cyan-400' : 'text-slate-600'}`} />
                  <span className="truncate">{c.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Operator Cryptographic Identity Dossier */}
      <div className="space-y-2 pt-3 border-t border-slate-900">
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>P2P E2EE Active</span>
          </span>
          <button
            onClick={onToggleShortcuts}
            title="Keyboard Shortcuts"
            className="text-slate-500 hover:text-cyan-400 p-0.5"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-slate-950 text-[10px]"
              style={{ backgroundColor: identity?.avatarColor || '#00f0ff' }}
            >
              {(identity?.handle || 'O')[0].toUpperCase()}
            </div>
            <div className="text-xs font-semibold text-slate-200 truncate">
              {identity?.handle || 'operator'}@nova.node
            </div>
          </div>
          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 truncate" title={identity?.publicKey}>
            <Key className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>{shortKey}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
