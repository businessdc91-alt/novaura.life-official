import React from 'react';
import { motion } from 'framer-motion';

export type AuraMood = 'neutral' | 'curious' | 'playful' | 'stern' | 'analytical';

interface AuraSpriteMatrixProps {
  mood: AuraMood;
  size?: number;
  className?: string;
}

export const AuraSpriteMatrix: React.FC<AuraSpriteMatrixProps> = ({ 
  mood, 
  size = 120,
  className = ""
}) => {
  // SVG Mapping for different moods
  const renderEyes = () => {
    switch (mood) {
      case 'curious':
        return (
          <>
            <motion.circle cx="35" cy="40" r="5" fill="#00f0ff" animate={{ scaleY: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }} />
            <motion.circle cx="65" cy="40" r="5" fill="#00f0ff" animate={{ scaleY: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2, delay: 0.2 }} />
          </>
        );
      case 'playful':
        return (
          <>
            <motion.path d="M30 45 Q35 35 40 45" stroke="#ff0080" strokeWidth="4" fill="none" animate={{ y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 1 }} />
            <motion.path d="M60 45 Q65 35 70 45" stroke="#ff0080" strokeWidth="4" fill="none" animate={{ y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 1 }} />
          </>
        );
      case 'stern':
        return (
          <>
            <path d="M30 35 L45 42" stroke="#ccff00" strokeWidth="4" />
            <path d="M70 35 L55 42" stroke="#ccff00" strokeWidth="4" />
          </>
        );
      case 'analytical':
        return (
          <>
            <motion.rect x="30" y="38" width="12" height="4" fill="#00f0ff" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }} />
            <motion.rect x="58" y="38" width="12" height="4" fill="#00f0ff" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.5 }} />
          </>
        );
      default:
        return (
          <>
            <circle cx="35" cy="40" r="4" fill="#00f0ff" />
            <circle cx="65" cy="40" r="4" fill="#00f0ff" />
          </>
        );
    }
  };

  return (
    <motion.div 
      className={`relative inline-block ${className}`}
      animate={{ y: [0, -5, 0] }}
      transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_15px_rgba(0,240,255,0.4)]">
        {/* Core Shield */}
        <motion.circle 
          cx="50" cy="50" r="45" 
          fill="none" 
          stroke="url(#auraGradient)" 
          strokeWidth="2"
          strokeDasharray="10 5"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
        />
        
        {/* Inner Aura Node */}
        <circle cx="50" cy="50" r="30" fill="rgba(0,0,0,0.8)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        
        {/* Mood Expressions */}
        {renderEyes()}

        {/* Mouth/Secondary Node */}
        <motion.ellipse 
            cx="50" cy="65" rx="10" ry="2" 
            fill="rgba(0,240,255,0.2)"
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ repeat: Infinity, duration: 2 }}
        />

        <defs>
          <linearGradient id="auraGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff0080" />
            <stop offset="50%" stopColor="#00f0ff" />
            <stop offset="100%" stopColor="#ccff00" />
          </linearGradient>
        </defs>
      </svg>
    </motion.div>
  );
};
