import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle, CheckCircle, Clock, MessageSquare, RefreshCw,
  Send, User, X, Filter, ChevronDown, UserCheck, Flag,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  subscribeTickets, markSeen, updateTicketStatus, updateTicketPriority,
  assignTicket, replyToTicket,
  type SupportTicket, type TicketStatus, type TicketPriority, type TicketType,
  TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG, TICKET_TYPE_CONFIG,
} from '../../services/supportService';

const STATUS_TABS: { id: TicketStatus | 'all'; label: string }[] = [
  { id: 'all',      label: 'All'      },
  { id: 'new',      label: 'New'      },
  { id: 'open',     label: 'Open'     },
  { id: 'pending',  label: 'Pending'  },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed',   label: 'Closed'   },
];

// ── Ticket row ───────────────────────────────────────────────────────

function TicketRow({ ticket, isSelected, onClick }: {
  ticket: SupportTicket;
  isSelected: boolean;
  onClick: () => void;
}) {
  const statusCfg = TICKET_STATUS_CONFIG[ticket.status];
  const priCfg = TICKET_PRIORITY_CONFIG[ticket.priority];
  const isNew = !ticket.seen;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      onClick={onClick}
      className={`flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-white/5 transition-all ${
        isSelected ? 'bg-neon-cyan/5 border-l-2 border-l-neon-cyan' : 'hover:bg-white/3'
      } ${isNew ? 'bg-red-500/3' : ''}`}
    >
      {/* Unseen pulse */}
      <div className="flex-shrink-0 mt-1.5">
        {isNew
          ? <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse block" />
          : <span className="w-2.5 h-2.5 rounded-full bg-white/10 block" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className={`text-sm font-semibold truncate ${isNew ? 'text-white' : 'text-white/80'}`}>
            {ticket.subject}
          </p>
          {ticket.priority === 'urgent' && (
            <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 animate-pulse" />
          )}
        </div>
        <p className="text-white/40 text-xs truncate mb-1.5">{ticket.userName} · {ticket.userEmail}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
            style={{ background: statusCfg.color + '20', color: statusCfg.color }}>
            {statusCfg.label}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md"
            style={{ background: priCfg.color + '15', color: priCfg.color }}>
            {priCfg.label}
          </span>
          <span className="text-[10px] text-white/25 ml-auto">
            {ticket.createdAt ? format(ticket.createdAt.toDate(), 'MMM d, h:mm a') : ''}
          </span>
        </div>
      </div>

      {ticket.replies?.length > 0 && (
        <div className="flex items-center gap-1 text-white/30 text-xs flex-shrink-0 mt-1">
          <MessageSquare className="w-3 h-3" />
          {ticket.replies.length}
        </div>
      )}
    </motion.div>
  );
}

// ── Detail panel ─────────────────────────────────────────────────────

function TicketDetail({ ticket, onClose }: { ticket: SupportTicket; onClose: () => void }) {
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ticket.seen) markSeen(ticket.id);
  }, [ticket.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket.replies?.length]);

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try { await replyToTicket(ticket.id, reply.trim()); setReply(''); }
    finally { setSending(false); }
  };

  const statusCfg = TICKET_STATUS_CONFIG[ticket.status];
  const priCfg = TICKET_PRIORITY_CONFIG[ticket.priority];

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 400, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="w-[420px] flex-shrink-0 flex flex-col bg-void-light border-l border-white/5 overflow-hidden h-full"
    >
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/5 flex items-center gap-2">
        <span className="text-white/25 text-xs font-mono">#{ticket.id.slice(-6).toUpperCase()}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
          style={{ background: priCfg.color + '20', color: priCfg.color }}>
          {priCfg.label}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => assignTicket(ticket.id)}
            title="Assign to me"
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs hover:border-neon-cyan/30 hover:text-neon-cyan transition-all">
            <UserCheck className="w-3.5 h-3.5" />
            {ticket.assignedName ? ticket.assignedName.split(' ')[0] : 'Assign me'}
          </button>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Subject */}
        <h2 className="text-white font-bold text-base leading-snug">{ticket.subject}</h2>

        {/* Meta */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="flex items-center gap-1.5 text-white/50">
            <User className="w-3 h-3" />
            {ticket.userName}
            <span className="text-white/25">·</span>
            {ticket.userEmail}
          </span>
          <span className="text-white/25">
            {ticket.createdAt ? format(ticket.createdAt.toDate(), 'MMM d, yyyy h:mm a') : ''}
          </span>
        </div>

        {/* Status + Priority controls */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-white/25 text-xs mb-1">Status</p>
            <select value={ticket.status}
              onChange={e => updateTicketStatus(ticket.id, e.target.value as TicketStatus)}
              className="w-full bg-void-lighter border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs outline-none">
              {Object.entries(TICKET_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <p className="text-white/25 text-xs mb-1">Priority</p>
            <select value={ticket.priority}
              onChange={e => updateTicketPriority(ticket.id, e.target.value as TicketPriority)}
              className="w-full bg-void-lighter border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs outline-none">
              {Object.entries(TICKET_PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        {/* Type badge */}
        <div className="flex items-center gap-2">
          <span className="text-white/25 text-xs">Type:</span>
          <span className="text-white/60 text-xs">{TICKET_TYPE_CONFIG[ticket.type]?.label || ticket.type}</span>
        </div>

        {/* Original message */}
        <div className="glass rounded-xl p-4 border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-void-lighter border border-white/10 flex items-center justify-center text-[10px] font-bold text-white/60 flex-shrink-0 overflow-hidden">
              {ticket.userPhoto
                ? <img src={ticket.userPhoto} alt="" className="w-full h-full object-cover" />
                : (ticket.userName || '?').charAt(0).toUpperCase()
              }
            </div>
            <span className="text-white/60 text-xs font-semibold">{ticket.userName}</span>
            <span className="text-white/25 text-[10px] ml-auto">Original</span>
          </div>
          <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{ticket.message}</p>
        </div>

        {/* Reply thread */}
        {(ticket.replies || []).map(r => (
          <div key={r.id} className={`glass rounded-xl p-4 border ${r.isStaff ? 'border-neon-cyan/15' : 'border-white/5'}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-void-lighter border border-white/10 flex items-center justify-center text-[10px] font-bold flex-shrink-0 overflow-hidden"
                style={{ borderColor: r.isStaff ? '#00f0ff30' : undefined }}>
                {r.authorPhoto
                  ? <img src={r.authorPhoto} alt="" className="w-full h-full object-cover" />
                  : <span style={{ color: r.isStaff ? '#00f0ff' : undefined }}>{r.authorName.charAt(0).toUpperCase()}</span>
                }
              </div>
              <span className="text-xs font-semibold" style={{ color: r.isStaff ? '#00f0ff' : 'rgba(255,255,255,0.6)' }}>
                {r.authorName} {r.isStaff && <span className="text-[9px] opacity-60">· Staff</span>}
              </span>
              <span className="text-white/25 text-[10px] ml-auto">
                {r.createdAt ? format(r.createdAt.toDate(), 'MMM d, h:mm a') : ''}
              </span>
            </div>
            <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{r.content}</p>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Reply input */}
      <div className="flex-shrink-0 border-t border-white/5 p-3 space-y-2">
        <div className="flex gap-2 items-center mb-1">
          <span className="text-white/30 text-xs">Reply to customer</span>
          <div className="flex gap-1.5 ml-auto">
            {(['resolved', 'closed'] as TicketStatus[]).map(s => (
              <button key={s} onClick={() => updateTicketStatus(ticket.id, s)}
                className="px-2 py-1 rounded-lg text-[10px] font-semibold transition-all"
                style={{ background: TICKET_STATUS_CONFIG[s].color + '15', color: TICKET_STATUS_CONFIG[s].color }}>
                Mark {TICKET_STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <textarea
            className="flex-1 bg-void-lighter border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-neon-cyan/40 selectable resize-none"
            rows={3}
            placeholder="Type your reply..."
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleReply(); }}
          />
          <button onClick={handleReply} disabled={sending || !reply.trim()}
            className="px-3 py-2 bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan rounded-xl hover:bg-neon-cyan/20 transition-all disabled:opacity-40 self-end">
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-white/20 text-[10px]">Ctrl+Enter to send</p>
      </div>
    </motion.div>
  );
}

// ── Main Panel ───────────────────────────────────────────────────────

export default function SupportPanel() {
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<SupportTicket | null>(null);

  useEffect(() => {
    return subscribeTickets(statusFilter === 'all' ? null : statusFilter, setTickets);
  }, [statusFilter]);

  // Keep selected in sync
  useEffect(() => {
    if (selected) {
      const updated = tickets.find(t => t.id === selected.id);
      setSelected(updated || null);
    }
  }, [tickets]);

  const newCount = tickets.filter(t => !t.seen).length;
  const urgentCount = tickets.filter(t => t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed').length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-white/5 flex items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-white">Customer Support</h1>
          <div className="flex items-center gap-3 mt-0.5">
            {newCount > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-red-400 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                {newCount} unseen
              </span>
            )}
            {urgentCount > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-orange-400">
                <AlertCircle className="w-3 h-3" />
                {urgentCount} urgent
              </span>
            )}
            {newCount === 0 && urgentCount === 0 && (
              <span className="text-white/25 text-xs">{tickets.length} tickets total</span>
            )}
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 ml-auto bg-void-lighter rounded-xl p-1">
          {STATUS_TABS.map(t => {
            const count = t.id === 'all' ? tickets.length : tickets.filter(x => x.status === t.id).length;
            const isNew = t.id === 'new' && tickets.filter(x => x.status === 'new' && !x.seen).length > 0;
            return (
              <button key={t.id} onClick={() => setStatusFilter(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all relative ${
                  statusFilter === t.id ? 'bg-void-light text-white' : 'text-white/40 hover:text-white/60'
                }`}>
                {isNew && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />}
                {t.label}
                {count > 0 && <span className="text-white/30 text-[10px]">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Ticket list */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence>
            {tickets.map(ticket => (
              <TicketRow
                key={ticket.id}
                ticket={ticket}
                isSelected={selected?.id === ticket.id}
                onClick={() => setSelected(selected?.id === ticket.id ? null : ticket)}
              />
            ))}
          </AnimatePresence>
          {tickets.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <CheckCircle className="w-10 h-10 text-white/10 mb-3" />
              <p className="text-white/30 font-semibold">No tickets</p>
              <p className="text-white/15 text-sm mt-1">All clear</p>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selected && (
            <TicketDetail ticket={selected} onClose={() => setSelected(null)} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
