import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield, ShieldAlert, ShieldCheck, ShieldX,
  AlertTriangle, Activity, Lock, Unlock, Trash2,
  Eye, EyeOff, RefreshCw, Bug, Zap, Globe,
  FileWarning, Code, Terminal, Bot, Clock,
  ChevronDown, ChevronRight, X, ExternalLink
} from 'lucide-react';

const SEVERITY_CONFIG = {
  0: { label: 'INFO',     color: 'text-white/40',    bg: 'bg-white/5',        border: 'border-white/10' },
  1: { label: 'LOW',      color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  2: { label: 'MEDIUM',   color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  3: { label: 'HIGH',     color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20' },
  4: { label: 'CRITICAL', color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
};

const THREAT_ICONS = {
  prompt_injection:    Bot,
  jailbreak:           ShieldX,
  system_prompt_leak:  Eye,
  encoding_attack:     Code,
  data_exfiltration:   ExternalLink,
  xss:                 Code,
  sql_injection:       Terminal,
  malicious_url:       Globe,
  malicious_code:      Bug,
  rate_anomaly:        Activity,
  escalation:          ShieldAlert,
  resource_abuse:      Zap,
  unauthorized_access: Lock,
  viral_payload:       Bug,
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const config = {
    SECURE:   { icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Secure' },
    ELEVATED: { icon: Shield,      color: 'text-amber-400',   bg: 'bg-amber-500/10',   label: 'Elevated' },
    ALERT:    { icon: ShieldAlert, color: 'text-orange-400',  bg: 'bg-orange-500/10',  label: 'Alert' },
    CRITICAL: { icon: ShieldX,     color: 'text-red-400',     bg: 'bg-red-500/10',     label: 'Critical' },
  };
  const c = config[status] || config.SECURE;
  const Icon = c.icon;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${c.bg} border ${c.color.replace('text-', 'border-').replace('400', '500/20')}`}>
      <Icon className={`w-5 h-5 ${c.color}`} />
      <div>
        <div className={`text-xs font-bold ${c.color}`}>{c.label}</div>
        <div className="text-[9px] text-white/30">Platform Status</div>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color = 'text-white/60' }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/5">
      <Icon className={`w-4 h-4 ${color}`} />
      <div>
        <div className="text-sm font-bold text-white/80">{value}</div>
        <div className="text-[9px] text-white/30">{label}</div>
      </div>
    </div>
  );
}

// ─── Rate Limit Bar ───────────────────────────────────────────────────────────
function RateLimitBar({ category, data }) {
  const pct = data.percentUsed;
  const color = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-24 text-white/40 truncate">{category.replace(/_/g, ' ')}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-white/30 w-16 text-right">{data.current}/{data.max}</span>
    </div>
  );
}

// ─── Threat Entry ─────────────────────────────────────────────────────────────
function ThreatEntry({ threat }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEVERITY_CONFIG[threat.severity] || SEVERITY_CONFIG[0];
  const Icon = THREAT_ICONS[threat.type] || AlertTriangle;
  const time = new Date(threat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className={`rounded-lg ${sev.bg} border ${sev.border} overflow-hidden`}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors">
        {expanded ? <ChevronDown className="w-3 h-3 text-white/30" /> : <ChevronRight className="w-3 h-3 text-white/30" />}
        <Icon className={`w-3.5 h-3.5 ${sev.color}`} />
        <span className={`text-[10px] font-bold ${sev.color} w-16`}>{sev.label}</span>
        <span className="text-[11px] text-white/60 flex-1 truncate">{threat.type.replace(/_/g, ' ')}</span>
        <span className="text-[9px] text-white/20">{time}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-2 space-y-1 border-t border-white/5">
          <div className="text-[10px] text-white/30">Source: <span className="text-white/50">{threat.source}</span></div>
          {threat.context && <div className="text-[10px] text-white/30">Context: <span className="text-white/50 font-mono">{threat.context}</span></div>}
          {threat.match && <div className="text-[10px] text-white/30">Match: <span className="text-red-400/70 font-mono">{threat.match}</span></div>}
          {threat.pattern && <div className="text-[10px] text-white/30">Pattern: <span className="text-white/40 font-mono">{threat.pattern}</span></div>}
        </div>
      )}
    </div>
  );
}

// ─── Quarantine Entry ─────────────────────────────────────────────────────────
function QuarantineEntry({ item, onRelease, onDestroy }) {
  const [expanded, setExpanded] = useState(false);
  const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="rounded-lg bg-red-500/5 border border-red-500/15 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 flex-1 text-left">
          {expanded ? <ChevronDown className="w-3 h-3 text-white/30" /> : <ChevronRight className="w-3 h-3 text-white/30" />}
          <FileWarning className="w-3.5 h-3.5 text-red-400" />
          <span className="text-[11px] text-white/60 truncate">{item.originalId}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded ${item.status === 'quarantined' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            {item.status}
          </span>
        </button>
        <span className="text-[9px] text-white/20">{time}</span>
        {item.status === 'quarantined' && (
          <div className="flex items-center gap-1">
            <button onClick={() => onRelease(item.id)} className="p-1 rounded hover:bg-white/10 text-amber-400/60 hover:text-amber-400" title="Release">
              <Unlock className="w-3 h-3" />
            </button>
            <button onClick={() => onDestroy(item.id)} className="p-1 rounded hover:bg-white/10 text-red-400/60 hover:text-red-400" title="Destroy">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
      {expanded && (
        <div className="px-3 pb-2 border-t border-white/5">
          <div className="text-[10px] text-white/30 mb-1">Threats: {item.threats?.map(t => t.type.replace(/_/g, ' ')).join(', ')}</div>
          {item.content && (
            <pre className="text-[9px] text-red-300/50 font-mono bg-black/30 rounded p-2 max-h-[100px] overflow-auto">{item.content}</pre>
          )}
        </div>
      )}
    </div>
  );
}

// ═══ Main SecurityMonitorWindow ═══════════════════════════════════════════════
export default function SecurityMonitorWindow({ kernel }) {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [threats, setThreats] = useState([]);
  const [quarantine, setQuarantine] = useState([]);
  const [rateLimits, setRateLimits] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const sentinel = kernel?.sentinel;

  const refresh = useCallback(() => {
    if (!sentinel) return;
    setStats(sentinel.getStats());
    setHealth(sentinel.getHealthReport());
    setThreats(sentinel.getThreatLog(100));
    setQuarantine(sentinel.getQuarantine());
    setRateLimits(sentinel.getRateLimits());
  }, [sentinel]);

  useEffect(() => {
    if (!sentinel) return;
    refresh();
    const unsub = sentinel.onStateChange(() => refresh());
    let interval;
    if (autoRefresh) {
      interval = setInterval(refresh, 5000);
    }
    return () => { unsub(); clearInterval(interval); };
  }, [sentinel, autoRefresh, refresh]);

  const handleRelease = useCallback((id) => {
    sentinel?.releaseFromQuarantine(id);
    refresh();
  }, [sentinel, refresh]);

  const handleDestroy = useCallback((id) => {
    if (!window.confirm('Permanently destroy this quarantined item?')) return;
    sentinel?.destroyQuarantined(id);
    refresh();
  }, [sentinel, refresh]);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'threats', label: `Threats (${threats.length})` },
    { id: 'quarantine', label: `Quarantine (${quarantine.filter(q => q.status === 'quarantined').length})` },
    { id: 'rates', label: 'Rate Limits' },
  ];

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#0c0c14] to-[#08080f] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-sm font-bold text-white/90">Sentinel Shield</h3>
            <p className="text-[9px] text-white/30">Platform Security Monitor</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-1.5 rounded transition-colors ${autoRefresh ? 'text-primary bg-primary/10' : 'text-white/30 hover:bg-white/10'}`}
            title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin-slow' : ''}`} />
          </button>
          <button onClick={refresh} className="p-1.5 rounded hover:bg-white/10 text-white/30" title="Refresh now">
            <Activity className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-white/5">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1 rounded-full text-[11px] transition-colors ${
              activeTab === tab.id
                ? 'bg-primary/20 border border-primary/30 text-primary'
                : 'text-white/40 hover:text-white/60 hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {activeTab === 'overview' && health && stats && (
          <>
            {/* Status + Stats Grid */}
            <div className="grid grid-cols-2 gap-2">
              <StatusBadge status={health.status} />
              <StatCard label="Threats Detected" value={stats.threatsDetected} icon={AlertTriangle} color="text-amber-400" />
              <StatCard label="Threats Blocked" value={stats.threatsBlocked} icon={ShieldX} color="text-red-400" />
              <StatCard label="Total Scans" value={stats.scansTotal} icon={Eye} color="text-primary" />
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-4 gap-2">
              <StatCard label="Prompts" value={stats.promptsScanned} icon={Bot} color="text-purple-400" />
              <StatCard label="Files" value={stats.filesScanned} icon={FileWarning} color="text-blue-400" />
              <StatCard label="URLs" value={stats.urlsScanned} icon={Globe} color="text-cyan-400" />
              <StatCard label="Quarantined" value={stats.quarantined} icon={Lock} color="text-red-400" />
            </div>

            {/* Detection Breakdown */}
            <div className="rounded-lg bg-white/3 border border-white/5 p-3">
              <h4 className="text-[10px] text-white/30 font-bold mb-2">DETECTION BREAKDOWN</h4>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex justify-between"><span className="text-white/40">Injections caught</span><span className="text-orange-400 font-mono">{stats.injectionsCaught}</span></div>
                <div className="flex justify-between"><span className="text-white/40">XSS caught</span><span className="text-amber-400 font-mono">{stats.xssCaught}</span></div>
                <div className="flex justify-between"><span className="text-white/40">SQLi caught</span><span className="text-red-400 font-mono">{stats.sqliCaught}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Viral caught</span><span className="text-pink-400 font-mono">{stats.viralCaught}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Rate violations</span><span className="text-blue-400 font-mono">{stats.rateViolations}</span></div>
              </div>
            </div>

            {/* Recent threats preview */}
            {threats.length > 0 && (
              <div>
                <h4 className="text-[10px] text-white/30 font-bold mb-2">RECENT THREATS</h4>
                <div className="space-y-1.5">
                  {threats.slice(-5).reverse().map(t => <ThreatEntry key={t.id} threat={t} />)}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'threats' && (
          <div className="space-y-1.5">
            {threats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-white/20">
                <ShieldCheck className="w-10 h-10 mb-2" />
                <p className="text-sm">No threats detected</p>
                <p className="text-[10px]">All clear — Sentinel is watching</p>
              </div>
            ) : (
              threats.slice().reverse().map(t => <ThreatEntry key={t.id} threat={t} />)
            )}
          </div>
        )}

        {activeTab === 'quarantine' && (
          <div className="space-y-1.5">
            {quarantine.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-white/20">
                <Lock className="w-10 h-10 mb-2" />
                <p className="text-sm">Quarantine vault empty</p>
                <p className="text-[10px]">No items currently quarantined</p>
              </div>
            ) : (
              quarantine.map(item => (
                <QuarantineEntry
                  key={item.id}
                  item={item}
                  onRelease={handleRelease}
                  onDestroy={handleDestroy}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'rates' && (
          <div className="space-y-2">
            <div className="rounded-lg bg-white/3 border border-white/5 p-3">
              <h4 className="text-[10px] text-white/30 font-bold mb-3">RATE LIMIT STATUS</h4>
              <div className="space-y-2.5">
                {Object.entries(rateLimits).map(([cat, data]) => (
                  <RateLimitBar key={cat} category={cat} data={data} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between text-[9px] text-white/20">
        <span>Sentinel v1.0 — Phase 1 boot interceptor</span>
        <span>{stats?.scansTotal || 0} scans lifetime</span>
      </div>
    </div>
  );
}
