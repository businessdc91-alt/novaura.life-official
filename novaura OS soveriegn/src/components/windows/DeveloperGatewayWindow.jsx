import React, { useState, useEffect } from 'react';
import {
  KeyRound, Plus, Trash2, Copy, Check, ShieldCheck, Terminal,
  Code2, Play, AlertCircle, RefreshCw, Radio, Layers, Server
} from 'lucide-react';
import {
  developerGateway,
  GATEWAY_SCOPES
} from '../../services/developerGatewayService.js';

export default function DeveloperGatewayWindow() {
  const [activeTab, setActiveTab] = useState('keys'); // 'keys' | 'tester' | 'snippets' | 'logs'
  const [keysList, setKeysList] = useState([]);
  const [newKeyLabel, setNewKeyLabel] = useState('Production Microservice Integration');
  const [selectedScopes, setSelectedScopes] = useState(['inference:chat', 'cybeni:scaffold']);
  const [rateLimit, setRateLimit] = useState('60');
  const [createdSecret, setCreatedSecret] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState('');

  // Interactive Playground State
  const [selectedTestKey, setSelectedTestKey] = useState('');
  const [selectedEndpoint, setSelectedEndpoint] = useState('/v1/chat/completions');
  const [testPayload, setTestPayload] = useState(JSON.stringify({
    model: 'gemma4:e2b',
    messages: [{ role: 'user', content: 'Generate a high-throughput sovereign worker pool.' }],
    temperature: 0.2
  }, null, 2));
  const [testResponse, setTestResponse] = useState(null);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [logsList, setLogsList] = useState([]);

  useEffect(() => {
    loadKeys();
    const unsub = developerGateway.subscribe(() => {
      loadKeys();
      setLogsList(developerGateway.getLogs());
    });
    return () => unsub();
  }, []);

  const loadKeys = async () => {
    const list = await developerGateway.listKeys();
    setKeysList(list);
    if (list.length > 0 && !selectedTestKey) {
      setSelectedTestKey(list[0].keyPrefix);
    }
  };

  const handleCreateKey = async (e) => {
    e.preventDefault();
    if (!newKeyLabel) return;
    try {
      const res = await developerGateway.createApiKey({
        label: newKeyLabel,
        scopes: selectedScopes,
        rateLimitRpm: rateLimit,
      });
      setCreatedSecret(res.fullApiKey);
      setNewKeyLabel('');
    } catch (err) {
      alert(`Error creating key: ${err.message}`);
    }
  };

  const handleExecutePlayground = async () => {
    setIsSendingTest(true);
    setTestResponse(null);
    try {
      let parsedBody = {};
      try { parsedBody = JSON.parse(testPayload); } catch {}
      
      const res = await developerGateway.handleGatewayRequest(
        selectedEndpoint,
        selectedEndpoint === '/v1/models' ? 'GET' : 'POST',
        { 'Authorization': `Bearer ${createdSecret || 'nov_sec_sample_key'}` },
        parsedBody
      );
      setTestResponse(res);
    } catch (err) {
      setTestResponse({ status: 500, data: { error: err.message }, latencyMs: 0 });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleCopyText = (text, type = 'key') => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    } else {
      setCopiedSnippet(type);
      setTimeout(() => setCopiedSnippet(''), 2500);
    }
  };

  const snippets = developerGateway.generateCodeSnippets(
    createdSecret || 'nov_sec_YOUR_KEY_HERE',
    selectedEndpoint
  );

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <KeyRound className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-wide text-white">Sovereign Developer Gateway & API Keys</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-mono">
                Port 9095 • Local Gateway
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Build third-party apps and integrate external tools into your Sovereign OS</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 text-xs">
          <button
            onClick={() => setActiveTab('keys')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              activeTab === 'keys' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            API Keys ({keysList.length})
          </button>
          <button
            onClick={() => setActiveTab('tester')}
            className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
              activeTab === 'tester' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Play className="w-3 h-3" />
            Live Gateway Tester
          </button>
          <button
            onClick={() => setActiveTab('snippets')}
            className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
              activeTab === 'snippets' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3 h-3" />
            SDK Code Snippets
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
              activeTab === 'logs' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3 h-3" />
            Audit Logs
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* TAB 1: API KEYS */}
        {activeTab === 'keys' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Secret Created Banner */}
            {createdSecret && (
              <div className="p-4 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl shadow-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                    <Check className="w-4 h-4" />
                    <span>Cryptographic Sovereign API Key Generated!</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono">Store this securely; it will not be displayed again.</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-emerald-500/30 font-mono text-xs text-white">
                  <span className="flex-1 truncate">{createdSecret}</span>
                  <button
                    onClick={() => handleCopyText(createdSecret, 'key')}
                    className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-sans transition-all"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey ? 'Copied!' : 'Copy Key'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Create New Key Card */}
            <form onSubmit={handleCreateKey} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                Generate New Sovereign Integration Key
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="text-[11px] text-slate-400 block mb-1">Key Description / Client Name</label>
                  <input
                    type="text"
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    placeholder="e.g. Next.js Dashboard Client / Python Agent"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Rate Limit (Req / Min)</label>
                  <input
                    type="number"
                    value={rateLimit}
                    onChange={(e) => setRateLimit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1.5 font-bold">Scoped Permissions</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {GATEWAY_SCOPES.map(s => {
                    const isSelected = selectedScopes.includes(s.id);
                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSelectedScopes(prev =>
                            isSelected ? prev.filter(x => x !== s.id) : [...prev, s.id]
                          );
                        }}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2 ${
                          isSelected ? 'bg-cyan-950/60 border-cyan-500/50 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <input type="checkbox" checked={isSelected} readOnly className="mt-0.5 rounded border-slate-700 text-cyan-500" />
                        <div>
                          <div className="font-bold">{s.label}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{s.description}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="py-2.5 px-5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-cyan-600/20 transition-all cursor-pointer"
              >
                Create Sovereign API Key
              </button>
            </form>

            {/* Existing Keys Table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Server className="w-4 h-4 text-purple-400" />
                  Active Sovereign API Keys
                </h3>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                {keysList.length > 0 ? (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Label</th>
                        <th className="py-3 px-4">Key Prefix</th>
                        <th className="py-3 px-4">Scopes</th>
                        <th className="py-3 px-4 text-right">Requests</th>
                        <th className="py-3 px-4 text-right">RPM</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {keysList.map(k => (
                        <tr key={k.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-bold text-white font-sans">{k.label}</td>
                          <td className="py-3 px-4 text-cyan-400">{k.keyPrefix}</td>
                          <td className="py-3 px-4 font-sans">
                            <div className="flex flex-wrap gap-1">
                              {k.scopes.map(s => (
                                <span key={s} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                                  {s.split(':')[0]}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right text-slate-200">{k.totalRequests || 0}</td>
                          <td className="py-3 px-4 text-right text-slate-400">{k.rateLimitRpm}</td>
                          <td className="py-3 px-4 text-center">
                            {k.revoked ? (
                              <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-500/40 text-[10px]">
                                Revoked
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40 text-[10px]">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {!k.revoked && (
                              <button
                                onClick={() => developerGateway.revokeKey(k.id)}
                                className="px-2 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 text-[10px] font-sans transition-colors mr-1"
                              >
                                Revoke
                              </button>
                            )}
                            <button
                              onClick={() => developerGateway.deleteKey(k.id)}
                              className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No API keys created yet. Generate your first key above to integrate external applications!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE GATEWAY TESTER */}
        {activeTab === 'tester' && (
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Target Endpoint</label>
                <select
                  value={selectedEndpoint}
                  onChange={(e) => setSelectedEndpoint(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                >
                  <option value="/v1/chat/completions">POST /v1/chat/completions (OpenAI Compatible)</option>
                  <option value="/v1/models">GET /v1/models (Catalog Models Spectrum)</option>
                  <option value="/v1/cybeni/scaffold">POST /v1/cybeni/scaffold (Project Architecture)</option>
                  <option value="/v1/search">POST /v1/search (Sovereign P2P & Codex)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Authentication Bearer Key</label>
                <input
                  type="text"
                  value={createdSecret || 'nov_sec_YOUR_KEY_HERE'}
                  readOnly
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-cyan-300 font-mono truncate"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">JSON Request Payload</label>
              <textarea
                value={testPayload}
                onChange={(e) => setTestPayload(e.target.value)}
                rows={6}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={handleExecutePlayground}
              disabled={isSendingTest}
              className="py-3 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSendingTest ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Routing Through Local Gateway...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Execute Gateway Request</span>
                </>
              )}
            </button>

            {testResponse && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${testResponse.status === 200 ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-rose-950 text-rose-400 border border-rose-500/40'}`}>
                      STATUS {testResponse.status}
                    </span>
                    <span className="text-slate-400">{testResponse.latencyMs}ms Latency</span>
                  </div>
                </div>
                <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto max-h-64">
                  {JSON.stringify(testResponse.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SDK CODE SNIPPETS */}
        {activeTab === 'snippets' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="text-xs text-slate-400">
              Integrate your own applications with Sovereign OS using standard HTTP or OpenAI-compatible client libraries.
            </div>

            {/* Python Snippet */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white font-mono">Python (Requests SDK)</span>
                <button
                  onClick={() => handleCopyText(snippets.python, 'py')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded-lg transition-colors flex items-center gap-1"
                >
                  {copiedSnippet === 'py' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSnippet === 'py' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 font-mono text-xs text-cyan-300 overflow-x-auto">
                {snippets.python}
              </pre>
            </div>

            {/* Node.js / Fetch Snippet */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white font-mono">Node.js (ESM Fetch)</span>
                <button
                  onClick={() => handleCopyText(snippets.nodejs, 'node')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded-lg transition-colors flex items-center gap-1"
                >
                  {copiedSnippet === 'node' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSnippet === 'node' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 font-mono text-xs text-indigo-300 overflow-x-auto">
                {snippets.nodejs}
              </pre>
            </div>

            {/* OpenAI SDK Compatibility */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white font-mono">Official OpenAI SDK (Python & JS 100% Compatible)</span>
                <button
                  onClick={() => handleCopyText(snippets.openaiSdk, 'openai')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded-lg transition-colors flex items-center gap-1"
                >
                  {copiedSnippet === 'openai' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSnippet === 'openai' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 font-mono text-xs text-purple-300 overflow-x-auto">
                {snippets.openaiSdk}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 4: AUDIT LOGS */}
        {activeTab === 'logs' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Live Gateway Request Audit Log</h3>
              <span className="text-[11px] text-slate-500 font-mono">{logsList.length} recorded events</span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              {logsList.length > 0 ? (
                <div className="divide-y divide-slate-800/60 font-mono text-xs max-h-96 overflow-y-auto">
                  {logsList.map((log, i) => (
                    <div key={i} className="p-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.statusCode === 200 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>
                          {log.statusCode}
                        </span>
                        <span className="text-white font-bold">{log.method}</span>
                        <span className="text-slate-300">{log.endpoint}</span>
                        <span className="text-slate-500 text-[10px]">({log.keyLabel})</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                        <span>{log.durationMs}ms</span>
                        <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No gateway requests captured yet. Make a request via the Live Gateway Tester to see live telemetry!
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
