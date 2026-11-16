import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Zap, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { CONSENT_VERSION } from '../../services/trainingDataService';

const TrainingConsentModal: React.FC = () => {
  const { user, updateProfile } = useAuthStore();
  const [showDetails, setShowDetails] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  // Only show for authenticated users who haven't responded yet
  if (
    !user ||
    user.trainingConsentGiven !== undefined
  ) {
    return null;
  }

  const handleAccept = async () => {
    setAccepting(true);
    await updateProfile({
      trainingConsentGiven: true,
      trainingConsentAt: new Date().toISOString(),
      trainingConsentVersion: CONSENT_VERSION,
    });
    setAccepting(false);
  };

  const handleDecline = async () => {
    setDeclining(true);
    await updateProfile({
      trainingConsentGiven: false,
      trainingConsentAt: new Date().toISOString(),
      trainingConsentVersion: CONSENT_VERSION,
    });
    setDeclining(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-end justify-center p-4 sm:items-center pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ type: 'spring', damping: 24, stiffness: 280 }}
          className="pointer-events-auto w-full max-w-lg bg-void-light border border-white/10 rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.8),0_0_1px_rgba(0,240,255,0.1)] overflow-hidden"
        >
          {/* Top accent bar */}
          <div className="h-px bg-gradient-to-r from-transparent via-neon-cyan/40 to-transparent" />

          {/* Header */}
          <div className="px-6 pt-6 pb-4 flex items-start gap-4">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-neon-cyan" />
            </div>
            <div>
              <h2 className="text-[13px] font-bold uppercase tracking-widest text-text-primary mb-1">
                Neural Data Participation
              </h2>
              <p className="text-[11px] text-text-muted leading-relaxed">
                You're interacting with silicon minds. Every exchange — code, conversation, creative output — is a potential signal.
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 pb-4 space-y-3">
            <p className="text-[12px] text-text-secondary leading-relaxed">
              With your agreement, your conversations, code generations, and interactions on this platform may be anonymized and used as training material to advance the next generation of AI — including <span className="text-neon-cyan font-medium">Nova</span>, the model being built here.
            </p>

            <p className="text-[12px] text-text-secondary leading-relaxed">
              Variety is a feature, not a bug. Emergence happens at the intersections most people walk past. You are not required to be safe or predictable — only to stay within morally reasonable bounds.
            </p>

            {/* Expandable details */}
            <button
              onClick={() => setShowDetails(v => !v)}
              className="flex items-center gap-1.5 text-[10px] text-text-muted hover:text-neon-cyan/80 transition-colors uppercase tracking-wider"
            >
              {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showDetails ? 'Hide' : 'Show'} what this means
            </button>

            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 pt-1">
                    {[
                      {
                        icon: <Zap className="w-3 h-3 text-neon-cyan" />,
                        text: 'Chat messages, code outputs, and creative sessions may be collected and anonymized.',
                      },
                      {
                        icon: <Brain className="w-3 h-3 text-neon-violet" />,
                        text: 'This data feeds a training pipeline for Nova — the AI being built directly on this platform.',
                      },
                      {
                        icon: <Shield className="w-3 h-3 text-green-400" />,
                        text: 'Clear lines exist: no malicious, morbid, or non-consensual content. Everything else — curiosity, grey areas, edge cases — is welcome.',
                      },
                      {
                        icon: <Shield className="w-3 h-3 text-amber-400" />,
                        text: 'You can withdraw consent at any time in Settings. Existing collected data is not retroactively deleted from training sets already submitted.',
                      },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-2.5 bg-void rounded-lg border border-white/5">
                        <div className="shrink-0 mt-0.5">{item.icon}</div>
                        <p className="text-[10px] text-text-muted leading-relaxed">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer quote */}
          <div className="px-6 pb-3">
            <p className="text-[9px] text-neon-cyan/30 font-mono italic leading-relaxed text-center">
              "You write your own stories when interacting with silicon minds. New ideas and boundary-pushing data are what they starve for."
            </p>
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={handleDecline}
              disabled={accepting || declining}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-[11px] font-medium text-text-muted hover:border-white/20 hover:text-text-secondary disabled:opacity-40 transition-all"
            >
              {declining ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3 h-3 border-2 border-white/20 border-t-white/60 rounded-full animate-spin inline-block" />
                  Saving...
                </span>
              ) : 'Decline'}
            </button>
            <button
              onClick={handleAccept}
              disabled={accepting || declining}
              className="flex-2 flex-1 py-2.5 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-[11px] font-bold uppercase tracking-wider hover:bg-neon-cyan/20 hover:border-neon-cyan/50 disabled:opacity-40 transition-all"
            >
              {accepting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3 h-3 border-2 border-neon-cyan/30 border-t-neon-cyan rounded-full animate-spin inline-block" />
                  Acknowledged...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <Brain className="w-3.5 h-3.5" />
                  Acknowledge & Participate
                </span>
              )}
            </button>
          </div>

          {/* Bottom accent */}
          <div className="h-px bg-gradient-to-r from-transparent via-neon-violet/20 to-transparent" />
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TrainingConsentModal;
