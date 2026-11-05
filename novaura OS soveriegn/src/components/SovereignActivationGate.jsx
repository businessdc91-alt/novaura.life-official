import React, { useState, useEffect } from 'react';
import { Shield, Key, CheckCircle, AlertTriangle, Sparkles, Copy, Clipboard } from 'lucide-react';
import { verifySovereignKey, saveKeyRecord } from '../services/sovereignAuth';
import { getHardwareFingerprint, verifyNativeLicense } from '../services/nativeService';
import logoImg from '../assets/novaura-logo.png';

export default function SovereignActivationGate({ onAuthorized }) {
  const [inputKey, setInputKey] = useState('');
  // Blank means a number derived from this node's key (phoneNumbers.js), so no two nodes share a default.
  const [inputPhone, setInputPhone] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [copiedNodeId, setCopiedNodeId] = useState(false);
  const [error, setError] = useState('');
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    getHardwareFingerprint().then((id) => {
      if (id) setNodeId(id);
    }).catch(() => {});
  }, []);

  const handleKeyChange = (e) => {
    const val = e.target.value.trim();
    setInputKey(val);
    setError('');
  };

  const handleCopyNodeId = async () => {
    if (!nodeId) return;
    try {
      await navigator.clipboard.writeText(nodeId);
      setCopiedNodeId(true);
      setTimeout(() => setCopiedNodeId(false), 2000);
    } catch {
      setError('Could not copy Node ID automatically. Please highlight and copy manually.');
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim().startsWith('NOVA1.')) {
        setInputKey(text.trim());
        setError('');
      } else if (text) {
        setInputKey(text.trim());
        setError('');
      }
    } catch {
      setError('Could not access clipboard. Please paste manually.');
    }
  };

  const handleActivate = async () => {
    if (!inputKey) {
      setError('Please enter your authentic NOVA1 sovereign license token.');
      return;
    }

    setValidating(true);
    setError('');

    try {
      const activeNodeId = nodeId || (await getHardwareFingerprint());

      // If running inside Tauri native environment, execute OS-level Rust verification
      const nativeCheck = await verifyNativeLicense(inputKey);
      if (nativeCheck && !nativeCheck.valid) {
        setError(nativeCheck.reason || 'Native hardware verification rejected this license.');
        setValidating(false);
        return;
      }

      // The native verifier accepts this machine's current or legacy node ID and
      // reports which one the license is bound to.
      const boundNodeId = nativeCheck?.valid && nativeCheck.fingerprint ? nativeCheck.fingerprint : activeNodeId;
      const result = verifySovereignKey(inputKey, boundNodeId);
      if (result.valid) {
        await saveKeyRecord(inputKey, result, inputPhone.trim() || null);
        if (onAuthorized) onAuthorized(result);
      } else {
        setError(result.reason || 'Cryptographic signature verification failed.');
      }
    } catch (err) {
      setError(err?.message || 'Verification failed.');
    } finally {
      setValidating(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999990,
        backgroundColor: '#05070f',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Background Cyber Grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.08) 0%, transparent 70%), linear-gradient(rgba(0, 240, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.03) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 36px 36px, 36px 36px',
        }}
      />

      <div
        style={{
          position: 'relative',
          width: '540px',
          maxWidth: '92vw',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(0, 240, 255, 0.25)',
          borderRadius: '12px',
          padding: '2.5rem',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), inset 0 0 30px rgba(0, 240, 255, 0.04)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <img
          src={logoImg}
          alt="Novaura"
          style={{ width: '64px', height: '64px', objectFit: 'contain', marginBottom: '1.2rem', filter: 'drop-shadow(0 0 15px rgba(0, 240, 255, 0.6))' }}
        />

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.25rem 0.75rem',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: '9999px',
          fontSize: '0.7rem',
          fontWeight: 700,
          color: '#34d399',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '0.75rem',
        }}>
          <span>💎 PERPETUAL OWNERSHIP • SINGLE-TIME PURCHASE • ZERO SUBSCRIPTIONS</span>
        </div>

        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '0.02em' }}>
          Sovereign Node Activation
        </h2>
        <p style={{ margin: '0.5rem 0 1.25rem 0', color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.5' }}>
          Escape the cloud subscription treadmill. This workstation runs 100% on your own hardware with a single-time perpetual purchase—replacing over a dozen monthly SaaS fees with permanent, air-gapped sovereignty.
        </p>

        {/* 12 Subscriptions Eliminated Highlight */}
        <div style={{
          width: '100%',
          padding: '0.65rem 0.85rem',
          backgroundColor: 'rgba(2, 6, 23, 0.7)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          fontSize: '0.72rem',
          color: '#cbd5e1',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <span style={{ fontWeight: 700, color: '#38bdf8' }}>12 Cloud Subscriptions Eliminated: </span>
            <span style={{ color: '#94a3b8' }}>ChatGPT Plus, Midjourney, Word, Scrivener, Canva, Wix, Drive & more.</span>
          </div>
          <span style={{ fontWeight: 800, color: '#34d399', paddingLeft: '0.5rem', whiteSpace: 'nowrap' }}>~$3,450/yr Saved</span>
        </div>


        {/* Hardware Node Identifier Display with 1-Click Copy */}
        <div style={{
          width: '100%',
          padding: '0.65rem 0.85rem',
          backgroundColor: 'rgba(2, 6, 23, 0.75)',
          border: '1px solid rgba(0, 240, 255, 0.25)',
          borderRadius: '8px',
          marginBottom: '1rem',
          textAlign: 'left',
          boxSizing: 'border-box',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#38bdf8', letterSpacing: '0.08em' }}>
              HARDWARE NODE IDENTIFIER (LOCAL MACHINE)
            </span>
            <button
              onClick={handleCopyNodeId}
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: copiedNodeId ? '#34d399' : '#00f0ff',
                fontSize: '0.7rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: 0,
              }}
            >
              {copiedNodeId ? <CheckCircle size={12} /> : <Copy size={12} />}
              <span>{copiedNodeId ? 'Copied' : 'Copy Node ID'}</span>
            </button>
          </div>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.78rem',
            color: '#e2e8f0',
            userSelect: 'all',
            wordBreak: 'break-all',
          }}>
            {nodeId || 'Detecting hardware node identity...'}
          </div>
        </div>

        {/* Key Input Field */}
        <div style={{ width: '100%', marginBottom: '1rem', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#00f0ff', letterSpacing: '0.08em' }}>
              SOVEREIGN AUTHORIZATION TOKEN (NOVA1.*)
            </label>
            <button
              onClick={handlePasteClipboard}
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: '#38bdf8',
                fontSize: '0.7rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: 0,
              }}
            >
              <Clipboard size={12} />
              <span>Paste Token</span>
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <Key size={18} color="#64748b" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={inputKey}
              onChange={handleKeyChange}
              placeholder="NOVA1.eyJ...<signature>"
              style={{
                width: '100%',
                padding: '0.85rem 1rem 0.85rem 2.8rem',
                backgroundColor: 'rgba(2, 6, 23, 0.8)',
                border: error ? '1px solid #ef4444' : '1px solid rgba(0, 240, 255, 0.3)',
                borderRadius: '8px',
                color: '#00f0ff',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.85rem',
                letterSpacing: '0.05em',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* In-Ecosystem Sovereign Phone Number */}
        <div style={{ width: '100%', marginBottom: '1.25rem', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8', letterSpacing: '0.08em' }}>
              IN-ECOSYSTEM PHONE NUMBER (E.164)
            </label>
            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Peer Calling & Mesh Identity</span>
          </div>
          <input
            type="text"
            value={inputPhone}
            onChange={(e) => setInputPhone(e.target.value)}
            placeholder="Optional, e.g. +1-700-NOVA-4821 (blank: made from your node key)"
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(2, 6, 23, 0.8)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '8px',
              color: '#38bdf8',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.95rem',
              letterSpacing: '0.08em',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171', fontSize: '0.78rem', marginBottom: '1rem', textAlign: 'left' }}>
            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handleActivate}
          disabled={validating}
          style={{
            width: '100%',
            padding: '0.85rem',
            backgroundColor: validating ? '#334155' : '#0284c7',
            border: 'none',
            borderRadius: '8px',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.92rem',
            cursor: validating ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
            boxShadow: '0 0 20px rgba(2, 132, 199, 0.4)',
            marginBottom: '1.25rem',
          }}
        >
          {validating ? 'Verifying Digital Signature...' : 'Authorize Node & Launch'}
        </button>

        {/* Cryptographic Licensing Verification Info */}
        <div
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: 'rgba(2, 6, 23, 0.5)',
            border: '1px solid rgba(148, 163, 184, 0.15)',
            borderRadius: '8px',
            fontSize: '0.72rem',
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          <Shield size={14} color="#38bdf8" />
          <span>Authority Root Verified: Offline Ed25519 Cryptographic Verification</span>
        </div>
      </div>
    </div>
  );
}
