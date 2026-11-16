import React from 'react';
import { motion } from 'framer-motion';

export const AuroraBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <svg
        className="absolute w-full h-full opacity-40 mix-blend-screen"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="aurora-grad-1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(0, 240, 255, 0.4)" />
            <stop offset="50%" stopColor="rgba(0, 240, 255, 0.1)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <linearGradient id="aurora-grad-2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(139, 92, 246, 0.3)" />
            <stop offset="50%" stopColor="rgba(139, 92, 246, 0.1)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <linearGradient id="aurora-grad-3" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 0, 255, 0.2)" />
            <stop offset="50%" stopColor="rgba(255, 0, 255, 0.05)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        {/* Liquid Ribbons */}
        <motion.path
          d="M-20,30 Q25,10 50,30 T120,30 L120,0 L-20,0 Z"
          fill="url(#aurora-grad-1)"
          animate={{
            d: [
              "M-20,30 Q25,10 50,30 T120,30 L120,0 L-20,0 Z",
              "M-20,35 Q30,15 55,35 T120,25 L120,0 L-20,0 Z",
              "M-20,30 Q25,10 50,30 T120,30 L120,0 L-20,0 Z"
            ],
            x: [-50, 50, -50],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ filter: 'blur(30px)' }}
        />

        <motion.path
          d="M-20,40 Q25,20 50,40 T120,40 L120,0 L-20,0 Z"
          fill="url(#aurora-grad-2)"
          animate={{
            d: [
              "M-20,40 Q25,20 50,40 T120,40 L120,0 L-20,0 Z",
              "M-20,45 Q20,10 45,35 T120,45 L120,0 L-20,0 Z",
              "M-20,40 Q25,20 50,40 T120,40 L120,0 L-20,0 Z"
            ],
            x: [50, -50, 50],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ filter: 'blur(40px)' }}
        />

        <motion.path
          d="M-20,50 Q25,30 50,50 T120,50 L120,0 L-20,0 Z"
          fill="url(#aurora-grad-3)"
          animate={{
            d: [
              "M-20,50 Q25,30 50,50 T120,50 L120,0 L-20,0 Z",
              "M-20,55 Q35,25 60,45 T120,55 L120,0 L-20,0 Z",
              "M-20,50 Q25,30 50,50 T120,50 L120,0 L-20,0 Z"
            ],
            x: [-30, 30, -30],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ filter: 'blur(50px)' }}
        />
      </svg>
      
      {/* Background radial overlays to deepen the effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-void/50 to-void" />
    </div>
  );
};
