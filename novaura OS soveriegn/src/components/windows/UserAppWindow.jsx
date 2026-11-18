import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Code2, ShieldCheck, KeyRound, X } from 'lucide-react';
import { createAdditionController, defaultControllerDeps } from '../../services/additions/controller.js';
import { ADDITION_SANDBOX } from '../../services/additions/launch.js';
import { openAdditionSettings } from '../../services/additions/settingsLink.js';

/**
 * A user's own app (an addition, built in Cybeni or rebranded in the Forge). It runs
 * in a frame with its own opaque origin: no access to the OS's data or commands, and
 * none to any other addition's. What it saves, and what it may reach on the network,
 * goes through the OS (see src/services/additions).
 */
export default function UserAppWindow({ appId, slug, name, windowId, onClose }) {
  const id = appId || `user_${slug}`;
  const frameRef = useRef(null);
  const ctrlRef = useRef(null);
  const closeRef = useRef(onClose);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const ctrl = createAdditionController({
      appId: id,
      deps: defaultControllerDeps({ windowId, onClose: () => closeRef.current?.() }),
      onState: (s) => {
        if ('error' in s) setError(s.error || '');
        if ('banner' in s) setBanner(s.banner || null);
        if ('notice' in s) setNotice(s.notice || null);
      },
    });
    ctrlRef.current = ctrl;
    ctrl.start(frameRef.current).catch((err) => setError(String(err?.message || err)));
    return () => {
      ctrl.dispose();
      ctrlRef.current = null;
    };
  }, [id, windowId]);

  const openInCybeni = () => {
    window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: { appId: 'cybeni', props: { project: slug } } }));
    window.dispatchEvent(new CustomEvent('novaura:cybeni_open_project', { detail: slug }));
  };
  const reviewPermissions = () => openAdditionSettings(id);

  return (
    <div className="relative h-full bg-white">
      <iframe ref={frameRef} title={name || slug} sandbox={ADDITION_SANDBOX} className="w-full h-full border-0" />
      {banner && (
        <div role="status" className="absolute top-2 left-2 right-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/95 border border-amber-500/30 text-[12px] text-amber-100 shadow-lg">
          <span className="flex-1">{banner.name} tried to connect to {banner.origin.replace(/^https:\/\//, '')}.</span>
          <button onClick={reviewPermissions} className="px-2.5 py-1 rounded-md bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400">Review</button>
          <button onClick={() => setBanner(null)} aria-label="Dismiss" title="Dismiss" className="p-1 rounded text-slate-400 hover:text-white"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {notice && !banner && (
        <div role="note" className="absolute top-2 left-2 right-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/95 border border-slate-600/50 text-[12px] text-slate-200 shadow-lg">
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" title="Dismiss" className="p-1 rounded text-slate-400 hover:text-white"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {error && <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-rose-300 text-[13px] p-6 text-center">{error}</div>}
      <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-30 hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900/90 text-[10px] text-emerald-300" title="Runs isolated from the OS and from other apps"><ShieldCheck className="w-3 h-3" /> Sandboxed</span>
        <button onClick={reviewPermissions} title="Permissions" aria-label="Permissions" className="p-1.5 rounded-md bg-slate-900/90 text-slate-300 hover:text-white"><KeyRound className="w-3.5 h-3.5" /></button>
        <button onClick={() => ctrlRef.current?.relaunch()} title="Reload" aria-label="Reload" className="p-1.5 rounded-md bg-slate-900/90 text-slate-300 hover:text-white"><RefreshCw className="w-3.5 h-3.5" /></button>
        <button onClick={openInCybeni} title="Change this app with Cybeni" aria-label="Change this app with Cybeni" className="p-1.5 rounded-md bg-slate-900/90 text-slate-300 hover:text-white"><Code2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}
