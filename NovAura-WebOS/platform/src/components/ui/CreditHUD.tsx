import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import ANSymbol from './ANSymbol';
import { type MembershipTier } from '../../config/tierConfig';

interface CreditHUDProps {
  dailyCredits: number;
  dailyMax: number;
  builderBotMonthlyRemaining: number;
  builderBotMonthlyLimit: number;
  tier: MembershipTier;
  creditCost: number;
}

const TIER_COLOR: Record<MembershipTier, string> = {
  free:     '#6b7280',
  creator:  '#00F0FF',
  studio:   '#8B5CF6',
  catalyst: '#FBBF24',
};

const TIER_GLOW: Record<MembershipTier, string> = {
  free:     'rgba(107,114,128,0.3)',
  creator:  'rgba(0,240,255,0.3)',
  studio:   'rgba(139,92,246,0.3)',
  catalyst: 'rgba(251,191,36,0.3)',
};

// Corner bracket element — sci-fi HUD corner
const Corner: React.FC<{ pos: 'tl' | 'tr' | 'bl' | 'br'; color: string }> = ({ pos, color }) => {
  const size = 6;
  const w = 1.5;
  const corners = {
    tl: `M${size},0 L0,0 L0,${size}`,
    tr: `M0,0 L${size},0 L${size},${size}`,
    bl: `M0,0 L0,${size} L${size},${size}`,
    br: `M0,${size} L${size},${size} L${size},0`,
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute" style={{
      top: pos.startsWith('t') ? 0 : undefined,
      bottom: pos.startsWith('b') ? 0 : undefined,
      left: pos.endsWith('l') ? 0 : undefined,
      right: pos.endsWith('r') ? 0 : undefined,
    }}>
      <path d={corners[pos]} stroke={color} strokeWidth={w} fill="none" strokeLinecap="square" />
    </svg>
  );
};

const CreditHUD: React.FC<CreditHUDProps> = ({
  dailyCredits,
  dailyMax,
  builderBotMonthlyRemaining,
  builderBotMonthlyLimit,
  tier,
  creditCost,
}) => {
  const navigate = useNavigate();
  const color = TIER_COLOR[tier];
  const glow = TIER_GLOW[tier];

  const dailyPct = Math.min(dailyCredits / dailyMax, 1);
  const monthlyPct = Math.min(builderBotMonthlyRemaining / builderBotMonthlyLimit, 1);

  const dailyStatus = dailyPct > 0.5 ? 'ok' : dailyPct > 0.2 ? 'warn' : 'low';
  const barColor = dailyStatus === 'ok' ? color : dailyStatus === 'warn' ? '#FBBF24' : '#EF4444';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mx-1 rounded-md border bg-black/60 overflow-hidden"
      style={{ borderColor: `${color}22` }}
    >
      {/* HUD corners */}
      <Corner pos="tl" color={color} />
      <Corner pos="tr" color={color} />
      <Corner pos="bl" color={color} />
      <Corner pos="br" color={color} />

      {/* Scan line overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.8) 2px, rgba(255,255,255,0.8) 3px)',
        }}
      />

      <div className="px-3 py-2 space-y-2">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ANSymbol size={14} color={color} glowColor={glow} />
            <span className="text-[8px] font-mono font-bold tracking-[0.2em] uppercase" style={{ color }}>
              NOVA·OS
            </span>
          </div>
          <button
            onClick={() => navigate('/pricing')}
            className="text-[8px] font-mono uppercase tracking-wider transition-opacity opacity-60 hover:opacity-100"
            style={{ color }}
          >
            {tier === 'free' ? '[ UPGRADE ]' : `[ ${tier.toUpperCase()} ]`}
          </button>
        </div>

        {/* Credit readout */}
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[8px] font-mono text-white/30 uppercase tracking-widest mb-0.5">Credits · Daily</div>
            <div className="flex items-baseline gap-1">
              <span
                className="text-lg font-black font-mono leading-none"
                style={{ color, textShadow: `0 0 10px ${glow}` }}
              >
                {dailyCredits.toLocaleString()}
              </span>
              <span className="text-[9px] font-mono text-white/30">/ {dailyMax.toLocaleString()}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[8px] font-mono text-white/30 uppercase tracking-widest mb-0.5">Bot Runs · Mo</div>
            <div className="flex items-baseline gap-1 justify-end">
              <span className="text-sm font-black font-mono leading-none text-white/70">
                {builderBotMonthlyRemaining}
              </span>
              <span className="text-[9px] font-mono text-white/30">/ {builderBotMonthlyLimit}</span>
            </div>
          </div>
        </div>

        {/* Daily credit bar */}
        <div className="space-y-0.5">
          <div className="h-1 w-full bg-white/5 rounded-none overflow-hidden">
            <motion.div
              className="h-full rounded-none"
              style={{ backgroundColor: barColor, boxShadow: `0 0 6px ${barColor}` }}
              initial={{ width: 0 }}
              animate={{ width: `${dailyPct * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <div className="h-0.5 w-full bg-white/5 rounded-none overflow-hidden">
            <motion.div
              className="h-full rounded-none"
              style={{ backgroundColor: `${color}80` }}
              initial={{ width: 0 }}
              animate={{ width: `${monthlyPct * 100}%` }}
              transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Cost indicator */}
        {creditCost > 0 && (
          <div className="flex items-center gap-1 pt-0.5">
            <div className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: color }} />
            <span className="text-[8px] font-mono text-white/40">
              Next run: <span style={{ color }}>{creditCost} cr</span>
            </span>
          </div>
        )}
        {creditCost === 0 && (
          <div className="flex items-center gap-1 pt-0.5">
            <div className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[8px] font-mono text-green-400/70">LOCAL AI · FREE INFERENCE</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default CreditHUD;
