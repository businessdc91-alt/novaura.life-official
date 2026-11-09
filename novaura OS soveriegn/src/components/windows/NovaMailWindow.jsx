import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Mail, X } from 'lucide-react';
import { db } from '../../database/sovereignDatabase.js';
import {
  getInbox, getSentMail, getDrafts, sendMail, markAsRead,
  toggleStar, deleteMail, getUnreadCount, getLocalIdentity
} from '../../services/sovereignMesh.js';
import { triageInboxMail } from '../../services/mailAiService.js';
import MailSidebar from './mail/MailSidebar.jsx';
import MailListPane from './mail/MailListPane.jsx';
import MailReadingPane from './mail/MailReadingPane.jsx';
import MailComposerModal from './mail/MailComposerModal.jsx';
import MailKeyboardShortcutsModal from './mail/MailKeyboardShortcutsModal.jsx';

export default function NovaMailWindow({ onClose }) {
  const [currentFolder, setCurrentFolder] = useState('inbox');
  const [currentCategory, setCurrentCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [allMails, setAllMails] = useState([]);
  const [selectedMail, setSelectedMail] = useState(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [selectedMailIds, setSelectedMailIds] = useState(new Set());
  const [composing, setComposing] = useState(false);
  const [composeDefaults, setComposeDefaults] = useState({ to: '', subject: '', body: '' });
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [starredCount, setStarredCount] = useState(0);
  const [draftsCount, setDraftsCount] = useState(0);
  // Messages already queued for triage, so reopening the inbox doesn't queue them again.
  const triageQueued = useRef(new Set());

  // Hydrate all emails from Dexie and in-memory mesh cache
  const refreshMails = useCallback(async () => {
    try {
      let list = [];
      if (currentFolder === 'inbox') {
        const memInbox = getInbox();
        const dbInbox = await db.mailbox.where('box').equals('inbox').toArray().catch(() => []);
        // Merge without duplicates
        const map = new Map();
        [...memInbox, ...dbInbox].forEach(m => {
          if (m?.id && !map.has(m.id)) map.set(m.id, m);
        });
        list = Array.from(map.values());
      } else if (currentFolder === 'sent') {
        const memSent = getSentMail();
        const dbSent = await db.mailbox.where('box').equals('sent').toArray().catch(() => []);
        const map = new Map();
        [...memSent, ...dbSent].forEach(m => {
          if (m?.id && !map.has(m.id)) map.set(m.id, m);
        });
        list = Array.from(map.values());
      } else if (currentFolder === 'drafts') {
        list = await db.mailbox.where('box').equals('drafts').toArray().catch(() => getDrafts());
      } else if (currentFolder === 'starred') {
        list = await db.mailbox.where('starred').equals(true).toArray().catch(() => []);
      } else if (currentFolder === 'archive') {
        list = await db.mailbox.where('box').equals('archive').toArray().catch(() => []);
      } else if (currentFolder === 'trash') {
        list = await db.mailbox.where('box').equals('trash').toArray().catch(() => []);
      }

      // Sort by newest first
      list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setAllMails(list);

      // Update counters
      setUnreadCount(getUnreadCount());
      const st = await db.mailbox.where('starred').equals(true).count().catch(() => 0);
      setStarredCount(st);
      const dr = await db.mailbox.where('box').equals('drafts').count().catch(() => 0);
      setDraftsCount(dr);

      // Triage untriaged inbox mail in the background, one message at a time
      // (on this machine only; see mailAiService.js).
      if (currentFolder === 'inbox') {
        const pending = list.filter(m => !m.aiSynopsis && !m.triaged && !triageQueued.current.has(m.id));
        pending.forEach(m => triageQueued.current.add(m.id));
        (async () => {
          for (const m of pending) {
            try {
              const triage = await triageInboxMail(m);
              if (!triage) continue;
              const updated = {
                ...m,
                priority: triage.priority,
                aiSynopsis: triage.synopsis,
                category: triage.category,
                actionRequired: triage.actionRequired,
                triageSource: triage.source,
                triaged: true,
              };
              db.mailbox.update(m.id, updated).catch(() => {});
              setAllMails(prev => prev.map(p => p.id === m.id ? updated : p));
            } catch { /* leave it untriaged */ }
          }
        })();
      }
    } catch (e) {
      console.warn('[NovaMail] Mail refresh note:', e);
    }
  }, [currentFolder]);

  useEffect(() => {
    refreshMails();
  }, [refreshMails]);

  // Real-time mesh listeners
  useEffect(() => {
    const handleUpdate = () => refreshMails();
    window.addEventListener('novaura:mesh_updated', handleUpdate);
    window.addEventListener('novaura:mail_received', handleUpdate);
    window.addEventListener('novaura:mail_sent', handleUpdate);
    window.addEventListener('novaura:mail_delivery_failed', handleUpdate);
    return () => {
      window.removeEventListener('novaura:mesh_updated', handleUpdate);
      window.removeEventListener('novaura:mail_received', handleUpdate);
      window.removeEventListener('novaura:mail_sent', handleUpdate);
      window.removeEventListener('novaura:mail_delivery_failed', handleUpdate);
    };
  }, [refreshMails]);

  // Filtered mails based on category and search query
  const filteredMails = useMemo(() => {
    return allMails.filter(m => {
      // Category filter (inbox only)
      if (currentFolder === 'inbox' && currentCategory !== 'all') {
        if (currentCategory === 'swarm') {
          const isSwarm = m.category === 'swarm' || /mesh|relay|node|swarm|genesis|p2p/i.test(m.subject + (m.sender || ''));
          if (!isSwarm) return false;
        } else if (currentCategory === 'alerts') {
          const isAlert = m.category === 'alerts' || /alert|critical|security|emergency|failure/i.test(m.subject + (m.body || ''));
          if (!isAlert) return false;
        } else if (currentCategory === 'primary') {
          const isSpecial = /mesh|relay|node|swarm|genesis|p2p|alert|critical/i.test(m.subject + (m.sender || ''));
          if (m.category !== 'primary' && isSpecial) return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          (m.subject || '').toLowerCase().includes(q) ||
          (m.body || '').toLowerCase().includes(q) ||
          (m.sender || '').toLowerCase().includes(q) ||
          (m.recipient || '').toLowerCase().includes(q) ||
          (m.aiSynopsis || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [allMails, currentFolder, currentCategory, searchQuery]);

  // Handle email selection & read state
  const handleSelectMail = (mail) => {
    setSelectedMail(mail);
    if (!mail.read && currentFolder === 'inbox') {
      markAsRead(mail.id);
      db.mailbox.update(mail.id, { read: true }).catch(() => {});
      setAllMails(prev => prev.map(m => m.id === mail.id ? { ...m, read: true } : m));
    }
  };

  // Toggle star
  const handleToggleStar = (mailId) => {
    toggleStar(mailId);
    setAllMails(prev => prev.map(m => m.id === mailId ? { ...m, starred: !m.starred } : m));
    if (selectedMail?.id === mailId) {
      setSelectedMail(prev => ({ ...prev, starred: !prev.starred }));
    }
  };

  // Archive mail
  const handleArchiveMail = (mailId = null) => {
    const idsToArchive = mailId ? [mailId] : Array.from(selectedMailIds);
    if (idsToArchive.length === 0 && selectedMail) idsToArchive.push(selectedMail.id);

    idsToArchive.forEach(id => {
      db.mailbox.update(id, { box: 'archive' }).catch(() => {});
    });

    setAllMails(prev => prev.filter(m => !idsToArchive.includes(m.id)));
    if (idsToArchive.includes(selectedMail?.id)) {
      setSelectedMail(null);
    }
    setSelectedMailIds(new Set());
  };

  // Delete mail
  const handleDeleteMail = (mailId = null) => {
    const idsToDelete = mailId ? [mailId] : Array.from(selectedMailIds);
    if (idsToDelete.length === 0 && selectedMail) idsToDelete.push(selectedMail.id);

    idsToDelete.forEach(id => {
      deleteMail(id, currentFolder);
      db.mailbox.update(id, { box: 'trash' }).catch(() => {});
    });

    setAllMails(prev => prev.filter(m => !idsToDelete.includes(m.id)));
    if (idsToDelete.includes(selectedMail?.id)) {
      setSelectedMail(null);
    }
    setSelectedMailIds(new Set());
  };

  // Mark all as read
  const handleMarkAllRead = () => {
    filteredMails.forEach(m => {
      if (!m.read) {
        markAsRead(m.id);
        db.mailbox.update(m.id, { read: true }).catch(() => {});
      }
    });
    setAllMails(prev => prev.map(m => ({ ...m, read: true })));
  };

  // Batch selection
  const handleToggleSelectId = (id) => {
    setSelectedMailIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedMailIds.size === filteredMails.length) {
      setSelectedMailIds(new Set());
    } else {
      setSelectedMailIds(new Set(filteredMails.map(m => m.id)));
    }
  };

  // Send new message
  const handleSendCompose = (msg) => {
    sendMail(msg);
    refreshMails();
  };

  // Inline quick reply handler
  const handleSendInlineReply = async ({ to, subject, body, threadId }) => {
    sendMail({ to, subject, body, threadId, inReplyTo: selectedMail?.id || null });
    refreshMails();
  };

  // Attachment download. Only a data: URL is saved, through a Blob: a link to a
  // website would navigate the Sovereign window to it instead of downloading.
  const handleDownloadAttachment = (att) => {
    if (!att || typeof att.dataUrl !== 'string' || !/^data:/i.test(att.dataUrl)) return;
    const comma = att.dataUrl.indexOf(',');
    if (comma < 0) return;
    const meta = att.dataUrl.slice(5, comma);
    const body = att.dataUrl.slice(comma + 1);
    let bytes;
    try {
      bytes = /;base64$/i.test(meta)
        ? Uint8Array.from(atob(body), c => c.charCodeAt(0))
        : new TextEncoder().encode(decodeURIComponent(body));
    } catch {
      return;
    }
    const blob = new Blob([bytes], { type: meta.split(';')[0] || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.name || 'attachment';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  // Superhuman Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input or textarea
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) {
        if (e.key === 'Escape') {
          e.target.blur();
        }
        return;
      }

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setComposeDefaults({ to: '', subject: '', body: '' });
        setComposing(true);
      } else if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = Math.min(prev + 1, filteredMails.length - 1);
          if (filteredMails[next]) handleSelectMail(filteredMails[next]);
          return next;
        });
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = Math.max(prev - 1, 0);
          if (filteredMails[next]) handleSelectMail(filteredMails[next]);
          return next;
        });
      } else if (e.key === 'Enter') {
        if (filteredMails[focusedIndex]) {
          handleSelectMail(filteredMails[focusedIndex]);
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (selectedMail) {
          e.preventDefault();
          setComposeDefaults({
            to: selectedMail.sender || selectedMail.from,
            subject: selectedMail.subject.startsWith('Re:') ? selectedMail.subject : `Re: ${selectedMail.subject}`,
            body: `\n\n--- On ${new Date(selectedMail.timestamp).toLocaleString()} ${selectedMail.sender} wrote:\n> ${selectedMail.body}`,
          });
          setComposing(true);
        }
      } else if (e.key === 's' || e.key === 'S') {
        if (selectedMail) {
          e.preventDefault();
          handleToggleStar(selectedMail.id);
        }
      } else if (e.key === 'e' || e.key === 'E') {
        if (selectedMail) {
          e.preventDefault();
          handleArchiveMail(selectedMail.id);
        }
      } else if (e.key === '#') {
        if (selectedMail) {
          e.preventDefault();
          handleDeleteMail(selectedMail.id);
        }
      } else if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search mail"]');
        if (searchInput) searchInput.focus();
      } else if (e.key === '?') {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
      } else if (e.key === 'Escape') {
        setSelectedMail(null);
        setComposing(false);
        setShowShortcutsModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredMails, focusedIndex, selectedMail]);

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      {/* Superhuman Top Header Ribbon */}
      <div className="h-11 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-500/20">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs tracking-wide text-white">NovaMail</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/40">
                Superhuman P2P
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors"
            title="Shortcuts (?)"
          >
            <kbd className="font-mono text-[10px] px-1 bg-slate-800 border border-slate-700 rounded">?</kbd>
            <span className="hidden sm:inline">Shortcuts</span>
          </button>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3-Column Enterprise Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Column 1: Sidebar */}
        <MailSidebar
          currentFolder={currentFolder}
          onSelectFolder={(f) => { setCurrentFolder(f); setSelectedMail(null); }}
          currentCategory={currentCategory}
          onSelectCategory={(c) => setCurrentCategory(c)}
          unreadCount={unreadCount}
          starredCount={starredCount}
          draftsCount={draftsCount}
          onOpenCompose={() => {
            setComposeDefaults({ to: '', subject: '', body: '' });
            setComposing(true);
          }}
          onToggleShortcuts={() => setShowShortcutsModal(prev => !prev)}
        />

        {/* Column 2: Mail List Pane */}
        <MailListPane
          mails={filteredMails}
          selectedMail={selectedMail}
          onSelectMail={handleSelectMail}
          onToggleStar={handleToggleStar}
          onDeleteMail={handleDeleteMail}
          onArchiveMail={handleArchiveMail}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          currentCategory={currentCategory}
          onSelectCategory={setCurrentCategory}
          selectedMailIds={selectedMailIds}
          onToggleSelectId={handleToggleSelectId}
          onSelectAll={handleSelectAll}
          onMarkAllRead={handleMarkAllRead}
          focusedIndex={focusedIndex}
          onRefresh={refreshMails}
        />

        {/* Column 3: Mail Reading Pane */}
        <MailReadingPane
          mail={selectedMail}
          onReply={() => {
            setComposeDefaults({
              to: selectedMail.sender || selectedMail.from,
              subject: selectedMail.subject.startsWith('Re:') ? selectedMail.subject : `Re: ${selectedMail.subject}`,
              body: `\n\n--- On ${new Date(selectedMail.timestamp).toLocaleString()} ${selectedMail.sender} wrote:\n> ${selectedMail.body}`,
            });
            setComposing(true);
          }}
          onReplyAll={() => {
            setComposeDefaults({
              to: `${selectedMail.sender}, ${selectedMail.recipient}`,
              subject: selectedMail.subject.startsWith('Re:') ? selectedMail.subject : `Re: ${selectedMail.subject}`,
              body: `\n\n--- On ${new Date(selectedMail.timestamp).toLocaleString()}:\n> ${selectedMail.body}`,
            });
            setComposing(true);
          }}
          onForward={() => {
            setComposeDefaults({
              to: '',
              subject: `Fwd: ${selectedMail.subject}`,
              body: `\n\n---------- Forwarded message ---------\nFrom: ${selectedMail.sender}\nDate: ${new Date(selectedMail.timestamp).toLocaleString()}\nSubject: ${selectedMail.subject}\n\n${selectedMail.body}`,
            });
            setComposing(true);
          }}
          onToggleStar={handleToggleStar}
          onArchive={handleArchiveMail}
          onDelete={handleDeleteMail}
          onSendInlineReply={handleSendInlineReply}
          onDownloadAttachment={handleDownloadAttachment}
        />
      </div>

      {/* Floating Modal Composer */}
      <MailComposerModal
        isOpen={composing}
        onClose={() => setComposing(false)}
        onSend={handleSendCompose}
        initialTo={composeDefaults.to}
        initialSubject={composeDefaults.subject}
        initialBody={composeDefaults.body}
      />

      {/* Keyboard Shortcuts Reference Modal */}
      <MailKeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
}
