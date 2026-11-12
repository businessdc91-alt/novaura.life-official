// PopoutHost.jsx — Root of a pop-out window: one Sovereign app filling its own
// native window (see services/popoutWindows.js), with a slim bar to send it
// back to the desktop.

import React, { Suspense, useEffect } from 'react';
import { Undo2 } from 'lucide-react';
import { Toaster } from 'sonner';
import { KernelProvider } from '../kernel/KernelProvider';
import { GraphicsProvider } from '../contexts/GraphicsContext';
import { KernelErrorBoundary } from '../kernel/KernelErrorBoundary';
import { getAppById } from '../config/appRegistry';
import { getSavedKeyRecord } from '../services/sovereignAuth';
import { popoutAppId, popoutProps, returnToDesktop } from '../services/popoutWindows';
import '../App.css';

const OPEN_BETA = import.meta.env.VITE_SOVEREIGN_OPEN_BETA === 'true';

async function closeThisWindow() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().close();
}

function Message({ children }) {
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm px-6 text-center">
      {children}
    </div>
  );
}

function PopoutApp({ appDef, props }) {
  const AppComponent = appDef.component;
  const windowId = `popout:${appDef.id}`;

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <header className="h-8 shrink-0 flex items-center gap-2 px-3 bg-black/60 border-b border-white/[0.08] select-none">
        <span
          aria-hidden="true"
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: appDef.color, boxShadow: `0 0 8px ${appDef.color}` }}
        />
        <span className="text-[11px] font-semibold text-slate-300 truncate">{appDef.title}</span>
        <button
          type="button"
          onClick={() => returnToDesktop(appDef.id, props).catch(() => {})}
          title="Put this app back on the Sovereign desktop"
          className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] text-slate-400 hover:text-cyan-300 hover:bg-cyan-400/10 transition-colors"
        >
          <Undo2 className="w-3.5 h-3.5" /> Back to desktop
        </button>
      </header>
      <main className="flex-1 overflow-auto relative">
        <KernelErrorBoundary windowId={windowId} appType={appDef.id}>
          <Suspense fallback={<Message>Loading…</Message>}>
            <AppComponent windowId={windowId} props={props} onClose={() => closeThisWindow().catch(() => {})} />
          </Suspense>
        </KernelErrorBoundary>
      </main>
      <Toaster theme="dark" position="bottom-left" closeButton />
    </div>
  );
}

export default function PopoutHost() {
  const appDef = getAppById(popoutAppId());
  const authorized = OPEN_BETA || Boolean(getSavedKeyRecord()?.valid);

  useEffect(() => {
    if (appDef) document.title = `${appDef.title} — Novaura Sovereign`;

    // Follow the desktop's theme, now and when it changes.
    const applyTheme = (theme) => theme && document.documentElement.setAttribute('data-theme', theme);
    try { applyTheme(localStorage.getItem('novaura-theme')); } catch { /* storage unavailable */ }
    const onTheme = (e) => applyTheme(e.detail);
    window.addEventListener('novaura-theme', onTheme);
    return () => window.removeEventListener('novaura-theme', onTheme);
  }, [appDef]);

  if (!appDef) return <Message>This app is not available.</Message>;
  if (!authorized) return <Message>Open Novaura Sovereign and sign in first.</Message>;

  return (
    <KernelErrorBoundary windowId="popout-root" windowType={appDef.title}>
      <KernelProvider>
        <GraphicsProvider>
          <PopoutApp appDef={appDef} props={popoutProps()} />
        </GraphicsProvider>
      </KernelProvider>
    </KernelErrorBoundary>
  );
}
