import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { X, MessageCircleQuestion, Send, CheckCircle, Loader2 } from 'lucide-react';

type TicketType = 'bug' | 'billing' | 'account' | 'feature' | 'general';

const TYPES: { id: TicketType; label: string }[] = [
  { id: 'bug',     label: 'Bug / Error'       },
  { id: 'billing', label: 'Billing'            },
  { id: 'account', label: 'Account'            },
  { id: 'feature', label: 'Feature Request'    },
  { id: 'general', label: 'General Question'   },
];

export default function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TicketType>('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const user = auth?.currentUser;

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'support_tickets'), {
        userId:     user?.uid     || 'anonymous',
        userEmail:  user?.email   || 'unknown',
        userName:   user?.displayName || user?.email || 'Guest',
        userPhoto:  user?.photoURL || null,
        subject:    subject.trim(),
        message:    message.trim(),
        type,
        status:     'new',
        priority:   'normal',
        replies:    [],
        seen:       false,
        createdAt:  serverTimestamp(),
        updatedAt:  serverTimestamp(),
      });
      setSent(true);
      setSubject('');
      setMessage('');
      setTimeout(() => { setSent(false); setOpen(false); }, 3000);
    } catch {
      // fail silently — user can retry
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #ff0080)',
              boxShadow: '0 0 24px rgba(124,58,237,0.4)',
            }}
            title="Support"
          >
            <MessageCircleQuestion className="w-6 h-6 text-white" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed bottom-6 right-6 z-50 w-96 rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: 'rgba(10,10,18,0.97)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(20px)',
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4"
              style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(255,0,128,0.1))' }}>
              <MessageCircleQuestion className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-white font-bold text-sm">NovAura Support</p>
                <p className="text-white/40 text-xs">We usually respond within a few hours</p>
              </div>
              <button onClick={() => setOpen(false)} className="ml-auto text-white/30 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {sent ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <CheckCircle className="w-10 h-10 text-green-400" />
                <p className="text-white font-semibold">Ticket submitted!</p>
                <p className="text-white/40 text-sm text-center px-4">Our team has been notified and will respond shortly.</p>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {/* Type selector */}
                <div className="flex flex-wrap gap-1.5">
                  {TYPES.map(t => (
                    <button key={t.id} onClick={() => setType(t.id)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                      style={type === t.id
                        ? { background: 'rgba(124,58,237,0.25)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.4)' }
                        : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }
                      }>
                      {t.label}
                    </button>
                  ))}
                </div>

                <input
                  className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  placeholder="Subject..."
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  onFocus={e => e.target.style.borderColor = 'rgba(124,58,237,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />

                <textarea
                  className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none resize-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  rows={4}
                  placeholder="Describe your issue in detail..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onFocus={e => e.target.style.borderColor = 'rgba(124,58,237,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />

                {!user && (
                  <p className="text-yellow-400/70 text-xs">
                    Sign in to track your ticket status and receive replies.
                  </p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={sending || !subject.trim() || !message.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #ff0080)' }}
                >
                  {sending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                    : <><Send className="w-4 h-4" /> Send to Support</>
                  }
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
