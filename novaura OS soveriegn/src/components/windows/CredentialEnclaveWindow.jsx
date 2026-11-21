import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, Lock, Unlock, Key, KeyRound, Copy, RefreshCw,
  Plus, Trash2, Eye, EyeOff, Check, AlertTriangle, Shield,
  Clock, Hash, Sliders, Terminal, CheckCircle2
} from 'lucide-react';
import { credentialEnclave } from '../../services/credentialEnclaveService.js';

export default function CredentialEnclaveWindow() {
  const [unlocked, setUnlocked] = useState(() => credentialEnclave.isUnlocked());
  const [lockReason, setLockReason] = useState(() => credentialEnclave.getStatus().lastLockReason);
  const [idleMinutes, setIdleMinutes] = useState(() => credentialEnclave.getIdleTimeoutMinutes());
  const [passphrase, setPassphrase] = useState('');
  const [deriving, setDeriving] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [activeTab, setActiveTab] = useState('keys'); // 'keys' | 'ssh' | 'totp' | 'generator'

  // Clipboard wipe state
  const [clipboardCountdown, setClipboardCountdown] = useState(0);
  const [copiedItemLabel, setCopiedItemLabel] = useState('');

  // Enclave Records (populated in volatile RAM only while unlocked)
  const [records, setRecords] = useState([]);
  const [revealedSecrets, setRevealedSecrets] = useState({});

  // Form State for Adding Keys
  const [newKeyForm, setNewKeyForm] = useState({ provider: 'gemini', label: 'Gemini Cloud BYOK', value: '' });

  // SSH Keyring State (encrypted in AES-256-GCM enclave store, zero plaintext storage)
  const [sshKeys, setSshKeys] = useState([]);

  // TOTP 2FA State (encrypted in AES-256-GCM enclave store, zero plaintext storage)
  const [totpAccounts, setTotpAccounts] = useState([]);
  const [newTotpForm, setNewTotpForm] = useState({ name: '', issuer: '', secret: '' });
  const [showAddTotp, setShowAddTotp] = useState(false);
  const [totpTick, setTotpTick] = useState({ timeRemaining: 30 });

  // Passphrase Generator State
  const [genLength, setGenLength] = useState(24);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [generatedPass, setGeneratedPass] = useState(() => credentialEnclave.generatePassphrase(24, true));

  const wipeVolatileState = useCallback(() => {
    setRecords([]);
    setSshKeys([]);
    setTotpAccounts([]);
    setRevealedSecrets({});
  }, []);

  const loadRecords = useCallback(async () => {
    if (!credentialEnclave.isUnlocked()) {
      wipeVolatileState();
      return;
    }
    try {
      const [allRecs, decryptedSsh, decryptedTotp] = await Promise.all([
        credentialEnclave.getSecretRecords(),
        credentialEnclave.listDecryptedByType('ssh_pgp'),
        credentialEnclave.listDecryptedByType('totp'),
      ]);
      setRecords(allRecs.filter(r => r.type === 'api_key'));
      setSshKeys(decryptedSsh);
      setTotpAccounts(decryptedTotp);
    } catch (e) {
      console.warn(e);
    }
  }, [wipeVolatileState]);

  useEffect(() => {
    const unsub = credentialEnclave.subscribe(({ isUnlocked, reason, idleTimeoutMinutes }) => {
      setUnlocked(isUnlocked);
      setLockReason(reason || null);
      if (typeof idleTimeoutMinutes === 'number') {
        setIdleMinutes(idleTimeoutMinutes);
      }
      if (isUnlocked) {
        loadRecords();
      } else {
        wipeVolatileState();
      }
    });

    if (unlocked) {
      loadRecords();
    } else {
      wipeVolatileState();
    }

    // TOTP Timer Interval (Dynamic RFC 6238 time-step cycle)
    const updateTick = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = 30 - (now % 30);
      setTotpTick({ timeRemaining: remaining });
    };
    updateTick();
    const timer = setInterval(updateTick, 1000);

    return () => {
      unsub();
      clearInterval(timer);
    };
  }, [unlocked, loadRecords, wipeVolatileState]);

  const handleUnlock = async (e) => {
    e?.preventDefault();
    if (!passphrase) {
      setUnlockError('Please enter master passphrase.');
      return;
    }
    setDeriving(true);
    setUnlockError('');
    try {
      await credentialEnclave.unlock(passphrase);
      setUnlocked(true);
      setLockReason(null);
      setPassphrase('');
    } catch (err) {
      setUnlockError(err.message || 'Unlock failed.');
    } finally {
      setDeriving(false);
    }
  };

  const handleLock = () => {
    credentialEnclave.lock('manual');
    setUnlocked(false);
    wipeVolatileState();
  };

  const handleCopySecret = (text, label) => {
    setCopiedItemLabel(label);
    credentialEnclave.copyToClipboardWithAutoWipe(
      text,
      (sec) => setClipboardCountdown(sec),
      () => {
        setClipboardCountdown(0);
        setCopiedItemLabel('');
      }
    );
  };

  const handleSaveApiKey = async (e) => {
    e.preventDefault();
    if (!newKeyForm.value.trim()) return;
    try {
      await credentialEnclave.storeSecret({
        type: 'api_key',
        label: newKeyForm.label || newKeyForm.provider.toUpperCase(),
        category: newKeyForm.provider,
        plaintextPayload: {
          provider: newKeyForm.provider,
          apiKey: newKeyForm.value.trim(),
        },
      });
      setNewKeyForm({ provider: 'gemini', label: '', value: '' });
      await loadRecords();
    } catch (err) {
      alert('Error saving secret: ' + err.message);
    }
  };

  const handleToggleReveal = async (recordId) => {
    if (revealedSecrets[recordId]) {
      setRevealedSecrets(prev => {
        const next = { ...prev };
        delete next[recordId];
        return next;
      });
    } else {
      try {
        const secret = await credentialEnclave.revealSecret(recordId);
        setRevealedSecrets(prev => ({ ...prev, [recordId]: secret }));
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleGenerateSSH = async (alg) => {
    try {
      const keypair = await credentialEnclave.generateKeyPair(alg);
      await credentialEnclave.storeSecret({
        id: 'ssh_' + Date.now(),
        type: 'ssh_pgp',
        label: `${alg} Operator Key`,
        category: alg.toLowerCase(),
        plaintextPayload: keypair,
      });
      await loadRecords();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      {!unlocked ? (
        /* Enclave Locked Screen */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-4 text-cyan-400 shadow-xl shadow-cyan-950/40">
            <Lock className="w-8 h-8" />
          </div>

          <h2 className="text-lg font-bold text-slate-100 mb-1">Sovereign Keyring & Credential Enclave</h2>
          <p className="text-xs text-slate-400 max-w-sm mb-5 leading-relaxed">
            Zero-knowledge vault encrypted at rest with hardware-bound 256-bit AES-GCM and PBKDF2-HMAC-SHA256 (600,000 iterations).
          </p>

          {lockReason === 'idle_timeout' && (
            <div className="w-full max-w-xs mb-4 px-3 py-2 rounded-xl bg-amber-950/40 border border-amber-500/40 text-[11px] text-amber-300 flex items-center gap-2 text-left">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Enclave automatically locked after inactivity timeout.</span>
            </div>
          )}

          <form onSubmit={handleUnlock} className="w-full max-w-xs space-y-3">
            <div>
              <input
                type="password"
                placeholder="Enter operator master passphrase..."
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 outline-none focus:border-cyan-500 font-mono text-center tracking-widest shadow-inner"
              />
            </div>

            {unlockError && (
              <span className="text-[11px] text-red-400 block">{unlockError}</span>
            )}

            <button
              type="submit"
              disabled={deriving}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-cyan-950/50 flex items-center justify-center gap-2"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>{deriving ? 'Deriving 256-bit Master Key...' : 'Unlock Enclave'}</span>
            </button>
          </form>
        </div>
      ) : (
        /* Enclave Unlocked Workspace */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Header & Zero-Clipboard Banner */}
          <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0 gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold text-slate-100">Sovereign Credential Enclave</h2>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                    AES-256 GCM ACTIVE
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">Hardware-bound zero-knowledge key store</span>
              </div>
            </div>

            {/* Clipboard Countdown Ticker + Auto-Lock Selector */}
            <div className="flex items-center gap-3">
              {clipboardCountdown > 0 ? (
                <div className="flex items-center gap-2 px-3 py-1 bg-amber-950/40 border border-amber-500/40 rounded-lg text-xs text-amber-300 font-mono">
                  <Clock className="w-3.5 h-3.5 animate-pulse text-amber-400" />
                  <span>Clipboard wipe in {clipboardCountdown}s ({copiedItemLabel})</span>
                </div>
              ) : (
                <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Zero-Clipboard Guard Armed</span>
                </div>
              )}

              <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span>Auto-Lock:</span>
                <select
                  value={idleMinutes}
                  onChange={(e) => setIdleMinutes(credentialEnclave.setIdleTimeoutMinutes(Number(e.target.value)))}
                  className="px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-[11px] text-slate-200 outline-none focus:border-cyan-500"
                >
                  <option value={1}>1m</option>
                  <option value={5}>5m</option>
                  <option value={15}>15m</option>
                  <option value={30}>30m</option>
                  <option value={60}>60m</option>
                  <option value={0}>Manual</option>
                </select>
              </label>

              <button
                onClick={handleLock}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg border border-slate-700 transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock Enclave</span>
              </button>
            </div>
          </div>

          {/* Navigation Bar */}
          <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex gap-2 shrink-0">
            {[
              { id: 'keys', label: 'API Keys & BYOK', icon: Key },
              { id: 'ssh', label: 'SSH & PGP Keyring', icon: Shield },
              { id: 'totp', label: '2FA Authenticator', icon: Clock },
              { id: 'generator', label: 'Passphrase Generator', icon: Sliders },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === tab.id
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'keys' && (
              <div className="max-w-3xl space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Encrypted Cloud BYOK & API Keys</h3>
                  <p className="text-xs text-slate-400">All keys are encrypted at rest with hardware salt and decrypted only in volatile RAM.</p>
                </div>

                {/* Add Key Form */}
                <form onSubmit={handleSaveApiKey} className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Provider</label>
                      <select
                        value={newKeyForm.provider}
                        onChange={(e) => setNewKeyForm({ ...newKeyForm, provider: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none"
                      >
                        <option value="gemini">Google Gemini / Vertex</option>
                        <option value="anthropic">Anthropic (Claude)</option>
                        <option value="openai">OpenAI</option>
                        <option value="openrouter">OpenRouter</option>
                        <option value="groq">Groq</option>
                        <option value="elevenlabs">ElevenLabs (Voice)</option>
                        <option value="custom">Custom Endpoint URL</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Label</label>
                      <input
                        type="text"
                        placeholder="e.g. 'Primary Production Key'..."
                        value={newKeyForm.label}
                        onChange={(e) => setNewKeyForm({ ...newKeyForm, label: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">API Key Secret</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="sk-..."
                        value={newKeyForm.value}
                        onChange={(e) => setNewKeyForm({ ...newKeyForm, value: e.target.value })}
                        className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 font-mono outline-none"
                      />
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition-colors"
                      >
                        Store Secret
                      </button>
                    </div>
                  </div>
                </form>

                {/* Stored Records */}
                <div className="space-y-2">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Stored Enclave Keys ({records.length})</span>
                  {records.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs bg-slate-900/40 rounded-xl border border-slate-800">
                      No encrypted keys stored yet. Add an API key above to secure it with AES-256 GCM.
                    </div>
                  ) : (
                    records.map((rec) => {
                      const revealed = revealedSecrets[rec.id];
                      return (
                        <div key={rec.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-200">{rec.label}</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-950 text-cyan-400 font-mono border border-slate-800 uppercase">
                                {rec.category}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
                              {revealed ? revealed.apiKey : '••••••••••••••••••••••••••••••••'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleToggleReveal(rec.id)}
                              className="p-1.5 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800"
                              title={revealed ? 'Hide' : 'Reveal'}
                            >
                              {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => revealed && handleCopySecret(revealed.apiKey, rec.label)}
                              disabled={!revealed}
                              className="p-1.5 text-slate-400 hover:text-cyan-400 disabled:opacity-30 rounded hover:bg-slate-800"
                              title="Copy with 30s auto-wipe"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={async () => {
                                await credentialEnclave.deleteSecret(rec.id);
                                loadRecords();
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-slate-800"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {activeTab === 'ssh' && (
              <div className="max-w-3xl space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">SSH & PGP Sovereign Keyring</h3>
                    <p className="text-xs text-slate-400">Generate on-device cryptographic keypairs for node administration, Git, and server authentication.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleGenerateSSH('Ed25519')}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Generate Ed25519</span>
                    </button>
                    <button
                      onClick={() => handleGenerateSSH('RSA')}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors border border-slate-700 cursor-pointer"
                    >
                      <span>Generate RSA-2048</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {sshKeys.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs bg-slate-900/40 rounded-xl border border-slate-800">
                      No SSH keypairs generated yet. Click above to generate an authentic on-device Ed25519 or RSA-2048 key.
                    </div>
                  ) : (
                    sshKeys.map((key) => (
                      <div key={key.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-100">{key.label}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-purple-400 font-mono border border-slate-800">
                              {key.algorithm}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-mono">
                              {key.fingerprint}
                            </span>
                            <button
                              onClick={async () => {
                                await credentialEnclave.deleteSecret(key.id);
                                await loadRecords();
                              }}
                              className="p-1 text-slate-500 hover:text-red-400 rounded"
                              title="Delete Key"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-400 break-all select-all">
                          {key.publicKey}
                        </div>

                        <div className="flex justify-end gap-3 pt-1">
                          {key.privateKey && (
                            <button
                              onClick={() => handleCopySecret(key.privateKey, `${key.label} (Private)`)}
                              className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Copy Private Key (30s wipe)</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleCopySecret(key.publicKey, `${key.label} (Public)`)}
                            className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy Public Key (30s wipe)</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'totp' && (
              <div className="max-w-2xl space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">Time-Based 2FA Authenticator (TOTP)</h3>
                    <p className="text-xs text-slate-400">Authentic RFC 6238 time-step codes encrypted at rest with zero-cloud storage and live 30-second cycles.</p>
                  </div>
                  <button
                    onClick={() => setShowAddTotp(!showAddTotp)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{showAddTotp ? 'Cancel' : 'Add 2FA Key'}</span>
                  </button>
                </div>

                {/* Add TOTP Form */}
                {showAddTotp && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newTotpForm.name || !newTotpForm.secret) return;
                      const cleanSecret = newTotpForm.secret.replace(/\s+/g, '').toUpperCase();
                      const cleanName = newTotpForm.name.trim();
                      const cleanIssuer = newTotpForm.issuer.trim() || 'Sovereign Node';
                      try {
                        await credentialEnclave.storeSecret({
                          id: 'totp_' + Date.now(),
                          type: 'totp',
                          label: cleanName,
                          category: cleanIssuer,
                          plaintextPayload: {
                            name: cleanName,
                            issuer: cleanIssuer,
                            secret: cleanSecret,
                          },
                        });
                        setNewTotpForm({ name: '', issuer: '', secret: '' });
                        setShowAddTotp(false);
                        await loadRecords();
                      } catch (err) {
                        alert('Error saving 2FA key: ' + err.message);
                      }
                    }}
                    className="p-4 bg-slate-900 border border-cyan-500/30 rounded-xl space-y-3"
                  >
                    <div className="text-xs font-bold text-cyan-300">Add New Authenticator Account</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Account Label</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. GitHub, AWS, Admin"
                          value={newTotpForm.name}
                          onChange={(e) => setNewTotpForm({ ...newTotpForm, name: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Issuer (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Cloudflare, Sovereign Enclave"
                          value={newTotpForm.issuer}
                          onChange={(e) => setNewTotpForm({ ...newTotpForm, issuer: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Base32 Secret Key</label>
                      <input
                        type="password"
                        required
                        placeholder="e.g. JBSWY3DPEHPK3PXP"
                        value={newTotpForm.secret}
                        onChange={(e) => setNewTotpForm({ ...newTotpForm, secret: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-cyan-300 outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="submit"
                        className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium cursor-pointer"
                      >
                        Save 2FA Key
                      </button>
                    </div>
                  </form>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {totpAccounts.length === 0 ? (
                    <div className="col-span-2 p-8 text-center text-slate-500 text-xs bg-slate-900/40 rounded-xl border border-slate-800">
                      No 2FA authenticator accounts added yet. Click &quot;Add 2FA Key&quot; to register your first secret seed.
                    </div>
                  ) : (
                    totpAccounts.map((acc) => {
                      const codeData = credentialEnclave.generateTOTPCode(acc.secret);
                      return (
                        <div key={acc.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold text-slate-100 block">{acc.name}</span>
                              <span className="text-[10px] text-slate-500">{acc.issuer}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full border border-cyan-500/30 flex items-center justify-center font-mono text-[10px] text-cyan-300 font-bold bg-cyan-950/30">
                                {totpTick.timeRemaining}s
                              </div>
                              <button
                                onClick={async () => {
                                  await credentialEnclave.deleteSecret(acc.id);
                                  await loadRecords();
                                }}
                                className="p-1 text-slate-500 hover:text-red-400 rounded"
                                title="Delete 2FA Account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
                            <span className="text-2xl font-extrabold text-cyan-400 font-mono tracking-widest">
                              {codeData.code}
                            </span>
                            <button
                              onClick={() => handleCopySecret(codeData.code, acc.name)}
                              className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-700 cursor-pointer"
                              title="Copy 2FA Code"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {activeTab === 'generator' && (
              <div className="max-w-xl space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Cryptographic Passphrase Generator</h3>
                  <p className="text-xs text-slate-400">Generate high-entropy passphrases derived from host hardware randomness.</p>
                </div>

                <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                  <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-sm font-bold text-emerald-400 font-mono break-all tracking-wider">
                      {generatedPass}
                    </span>
                    <button
                      onClick={() => handleCopySecret(generatedPass, 'Generated Passphrase')}
                      className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded border border-slate-700 shrink-0 ml-3"
                      title="Copy with 30s auto-wipe"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Length: {genLength} Characters</span>
                        <span className="text-emerald-400 font-bold">~{Math.round(genLength * 5.9)} bits entropy</span>
                      </div>
                      <input
                        type="range"
                        min="16"
                        max="48"
                        value={genLength}
                        onChange={(e) => {
                          const len = parseInt(e.target.value);
                          setGenLength(len);
                          setGeneratedPass(credentialEnclave.generatePassphrase(len, includeSymbols));
                        }}
                        className="w-full accent-cyan-400"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={includeSymbols}
                          onChange={(e) => {
                            setIncludeSymbols(e.target.checked);
                            setGeneratedPass(credentialEnclave.generatePassphrase(genLength, e.target.checked));
                          }}
                          className="accent-cyan-400 rounded"
                        />
                        <span>Include Special Symbols (!@#$%^&*)</span>
                      </label>

                      <button
                        onClick={() => setGeneratedPass(credentialEnclave.generatePassphrase(genLength, includeSymbols))}
                        className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 font-semibold"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Regenerate</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
