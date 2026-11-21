import React, { useState, useEffect } from 'react';
import {
  Reply, ReplyAll, Forward, Star, Archive, Trash2,
  Lock, ShieldCheck, AlertTriangle, Paperclip, Download,
  Sparkles, Send, X, Flame, ChevronDown, ChevronUp, Copy, Check
} from 'lucide-react';
import { generateMailSmartReplies } from '../../../services/mailAiService.js';

export default function MailReadingPane({
  mail,
  onReply,
  onReplyAll,
  onForward,
  onToggleStar,
  onArchive,
  onDelete,
  onSendInlineReply,
  onDownloadAttachment,
}) {
  const [smartReplies, setSmartReplies] = useState([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [showFullDossier, setShowFullDossier] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Load smart replies when mail changes
  useEffect(() => {
    if (!mail) return undefined;
    // Suggestions run on a local model only; a reply for a previously opened
    // message is ignored if it arrives after switching.
    let current = true;
    setReplyOpen(false);
    setReplyText('');
    setSmartReplies([]);
    setLoadingReplies(true);
    generateMailSmartReplies(mail)
      .then(replies => { if (current) setSmartReplies(replies || []); })
      .catch(() => { if (current) setSmartReplies([]); })
      .finally(() => { if (current) setLoadingReplies(false); });
    return () => { current = false; };
  }, [mail?.id]);

  if (!mail) {
    return (
      <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-8 text-center text-slate-500 font-sans select-none">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 mb-3 shadow-inner">
          <Reply className="w-8 h-8 opacity-40" />
        </div>
        <div className="text-sm font-semibold text-slate-400">Select a message to inspect</div>
        <p className="text-xs text-slate-600 mt-1 max-w-sm">
          Use <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">J</kbd> and <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">K</kbd> to quickly navigate your inbox at superhuman speed.
        </p>
      </div>
    );
  }

  const isHighPriority = mail.priority === 'high' || /urgent|asap|critical/i.test(mail.subject || '');
  // Set only on receipt, from the key whose signature checked out (sovereignMesh.js).
  const senderPub = /^did:nova:[0-9a-f]{64}$/.test(mail.senderDid || '') ? mail.senderDid.slice(9) : null;
  const shortPub = senderPub ? `${senderPub.substring(0, 10)}...${senderPub.substring(senderPub.length - 6)}` : null;
  const shortAddress = (addr) => (/^did:nova:/.test(addr || '') ? `${addr.slice(0, 19)}…${addr.slice(-6)}` : addr);

  const handleApplySmartReply = (reply) => {
    setReplyText(reply.replyText);
    setReplyOpen(true);
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      await onSendInlineReply({
        to: mail.sender || mail.from,
        subject: mail.subject.startsWith('Re:') ? mail.subject : `Re: ${mail.subject}`,
        body: replyText,
        threadId: mail.threadId || mail.id,
      });
      setReplyText('');
      setReplyOpen(false);
    } finally {
      setSendingReply(false);
    }
  };

  const copySenderId = () => {
    if (senderPub) {
      navigator.clipboard.writeText(senderPub);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  return (
    <div className="flex-1 bg-slate-950 flex flex-col font-sans overflow-hidden select-text">
      {/* Top Reading Action Bar */}
      <div className="h-12 px-5 bg-slate-900/70 border-b border-slate-800/80 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          {isHighPriority && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-full">
              <Flame className="w-3.5 h-3.5 fill-amber-400 animate-pulse" />
              <span>High Priority</span>
            </span>
          )}

          {mail.isEncryptedE2EE && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              <Lock className="w-3 h-3" />
              <span>End-to-end encrypted</span>
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 text-slate-400">
          <button
            onClick={() => { setReplyOpen(true); onReply(mail); }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-cyan-300 text-xs transition-colors"
            title="Reply (R)"
          >
            <Reply className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reply</span>
          </button>
          <button
            onClick={() => onArchive(mail.id)}
            className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-cyan-300 text-xs transition-colors"
            title="Archive (E)"
          >
            <Archive className="w-4 h-4" />
          </button>
          <button
            onClick={() => onToggleStar(mail.id)}
            className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-amber-400 text-xs transition-colors"
            title="Star (S)"
          >
            <Star className={`w-4 h-4 ${mail.starred ? 'fill-amber-400 text-amber-400' : ''}`} />
          </button>
          <button
            onClick={() => onDelete(mail.id)}
            className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-red-400 text-xs transition-colors"
            title="Delete (#)"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Message Content Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {/* Subject Header */}
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight leading-snug">
            {mail.subject || '(No Subject)'}
          </h1>
        </div>

        {/* Sender Dossier & Cryptographic Verification Card */}
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-sm shrink-0">
              {(mail.senderName || mail.sender || 'P')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-100">{mail.senderName || mail.sender}</span>
                <span className="text-xs text-cyan-400 font-mono">
                  &lt;{shortAddress(mail.sender || mail.from)}&gt;
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                to <span className="text-slate-300 font-mono">{mail.recipient || mail.to}</span>
              </div>

              {/* Cryptographic Node Signature Verification Badge */}
              {shortPub && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 rounded px-2 py-0.5 font-mono">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Signed by key {shortPub}</span>
                    <button
                      onClick={copySenderId}
                      className="ml-1 text-slate-400 hover:text-emerald-300"
                      title="Copy Public Key"
                    >
                      {copiedId ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  {!mail.senderIsContact && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-300/90">
                      <AlertTriangle className="w-3 h-3" />
                      Not in your contacts: the name is the sender&apos;s own claim
                    </span>
                  )}
                </div>
              )}

              {!shortPub && mail.box !== 'sent' && mail.folder !== 'sent' && mail.box !== 'drafts' && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-950/50 border border-amber-500/30 rounded px-2 py-0.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Unsigned / Unverified Sender — no Ed25519 DID signature attached</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-right text-xs text-slate-500 shrink-0 select-none">
            <div>{new Date(mail.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            <div className="font-mono text-[11px] mt-0.5">{new Date(mail.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>

        {/* Undelivered Diagnostic Alert */}
        {mail.deliveryStatus === 'undelivered' && (
          <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-200 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold text-red-300">Message Could Not Leave Local Node</div>
              <p className="mt-0.5 text-red-200/80 leading-relaxed">
                {mail.deliveryError || 'Recipient node public key was not found on the peer mesh. The message remains safe in your local private cloud vault.'}
              </p>
            </div>
          </div>
        )}

        {/* Message Body */}
        <div className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-sans min-h-[140px] px-1">
          {mail.body || '(Empty message body)'}
        </div>

        {/* Attachments Section */}
        {mail.attachments && mail.attachments.length > 0 && (
          <div className="pt-4 border-t border-slate-900 space-y-2">
            <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-cyan-400" />
              <span>Attachments ({mail.attachments.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {mail.attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs hover:border-cyan-500/40 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-slate-200 truncate">{att.name || `attachment_${idx + 1}`}</span>
                    {att.size && <span className="text-[10px] text-slate-500 font-mono">({Math.round(att.size / 1024)} KB)</span>}
                  </div>
                  <button
                    onClick={() => onDownloadAttachment(att)}
                    className="p-1 hover:text-cyan-400 text-slate-500 transition-colors"
                    title="Download Attachment"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Smart Replies Section */}
        <div className="pt-4 border-t border-slate-900 space-y-2.5 select-none">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Smart Reply Pills</span>
            {loadingReplies && <span className="text-[10px] text-cyan-400 animate-pulse ml-1">Analyzing thread...</span>}
          </div>

          <div className="flex flex-wrap gap-2">
            {smartReplies.map((reply, idx) => (
              <button
                key={idx}
                onClick={() => handleApplySmartReply(reply)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-cyan-500/40 text-xs transition-all cursor-pointer shadow-sm active:scale-95 text-left"
              >
                <span className="font-semibold text-cyan-400">{reply.label}:</span>
                <span className="text-slate-300 max-w-xs truncate">{reply.replyText}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Inline Quick Reply Drawer */}
        {replyOpen && (
          <div className="p-4 rounded-xl bg-slate-900 border border-cyan-500/30 space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-xs text-slate-400 select-none">
              <span className="font-semibold text-cyan-300">
                Replying to {mail.senderName || mail.sender}...
              </span>
              <button
                onClick={() => setReplyOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-1 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write your sovereign encrypted reply..."
              rows={4}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus:border-cyan-500/60 font-sans resize-none"
            />

            <div className="flex items-center justify-between select-none">
              <div className="flex items-center gap-2 text-[11px] text-emerald-400">
                <Lock className="w-3 h-3" />
                <span>P2P E2EE Guaranteed</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReplyOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={handleSendReply}
                  disabled={sendingReply || !replyText.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-md shadow-cyan-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingReply ? 'Encrypting & Sending...' : 'Send Reply'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
