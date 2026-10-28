import React, { useEffect, useRef, useState } from 'react';
import { isTauriNative } from '../services/nativeService';

const FIRST_CHECK_DELAY_MS = 15 * 1000;
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Checks the signed update feed (tauri.conf.json > plugins.updater) and offers
 * a one-click install. Only runs in packaged native builds.
 */
export default function UpdateNotifier() {
  const [update, setUpdate] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | available | downloading | ready | error
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    if (!isTauriNative() || !import.meta.env.PROD) return undefined;

    const runCheck = async () => {
      if (busy.current) return;
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const found = await check();
        if (found) {
          setUpdate(found);
          setPhase('available');
          setDismissed(false);
        }
      } catch (err) {
        // Offline or feed not published yet: stay quiet, try again later.
        console.info('[Updater] Update check skipped:', err?.message || err);
      }
    };

    const first = setTimeout(runCheck, FIRST_CHECK_DELAY_MS);
    const interval = setInterval(runCheck, RECHECK_INTERVAL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);

  const install = async () => {
    if (!update || busy.current) return;
    busy.current = true;
    setPhase('downloading');
    setError('');
    let total = 0;
    let received = 0;
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') total = event.data.contentLength || 0;
        if (event.event === 'Progress') {
          received += event.data.chunkLength;
          if (total > 0) setProgress(Math.min(100, Math.round((received / total) * 100)));
        }
      });
      setPhase('ready');
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (err) {
      setPhase('error');
      setError(err?.message || String(err));
    } finally {
      busy.current = false;
    }
  };

  if (phase === 'idle' || dismissed) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 72,
        zIndex: 999980,
        maxWidth: 340,
        padding: '12px 14px',
        borderRadius: 10,
        background: 'rgba(10, 15, 30, 0.96)',
        border: '1px solid rgba(0, 240, 255, 0.35)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
        color: '#e2e8f0',
        fontFamily: "'Inter', sans-serif",
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 700, color: '#00f0ff', marginBottom: 4 }}>
        {phase === 'error' ? 'Update failed' : `Update available: v${update?.version}`}
      </div>
      {phase === 'available' && (
        <>
          {update?.body && (
            <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8, maxHeight: 90, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
              {update.body}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={install} style={{ background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontWeight: 600 }}>
              Install &amp; restart
            </button>
            <button onClick={() => setDismissed(true)} style={{ background: 'none', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>
              Later
            </button>
          </div>
        </>
      )}
      {phase === 'downloading' && <div style={{ color: '#94a3b8' }}>Downloading… {progress > 0 ? `${progress}%` : ''}</div>}
      {phase === 'ready' && <div style={{ color: '#34d399' }}>Installed. Restarting…</div>}
      {phase === 'error' && (
        <>
          <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 8 }}>{error}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={install} style={{ background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>Retry</button>
            <button onClick={() => setDismissed(true)} style={{ background: 'none', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>Dismiss</button>
          </div>
        </>
      )}
    </div>
  );
}
