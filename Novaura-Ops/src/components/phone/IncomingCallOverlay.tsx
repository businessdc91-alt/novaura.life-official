import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, User, Bot } from 'lucide-react';
import { remove } from 'firebase/database';
import { ref } from 'firebase/database';
import { rtdb, auth } from '../../services/firebase';
import {
  subscribeIncomingCalls, acceptCall, declineCall, startRingTone,
  IncomingCall,
} from '../../services/phoneService';
import { voiceService } from '../../services/voiceService';
import { useAppStore } from '../../stores/appStore';

export default function IncomingCallOverlay() {
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const stopRing = useRef<(() => void) | null>(null);
  const { setActivePanel, setPendingNovaCall } = useAppStore();

  useEffect(() => {
    const unsub = subscribeIncomingCalls(call => {
      setIncoming(call);
      if (call) {
        stopRing.current?.();
        stopRing.current = startRingTone();
      } else {
        stopRing.current?.();
        stopRing.current = null;
      }
    });
    return () => { unsub(); stopRing.current?.(); };
  }, []);

  const handleAccept = async () => {
    if (!incoming) return;
    stopRing.current?.();
    stopRing.current = null;

    // Nova AI calls open the AI panel with alert context, no WebRTC
    if ((incoming as any).callerId === 'nova_ai') {
      const user = auth.currentUser;
      if (user) await remove(ref(rtdb, `phone_incoming/${user.uid}`));
      setPendingNovaCall({
        callId: incoming.callId,
        novaAlertId: (incoming as any).novaAlertId,
        novaMessage: (incoming as any).novaMessage,
      });
      setIncoming(null);
      setActivePanel('ai');
      return;
    }

    await acceptCall(incoming);
    try {
      await voiceService.joinRoom(incoming.roomId, { audio: true, video: false });
    } catch {}
    setIncoming(null);
    setActivePanel('phone' as any);
  };

  const handleDecline = async () => {
    if (!incoming) return;
    stopRing.current?.();
    stopRing.current = null;
    await declineCall(incoming);
    setIncoming(null);
  };

  return (
    <AnimatePresence>
      {incoming && (
        <motion.div
          initial={{ opacity: 0, y: -80, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -80, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="fixed top-6 left-1/2 z-[9999] -translate-x-1/2"
          style={{ width: 340 }}
        >
          <div
            className="rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: 'rgba(10,10,18,0.97)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(24px)',
            }}
          >
            {/* Animated glow bar */}
            <div
              className="h-1 w-full"
              style={{
                background: (incoming as any).callerId === 'nova_ai'
                  ? 'linear-gradient(90deg, #7c3aed, #ff0080, #7c3aed)'
                  : 'linear-gradient(90deg, #22c55e, #00f0ff, #22c55e)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s linear infinite',
              }}
            />

            <div className="px-5 py-4 flex items-center gap-4">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {(incoming as any).callerId === 'nova_ai' ? (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-purple-500/50"
                    style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(255,0,128,0.2))' }}>
                    <Bot className="w-6 h-6 text-purple-300" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-void-lighter border-2 border-green-400/40 flex items-center justify-center">
                    {incoming.callerPhoto
                      ? <img src={incoming.callerPhoto} alt="" className="w-full h-full object-cover" />
                      : <User className="w-6 h-6 text-white/40" />
                    }
                  </div>
                )}
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
                  style={{
                    borderColor: 'rgba(10,10,18,0.97)',
                    background: (incoming as any).callerId === 'nova_ai' ? '#a855f7' : '#4ade80',
                    animation: 'pulse 1s ease-in-out infinite',
                  }}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white/50 text-xs mb-0.5">
                  {(incoming as any).callerId === 'nova_ai' ? 'Nova AI needs your attention' : 'Incoming call'}
                </p>
                <p className="text-white font-bold text-sm truncate">{incoming.callerName}</p>
                {(incoming as any).callerId === 'nova_ai'
                  ? <p className="text-purple-400 text-xs truncate">{(incoming as any).novaMessage || 'Alert requires review'}</p>
                  : <p className="text-green-400 text-xs font-mono">Ext. {incoming.callerExt}</p>
                }
              </div>
            </div>

            {/* Buttons */}
            <div className="px-5 pb-4 flex gap-3">
              <button
                onClick={handleDecline}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:scale-105 active:scale-95"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                <PhoneOff className="w-4 h-4 text-red-400" />
                <span className="text-red-400">Decline</span>
              </button>
              <button
                onClick={handleAccept}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:scale-105 active:scale-95"
                style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}
              >
                <Phone className="w-4 h-4 text-green-400" />
                <span className="text-green-400">Answer</span>
              </button>
            </div>
          </div>

          <style>{`
            @keyframes shimmer { to { background-position: 200% 0; } }
            @keyframes pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.6; transform: scale(1.3); }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
