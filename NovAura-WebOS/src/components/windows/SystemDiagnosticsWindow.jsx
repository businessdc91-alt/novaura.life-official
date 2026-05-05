import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, CheckCircle2, XCircle, AlertTriangle, Clock,
  RefreshCw, Wifi, WifiOff, Cpu, Zap, Database, Shield,
  Smartphone, Monitor, Globe, Server, ChevronDown, ChevronUp,
  Loader2, HardDrive, BarChart3
} from 'lucide-react';

const STATUS_COLORS = {
  ok:             { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-400', icon: CheckCircle2 },
  error:          { bg: 'bg-red-500/20',     border: 'border-red-500/40',     text: 'text-red-400',     icon: XCircle },
  timeout:        { bg: 'bg-amber-500/20',   border: 'border-amber-500/40',   text: 'text-amber-400',   icon: Clock },
  no_key:         { bg: 'bg-gray-500/20',    border: 'border-gray-500/40',    text: 'text-gray-400',    icon: Shield },
  empty_response: { bg: 'bg-amber-500/20',   border: 'border-amber-500/40',   text: 'text-amber-400',   icon: AlertTriangle },
  unsupported:    { bg: 'bg-gray-500/20',    border: 'border-gray-500/40',    text: 'text-gray-500',    icon: XCircle },
  pending:        { bg: 'bg-blue-500/20',    border: 'border-blue-500/40',    text: 'text-blue-400',    icon: Loader2 },
};

const PROVIDER_LABELS = {
  gemini: 'Google Gemini',
  claude: 'Anthropic Claude',
  openai: 'OpenAI',
  kimi: 'Moonshot Kimi',
  alibaba: 'Alibaba Qwen',
  aiml: 'AIML API',
  novita: 'Novita AI',
  scaleway: 'Scaleway',
  hyperbolic: 'Hyperbolic',
  fireworks: 'Fireworks AI',
  azure: 'Azure OpenAI',
  nova: 'Amazon Nova',
  aws: 'AWS Bedrock',
  'webgpu-local': 'WebGPU Local (Nova)',
  ollama: 'Ollama (Local)',
  lmstudio: 'LM Studio (Local)',
};

function StatusBadge({ status }) {
  const cfg = STATUS_COLORS[status] || STATUS_COLORS.error;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.bg} ${cfg.border} ${cfg.text} border`}>
      <Icon className={`w-3 h-3 ${status === 'pending' ? 'animate-spin' : ''}`} />
      {status === 'ok' ? 'Healthy' : status === 'no_key' ? 'No Key' : status === 'timeout' ? 'Timeout' : status === 'empty_response' ? 'Empty' : status === 'pending' ? 'Testing...' : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function LatencyBar({ ms }) {
  if (!ms) return null;
  const pct = Math.min(ms / 10000, 1) * 100;
  const color = ms < 2000 ? 'bg-emerald-500' : ms < 5000 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-white/50 w-12 text-right">{ms}ms</span>
    </div>
  );
}

function ProviderCard({ name, data, expanded, onToggle }) {
  const label = PROVIDER_LABELS[name] || name;
  const status = data?.status || 'no_key';
  const cfg = STATUS_COLORS[status] || STATUS_COLORS.error;
  const local = data?.localState;

  return (
    <div className={`rounded-lg border ${cfg.border} bg-black/30 overflow-hidden transition-all`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <span className="text-sm text-white/80 font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          {data?.latencyMs && <span className="text-[10px] text-white/40">{data.latencyMs}ms</span>}
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/5">
          {data?.latencyMs != null && (
            <div className="pt-2">
              <div className="text-[10px] text-white/40 mb-1 uppercase tracking-wider">Latency</div>
              <LatencyBar ms={data.latencyMs} />
            </div>
          )}

          {data?.error && (
            <div>
              <div className="text-[10px] text-white/40 mb-1 uppercase tracking-wider">Error</div>
              <p className="text-[11px] text-red-400 bg-red-500/10 rounded px-2 py-1 font-mono break-all">{data.error}</p>
            </div>
          )}

          {data?.httpStatus && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40">HTTP Status:</span>
              <span className={`text-[11px] font-mono ${data.httpStatus < 400 ? 'text-emerald-400' : 'text-red-400'}`}>{data.httpStatus}</span>
            </div>
          )}

          {data?.response && (
            <div>
              <div className="text-[10px] text-white/40 mb-1 uppercase tracking-wider">Response</div>
              <p className="text-[11px] text-emerald-400 bg-emerald-500/10 rounded px-2 py-1 font-mono truncate">{data.response}</p>
            </div>
          )}

          {local && (
            <div className="pt-1">
              <div className="text-[10px] text-white/40 mb-1 uppercase tracking-wider">Local Engine State</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                <span className="text-white/40">Available</span>
                <span className={local.available ? 'text-emerald-400' : 'text-red-400'}>{local.available ? 'Yes' : 'No'}</span>
                <span className="text-white/40">Requests</span>
                <span className="text-white/70">{local.requestCount}</span>
                <span className="text-white/40">Errors</span>
                <span className={local.errorCount > 0 ? 'text-amber-400' : 'text-white/70'}>{local.errorCount}</span>
                <span className="text-white/40">Quality</span>
                <span className="text-white/70">{(local.avgQuality * 100).toFixed(0)}%</span>
                {local.rateLimited && <>
                  <span className="text-white/40">Rate Limited</span>
                  <span className="text-amber-400">Yes</span>
                </>}
                {local.lastError && <>
                  <span className="text-white/40">Last Error</span>
                  <span className="text-red-400 truncate">{local.lastError}</span>
                </>}
              </div>
            </div>
          )}

          {!data?.configured && status === 'no_key' && (
            <p className="text-[11px] text-white/30 italic">No API key configured for this provider. Add it in functions/.env and redeploy.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function SystemDiagnosticsWindow({ onClose }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRun, setLastRun] = useState(null);

  const runDiagnostics = useCallback(async () => {
    setLoading(true);
    try {
      // Try kernel path first
      const { kernel } = await import('../../kernel/NovaKernel.js');
      if (kernel?.ai?.diagnose) {
        const result = await kernel.ai.diagnose();
        setReport(result);
        setLastRun(new Date());
      } else {
        // Fallback: hit the endpoint directly
        const token = localStorage.getItem('auth_token') || '';
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = 'Bearer ' + token;

        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://us-central1-novaura-life.cloudfunctions.net/api';
        const res = await fetch(backendUrl + '/ai/health-check', { headers });
        const data = await res.json();
        setReport({
          timestamp: data.timestamp,
          backend: { reachable: true, url: backendUrl, status: data.status, summary: data.summary },
          providers: data.providers || {},
          localModel: null,
          cache: null,
          queue: null,
          pending: 0,
        });
        setLastRun(new Date());
      }
    } catch (err) {
      setReport({
        timestamp: new Date().toISOString(),
        backend: { reachable: false, error: err.message },
        providers: {},
        localModel: null,
        cache: null,
      });
      setLastRun(new Date());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(runDiagnostics, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, runDiagnostics]);

  const toggleExpand = (name) => setExpanded(prev => ({ ...prev, [name]: !prev[name] }));

  const okCount = report ? Object.values(report.providers).filter(p => p.status === 'ok').length : 0;
  const totalCount = report ? Object.keys(report.providers).length : 0;
  const overallStatus = !report ? 'pending' : !report.backend?.reachable ? 'error' : okCount === 0 ? 'error' : okCount < totalCount / 2 ? 'timeout' : 'ok';

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-gray-900/95 to-black/95 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          <h2 className="text-sm font-semibold">System Diagnostics</h2>
          <StatusBadge status={overallStatus} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-[10px] px-2 py-1 rounded border transition-colors ${autoRefresh ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'}`}
          >
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={runDiagnostics}
            disabled={loading}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Testing...' : 'Run Tests'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg bg-white/5 border border-white/10 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              {report?.backend?.reachable ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-red-400" />}
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Backend</span>
            </div>
            <p className={`text-sm font-semibold ${report?.backend?.reachable ? 'text-emerald-400' : 'text-red-400'}`}>
              {!report ? '...' : report.backend?.reachable ? 'Online' : 'Unreachable'}
            </p>
          </div>

          <div className="rounded-lg bg-white/5 border border-white/10 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Providers</span>
            </div>
            <p className="text-sm font-semibold text-white/80">
              {report ? `${okCount}/${totalCount} healthy` : '...'}
            </p>
          </div>

          <div className="rounded-lg bg-white/5 border border-white/10 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Database className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Cache</span>
            </div>
            <p className="text-sm font-semibold text-white/80">
              {report?.cache ? `${report.cache.size}/${report.cache.maxSize}` : 'N/A'}
            </p>
          </div>

          <div className="rounded-lg bg-white/5 border border-white/10 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Local AI</span>
            </div>
            <p className={`text-sm font-semibold ${report?.localModel?.state === 'ready' ? 'text-emerald-400' : report?.localModel?.webgpuAvailable ? 'text-amber-400' : 'text-white/40'}`}>
              {!report ? '...' : report.localModel?.state === 'ready' ? 'Active' : report.localModel?.webgpuAvailable ? 'Available' : 'No WebGPU'}
            </p>
          </div>
        </div>

        {/* Backend details */}
        {report?.backend?.error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm font-medium text-red-400">Backend Connection Failed</span>
            </div>
            <p className="text-[11px] text-red-300/80 font-mono">{report.backend.error}</p>
            <p className="text-[10px] text-white/30 mt-1">URL: {report.backend.url || 'N/A'}</p>
          </div>
        )}

        {/* Local Model Section */}
        {report?.localModel && (
          <div className="rounded-lg bg-white/5 border border-white/10 p-3">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-medium text-white/80">Local WebGPU Model (Nova)</span>
              <StatusBadge status={report.localModel.state === 'ready' ? 'ok' : report.localModel.state === 'downloading' ? 'pending' : report.localModel.state === 'error' ? 'error' : 'no_key'} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <span className="text-white/40">State</span>
              <span className="text-white/70">{report.localModel.state}</span>
              <span className="text-white/40">Model</span>
              <span className="text-white/70">{report.localModel.modelId || 'Not loaded'}</span>
              <span className="text-white/40">WebGPU</span>
              <span className={report.localModel.webgpuAvailable ? 'text-emerald-400' : 'text-red-400'}>{report.localModel.webgpuAvailable ? 'Available' : 'Not available'}</span>
              <span className="text-white/40">Enabled</span>
              <span className={report.localModel.enabled ? 'text-emerald-400' : 'text-amber-400'}>{report.localModel.enabled ? 'Yes (opt-in)' : 'No'}</span>
              {report.localModel.progress > 0 && report.localModel.state === 'downloading' && <>
                <span className="text-white/40">Download</span>
                <span className="text-cyan-400">{Math.round(report.localModel.progress * 100)}%</span>
              </>}
              {report.localModel.error && <>
                <span className="text-white/40">Error</span>
                <span className="text-red-400">{report.localModel.error}</span>
              </>}
            </div>
          </div>
        )}

        {/* Provider Cards */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-white/40" />
            <span className="text-xs font-medium text-white/60 uppercase tracking-wider">API Providers</span>
          </div>
          <div className="space-y-2">
            {report ? (
              Object.entries(report.providers)
                .sort(([, a], [, b]) => {
                  const order = { ok: 0, error: 1, timeout: 2, empty_response: 3, no_key: 4, unsupported: 5 };
                  return (order[a.status] ?? 9) - (order[b.status] ?? 9);
                })
                .map(([name, data]) => (
                  <ProviderCard
                    key={name}
                    name={name}
                    data={data}
                    expanded={!!expanded[name]}
                    onToggle={() => toggleExpand(name)}
                  />
                ))
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                <span className="ml-2 text-sm text-white/40">Running diagnostics...</span>
              </div>
            )}
          </div>
        </div>

        {/* Queue & Pending */}
        {report?.queue && (
          <div className="rounded-lg bg-white/5 border border-white/10 p-3">
            <div className="text-[10px] text-white/40 mb-1 uppercase tracking-wider">Request Queue</div>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="text-white/40">High: <span className="text-white/70">{report.queue.high}</span></span>
              <span className="text-white/40">Normal: <span className="text-white/70">{report.queue.normal}</span></span>
              <span className="text-white/40">Low: <span className="text-white/70">{report.queue.low}</span></span>
              <span className="text-white/40">In-flight: <span className="text-cyan-400">{report.pending}</span></span>
            </div>
          </div>
        )}

        {/* Timestamp */}
        {lastRun && (
          <p className="text-[10px] text-white/20 text-center">
            Last tested: {lastRun.toLocaleTimeString()} — {report?.backend?.summary || ''}
          </p>
        )}
      </div>
    </div>
  );
}
