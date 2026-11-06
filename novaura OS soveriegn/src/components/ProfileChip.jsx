import React, { useEffect, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { profilesAvailable, getProfilesState, switchProfile, initials } from '../services/profiles.js';

/** The signed-in profile in the system bar, with "Switch profile". */
export default function ProfileChip() {
  const [profile, setProfile] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!profilesAvailable()) return;
    getProfilesState()
      .then(state => setProfile(state.profiles.find(p => p.id === state.active) || null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  if (!profile) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md hover:bg-slate-800 transition-colors"
        title={`Signed in as ${profile.name}`}
      >
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
          style={{ background: `${profile.color}55`, border: `1px solid ${profile.color}` }}
        >
          {initials(profile.name)}
        </span>
        <span className="text-[11px] text-slate-300 max-w-[90px] truncate">{profile.name}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-8 w-64 p-3 rounded-xl bg-slate-900/95 border border-slate-700 shadow-2xl backdrop-blur-xl z-[9500]">
          <div className="text-xs text-slate-400">Signed in as</div>
          <div className="text-sm font-semibold text-white truncate">{profile.name}</div>
          <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
            Switching restarts Sovereign at the sign-in screen. Save your work first: open windows close.
          </p>
          <button
            onClick={() => switchProfile().catch(err => setError(String(err?.message || err)))}
            className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white"
          >
            <Users className="w-3.5 h-3.5" /> Switch profile
          </button>
          {error && <p className="mt-2 text-[11px] text-rose-300">{error}</p>}
        </div>
      )}
    </div>
  );
}
