import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Send, Trash2, FileCode, Loader2, Paperclip,
  Bell, Activity, CheckCheck, AlertTriangle, Info,
  ExternalLink, RefreshCw, Zap, Clock, Eye,
} from 'lucide-react';
import { chat, streamClaude, PROVIDER_LABELS, DEFAULT_PROVIDER, type AIProvider, type Message } from '../../services/aiService';
import {
  subscribeNovaAlerts, subscribeNovaStatus, acknowledgeAlert,
  investigateSource, NovaAlert, NovaStatus, SEVERITY_CONFIG, ALERT_TYPE_LABELS,
} from '../../services/novaService';
import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/api/dialog';
import { useAppStore } from '../../stores/appStore';
import { formatDistanceToNow } from 'date-fns';

type NovaView = 'chat' | 'alerts' | 'monitor';

interface ConversationMessage extends Message {
  id: string;
  provider?: AIProvider;
  streaming?: boolean;
}

// ── Alert card ─────────────────────────────────────────────────────────

function AlertCard({
  alert,
  onAck,
  onInvestigate,
}: {
  alert: NovaAlert;
  onAck: () => void;
  onInvestigate: () => void;
}) {
  const cfg = SEVERITY_CONFIG[alert.severity];
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          {/* Severity icon */}
          <div className="flex-shrink-0 mt-0.5">
            {alert.severity === 'critical'
              ? <AlertTriangle className="w-4 h-4" style={{ color: cfg.color }} />
              : alert.severity === 'warn'
              ? <AlertTriangle className="w-4 h-4" style={{ color: cfg.color }} />
              : <Info className="w-4 h-4" style={{ color: cfg.color }} />
            }
          </div>

          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                style={{ background: cfg.border, color: cfg.color }}>
                {cfg.label}
              </span>
              <span className="text-white/30 text-xs">
                {ALERT_TYPE_LABELS[alert.type]}
              </span>
              {alert.tags?.map(tag => (
                <span key={tag} className="text-white/20 text-xs bg-white/5 px-1.5 py-0.5 rounded">
                  {tag}
                </span>
              ))}
              <span className="ml-auto text-white/20 text-xs flex-shrink-0">
                {alert.createdAt?.toDate
                  ? formatDistanceToNow(alert.createdAt.toDate(), { addSuffix: true })
                  : 'just now'}
              </span>
            </div>

            {/* Title */}
            <p className="text-white text-sm font-semibold leading-snug mb-1">{alert.title}</p>

            {/* Summary */}
            <p className="text-white/60 text-xs leading-relaxed">{alert.summary}</p>

            {/* Suggested response if exists */}
            {alert.suggestedResponse && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="mt-2 text-xs text-white/40 hover:text-white/70 transition-colors flex items-center gap-1"
              >
                <Eye className="w-3 h-3" />
                {expanded ? 'Hide' : 'View'} suggested response
              </button>
            )}
            <AnimatePresence>
              {expanded && alert.suggestedResponse && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-white/50 text-xs mb-1 font-semibold">Nova's suggested response:</p>
                    <p className="text-white/80 text-xs leading-relaxed whitespace-pre-wrap">{alert.suggestedResponse}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={onInvestigate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
            style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa' }}
          >
            <Bot className="w-3 h-3" />
            Ask Nova
          </button>
          {alert.sourceId && (
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/40 hover:text-white/70 transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <ExternalLink className="w-3 h-3" />
              View {alert.sourceType}
            </button>
          )}
          {!alert.acknowledged && (
            <button
              onClick={onAck}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }}
            >
              <CheckCheck className="w-3 h-3" />
              Acknowledge
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────

export default function AIOrchestrator() {
  const { activeFile, novaAlerts, pendingNovaCall, setPendingNovaCall, setActivePanel } = useAppStore();

  const [view, setView] = useState<NovaView>('chat');
  const [provider, setProvider] = useState<AIProvider>(DEFAULT_PROVIDER);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ path: string; content: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Nova state
  const [alerts, setAlerts] = useState<NovaAlert[]>([]);
  const [alertFilter, setAlertFilter] = useState<'all' | 'unacknowledged' | 'critical'>('all');
  const [novaStatus, setNovaStatus] = useState<NovaStatus | null>(null);
  const [investigating, setInvestigating] = useState<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const unsub1 = subscribeNovaAlerts(alertFilter, setAlerts);
    const unsub2 = subscribeNovaStatus(setNovaStatus);
    return () => { unsub1(); unsub2(); };
  }, [alertFilter]);

  // Handle incoming Nova call — switch to chat and pre-load context
  useEffect(() => {
    if (!pendingNovaCall) return;
    setView('chat');
    const context = pendingNovaCall.novaMessage || 'I flagged something that needs your attention.';
    const systemMsg: ConversationMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `Nova here. ${context}\n\nI've flagged this as Alert ID \`${pendingNovaCall.novaAlertId || 'unknown'}\`. You can check the Alerts tab for full details, or ask me about it here.`,
      provider: 'gemini',
    };
    setMessages([systemMsg]);
    setPendingNovaCall(null);
  }, [pendingNovaCall]);

  const attachActiveFile = async () => {
    if (!activeFile) return;
    try {
      const content = await invoke<string>('read_file', { path: activeFile });
      setAttachedFile({ path: activeFile, content });
    } catch {}
  };

  const attachFromDisk = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Code', extensions: ['ts', 'tsx', 'js', 'jsx', 'rs', 'py', 'json', 'md', 'sql', 'css'] }],
      });
      if (typeof selected === 'string') {
        const content = await invoke<string>('read_file', { path: selected });
        setAttachedFile({ path: selected, content });
      }
    } catch {}
  };

  const handleSend = async () => {
    if (!input.trim() && !attachedFile) return;
    if (loading) return;

    let userContent = input.trim();
    if (attachedFile) {
      const ext = attachedFile.path.split('.').pop() || '';
      userContent = `${userContent ? userContent + '\n\n' : ''}File: \`${attachedFile.path}\`\n\`\`\`${ext}\n${attachedFile.content.slice(0, 12000)}\n\`\`\``;
    }

    const userMsg: ConversationMessage = { id: crypto.randomUUID(), role: 'user', content: userContent };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setAttachedFile(null);
    setLoading(true);

    const apiMessages: Message[] = updatedMessages.map(m => ({ role: m.role, content: m.content }));

    if (provider === 'claude') {
      const assistantId = crypto.randomUUID();
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', provider: 'claude', streaming: true }]);
      await streamClaude(
        apiMessages,
        chunk => setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk } : m)),
        () => {
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, streaming: false } : m));
          setLoading(false);
        }
      );
    } else {
      try {
        const resp = await chat(provider, apiMessages);
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: resp.text, provider }]);
      } catch (e: any) {
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${e.message || e}`, provider }]);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleInvestigateAlert = async (alert: NovaAlert) => {
    setView('chat');
    if (!alert.sourceId || !alert.sourceType) {
      // Just ask in chat without a source
      setInput(`Nova, tell me more about this alert: "${alert.title}"\n\nSummary: ${alert.summary}`);
      return;
    }
    setInvestigating(alert.id);
    try {
      const { analysis } = await investigateSource(
        alert.sourceId,
        alert.sourceType as 'ticket' | 'task',
        `Explain this issue and tell me exactly what to do: "${alert.title}"`,
      );
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: analysis,
        provider: 'gemini',
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Investigation error: ${e.message || e}`,
        provider: 'gemini',
      }]);
    } finally {
      setInvestigating(null);
    }
  };

  const cfg = PROVIDER_LABELS[provider];
  const unackCount = alerts.filter(a => !a.acknowledged).length;
  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-white/5 flex items-center gap-3 flex-wrap">
        <Bot className="w-5 h-5 flex-shrink-0" style={{ color: view === 'chat' ? cfg.color : '#a78bfa' }} />
        <h1 className="text-xl font-black text-white">AI Orchestrator</h1>

        {/* View tabs */}
        <div className="flex gap-1 ml-2 bg-void-lighter rounded-xl p-1">
          {(['chat', 'alerts', 'monitor'] as NovaView[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                view === v ? 'bg-void-light text-white' : 'text-white/40 hover:text-white/70'
              }`}
              style={view === v && v !== 'chat' ? { color: '#a78bfa', boxShadow: '0 0 0 1px rgba(124,58,237,0.3)' } : {}}
            >
              {v === 'chat' ? 'Chat'
                : v === 'alerts'
                  ? <>Alerts {unackCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black"
                      style={{ background: criticalCount > 0 ? '#ef444440' : '#f59e0b40', color: criticalCount > 0 ? '#ef4444' : '#f59e0b' }}>
                      {unackCount}
                    </span>}</>
                  : 'Monitor'}
            </button>
          ))}
        </div>

        {/* Provider tabs — chat view only */}
        {view === 'chat' && (
          <div className="flex gap-1 ml-auto bg-void-lighter rounded-xl p-1">
            {(Object.keys(PROVIDER_LABELS) as AIProvider[]).map(p => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  provider === p ? 'bg-void-light text-white' : 'text-white/40 hover:text-white/70'
                }`}
                style={provider === p ? { boxShadow: `0 0 0 1px ${PROVIDER_LABELS[p].color}40`, color: PROVIDER_LABELS[p].color } : {}}
              >
                {PROVIDER_LABELS[p].name}
              </button>
            ))}
          </div>
        )}

        {view === 'chat' && (
          <button onClick={() => setMessages([])} title="Clear conversation"
            className="text-white/20 hover:text-white/60 transition-colors flex-shrink-0">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── CHAT VIEW ──────────────────────────────────────────────────── */}
      {view === 'chat' && (
        <>
          <div className="px-6 py-2 flex-shrink-0 border-b border-white/5">
            <p className="text-white/30 text-xs">{cfg.description}</p>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 selectable">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <div className="relative w-16 h-16">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 rounded-full border border-dashed opacity-30"
                    style={{ borderColor: cfg.color }} />
                  <div className="absolute inset-2 rounded-full flex items-center justify-center"
                    style={{ background: `${cfg.color}15` }}>
                    <Bot className="w-6 h-6" style={{ color: cfg.color }} />
                  </div>
                </div>
                <p className="text-white/30 text-sm max-w-sm">
                  Ask {cfg.name} anything about the NovAura codebase, request fixes, architecture help, or code review.
                  Attach files for context.
                </p>
                {activeFile && (
                  <button onClick={attachActiveFile}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-white/10 text-white/60 text-sm hover:text-white hover:border-white/20 transition-all">
                    <FileCode className="w-4 h-4" />
                    Attach active file
                  </button>
                )}
                {novaAlerts > 0 && (
                  <button onClick={() => setView('alerts')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                    <Bell className="w-3.5 h-3.5" />
                    {novaAlerts} unacknowledged alert{novaAlerts !== 1 ? 's' : ''} need attention
                  </button>
                )}
              </div>
            )}

            {messages.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                  msg.role === 'user' ? 'bg-white/10' : ''
                }`} style={msg.role === 'assistant' ? { background: `${PROVIDER_LABELS[msg.provider || provider].color}20` } : {}}>
                  {msg.role === 'user' ? 'U' : 'AI'}
                </div>
                <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap selectable ${
                      msg.role === 'user'
                        ? 'bg-void-lighter border border-white/10 text-white/90'
                        : 'text-white/90'
                    }`}
                    style={msg.role === 'assistant' ? {
                      background: `${PROVIDER_LABELS[msg.provider || provider].color}08`,
                      border: `1px solid ${PROVIDER_LABELS[msg.provider || provider].color}20`,
                    } : {}}>
                    {msg.content}
                    {msg.streaming && <span className="inline-block w-1.5 h-4 bg-current ml-1 animate-pulse align-text-bottom" />}
                  </div>
                </div>
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <AnimatePresence>
            {attachedFile && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                className="flex-shrink-0 px-6 py-2 border-t border-white/5 overflow-hidden">
                <div className="flex items-center gap-2 text-xs text-neon-cyan/70">
                  <FileCode className="w-3.5 h-3.5" />
                  <span className="font-mono truncate">{attachedFile.path.split('/').pop()}</span>
                  <span className="text-white/30">({(attachedFile.content.length / 1024).toFixed(1)}kb)</span>
                  <button onClick={() => setAttachedFile(null)} className="ml-auto text-white/30 hover:text-white/70">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-shrink-0 p-4 border-t border-white/5 flex gap-2 items-end">
            <button onClick={attachFromDisk} title="Attach file"
              className="w-9 h-9 flex-shrink-0 rounded-xl bg-void-lighter border border-white/10 flex items-center justify-center text-white/40 hover:text-white/70 hover:border-white/20 transition-all">
              <Paperclip className="w-4 h-4" />
            </button>
            {activeFile && (
              <button onClick={attachActiveFile} title="Attach active editor file"
                className="w-9 h-9 flex-shrink-0 rounded-xl bg-void-lighter border border-white/10 flex items-center justify-center text-neon-cyan/40 hover:text-neon-cyan hover:border-neon-cyan/30 transition-all">
                <FileCode className="w-4 h-4" />
              </button>
            )}
            <textarea
              className="flex-1 bg-void-lighter border border-white/10 rounded-xl px-4 py-3 text-sm text-white resize-none outline-none focus:border-neon-cyan/40 transition-colors selectable"
              rows={3}
              placeholder={`Ask ${cfg.name}...`}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
            />
            <button
              onClick={handleSend}
              disabled={(!input.trim() && !attachedFile) || loading}
              className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
              style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}30`, color: cfg.color }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </>
      )}

      {/* ── ALERTS VIEW ────────────────────────────────────────────────── */}
      {view === 'alerts' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filter bar */}
          <div className="flex-shrink-0 px-6 py-3 border-b border-white/5 flex items-center gap-2">
            {(['all', 'unacknowledged', 'critical'] as const).map(f => (
              <button
                key={f}
                onClick={() => setAlertFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                  alertFilter === f ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
                }`}
              >
                {f}
              </button>
            ))}
            <span className="ml-auto text-white/20 text-xs">{alerts.length} alert{alerts.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Alert list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {investigating && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
                <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                <span className="text-purple-400 text-sm">Nova is investigating...</span>
              </div>
            )}
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <Activity className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-white/40 text-sm">No alerts — all clear</p>
              </div>
            ) : (
              alerts.map(alert => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onAck={() => acknowledgeAlert(alert.id)}
                  onInvestigate={() => handleInvestigateAlert(alert)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* ── MONITOR VIEW ───────────────────────────────────────────────── */}
      {view === 'monitor' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Nova status card */}
          <div className="rounded-2xl p-5"
            style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <div className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(255,0,128,0.2))', border: '1px solid rgba(124,58,237,0.3)' }}>
                  <Bot className="w-5 h-5 text-purple-300" />
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-void ${
                  novaStatus?.isActive ? 'bg-green-400' : 'bg-white/20'
                }`} style={{ animation: novaStatus?.isActive ? 'pulse 2s ease-in-out infinite' : undefined }} />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Nova AI</p>
                <p className="text-purple-300/70 text-xs">
                  {novaStatus?.isActive ? 'Active — monitoring platform' : 'Standby'}
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-white/20 text-xs">Unacknowledged</p>
                <p className="text-white font-black text-xl"
                  style={{ color: novaAlerts > 0 ? '#ef4444' : '#4ade80' }}>
                  {novaAlerts}
                </p>
              </div>
            </div>

            {novaStatus && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <Activity className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-white/60">{novaStatus.currentFocus}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="w-3.5 h-3.5 text-white/30" />
                  <span className="text-white/30">
                    Last check: {novaStatus.lastCheck
                      ? formatDistanceToNow(new Date(novaStatus.lastCheck), { addSuffix: true })
                      : 'never'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* What Nova monitors */}
          <div className="rounded-2xl p-5 space-y-3"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">What Nova monitors</p>
            {[
              { icon: Bell,         label: 'New support tickets',         desc: 'AI analyzes severity, drafts responses, rings owner for critical issues' },
              { icon: AlertTriangle, label: 'Urgent unresponded tickets', desc: 'Escalates high-priority tickets that have waited 2+ hours with no staff reply' },
              { icon: Zap,          label: 'Stalled tasks',               desc: 'Flags in-progress tasks with no updates after 3 days' },
              { icon: RefreshCw,    label: 'Scheduled checks',            desc: 'Runs full platform health scan every 15 minutes' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5"
                  style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.2)' }}>
                  <Icon className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div>
                  <p className="text-white/80 text-xs font-semibold">{label}</p>
                  <p className="text-white/30 text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Quick investigate */}
          <div className="rounded-2xl p-5"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Ask Nova to investigate</p>
            <p className="text-white/30 text-xs mb-3">
              Switch to the Chat tab and ask Nova to review a specific ticket, task, or piece of code.
              Attach files directly for code review.
            </p>
            <button
              onClick={() => setView('chat')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(255,0,128,0.1))', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa' }}
            >
              <Bot className="w-4 h-4" />
              Open Chat with Nova
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.3)} }`}</style>
    </div>
  );
}
