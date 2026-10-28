import React, { useState, useEffect } from 'react';
import BootSplash from './components/BootSplash';
import SovereignActivationGate from './components/SovereignActivationGate';
import SovereignDesktop from './components/SovereignDesktop';
import UpdateNotifier from './components/UpdateNotifier';
import { getSavedKeyRecord, clearKeyRecord } from './services/sovereignAuth';
import { verifyNativeLicense } from './services/nativeService';
import { KernelProvider } from './kernel/KernelProvider';
import { GraphicsProvider } from './contexts/GraphicsContext';
import { KernelErrorBoundary } from './kernel/KernelErrorBoundary';
import './App.css';

// Open-beta builds skip the license gate entirely. Set VITE_SOVEREIGN_OPEN_BETA=true
// at build time to produce one. Default builds require a signed NOVA1 license
// (mint tester keys with scripts/mint_tester_license.py).
const OPEN_BETA = import.meta.env.VITE_SOVEREIGN_OPEN_BETA === 'true';

const OPEN_BETA_RECORD = Object.freeze({
  valid: true,
  tier: 'OPEN_BETA',
  holder: 'Beta Tester',
  key: null,
  isOpenBeta: true,
});

function AppContent() {
  const [bootCompleted, setBootCompleted] = useState(false);
  const [authRecord, setAuthRecord] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    if (OPEN_BETA) {
      setAuthRecord(OPEN_BETA_RECORD);
      setCheckingAuth(false);
      return undefined;
    }

    let cancelled = false;

    // Re-check a saved license against the native verifier, which binds it to
    // this machine. A record copied from another machine's storage fails here.
    const adoptRecord = async (record) => {
      if (!record) return;
      const native = await verifyNativeLicense(record.key).catch(() => null);
      if (cancelled) return;
      if (native && !native.valid) {
        console.warn('[Sovereign] Saved license rejected by native verifier:', native.reason);
        await clearKeyRecord();
        setAuthRecord(null);
        return;
      }
      setAuthRecord(record);
    };

    adoptRecord(getSavedKeyRecord()).finally(() => {
      if (!cancelled) setCheckingAuth(false);
    });

    // getSavedKeyRecord() may recover a license from the on-disk node
    // certificate asynchronously and announces it with this event.
    const onAuthUpdated = () => {
      const recovered = getSavedKeyRecord();
      if (recovered) adoptRecord(recovered);
    };
    window.addEventListener('novaura:auth_updated', onAuthUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener('novaura:auth_updated', onAuthUpdated);
    };
  }, []);

  return (
    <div className="sovereign-app-container">
      {/* 1. First Boot Splash Sequence */}
      {!bootCompleted && (
        <BootSplash onComplete={() => setBootCompleted(true)} />
      )}

      {/* 2. Cryptographic Activation Gate (Blocks if no valid offline key) */}
      {bootCompleted && !authRecord && !checkingAuth && (
        <SovereignActivationGate onAuthorized={(record) => setAuthRecord(record)} />
      )}

      {/* 3. Sovereign Desktop (Only accessible once key is verified) */}
      {bootCompleted && authRecord && (
        <SovereignDesktop authRecord={authRecord} onRevoke={() => setAuthRecord(null)} />
      )}

      {/* 4. Signed auto-update prompt (packaged builds only) */}
      {bootCompleted && <UpdateNotifier />}
    </div>
  );
}

export default function App() {
  return (
    <KernelErrorBoundary windowId="root-desktop" windowType="NovAura Sovereign OS">
      <KernelProvider>
        <GraphicsProvider>
          <AppContent />
        </GraphicsProvider>
      </KernelProvider>
    </KernelErrorBoundary>
  );
}
