import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert, ShieldCheck, Key, Lock, Radio, Sparkles,
  Users, Globe, Send, Terminal, Cpu, Check, X, AlertTriangle,
  RotateCw, Plus, Trash2, Pin, PinOff, Eye, Search, Layers, Swords
} from 'lucide-react';
import { db } from '../../database/sovereignDatabase.js';
import {
  AUTHORITY_TIERS,
  FOUNDER_ACTION_BUBBLES,
  getOperatorAuthority,
  verifyFounderKey,
  ISSUE_KEY_INSTRUCTIONS,
  listFounderKeys,
  revokeFounderKey,
  setNodeAuthority,
  getNodeAuthorityMatrix,
  getFactionBalanceStats,
  executeNovaFounderCommand
} from '../../services/founderAuthService.js';
import { getMeshSitesRegistry, setSitePinStatus, setSiteFlagStatus } from '../../services/sovereignMesh.js';
import { getAuthorizedApps, revokeAppAccess } from '../../services/decentralizedAuthService.js';

export default function FounderOfficeSuiteWindow({ onClose }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authKeyInput, setAuthKeyInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [operator, setOperator] = useState(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState('console'); // 'console' | 'authority' | 'oauth' | 'factions' | 'registry'

  // Nova Command Console State
  const [chatLog, setChatLog] = useState([
    {
      sender: 'nova',
      text: `### 👑 Founder's Executive Office Engaged\n\nWelcome, Founder. I am **Nova**, your executive intelligence companion. All ecosystem authority levers, cryptographic key minting, and dual-mesh faction matrices are at your command.\n\nSelect an action bubble below or give me any sovereign administrative directive.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [executingCommand, setExecutingCommand] = useState(false);
  const chatBottomRef = useRef(null);

  // Authority Matrix State
  const [authorityRows, setAuthorityRows] = useState([]);
  const [founderKeys, setFounderKeys] = useState([]);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyIssued, setNewKeyIssued] = useState(null);
  const [targetHandle, setTargetHandle] = useState('');
  const [targetTier, setTargetTier] = useState('council');

  // OAuth Apps State
  const [authorizedApps, setAuthorizedApps] = useState([]);

  // Faction War State
  const [factionStats, setFactionStats] = useState(null);

  // Mesh Registry State
  const [registrySites, setRegistrySites] = useState([]);

  // Check initial authentication
  useEffect(() => {
    const initAuth = async () => {
      setCheckingAuth(true);
      try {
        const op = await getOperatorAuthority();
        setOperator(op);
        if (op.isFounder) {
          setIsAuthenticated(true);
        }
      } finally {
        setCheckingAuth(false);
      }
    };
    initAuth();
  }, []);

  // Load data for active tabs
  const refreshTabData = async () => {
    if (!isAuthenticated) return;
    try {
      if (activeTab === 'authority') {
        const [matrix, keys] = await Promise.all([
          getNodeAuthorityMatrix(),
          listFounderKeys(),
        ]);
        setAuthorityRows(matrix);
        setFounderKeys(keys);
      } else if (activeTab === 'oauth') {
        const apps = await getAuthorizedApps();
        setAuthorizedApps(apps);
      } else if (activeTab === 'factions') {
        const stats = await getFactionBalanceStats();
        setFactionStats(stats);
      } else if (activeTab === 'registry') {
        const sites = await getMeshSitesRegistry();
        setRegistrySites(sites);
      }
    } catch (e) {
      console.warn('[FounderOffice] Tab refresh note:', e);
    }
  };

  useEffect(() => {
    refreshTabData();
  }, [activeTab, isAuthenticated]);

  // Scroll chat bottom
  useEffect(() => {
    if (activeTab === 'console') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatLog, activeTab]);

  // Manual key entry verification
  const handleKeyLogin = async () => {
    setAuthError('');
    const valid = await verifyFounderKey(authKeyInput);
    if (valid) {
      setIsAuthenticated(true);
    } else {
      setAuthError('That is not a valid founder license. It must be a NOVA1 token with a founder tier, signed by the Novaura authority key.');
    }
  };

  // Execute Nova command
  const handleSendCommand = async (textToSend = null) => {
    const prompt = textToSend || chatInput;
    if (!prompt.trim() || executingCommand) return;

    const userEntry = {
      sender: 'user',
      text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatLog(prev => [...prev, userEntry]);
    if (!textToSend) setChatInput('');
    setExecutingCommand(true);

    try {
      const response = await executeNovaFounderCommand(prompt);
      const novaEntry = {
        sender: 'nova',
        text: response.message,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        data: response.data,
      };
      setChatLog(prev => [...prev, novaEntry]);
    } catch (err) {
      setChatLog(prev => [
        ...prev,
        {
          sender: 'nova',
          text: `⚠️ Execution notice: ${err.message || 'Command failed to execute.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    } finally {
      setExecutingCommand(false);
    }
  };

  // Node authority assignment
  const handlePromoteNode = async () => {
    if (!targetHandle.trim()) return;
    await setNodeAuthority(targetHandle, targetTier, 'Assigned via Founder Executive Office');
    setTargetHandle('');
    refreshTabData();
  };

  // Revoke founder key
  const handleRevokeKey = async (keyId) => {
    await revokeFounderKey(keyId);
    refreshTabData();
  };

  // Revoke app authorization
  const handleRevokeApp = async (domain) => {
    await revokeAppAccess(domain);
    refreshTabData();
  };

  // Toggle site pin
  const handleTogglePin = async (domain, currentPinned) => {
    await setSitePinStatus(domain, !currentPinned);
    refreshTabData();
  };

  // Flag or quarantine site
  const handleToggleFlag = async (domain, currentFlagged) => {
    await setSiteFlagStatus(domain, !currentFlagged, 'Quarantined by Founder Office');
    refreshTabData();
  };

  // Gatekeeper: Authentication Screen
  if (checkingAuth) {
    return (
      <div className="w-full h-full bg-slate-950 flex items-center justify-center font-sans select-none text-slate-400">
        <Cpu className="w-6 h-6 animate-spin text-cyan-400 mr-2" />
        <span>Verifying Sovereign Cryptographic Credentials...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="w-full h-full bg-slate-950 flex items-center justify-center p-6 font-sans select-none">
        <div className="w-full max-w-md bg-slate-900 border border-red-500/30 rounded-2xl p-6 shadow-2xl shadow-red-950/40 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-950/80 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">Founder's Office Restricted Enclave</h2>
            <p className="text-xs text-slate-400 mt-1">
              Reserved for holders of a founder license signed by the Novaura authority key.
            </p>
          </div>

          <div className="space-y-2 text-left">
            <label className="text-xs font-semibold text-slate-300">Paste your founder license (NOVA1 token)</label>
            <input
              type="password"
              value={authKeyInput}
              onChange={(e) => setAuthKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleKeyLogin()}
              placeholder="NOVA1...."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 placeholder:text-slate-600 outline-none focus:border-cyan-500"
            />
          </div>

          {authError && (
            <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-500/40 text-xs text-red-300 flex items-center gap-2 text-left">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
            >
              Exit
            </button>
            <button
              onClick={handleKeyLogin}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 shadow-lg shadow-red-950/60 transition-all cursor-pointer"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Unlock Founder Suite</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* Top Header Ribbon */}
      <div className="h-12 px-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-cyan-500/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-500/20">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold text-white tracking-wide">FOUNDER'S EXECUTIVE OFFICE</h1>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                Root Authority
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Master Controller for Novaura Sovereign Conglomerate</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setActiveTab('console')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors ${
              activeTab === 'console' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Nova Command Console</span>
          </button>
          <button
            onClick={() => setActiveTab('authority')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors ${
              activeTab === 'authority' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Authority Matrix</span>
          </button>
          <button
            onClick={() => setActiveTab('oauth')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors ${
              activeTab === 'oauth' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Ecosystem OAuth (SIWN)</span>
          </button>
          <button
            onClick={() => setActiveTab('factions')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors ${
              activeTab === 'factions' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Faction War</span>
          </button>
          <button
            onClick={() => setActiveTab('registry')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors ${
              activeTab === 'registry' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Registry Admin</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-hidden flex flex-col bg-slate-950">
        {/* ── TAB 1: NOVA EXECUTIVE COMMAND CONSOLE ── */}
        {activeTab === 'console' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Quick Action Bubbles Bar */}
            <div className="px-6 py-2.5 bg-slate-900/40 border-b border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0 select-none">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mr-1">
                Executive Bubbles:
              </span>
              {FOUNDER_ACTION_BUBBLES.map((bubble) => (
                <button
                  key={bubble.id}
                  onClick={() => handleSendCommand(bubble.prompt)}
                  disabled={executingCommand}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 hover:bg-cyan-950 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/50 text-xs transition-all whitespace-nowrap cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                >
                  <span>{bubble.label}</span>
                </button>
              ))}
            </div>

            {/* Chat Log Window */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar select-text">
              {chatLog.map((msg, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'nova' && (
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold text-xs shrink-0 mt-0.5">
                      NV
                    </div>
                  )}

                  <div
                    className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-cyan-600 text-white rounded-tr-none'
                        : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-none whitespace-pre-wrap'
                    }`}
                  >
                    <div className="font-sans">{msg.text}</div>
                    <div className="text-[10px] text-slate-500 mt-2 text-right font-mono select-none">
                      {msg.timestamp}
                    </div>
                  </div>

                  {msg.sender === 'user' && (
                    <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-300 font-bold text-xs shrink-0 mt-0.5">
                      F
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            {/* Command Input Bar */}
            <div className="p-4 bg-slate-900/80 border-t border-slate-800 shrink-0">
              <div className="relative flex items-center">
                <Terminal className="w-4 h-4 text-cyan-400 absolute left-3.5" />
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendCommand()}
                  placeholder="Ask Nova anything or issue administrative commands (e.g. 'Nova, promote @alice to Council tier')..."
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-28 py-3 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500"
                />
                <button
                  onClick={() => handleSendCommand()}
                  disabled={executingCommand || !chatInput.trim()}
                  className="absolute right-2 flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Execute</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: AUTHORITY MATRIX & FOUNDER KEYS ── */}
        {activeTab === 'authority' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {/* Issue Founder Key Box */}
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-cyan-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Key className="w-4 h-4 text-cyan-400" />
                    <span>Cryptographic Founder Auth Keys</span>
                  </h3>
                  <p className="text-xs text-slate-400">Mint cryptographic root tokens to delegate founder powers to secondary workstations</p>
                </div>
              </div>

              {/* Keys are licenses signed with the offline authority key; the app can't mint them. */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-300 leading-relaxed select-text">
                {ISSUE_KEY_INSTRUCTIONS}
              </div>

              {newKeyIssued && (
                <div className="p-3 rounded-xl bg-cyan-950/50 border border-cyan-500/40 text-xs space-y-1">
                  <div className="font-bold text-cyan-300">New Key Minted Successfully:</div>
                  <div className="font-mono text-white bg-slate-950 p-2 rounded border border-slate-800 select-text">
                    {newKeyIssued.id}
                  </div>
                  <div className="text-[11px] text-slate-400">Expires: {new Date(newKeyIssued.expiresAt).toLocaleDateString()}</div>
                </div>
              )}

              {/* Active Keys List */}
              {founderKeys.length > 0 && (
                <div className="pt-2 divide-y divide-slate-800/60">
                  <div className="text-[11px] uppercase font-bold text-slate-500 pb-1">Active Delegated Keys:</div>
                  {founderKeys.map(k => (
                    <div key={k.id} className="py-2 flex items-center justify-between text-xs font-mono">
                      <div>
                        <span className="text-slate-200 font-bold">{k.label}:</span>{' '}
                        <span className="text-cyan-400">{k.id}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-slate-500">Expires {new Date(k.expiresAt).toLocaleDateString()}</span>
                        <button
                          onClick={() => handleRevokeKey(k.id)}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Promote Node Control */}
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>Adjust Peer Authority Level</span>
              </h3>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={targetHandle}
                  onChange={(e) => setTargetHandle(e.target.value)}
                  placeholder="Target Handle (@alice or node DID)..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-500"
                />
                <select
                  value={targetTier}
                  onChange={(e) => setTargetTier(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-cyan-400 outline-none"
                >
                  <option value="council">Council (Custodian)</option>
                  <option value="ally">Ally (Trusted)</option>
                  <option value="operator">Operator (Standard)</option>
                  <option value="restricted">Restricted (Quarantined)</option>
                </select>
                <button
                  onClick={handlePromoteNode}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs"
                >
                  Set Authority
                </button>
              </div>
            </div>

            {/* Authority Matrix Table */}
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white">Full Ecosystem Node Matrix</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 font-mono text-[11px] uppercase">
                      <th className="py-2 px-3">Node</th>
                      <th className="py-2 px-3">Address</th>
                      <th className="py-2 px-3">Authority Tier</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {authorityRows.map((r) => {
                      const tierDef = AUTHORITY_TIERS[r.tier?.toUpperCase()] || AUTHORITY_TIERS.OPERATOR;
                      return (
                        <tr key={r.id} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-bold text-slate-200">
                            @{r.handle} {r.isSelf && <span className="text-[10px] text-cyan-400 font-normal">(You)</span>}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-400 truncate max-w-[160px]">{r.address}</td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${tierDef.badgeClass}`}>
                              {tierDef.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-400">
                            <span className={`text-[10px] ${r.status === 'ONLINE' ? 'text-emerald-400' : 'text-slate-500'}`}>
                              ● {r.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: MASTER ECOSYSTEM OAUTH (SIWN) ── */}
        {activeTab === 'oauth' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-cyan-400" />
                <span>Ecosystem-Wide SIWN OAuth Inspector</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Master audit of all decentralized applications currently granted cryptographic Ed25519 authentication tokens.
              </p>
            </div>

            {authorizedApps.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No external applications currently authorized on this sovereign node.
              </div>
            ) : (
              <div className="space-y-3">
                {authorizedApps.map((app) => (
                  <div key={app.id} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{app.appName || app.domain}</span>
                        <span className="text-xs font-mono text-cyan-400">nova://{app.domain}</span>
                      </div>
                      <div className="text-xs text-slate-400">
                        <b>Granted Scopes:</b> {(app.scopes || []).join(', ')}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        Authorized: {new Date(app.authorizedAt).toLocaleString()} • Expires: {new Date(app.expiresAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRevokeApp(app.domain)}
                        className="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-500/30 text-xs font-semibold transition-colors"
                      >
                        Global Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: FACTION WAR (NOVA VS AURA) ── */}
        {activeTab === 'factions' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Nova Mesh Card */}
              <div className="p-5 rounded-2xl bg-cyan-950/20 border border-cyan-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Radio className="w-5 h-5" />
                    <h3 className="text-base font-bold text-white">Nova Mesh (.nova)</h3>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    Logic & Compute
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  The infrastructure backbone. Prioritizes bare-metal hardware execution, deterministic Ed25519 state verification, zero-trust cryptographic enclaves, and unkillable private cloud databases.
                </p>
                <div className="pt-2 text-xs text-cyan-300 font-mono">
                  Registered Portals: <b>{factionStats?.novaSitesCount || 0} sites</b> ({factionStats?.novaPercentage || 0}%)
                </div>
              </div>

              {/* Aura Mesh Card */}
              <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-purple-400">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <h3 className="text-base font-bold text-white">Aura Mesh (.aura)</h3>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                    Neural & Creative
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  The creative neural guild. Prioritizes generative literature synthesis, autonomous AI agents, sensory narrative exploration, media foundry rendering, and decentralized social channels.
                </p>
                <div className="pt-2 text-xs text-purple-300 font-mono">
                  Registered Portals: <b>{factionStats?.auraSitesCount || 0} sites</b> ({factionStats?.auraPercentage || 0}%)
                </div>
              </div>
            </div>

            {/* Territory Dominance Radar */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 text-center">
              <h3 className="text-sm font-bold text-white flex items-center justify-center gap-2">
                <Swords className="w-4 h-4 text-amber-400" />
                <span>Swarm Dominance Status: <span className="text-cyan-400">{factionStats?.territoryLeader}</span></span>
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Nodes and creators across the peer swarm can align with either faction when publishing decentralized websites and services.
              </p>
            </div>
          </div>
        )}

        {/* ── TAB 5: MESH REGISTRY ADMINISTRATOR ── */}
        {activeTab === 'registry' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Decentralized Web Registry Administration</h3>
                <p className="text-xs text-slate-400 mt-0.5">Pin or quarantine sites in this PC's directory only. To approve, decline or revoke names for everyone, use Nova Registry → Operator.</p>
              </div>
              <button onClick={refreshTabData} className="p-1.5 text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-slate-800">
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {registrySites.map((site) => (
                <div key={site.id} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{site.favicon || '🌐'}</span>
                      <span className="text-sm font-bold text-white">{site.title || site.domain}</span>
                      <span className="text-xs font-mono text-cyan-400">nova://{site.domain}</span>
                      {site.isPinned && (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.2 rounded border border-amber-500/30">
                          PINNED
                        </span>
                      )}
                      {site.isFlagged && (
                        <span className="text-[10px] font-bold text-red-400 bg-red-950/60 px-2 py-0.2 rounded border border-red-500/30">
                          QUARANTINED
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">
                      Publisher: <b>@{site.ownerHandle}</b> • Category: {site.category || 'General'} • Faction: {(site.faction || 'nova').toUpperCase()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTogglePin(site.domain, site.isPinned)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        site.isPinned
                          ? 'bg-amber-950/60 text-amber-300 border-amber-500/40 hover:bg-amber-900/60'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                      }`}
                    >
                      {site.isPinned ? 'Unpin' : 'Pin to Top'}
                    </button>
                    <button
                      onClick={() => handleToggleFlag(site.domain, site.isFlagged)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        site.isFlagged
                          ? 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                          : 'bg-red-950/60 text-red-300 border-red-500/40 hover:bg-red-900/60'
                      }`}
                    >
                      {site.isFlagged ? 'Lift Quarantine' : 'Quarantine'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
