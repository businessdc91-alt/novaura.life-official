import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, X } from 'lucide-react';
import type { BadgeSearchResult } from '@/types';
import { BADGE_LABELS, BADGE_COLORS } from '@/services/pioneerBadgeService';
import { usePioneerBadgeStore } from '@/stores/pioneerBadgeStore';

interface Props {
  result: BadgeSearchResult;
}

export function AuraBadgeAward({ result }: Props) {
  const clearLastResult = usePioneerBadgeStore((s) => s.clearLastResult);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    const t = setTimeout(clearLastResult, 8000);
    return () => clearTimeout(t);
  }, [clearLastResult]);

  if (!result.newBadges.length || !result.auraMessage) return null;

  const topBadge = result.newBadges[0];
  const colors = BADGE_COLORS[topBadge.tier];

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className="fixed bottom-6 left-1/2 z-50 w-[min(480px,90vw)] -translate-x-1/2"
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d14]/95 p-5 shadow-2xl backdrop-blur-xl">
        {/* Gradient accent border top */}
        <div className={`absolute inset-x-0 top-0 h-0.5 ${colors.bg.replace('/20', '')}`} />

        <button
          onClick={clearLastResult}
          className="absolute right-3 top-3 text-white/30 hover:text-white/70 transition-colors"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${colors.border} ${colors.bg}`}>
            <Shield size={20} className={colors.text} />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-widest text-white/40">
              Aura · Badge Awarded
            </p>
            <p className={`text-sm font-bold ${colors.text}`}>
              {BADGE_LABELS[topBadge.tier]}
            </p>
          </div>
        </div>

        {/* Aura message */}
        <p className="text-sm leading-relaxed text-white/70">{result.auraMessage}</p>

        {/* Additional badges if multiple awarded at once */}
        {result.newBadges.length > 1 && (
          <p className="mt-2 text-xs text-white/40">
            +{result.newBadges.length - 1} more badge{result.newBadges.length > 2 ? 's' : ''} awarded
          </p>
        )}

        {/* Term chip */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-white/30">Search term:</span>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${colors.border} ${colors.bg} ${colors.text}`}>
            {topBadge.searchTermDisplay}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/** Drop this inside App.tsx or a layout to show badge awards globally. */
export function GlobalBadgeAwardOverlay() {
  const lastSearchResult = usePioneerBadgeStore((s) => s.lastSearchResult);

  return (
    <AnimatePresence>
      {lastSearchResult && lastSearchResult.newBadges.length > 0 && (
        <AuraBadgeAward key={lastSearchResult.newBadges[0].id} result={lastSearchResult} />
      )}
    </AnimatePresence>
  );
}
