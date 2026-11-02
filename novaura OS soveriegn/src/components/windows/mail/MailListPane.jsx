import React from 'react';
import {
  Search, Star, Paperclip, Lock, AlertTriangle, Flame,
  CheckSquare, Square, Archive, Trash2, MailCheck, Filter, RefreshCw
} from 'lucide-react';

export default function MailListPane({
  mails = [],
  selectedMail,
  onSelectMail,
  onToggleStar,
  onDeleteMail,
  onArchiveMail,
  searchQuery,
  onSearchChange,
  currentCategory,
  onSelectCategory,
  selectedMailIds = new Set(),
  onToggleSelectId,
  onSelectAll,
  onMarkAllRead,
  focusedIndex,
  onRefresh,
}) {
  const allSelected = mails.length > 0 && selectedMailIds.size === mails.length;

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getCleanSender = (mail) => {
    const raw = mail.sender || mail.from || 'unknown';
    const clean = raw.includes('@') ? raw.split('@')[0] : raw;
    return mail.senderName || clean;
  };

  return (
    <div className="w-80 md:w-96 bg-slate-900/60 border-r border-slate-800/80 flex flex-col shrink-0 select-none font-sans overflow-hidden">
      {/* Search Bar & Instant Filter */}
      <div className="p-3 border-b border-slate-800/80 space-y-2">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search mail or press / ..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-12 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500/60 transition-colors"
          />
          <kbd className="absolute right-2.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
            /
          </kbd>
        </div>

        {/* Action Toolbar & Batch Controls */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={onSelectAll}
              className="flex items-center gap-1.5 hover:text-slate-200 transition-colors p-1 rounded"
              title={allSelected ? 'Deselect All' : 'Select All'}
            >
              {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" /> : <Square className="w-3.5 h-3.5" />}
              <span className="text-[11px]">{selectedMailIds.size > 0 ? `${selectedMailIds.size} selected` : 'Select'}</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            {selectedMailIds.size > 0 ? (
              <>
                <button
                  onClick={onArchiveMail}
                  className="p-1 hover:text-cyan-400 transition-colors rounded hover:bg-slate-800"
                  title="Archive selected (E)"
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onDeleteMail}
                  className="p-1 hover:text-red-400 transition-colors rounded hover:bg-slate-800"
                  title="Delete selected (#)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onMarkAllRead}
                  className="p-1 text-slate-400 hover:text-cyan-400 transition-colors rounded hover:bg-slate-800"
                  title="Mark all as read"
                >
                  <MailCheck className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onRefresh}
                  className="p-1 text-slate-400 hover:text-cyan-400 transition-colors rounded hover:bg-slate-800"
                  title="Refresh mail from mesh"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mail List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 custom-scrollbar">
        {mails.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center p-6 text-center text-slate-500">
            <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center mb-3 text-slate-600">
              <MailCheck className="w-6 h-6" />
            </div>
            <div className="text-xs font-semibold text-slate-400">Inbox Zero Achieved</div>
            <p className="text-[11px] text-slate-600 mt-1 max-w-[200px]">
              No messages found. P2P mesh radio is actively listening for incoming packets.
            </p>
          </div>
        ) : (
          mails.map((mail, idx) => {
            const isSelected = selectedMail?.id === mail.id;
            const isChecked = selectedMailIds.has(mail.id);
            const isFocused = focusedIndex === idx;
            const isHighPriority = mail.priority === 'high' || /urgent|asap|critical/i.test(mail.subject || '');
            const senderName = getCleanSender(mail);

            return (
              <div
                key={mail.id}
                onClick={() => onSelectMail(mail)}
                className={`relative px-3.5 py-3 flex items-start gap-2.5 transition-all cursor-pointer group ${
                  isSelected
                    ? 'bg-cyan-950/40 border-l-2 border-cyan-400'
                    : isFocused
                    ? 'bg-slate-800/50 border-l-2 border-slate-500'
                    : !mail.read
                    ? 'bg-slate-900/90 hover:bg-slate-800/60'
                    : 'hover:bg-slate-900/40 opacity-80 hover:opacity-100'
                }`}
              >
                {/* Checkbox / Selection Toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelectId(mail.id);
                  }}
                  className="mt-1 text-slate-500 hover:text-cyan-400 p-0.5 rounded transition-colors"
                >
                  {isChecked ? (
                    <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                  ) : (
                    <Square className="w-3.5 h-3.5 group-hover:text-slate-400 text-transparent" />
                  )}
                </button>

                {/* Unread Glow Pip */}
                {!mail.read && (
                  <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400 mt-1.5 shrink-0 animate-pulse" />
                )}

                {/* Mail Row Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5 truncate">
                      {isHighPriority && (
                        <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-bounce" title="High Priority Flame" />
                      )}
                      <span className={`text-xs truncate ${!mail.read ? 'font-bold text-slate-100' : 'font-medium text-slate-300'}`}>
                        {senderName}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                      {formatTimestamp(mail.timestamp)}
                    </span>
                  </div>

                  {/* Subject Line */}
                  <div className={`text-xs truncate mb-1 ${!mail.read ? 'font-semibold text-cyan-100' : 'text-slate-300'}`}>
                    {mail.subject || '(No Subject)'}
                  </div>

                  {/* 1-Line AI Synopsis Pill */}
                  {mail.aiSynopsis && (
                    <div className="inline-block max-w-full text-[10px] text-cyan-300 bg-cyan-950/60 border border-cyan-800/40 rounded px-1.5 py-0.5 truncate mb-1">
                      ⚡ {mail.aiSynopsis}
                    </div>
                  )}

                  {/* Metadata Icons: Encryption, Attachments, Delivery Warnings */}
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                    {mail.isEncryptedE2EE && (
                      <span className="flex items-center gap-1 text-emerald-400" title="End-to-End Encrypted via X25519">
                        <Lock className="w-3 h-3" />
                        <span>E2EE</span>
                      </span>
                    )}

                    {mail.attachments && mail.attachments.length > 0 && (
                      <span className="flex items-center gap-0.5 text-cyan-400" title={`${mail.attachments.length} attachment(s)`}>
                        <Paperclip className="w-3 h-3" />
                        <span>{mail.attachments.length}</span>
                      </span>
                    )}

                    {mail.deliveryStatus === 'undelivered' && (
                      <span className="flex items-center gap-1 text-red-400" title={mail.deliveryError || 'Failed to deliver'}>
                        <AlertTriangle className="w-3 h-3" />
                        <span>Undelivered</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Star Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleStar(mail.id);
                  }}
                  className="mt-0.5 text-slate-500 hover:text-amber-400 p-0.5 transition-colors"
                >
                  <Star
                    className={`w-3.5 h-3.5 ${
                      mail.starred ? 'fill-amber-400 text-amber-400' : 'text-slate-600 hover:text-slate-400'
                    }`}
                  />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
