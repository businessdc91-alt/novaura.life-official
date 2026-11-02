import React from 'react';
import { X, Command, Keyboard } from 'lucide-react';

export default function MailKeyboardShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'C', description: 'Compose new message' },
    { key: 'J', description: 'Next email in list' },
    { key: 'K', description: 'Previous email in list' },
    { key: 'Enter', description: 'Open selected email' },
    { key: 'R', description: 'Reply to sender' },
    { key: 'E', description: 'Archive email' },
    { key: 'S', description: 'Toggle star' },
    { key: '#', description: 'Delete email' },
    { key: '/', description: 'Focus search bar' },
    { key: 'Esc', description: 'Close modal / Clear selection' },
    { key: '?', description: 'Toggle this shortcuts modal' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans select-none animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">Superhuman Keyboard Shortcuts</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2 max-h-[70vh] overflow-y-auto">
          {shortcuts.map((s, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40 text-xs">
              <span className="text-slate-300">{s.description}</span>
              <kbd className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-mono font-semibold text-[11px]">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
