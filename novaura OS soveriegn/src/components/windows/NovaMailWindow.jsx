import React, { useState, useEffect } from 'react';
import {
  Mail, Inbox, Send, FileText, Trash2, Plus, Search, Star,
  ArrowLeft, Paperclip, X, RefreshCw, Circle, CheckCircle2, AlertTriangle, Lock
} from 'lucide-react';
import {
  getInbox, getSentMail, getDrafts, sendMail, markAsRead,
  toggleStar, deleteMail, getUnreadCount, getLocalIdentity
} from '../../services/sovereignMesh';

export default function NovaMailWindow({ onClose }) {
  const [folder, setFolder] = useState('inbox');
  const [mails, setMails] = useState([]);
  const [selected, setSelected] = useState(null);
  const [composing, setComposing] = useState(false);
  const [unread, setUnread] = useState(0);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');

  const identity = getLocalIdentity();

  const refresh = () => {
    if (folder === 'inbox') setMails(getInbox());
    else if (folder === 'sent') setMails(getSentMail());
    else if (folder === 'drafts') setMails(getDrafts());
    setUnread(getUnreadCount());
  };

  useEffect(() => { refresh(); }, [folder]);

  // Pick up incoming mail and delivery-status changes from the mesh.
  useEffect(() => {
    const onUpdate = () => refresh();
    window.addEventListener('novaura:mesh_updated', onUpdate);
    window.addEventListener('novaura:mail_delivery_failed', onUpdate);
    return () => {
      window.removeEventListener('novaura:mesh_updated', onUpdate);
      window.removeEventListener('novaura:mail_delivery_failed', onUpdate);
    };
  }, [folder]);

  // Mail records store full addresses in sender/recipient; older records used from/to handles.
  const addr = (value) => {
    if (!value) return 'unknown';
    return value.includes('@') ? value : `${value}@nova.node`;
  };

  const handleSend = () => {
    if (!composeTo.trim() || !composeSubject.trim()) return;
    sendMail({ to: composeTo, subject: composeSubject, body: composeBody });
    setComposing(false);
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
    refresh();
  };

  const handleSelect = (mail) => {
    setSelected(mail);
    if (!mail.read && folder === 'inbox') {
      markAsRead(mail.id);
      refresh();
    }
  };

  const handleDelete = (id) => {
    deleteMail(id, folder);
    setSelected(null);
    refresh();
  };

  const handleStar = (id) => {
    toggleStar(id);
    refresh();
  };

  const folders = [
    { key: 'inbox', label: 'Inbox', icon: Inbox, badge: unread },
    { key: 'sent', label: 'Sent', icon: Send },
    { key: 'drafts', label: 'Drafts', icon: FileText },
  ];

  const formatTime = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#0a0f1e', color: '#e2e8f0', fontFamily: "'Inter', sans-serif", borderRadius: '8px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1rem', borderBottom: '1px solid rgba(0,240,255,0.15)', backgroundColor: 'rgba(15,23,42,0.9)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Mail size={18} color="#00f0ff" />
          <span style={{ fontWeight: 700, color: '#00f0ff', fontSize: '0.95rem' }}>NovaMail</span>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Sovereign P2P</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => { setComposing(true); setSelected(null); }} style={{ background: '#0284c7', border: 'none', color: '#fff', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Plus size={14} /> Compose
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: '180px', borderRight: '1px solid rgba(255,255,255,0.08)', padding: '0.75rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {folders.map(f => (
            <button key={f.key} onClick={() => { setFolder(f.key); setSelected(null); setComposing(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.65rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.82rem', backgroundColor: folder === f.key ? 'rgba(0,240,255,0.12)' : 'transparent', color: folder === f.key ? '#00f0ff' : '#94a3b8', width: '100%', textAlign: 'left' }}>
              <f.icon size={15} />
              <span style={{ flex: 1 }}>{f.label}</span>
              {f.badge > 0 && <span style={{ backgroundColor: '#0284c7', color: '#fff', borderRadius: '10px', padding: '0.1rem 0.4rem', fontSize: '0.68rem', fontWeight: 600 }}>{f.badge}</span>}
            </button>
          ))}
          <div style={{ marginTop: 'auto', padding: '0.5rem', fontSize: '0.7rem', color: '#475569', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div>Signed in as:</div>
            <div style={{ color: '#00f0ff', fontWeight: 600 }}>{identity?.handle || 'anon'}@nova.node</div>
          </div>
        </div>

        {/* Mail List or Compose */}
        {composing ? (
          <div style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f1f5f9' }}>New Message</div>
            <input value={composeTo} onChange={e => setComposeTo(e.target.value)} placeholder="To: handle@nova.node" style={{ padding: '0.6rem 0.8rem', backgroundColor: 'rgba(2,6,23,0.7)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '6px', color: '#e2e8f0', fontSize: '0.85rem', outline: 'none' }} />
            <input value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Subject" style={{ padding: '0.6rem 0.8rem', backgroundColor: 'rgba(2,6,23,0.7)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '6px', color: '#e2e8f0', fontSize: '0.85rem', outline: 'none' }} />
            <textarea value={composeBody} onChange={e => setComposeBody(e.target.value)} placeholder="Write your message..." rows={10} style={{ flex: 1, padding: '0.8rem', backgroundColor: 'rgba(2,6,23,0.7)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '6px', color: '#e2e8f0', fontSize: '0.85rem', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleSend} style={{ background: '#0284c7', border: 'none', color: '#fff', padding: '0.55rem 1.2rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}>Send</button>
              <button onClick={() => setComposing(false)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: '#94a3b8', padding: '0.55rem 1rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : selected ? (
          <div style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#00f0ff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', marginBottom: '1rem', padding: 0 }}>
              <ArrowLeft size={15} /> Back to {folder}
            </button>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.5rem' }}>{selected.subject || '(No Subject)'}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span>From: <strong style={{ color: '#38bdf8' }}>{addr(selected.sender || selected.from)}</strong> → To: <strong>{addr(selected.recipient || selected.to)}</strong></span>
              <span>{formatTime(selected.timestamp)}</span>
            </div>
            {selected.deliveryStatus === 'undelivered' && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.6rem 0.75rem', marginBottom: '1rem', borderRadius: '6px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: '0.78rem' }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                <span>Not delivered. {selected.deliveryError}</span>
              </div>
            )}
            {selected.isEncryptedE2EE && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem', color: '#34d399', fontSize: '0.75rem' }}>
                <Lock size={13} /> End-to-end encrypted
              </div>
            )}
            <div style={{ flex: 1, fontSize: '0.88rem', lineHeight: '1.7', color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>{selected.body || '(Empty message)'}</div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button onClick={() => handleStar(selected.id)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: selected.starred ? '#fbbf24' : '#94a3b8', padding: '0.4rem 0.7rem', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Star size={14} fill={selected.starred ? '#fbbf24' : 'none'} /> {selected.starred ? 'Starred' : 'Star'}
              </button>
              <button onClick={() => handleDelete(selected.id)} style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '0.4rem 0.7rem', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'auto' }}>
            {mails.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#475569', gap: '0.5rem' }}>
                <Mail size={36} />
                <span style={{ fontSize: '0.88rem' }}>No messages in {folder}</span>
              </div>
            ) : (
              mails.map(mail => (
                <div key={mail.id} onClick={() => handleSelect(mail)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', backgroundColor: !mail.read ? 'rgba(0,240,255,0.04)' : 'transparent' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: mail.read ? 'transparent' : '#0284c7', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: mail.read ? 400 : 600, color: mail.read ? '#94a3b8' : '#f1f5f9' }}>{folder === 'sent' ? `To: ${addr(mail.recipient || mail.to)}` : addr(mail.sender || mail.from)}</span>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', flexShrink: 0 }}>{formatTime(mail.timestamp)}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: mail.read ? 400 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mail.subject || '(No Subject)'}</div>
                  </div>
                  {mail.deliveryStatus === 'undelivered' && <AlertTriangle size={14} color="#f87171" title="Not delivered" />}
                  {mail.starred && <Star size={14} color="#fbbf24" fill="#fbbf24" />}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
