import React, { useState, useEffect, useRef } from 'react';
import {
  Send, X, Paperclip, Sparkles, Lock, AlertTriangle,
  Minus, Maximize2, Minimize2, Check, FileText, Trash2
} from 'lucide-react';
import { db } from '../../../database/sovereignDatabase.js';
import { resolveRecipientPublicKey, getConnectedPeers, MAX_MAIL_ATTACHMENT_BYTES } from '../../../services/sovereignMesh.js';
import { polishMailDraft } from '../../../services/mailAiService.js';
import { formatBytes } from '../../../config/meshLimits.js';

export default function MailComposerModal({
  isOpen,
  onClose,
  onSend,
  initialTo = '',
  initialSubject = '',
  initialBody = '',
  onSaveDraft,
}) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [attachments, setAttachments] = useState([]);
  const [notice, setNotice] = useState('');
  const [recipientKey, setRecipientKey] = useState(null);
  const [resolvingKey, setResolvingKey] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [showAiMenu, setShowAiMenu] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [showContactDropdown, setShowContactDropdown] = useState(false);

  const fileInputRef = useRef(null);

  // Sync initial props
  useEffect(() => {
    setTo(initialTo);
    setSubject(initialSubject);
    setBody(initialBody);
  }, [initialTo, initialSubject, initialBody]);

  // Load contacts for autocomplete
  useEffect(() => {
    const loadContacts = async () => {
      try {
        const stored = await db.contacts.toArray();
        const peers = getConnectedPeers();
        const combined = [
          ...stored.map(c => ({
            name: c.handle || c.name || c.address,
            address: c.address || (c.handle ? `${c.handle}@nova.node` : null),
            pub: c.publicKey,
          })),
          ...peers.map(p => ({
            name: p.name || p.id,
            address: p.address || (p.name ? `${p.name}@nova.node` : null),
            pub: p.publicKey,
          })),
        ].filter(c => c.address);

        setContacts(combined);
      } catch {}
    };
    if (isOpen) loadContacts();
  }, [isOpen]);

  // Check recipient encryption key whenever `to` changes
  useEffect(() => {
    if (!to.trim()) {
      setRecipientKey(null);
      return;
    }
    setResolvingKey(true);
    const timer = setTimeout(() => {
      resolveRecipientPublicKey(to)
        .then(key => setRecipientKey(key))
        .catch(() => setRecipientKey(null))
        .finally(() => setResolvingKey(false));
    }, 400);

    return () => clearTimeout(timer);
  }, [to]);

  // Handle contact autocomplete filtering
  const handleToChange = (val) => {
    setTo(val);
    if (val.trim()) {
      const q = val.toLowerCase();
      const matches = contacts.filter(c =>
        c.name.toLowerCase().includes(q) || (c.address && c.address.toLowerCase().includes(q))
      );
      setFilteredContacts(matches);
      setShowContactDropdown(matches.length > 0);
    } else {
      setShowContactDropdown(false);
    }
  };

  const handleSelectContact = (c) => {
    setTo(c.address || c.name);
    setShowContactDropdown(false);
  };

  // Attach local file
  // Mail travels as one sealed mesh packet, so attachments must stay small
  // (see MAX_MAIL_ATTACHMENT_BYTES in sovereignMesh.js).
  const handleAttachFile = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const already = attachments.reduce((n, a) => n + (a.size || 0), 0);
    const adding = Array.from(files).reduce((n, f) => n + f.size, 0);
    e.target.value = '';
    if (already + adding > MAX_MAIL_ATTACHMENT_BYTES) {
      setNotice(`Mail attachments are limited to ${formatBytes(MAX_MAIL_ATTACHMENT_BYTES)} in total (mail goes over the mesh in one packet). Send bigger files from Sovereign Network → Transfers, which has no size limit.`);
      return;
    }
    setNotice('');

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments(prev => [
          ...prev,
          {
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: reader.result,
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveAttachment = (idx) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  // AI Polish
  const handlePolish = async (tone) => {
    setShowAiMenu(false);
    setPolishing(true);
    try {
      const polished = await polishMailDraft({
        draftSubject: subject,
        draftBody: body,
        tone,
      });
      if (polished) {
        if (polished.subject) setSubject(polished.subject);
        if (polished.body) setBody(polished.body);
      }
      setNotice('');
    } catch (err) {
      setNotice(`Draft left unchanged: ${err.message}`);
    } finally {
      setPolishing(false);
    }
  };

  const handleSubmit = () => {
    if (!to.trim() || !subject.trim()) return;
    onSend({
      to: to.trim(),
      subject: subject.trim(),
      body: body.trim(),
      attachments,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed z-50 transition-all font-sans select-none ${
      isMaximized
        ? 'inset-4 flex flex-col'
        : isMinimized
        ? 'bottom-4 right-8 w-80'
        : 'bottom-6 right-10 w-[580px] max-w-[90vw]'
    }`}>
      <div className="bg-slate-900/95 border border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-950/60 overflow-hidden flex flex-col backdrop-blur-md">
        {/* Modal Window Header */}
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-bold text-slate-100">
              {subject ? subject : 'New Message'}
            </span>
          </div>

          <div className="flex items-center gap-1 text-slate-400">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
              title={isMinimized ? 'Restore' : 'Minimize'}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setIsMaximized(!isMaximized); setIsMinimized(false); }}
              className="p-1 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Minimized Bar only */}
        {!isMinimized && (
          <>
            {/* Recipients & Subject Fields */}
            <div className="p-4 space-y-2.5 border-b border-slate-800/80">
              {/* "To" Field with live encryption indicator */}
              <div className="relative flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 w-12 shrink-0">To:</span>
                <input
                  type="text"
                  value={to}
                  onChange={(e) => handleToChange(e.target.value)}
                  placeholder="handle@nova.node or peer address..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus:border-cyan-500/60 font-mono"
                />

                {/* Recipient Encryption Badge */}
                {to.trim() && (
                  <div className="shrink-0 flex items-center">
                    {recipientKey ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-full" title="Peer public key verified">
                        <Lock className="w-3 h-3" />
                        <span>E2EE Ready</span>
                      </span>
                    ) : resolvingKey ? (
                      <span className="text-[10px] text-slate-400 animate-pulse">Resolving...</span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/80 border border-amber-500/30 px-2 py-0.5 rounded-full" title="No public key known on mesh">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Local Loopback</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Autocomplete Dropdown */}
                {showContactDropdown && filteredContacts.length > 0 && (
                  <div className="absolute top-full left-14 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                    {filteredContacts.map((c, i) => (
                      <div
                        key={i}
                        onClick={() => handleSelectContact(c)}
                        className="px-3 py-2 text-xs hover:bg-slate-800 cursor-pointer flex items-center justify-between text-slate-200"
                      >
                        <div className="font-semibold">{c.name}</div>
                        <div className="text-[11px] font-mono text-cyan-400">{c.address}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Subject Field */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 w-12 shrink-0">Subject:</span>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject line..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus:border-cyan-500/60 font-sans"
                />
              </div>
            </div>

            {/* Message Body Editor */}
            <div className="flex-1 p-4 flex flex-col min-h-[220px]">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your sovereign dispatch..."
                className="w-full flex-1 bg-slate-950/40 border-none p-0 text-xs text-slate-100 placeholder:text-slate-600 outline-none resize-none font-sans leading-relaxed"
              />
            </div>

            {notice && (
              <div className="px-4 py-2 border-t border-slate-800/60 text-[11px] text-amber-300">{notice}</div>
            )}

            {/* Attachments Chip Row */}
            {attachments.length > 0 && (
              <div className="px-4 py-2 border-t border-slate-800/60 flex flex-wrap gap-2">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-[11px] text-slate-200"
                  >
                    <Paperclip className="w-3 h-3 text-cyan-400" />
                    <span className="max-w-[150px] truncate">{att.name}</span>
                    <button
                      onClick={() => handleRemoveAttachment(idx)}
                      className="text-slate-400 hover:text-red-400 ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Send Button */}
                <button
                  onClick={handleSubmit}
                  disabled={!to.trim() || !subject.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                  <kbd className="text-[10px] font-mono px-1 rounded bg-black/30 text-cyan-200">↵</kbd>
                </button>

                {/* Attach File Button */}
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleAttachFile}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-slate-900 transition-colors"
                  title="Attach File"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                {/* AI Polish Trigger & Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowAiMenu(!showAiMenu)}
                    disabled={polishing || !body.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-cyan-300 bg-slate-900 border border-slate-800 hover:border-cyan-500/40 transition-all disabled:opacity-40"
                    title="AI Polish Draft"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{polishing ? 'Polishing...' : 'AI Polish'}</span>
                  </button>

                  {showAiMenu && (
                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1 z-30 space-y-0.5">
                      <button
                        onClick={() => handlePolish('professional')}
                        className="w-full text-left px-3 py-1.5 rounded-lg text-xs hover:bg-slate-800 text-slate-200"
                      >
                        Executive Professional
                      </button>
                      <button
                        onClick={() => handlePolish('concise')}
                        className="w-full text-left px-3 py-1.5 rounded-lg text-xs hover:bg-slate-800 text-slate-200"
                      >
                        Superhuman Concise
                      </button>
                      <button
                        onClick={() => handlePolish('friendly')}
                        className="w-full text-left px-3 py-1.5 rounded-lg text-xs hover:bg-slate-800 text-slate-200"
                      >
                        Warm & Friendly
                      </button>
                      <button
                        onClick={() => handlePolish('persuasive')}
                        className="w-full text-left px-3 py-1.5 rounded-lg text-xs hover:bg-slate-800 text-slate-200"
                      >
                        Persuasive Pitch
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                  title="Discard Draft"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
