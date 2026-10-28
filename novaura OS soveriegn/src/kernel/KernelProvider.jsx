import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { kernel } from './NovaKernel.js';
import logoImg from '../assets/novaura-logo.png';
import { KernelContext } from './KernelContext.js';

export function KernelProvider({ children }) {
  const [bootState, setBootState] = useState({
    phase: -1,
    progress: 0,
    label: 'Booting Novaura Sovereign Kernel...',
    ready: false,
    error: null,
  });
  const booted = useRef(false);

  useEffect(() => {
    if (kernel.bootPhase === 'ready') {
      setBootState(prev => ({ ...prev, progress: 100, label: 'Sovereign Core Ready', ready: true }));
      booted.current = true;
      return;
    }

    if (booted.current) return;
    booted.current = true;

    const unsubPhase = kernel.ipc.on('system:boot:phase', ({ phase, label, progress }) => {
      setBootState(prev => ({ ...prev, phase, label, progress }));
    });

    const unsubReady = kernel.ipc.on('system:ready', () => {
      setBootState(prev => ({ ...prev, progress: 100, label: 'Sovereign Core Ready', ready: true }));
    });

    const unsubError = kernel.ipc.on('system:boot:error', ({ error }) => {
      setBootState(prev => ({ ...prev, error, ready: false }));
    });

    kernel.boot().then(() => {
      if (kernel.bootPhase === 'ready') {
        setBootState(prev => ({ ...prev, ready: true, progress: 100 }));
      }
    }).catch(e => {
      setBootState(prev => ({ ...prev, error: e.message }));
    });

    return () => {
      unsubPhase();
      unsubReady();
      unsubError();
    };
  }, []);

  if (bootState.error) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: '#0a0a0f', color: '#fff',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: 'monospace', gap: 16,
      }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <div style={{ color: '#ff4444', fontSize: 16 }}>Sovereign Kernel boot failed</div>
        <div style={{ color: '#ffffff50', fontSize: 12 }}>{bootState.error}</div>
        <button
          onClick={() => { booted.current = false; kernel.restart(); }}
          style={{
            marginTop: 16, padding: '8px 24px',
            background: 'transparent', border: '1px solid #00f0ff44',
            color: '#00f0ff', borderRadius: 8, cursor: 'pointer', fontSize: 13,
          }}
        >
          Re-initialize Kernel
        </button>
      </div>
    );
  }

  if (!bootState.ready) {
    return <KernelBootScreen state={bootState} />;
  }

  return (
    <KernelContext.Provider value={kernel}>
      {children}
    </KernelContext.Provider>
  );
}

function KernelBootScreen({ state }) {
  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#040711',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'sans-serif',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 50% 45%, rgba(6, 182, 212, 0.15) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative', zIndex: 1,
        textAlign: 'center',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 20,
      }}>
        <div style={{ width: 90, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img 
            src={logoImg} 
            alt="Novaura"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 25px rgba(6, 182, 212, 0.6))',
            }}
          />
        </div>

        <div>
          <div style={{
            fontSize: 22, fontWeight: 800, letterSpacing: '0.25em',
            background: 'linear-gradient(135deg, #22d3ee, #a855f7, #ec4899)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            NOVAURA SOVEREIGN OS
          </div>
          <div style={{ color: '#64748b', fontSize: 10, letterSpacing: '0.3em', marginTop: 6, fontWeight: 600 }}>
            PRIVATE CLOUD KERNEL
          </div>
        </div>

        <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${state.progress}%`,
              background: 'linear-gradient(90deg, #06b6d4, #8b5cf6)',
              borderRadius: 4,
              transition: 'width 0.4s ease',
              boxShadow: '0 0 10px #06b6d4',
            }} />
          </div>
          <div style={{ color: '#94a3b8', fontSize: 11, letterSpacing: '0.05em', textAlign: 'center', fontFamily: 'monospace' }}>
            {state.label}
          </div>
        </div>
      </div>
    </div>
  );
}

export function useKernelContext() {
  return useContext(KernelContext);
}

export default KernelProvider;
