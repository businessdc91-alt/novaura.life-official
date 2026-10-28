import React, { useState, useEffect } from 'react';
import logoImg from '../assets/novaura-logo.png';

const KERNEL_DIAGNOSTICS = [
  { id: 'CPU', desc: 'x86_64 CPU Topology: AVX-512, FMA3, VT-x Hardware Enclave Verified', status: 'OK' },
  { id: 'MEM', desc: 'Secure Memory Pools: 64-bit Non-Paged Executive Pool Allocated', status: 'OK' },
  { id: 'UEFI', desc: 'UEFI 2.8+ Secure Handshake: TPM 2.0 PCR-7 Hardware Root Bound', status: 'VERIFIED' },
  { id: 'NVME', desc: 'NVMe Storage Controller: Dual-Layer Dexie + Physical Vault Active', status: 'READY' },
  { id: 'SENTINEL', desc: 'Sentinel Zero-Trust Shield: Anti-Tamper Code Integrity Enforced', status: 'ACTIVE' },
  { id: 'P2P', desc: 'Sovereign Telecom Relay: Local Broadcast + DTLS 1.3 Mesh Initialized', status: 'ONLINE' },
];

export default function BootSplash({ onComplete }) {
  const [fading, setFading] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagStep, setDiagStep] = useState(0);

  useEffect(() => {
    // Increment diagnostic steps in background
    const diagTimer = setInterval(() => {
      setDiagStep(prev => (prev < KERNEL_DIAGNOSTICS.length ? prev + 1 : prev));
    }, 450);

    // Keyboard listener: ESC/Enter/Space to skip immediately, F2 to toggle diagnostics
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setShowDiagnostics(prev => !prev);
      } else if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        triggerComplete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Standard OEM boot display timer (3.8s boot sequence, then smooth fade)
    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, 3800);

    const finishTimer = setTimeout(() => {
      triggerComplete();
    }, 4600);

    return () => {
      clearInterval(diagTimer);
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const triggerComplete = () => {
    setFading(true);
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 450);
  };

  return (
    <div
      onClick={triggerComplete}
      title="Click or press [Space / Enter] to bypass directly to Sovereign Desktop"
      className="fixed inset-0 z-[999999] bg-black text-white flex flex-col items-center justify-between select-none cursor-pointer overflow-hidden transition-opacity duration-700 ease-in-out"
      style={{
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      {/* 1. Top Bar: Subtle OEM POST Status */}
      <div className="w-full px-8 pt-6 flex items-center justify-between text-[11px] text-zinc-500 font-mono tracking-wider">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          <span>NOVAURA SOVEREIGN POST // REVISION 2026.4</span>
        </div>
        <div className="flex items-center gap-4 text-zinc-600">
          <span>[F2] SYSTEM DIAGNOSTICS</span>
          <span>[ESC] BYPASS</span>
        </div>
      </div>

      {/* 2. Center: Official OEM / UEFI Logo & Iconic Spinning Dots Loader */}
      <div className="flex flex-col items-center justify-center -mt-8">
        {/* Glowing Crest / Official Emblem */}
        <div className="relative flex items-center justify-center mb-8">
          <div
            className="absolute w-44 h-44 rounded-full bg-cyan-500/15 blur-2xl animate-pulse"
            style={{ animationDuration: '3s' }}
          />
          <img
            src={logoImg}
            alt="Novaura Official Logo"
            className="w-32 h-32 md:w-36 md:h-36 object-contain relative z-10 drop-shadow-[0_0_35px_rgba(6,182,212,0.6)]"
          />
        </div>

        {/* Brand Typography (Dell / Windows OEM Style) */}
        <div className="text-center mb-10 space-y-1">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-[0.28em] text-white font-sans drop-shadow-[0_2px_12px_rgba(255,255,255,0.25)]">
            NOVAURA
          </h1>
          <p className="text-[11px] md:text-xs font-semibold tracking-[0.45em] text-cyan-400/90 uppercase font-mono">
            Sovereign OS
          </p>
        </div>

        {/* Windows/Surface-Style Iconic Circular Orbiting Spinner */}
        <div className="relative w-10 h-10 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 border-r-cyan-500/40 animate-spin" style={{ animationDuration: '1.2s' }} />
          <div className="absolute w-6 h-6 rounded-full border-2 border-transparent border-b-cyan-300 animate-spin" style={{ animationDuration: '0.8s', animationDirection: 'reverse' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-ping" />
        </div>
      </div>

      {/* 3. Bottom: Microkernel Banner & Diagnostics Terminal */}
      <div className="w-full max-w-4xl px-8 pb-8 flex flex-col items-center gap-3">
        {/* Toggleable Diagnostics Overlay if F2 is active or on click */}
        {showDiagnostics && (
          <div className="w-full bg-zinc-950/90 border border-zinc-800 rounded-xl p-3 mb-2 font-mono text-[10px] text-zinc-400 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-zinc-800 text-cyan-400 font-bold">
              <span>UEFI MICROKERNEL DIAGNOSTIC LOG</span>
              <span>STAGE {diagStep}/{KERNEL_DIAGNOSTICS.length}</span>
            </div>
            <div className="space-y-1">
              {KERNEL_DIAGNOSTICS.slice(0, diagStep).map((d) => (
                <div key={d.id} className="flex items-center justify-between">
                  <span className="text-zinc-300">[{d.id}] {d.desc}</span>
                  <span className="text-emerald-400 font-bold">[{d.status}]</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Microkernel Specification String */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-between text-[11px] text-zinc-500 font-mono border-t border-zinc-900 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 font-semibold">KERNEL:</span>
            <span className="text-cyan-400/80">NovAura Sovereign Microkernel v2.5 (x86_64-pc-windows-gnu)</span>
          </div>
          <div className="flex items-center gap-2 mt-1 sm:mt-0 text-zinc-600">
            <span>ZERO-TRUST SECURE BOOT</span>
            <span>•</span>
            <span className="text-emerald-500/80">AUTHENTICATED</span>
          </div>
        </div>
      </div>
    </div>
  );
}
