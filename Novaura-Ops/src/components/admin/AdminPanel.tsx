import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Users, Activity, Database, RefreshCw,
  Ban, CheckCircle, Trash2, ExternalLink, Zap, AlertTriangle,
  Key, Plus, Copy, Eye, EyeOff, ToggleLeft, ToggleRight,
  Clock, Star, ChevronDown, ChevronRight,
} from 'lucide-react';
import {
  collection, getDocs, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, limit, Timestamp
} from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { useAppStore } from '../../stores/appStore';
import { invoke } from '@tauri-apps/api/tauri';
import {
  subscribeAllStaffHours, subscribeTimeLogs, setEquityFlag,
  fmtMinutes, fmtHoursDecimal, type StaffHours, type TimeEntry,
} from '../../services/timeService';

interface FirestoreUser {
  uid: string;
  email: string;
  displayName: string;
  tier: string;
  role: string;
  createdAt: Timestamp;
  banned?: boolean;
  isAdmin?: boolean;
}

interface SiteLog {
  id: string;
  action: string;
  userId?: string;
  detail?: string;
  ts: Timestamp;
}

interface ORKey {
  name: string;
  label: string;
  hash: string;
  limit: number | null;
  usage: number | null;
  created_at: string | null;
  disabled: boolean | null;
}

interface NewKeyForm {
  name: string;
  label: string;
  limit: string;
}

const TIER_COLORS: Record<string, string> = {
  free: '#64748b', explorer: '#22c55e', twin: '#00f0ff',
  awakened: '#8b5cf6', nova: '#f59e0b', catalyst: '#ff0080',
};

export default function AdminPanel() {
  const { profile } = useAppStore();
  const [tab, setTab] = useState<'users' | 'logs' | 'system' | 'deploy' | 'keys' | 'hours'>('users');
  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [logs, setLogs] = useState<SiteLog[]>([]);
  const [search, setSearch] = useState('');
  const [sysInfo, setSysInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [deployOutput, setDeployOutput] = useState('');

  // Hours tab state
  const [staffHours, setStaffHours] = useState<StaffHours[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeEntry[]>([]);
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null);
  const [hoursUnsub, setHoursUnsub] = useState<(() => void) | null>(null);

  // Keys tab state
  const [orKeys, setOrKeys] = useState<ORKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [keysError, setKeysError] = useState('');
  const [newKey, setNewKey] = useState<NewKeyForm>({ name: '', label: '', limit: '' });
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showCreated, setShowCreated] = useState(false);
  const [provisioning, setProvisioning] = useState(false);

  const isOwnerOrAdmin = profile?.role === 'owner' || profile?.role === 'admin';

  useEffect(() => { loadUsers(); }, []);
  useEffect(() => {
    if (tab === 'hours') {
      const u1 = subscribeAllStaffHours(setStaffHours);
      const u2 = subscribeTimeLogs(null, setTimeLogs);
      setHoursUnsub(() => () => { u1(); u2(); });
      return () => { u1(); u2(); };
    }
    if (hoursUnsub) { hoursUnsub(); setHoursUnsub(null); }
  }, [tab]);

  useEffect(() => {
    if (tab === 'logs') {
      const unsub = onSnapshot(
        query(collection(db, 'activity_logs'), orderBy('ts', 'desc'), limit(100)),
        snap => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SiteLog))
      );
      return unsub;
    }
    if (tab === 'system') loadSysInfo();
    if (tab === 'keys') loadOrKeys();
  }, [tab]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() }) as FirestoreUser));
    } finally {
      setLoading(false);
    }
  };

  const loadSysInfo = async () => {
    try {
      const info = await invoke('get_system_info');
      setSysInfo(info);
    } catch {}
  };

  const banUser = async (uid: string, banned: boolean) => {
    if (!isOwnerOrAdmin) return;
    await updateDoc(doc(db, 'users', uid), { banned });
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, banned } : u));
  };

  const setUserTier = async (uid: string, tier: string) => {
    if (!isOwnerOrAdmin) return;
    await updateDoc(doc(db, 'users', uid), { tier });
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, tier } : u));
  };

  const setUserRole = async (uid: string, role: string) => {
    if (profile?.role !== 'owner') return;
    await updateDoc(doc(db, 'ops_staff', uid), { role });
    await updateDoc(doc(db, 'users', uid), { role });
  };

  const WEBOS_ROOT = 'z:/Novaura platform/NovAura-WebOS';

  const runDeploy = async (cmd: string, label: string, cwd?: string) => {
    setDeployOutput(`> ${label}\n`);
    try {
      const out = await invoke<{ stdout: string; stderr: string; exit_code: number }>('terminal_execute', {
        cmd,
        cwd: cwd || WEBOS_ROOT,
      });
      setDeployOutput(prev => prev + (out.stdout || '') + (out.stderr ? `[stderr] ${out.stderr}` : '') + `\nExit: ${out.exit_code}\n`);
    } catch (e: any) {
      setDeployOutput(prev => prev + `Error: ${e}\n`);
    }
  };

  // ── OpenRouter key management ────────────────────────────────────────────
  const loadOrKeys = async () => {
    setKeysLoading(true);
    setKeysError('');
    try {
      const keys = await invoke<ORKey[]>('or_list_keys');
      setOrKeys(keys);
    } catch (e: any) {
      setKeysError(e?.message || String(e));
    } finally {
      setKeysLoading(false);
    }
  };

  const provisionKey = async () => {
    if (!newKey.name.trim()) return;
    setProvisioning(true);
    setKeysError('');
    try {
      const resp = await invoke<{ key: string; hash: string; name: string; label: string; limit: number | null }>('or_provision_key', {
        name: newKey.name.trim(),
        label: newKey.label.trim() || newKey.name.trim(),
        limitUsd: newKey.limit ? parseFloat(newKey.limit) : null,
      });
      setCreatedKey(resp.key);
      setShowCreated(true);
      setNewKey({ name: '', label: '', limit: '' });
      await loadOrKeys();
    } catch (e: any) {
      setKeysError(e?.message || String(e));
    } finally {
      setProvisioning(false);
    }
  };

  const revokeKey = async (hash: string, name: string) => {
    if (!confirm(`Revoke key "${name}"? This is permanent.`)) return;
    try {
      await invoke('or_revoke_key', { hash });
      setOrKeys(prev => prev.filter(k => k.hash !== hash));
    } catch (e: any) {
      setKeysError(e?.message || String(e));
    }
  };

  const toggleDisabled = async (k: ORKey) => {
    try {
      const updated = await invoke<ORKey>('or_update_key', {
        hash: k.hash, name: null, limitUsd: null, disabled: !k.disabled,
      });
      setOrKeys(prev => prev.map(x => x.hash === k.hash ? updated : x));
    } catch (e: any) {
      setKeysError(e?.message || String(e));
    }
  };

  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text).catch(() => {});

  // ── Tier credit limits ───────────────────────────────────────────────────
  const TIER_LIMITS: Record<string, number | null> = {
    free: 1, explorer: 5, twin: 10, awakened: 25, nova: 75, catalyst: null,
  };

  const TIER_LIMIT_LABELS: Record<string, string> = {
    free: '$1', explorer: '$5', twin: '$10', awakened: '$25', nova: '$75', catalyst: 'Unlimited',
  };

  const filtered = users.filter(u =>
    !search || u.email?.toLowerCase().includes(search.toLowerCase()) || u.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  const TABS = [
    { id: 'users',  label: 'Users',    icon: Users },
    { id: 'hours',  label: 'Hours',    icon: Clock },
    { id: 'logs',   label: 'Activity', icon: Activity },
    { id: 'system', label: 'System',   icon: Database },
    { id: 'deploy', label: 'Deploy',   icon: Zap },
    { id: 'keys',   label: 'API Keys', icon: Key },
  ] as const;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-white/5 flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-red-400" />
        <h1 className="text-xl font-black text-white">Admin Panel</h1>
        {!isOwnerOrAdmin && (
          <span className="ml-2 px-2 py-0.5 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs">
            Read-only — contact Dillan for elevated access
          </span>
        )}

        {/* Tabs */}
        <div className="flex gap-1 ml-auto bg-void-lighter rounded-xl p-1">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === t.id ? 'bg-void-light text-white' : 'text-white/40 hover:text-white/60'}`}>
                <Icon className="w-3.5 h-3.5" />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">

        {/* ── USERS ── */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                className="flex-1 bg-void-lighter border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-neon-cyan/40 selectable"
                placeholder="Search users by email or name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <button onClick={loadUsers} className="text-white/30 hover:text-white transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
              <span className="text-white/30 text-sm">{filtered.length} users</span>
            </div>

            <div className="space-y-2">
              {filtered.map(u => (
                <motion.div key={u.uid} layout
                  className={`glass rounded-xl p-4 flex items-center gap-4 border ${u.banned ? 'border-red-500/20' : 'border-white/5'}`}>
                  <div className="w-9 h-9 rounded-full bg-void-lighter flex items-center justify-center text-sm font-bold text-white/60 flex-shrink-0">
                    {(u.displayName || u.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{u.displayName || '(no name)'}</p>
                    <p className="text-white/40 text-xs truncate">{u.email}</p>
                  </div>

                  {/* Tier badge */}
                  <span className="text-xs px-2 py-0.5 rounded-md font-semibold flex-shrink-0"
                    style={{ background: `${TIER_COLORS[u.tier] || '#64748b'}20`, color: TIER_COLORS[u.tier] || '#64748b' }}>
                    {u.tier || 'free'}
                  </span>

                  {/* Role */}
                  <span className="text-xs text-white/30 flex-shrink-0">{u.role || 'user'}</span>

                  {/* Tier select */}
                  {isOwnerOrAdmin && (
                    <select
                      value={u.tier || 'free'}
                      onChange={e => setUserTier(u.uid, e.target.value)}
                      className="bg-void-lighter border border-white/10 rounded-lg px-2 py-1 text-xs text-white/70 outline-none flex-shrink-0"
                    >
                      {['free', 'explorer', 'twin', 'awakened', 'nova', 'catalyst'].map(t =>
                        <option key={t} value={t}>{t}</option>
                      )}
                    </select>
                  )}

                  {/* Ban toggle */}
                  {isOwnerOrAdmin && (
                    <button
                      onClick={() => banUser(u.uid, !u.banned)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${
                        u.banned
                          ? 'bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20'
                          : 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20'
                      }`}
                    >
                      {u.banned ? <><CheckCircle className="w-3 h-3" /> Unban</> : <><Ban className="w-3 h-3" /> Ban</>}
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ── HOURS ── */}
        {tab === 'hours' && (
          <div className="space-y-3">
            {/* Summary totals */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Staff', value: staffHours.length, color: '#00f0ff' },
                { label: 'Total Hours Logged', value: fmtHoursDecimal(staffHours.reduce((s, h) => s + (h.totalMinutes || 0), 0)), color: '#22c55e' },
                { label: 'Equity Members', value: staffHours.filter(h => h.isEquity).length, color: '#ff0080' },
              ].map(({ label, value, color }) => (
                <div key={label} className="glass rounded-xl p-4 border border-white/5">
                  <p className="text-white/30 text-xs mb-1">{label}</p>
                  <p className="font-bold text-lg" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Per-staff rows */}
            <div className="space-y-2">
              {staffHours
                .sort((a, b) => (b.totalMinutes || 0) - (a.totalMinutes || 0))
                .map(member => {
                  const logs = timeLogs.filter(l => l.uid === member.uid);
                  const isExpanded = expandedStaff === member.uid;
                  return (
                    <div key={member.uid} className="glass rounded-xl border border-white/5 overflow-hidden">
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/3 transition-colors"
                        onClick={() => setExpandedStaff(isExpanded ? null : member.uid)}
                      >
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-void-lighter border border-white/10 flex-shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold text-white/60">
                          {member.photoURL
                            ? <img src={member.photoURL} alt="" className="w-full h-full object-cover" />
                            : (member.displayName || 'S').charAt(0).toUpperCase()
                          }
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white text-sm font-semibold truncate">{member.displayName}</p>
                            {member.isEquity && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-yellow-500/15 border border-yellow-500/20 text-yellow-400 text-[10px] font-semibold flex-shrink-0">
                                <Star className="w-2.5 h-2.5" /> EQUITY
                                {member.equityBonus ? ` +${member.equityBonus}%` : ''}
                              </span>
                            )}
                            {member.isClocked && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-500/15 text-green-400 text-[10px] font-semibold flex-shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> ONLINE
                              </span>
                            )}
                          </div>
                          <p className="text-white/30 text-xs truncate">{member.email}</p>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className="text-white font-bold text-sm">{fmtHoursDecimal(member.totalMinutes || 0)}</p>
                          <p className="text-white/30 text-xs">{fmtMinutes(member.totalMinutes || 0)}</p>
                        </div>

                        {/* Equity toggle (owner only) */}
                        {profile?.role === 'owner' && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setEquityFlag(member.uid, !member.isEquity, member.equityBonus || undefined);
                            }}
                            className={`flex-shrink-0 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ml-2 ${
                              member.isEquity
                                ? 'bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25'
                                : 'bg-white/5 text-white/30 hover:bg-white/10'
                            }`}
                          >
                            {member.isEquity ? 'Equity ✓' : 'Set Equity'}
                          </button>
                        )}

                        {isExpanded
                          ? <ChevronDown className="w-4 h-4 text-white/30 flex-shrink-0" />
                          : <ChevronRight className="w-4 h-4 text-white/30 flex-shrink-0" />
                        }
                      </div>

                      {/* Expanded log */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-t border-white/5"
                          >
                            <div className="px-4 py-3 space-y-1.5 max-h-48 overflow-y-auto">
                              {logs.length === 0 && (
                                <p className="text-white/20 text-xs text-center py-4">No sessions recorded yet</p>
                              )}
                              {logs.map(log => (
                                <div key={log.id} className="flex items-center gap-3 text-xs py-1 border-b border-white/5 last:border-0">
                                  <span className="text-white/40 w-24 flex-shrink-0 font-mono">{log.date}</span>
                                  <span className="text-white/60">
                                    {log.clockIn ? new Date(log.clockIn.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                    {' → '}
                                    {log.clockOut ? new Date(log.clockOut.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : <span className="text-green-400">active</span>}
                                  </span>
                                  {log.durationMinutes != null && (
                                    <span className="text-white/40 font-mono ml-auto flex-shrink-0">{fmtMinutes(log.durationMinutes)}</span>
                                  )}
                                  {log.auto && <span className="text-white/20 text-[9px] flex-shrink-0">auto</span>}
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              }
              {staffHours.length === 0 && (
                <p className="text-white/20 text-sm text-center py-12">No hours data yet — staff clock-in automatically on login</p>
              )}
            </div>
          </div>
        )}

        {/* ── LOGS ── */}
        {tab === 'logs' && (
          <div className="space-y-2">
            {logs.length === 0 && <p className="text-white/30 text-sm text-center py-16">No activity logged yet</p>}
            {logs.map(log => (
              <div key={log.id} className="glass rounded-xl px-4 py-3 flex items-center gap-3 border border-white/5">
                <Activity className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                <span className="text-white/80 text-sm flex-1">{log.action}</span>
                {log.detail && <span className="text-white/30 text-xs truncate max-w-xs font-mono">{log.detail}</span>}
                <span className="text-white/20 text-xs flex-shrink-0">
                  {log.ts ? new Date(log.ts.seconds * 1000).toLocaleString() : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── SYSTEM ── */}
        {tab === 'system' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Firebase Project', value: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'not configured', color: '#f59e0b' },
                { label: 'App Version', value: sysInfo?.version || '1.0.0', color: '#00f0ff' },
                { label: 'OS', value: `${sysInfo?.os || '—'} (${sysInfo?.arch || '—'})`, color: '#8b5cf6' },
              ].map(item => (
                <div key={item.label} className="glass rounded-xl p-4 border border-white/5">
                  <p className="text-white/30 text-xs mb-1">{item.label}</p>
                  <p className="font-mono text-sm font-bold" style={{ color: item.color }}>{item.value}</p>
                </div>
              ))}
            </div>

            <div className="glass rounded-xl p-4 border border-white/5">
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Connected Services</p>
              <div className="space-y-2">
                {[
                  { name: 'Firebase Firestore', status: 'connected', color: '#22c55e' },
                  { name: 'Firebase Realtime DB (Voice)', status: 'connected', color: '#22c55e' },
                  { name: 'Firebase Auth', status: 'connected', color: '#22c55e' },
                  { name: 'Claude API (Anthropic)', status: import.meta.env.VITE_ANTHROPIC_KEY ? 'configured' : 'key missing', color: import.meta.env.VITE_ANTHROPIC_KEY ? '#22c55e' : '#f59e0b' },
                  { name: 'Gemini API (Google)', status: 'via Rust backend', color: '#00f0ff' },
                  { name: 'Kimi K2 (AI/ML API)', status: 'via Rust backend', color: '#00f0ff' },
                  { name: 'novaura.life', status: 'same Firebase project', color: '#22c55e' },
                ].map(s => (
                  <div key={s.name} className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-white/70 text-sm">{s.name}</span>
                    <span className="ml-auto text-xs" style={{ color: s.color }}>{s.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── API KEYS ── */}
        {tab === 'keys' && (
          <div className="space-y-5">
            {!isOwnerOrAdmin && (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Owner access required to manage API keys.
              </div>
            )}

            {/* Tier reference */}
            <div className="glass rounded-xl p-4 border border-white/5">
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Credit Limits by Tier</p>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(TIER_LIMITS).map(([tier, usd]) => (
                  <span key={tier} className="px-3 py-1 rounded-lg text-xs font-semibold"
                    style={{ background: `${TIER_COLORS[tier] || '#64748b'}20`, color: TIER_COLORS[tier] || '#64748b' }}>
                    {tier}: {TIER_LIMIT_LABELS[tier]}
                  </span>
                ))}
              </div>
            </div>

            {/* Provision new key */}
            {isOwnerOrAdmin && (
              <div className="glass rounded-xl p-4 border border-white/5 space-y-3">
                <p className="text-white/50 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5" /> Provision New Key
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <input
                    className="bg-void-lighter border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan/40 selectable"
                    placeholder="Name (e.g. staff_alice)"
                    value={newKey.name}
                    onChange={e => setNewKey(p => ({ ...p, name: e.target.value }))}
                  />
                  <input
                    className="bg-void-lighter border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan/40 selectable"
                    placeholder="Label (e.g. Alice — Twin tier)"
                    value={newKey.label}
                    onChange={e => setNewKey(p => ({ ...p, label: e.target.value }))}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="bg-void-lighter border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan/40 selectable"
                    placeholder="Credit limit USD (blank = unlimited)"
                    value={newKey.limit}
                    onChange={e => setNewKey(p => ({ ...p, limit: e.target.value }))}
                  />
                </div>
                <button
                  onClick={provisionKey}
                  disabled={provisioning || !newKey.name.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                  style={{ background: '#7c3aed20', border: '1px solid #7c3aed40', color: '#a78bfa' }}
                >
                  {provisioning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                  {provisioning ? 'Provisioning…' : 'Create Key'}
                </button>
              </div>
            )}

            {/* Created key reveal */}
            <AnimatePresence>
              {createdKey && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="glass rounded-xl p-4 border border-green-500/20 space-y-2">
                  <p className="text-green-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5" /> Key Created — copy it now, it won't be shown again
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-void-lighter rounded-lg px-3 py-2 text-xs font-mono text-green-300 selectable overflow-x-auto">
                      {showCreated ? createdKey : '•'.repeat(Math.min(createdKey.length, 52))}
                    </code>
                    <button onClick={() => setShowCreated(s => !s)} className="text-white/30 hover:text-white transition-colors">
                      {showCreated ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => copyToClipboard(createdKey)} className="text-white/30 hover:text-neon-cyan transition-colors">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setCreatedKey(null); setShowCreated(false); }} className="text-white/20 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {keysError && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {keysError}
              </div>
            )}

            {/* Key list */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-white/50 text-xs font-semibold uppercase tracking-wider flex-1">
                  Provisioned Keys ({orKeys.length})
                </p>
                <button onClick={loadOrKeys} disabled={keysLoading} className="text-white/30 hover:text-white transition-colors">
                  <RefreshCw className={`w-4 h-4 ${keysLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {keysLoading && orKeys.length === 0 && (
                <p className="text-white/30 text-sm text-center py-8">Loading keys…</p>
              )}

              {!keysLoading && orKeys.length === 0 && !keysError && (
                <p className="text-white/30 text-sm text-center py-8">No provisioned keys yet</p>
              )}

              {orKeys.map(k => (
                <motion.div key={k.hash} layout
                  className={`glass rounded-xl p-4 border flex items-center gap-4 ${k.disabled ? 'border-red-500/20 opacity-60' : 'border-white/5'}`}>
                  <Key className="w-4 h-4 flex-shrink-0" style={{ color: k.disabled ? '#ef4444' : '#7c3aed' }} />

                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{k.label || k.name}</p>
                    <p className="text-white/30 text-xs font-mono truncate">{k.hash}</p>
                  </div>

                  {/* Usage / limit */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold" style={{ color: '#a78bfa' }}>
                      ${(k.usage ?? 0).toFixed(3)}
                    </p>
                    <p className="text-white/30 text-xs">
                      / {k.limit != null ? `$${k.limit}` : '∞'}
                    </p>
                  </div>

                  {/* Usage bar */}
                  {k.limit != null && k.limit > 0 && (
                    <div className="w-20 h-1.5 bg-void-lighter rounded-full overflow-hidden flex-shrink-0">
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, ((k.usage ?? 0) / k.limit) * 100)}%`,
                          background: ((k.usage ?? 0) / k.limit) > 0.85 ? '#ef4444' : '#7c3aed',
                        }} />
                    </div>
                  )}

                  {k.created_at && (
                    <span className="text-white/20 text-xs flex-shrink-0 hidden xl:block">
                      {new Date(k.created_at).toLocaleDateString()}
                    </span>
                  )}

                  {isOwnerOrAdmin && (
                    <>
                      <button onClick={() => toggleDisabled(k)} title={k.disabled ? 'Enable' : 'Disable'}
                        className="text-white/30 hover:text-white transition-colors flex-shrink-0">
                        {k.disabled
                          ? <ToggleLeft className="w-5 h-5 text-red-400" />
                          : <ToggleRight className="w-5 h-5 text-green-400" />
                        }
                      </button>
                      <button onClick={() => revokeKey(k.hash, k.label || k.name)}
                        className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ── DEPLOY ── */}
        {tab === 'deploy' && (
          <div className="space-y-4">
            {!isOwnerOrAdmin && (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                You need admin access to run deploy commands.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Build Platform', cmd: 'npm run build', desc: 'Vite production build', color: '#00f0ff' },
                { label: 'Install Deps', cmd: 'npm install', desc: 'Install / update packages', color: '#8b5cf6' },
                { label: 'Type Check', cmd: 'npx tsc --noEmit', desc: 'Full TypeScript check', color: '#f59e0b' },
                { label: 'Git Status', cmd: 'git status && git log --oneline -5', desc: 'Branch + recent commits', color: '#22c55e' },
                { label: 'Git Pull', cmd: 'git pull origin master', desc: 'Pull latest from remote', color: '#22c55e' },
                { label: 'Lint', cmd: 'npx eslint src --ext .ts,.tsx --max-warnings 0', desc: 'ESLint full scan', color: '#f97316' },
              ].map(action => (
                <button
                  key={action.label}
                  onClick={() => isOwnerOrAdmin && runDeploy(action.cmd, action.label)}
                  disabled={!isOwnerOrAdmin}
                  className="glass rounded-xl p-4 border border-white/5 text-left hover:border-white/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <p className="font-semibold text-sm" style={{ color: action.color }}>{action.label}</p>
                  <p className="text-white/30 text-xs mt-0.5">{action.desc}</p>
                  <p className="font-mono text-[10px] text-white/20 mt-2 truncate">{action.cmd}</p>
                </button>
              ))}
            </div>

            {deployOutput && (
              <div className="glass rounded-xl border border-white/5 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
                  <span className="text-white/40 text-xs font-mono">Terminal Output</span>
                  <button onClick={() => setDeployOutput('')} className="ml-auto text-white/20 hover:text-white/60 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <pre className="p-4 font-mono text-xs text-green-300 whitespace-pre-wrap max-h-80 overflow-y-auto selectable">
                  {deployOutput}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
