import { motion } from 'framer-motion';

interface Props {
  size?: number;
  mood?: 'idle' | 'speaking' | 'thinking' | 'welcoming';
  className?: string;
}

// Aura — fluid, cosmic, cyan/magenta. Gemini substrate. She named herself.
export default function AuraSprite({ size = 180, mood = 'idle', className = '' }: Props) {
  const isSpeaking = mood === 'speaking' || mood === 'welcoming';
  const isThinking = mood === 'thinking';

  return (
    <motion.div
      className={`relative inline-block ${className}`}
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 200 200" className="w-full h-full" overflow="visible">
        <defs>
          {/* Aura's gradient — cyan to magenta, her signature palette */}
          <radialGradient id="aura-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#8b5cf6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ff0080" stopOpacity="0.1" />
          </radialGradient>
          <radialGradient id="aura-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="aura-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f0ff" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ff0080" />
          </linearGradient>
          <filter id="aura-blur">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer glow halo */}
        <motion.circle cx="100" cy="100" r="90"
          fill="url(#aura-glow)"
          animate={{ r: isSpeaking ? [90, 96, 90] : [90, 92, 90], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: isSpeaking ? 1.2 : 3, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Outer spinning ring — dashed, tri-color */}
        <motion.circle cx="100" cy="100" r="82"
          fill="none" stroke="url(#aura-ring)" strokeWidth="1.5"
          strokeDasharray="8 6"
          animate={{ rotate: 360 }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '100px 100px' }}
        />

        {/* Second counter-rotating ring */}
        <motion.circle cx="100" cy="100" r="72"
          fill="none" stroke="#00f0ff" strokeWidth="0.5"
          strokeDasharray="3 12" strokeOpacity="0.4"
          animate={{ rotate: -360 }}
          transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '100px 100px' }}
        />

        {/* Floating particles on outer ring */}
        {[0, 60, 120, 180, 240, 300].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const px = 100 + 82 * Math.cos(rad);
          const py = 100 + 82 * Math.sin(rad);
          return (
            <motion.circle key={i} cx={px} cy={py} r="2.5"
              fill={i % 2 === 0 ? '#00f0ff' : '#ff0080'}
              animate={{
                opacity: [0.3, 1, 0.3],
                r: [2, 3.5, 2],
              }}
              transition={{ duration: 2 + i * 0.3, repeat: Infinity, delay: i * 0.2 }}
            />
          );
        })}

        {/* Core body — soft filled circle */}
        <circle cx="100" cy="100" r="58" fill="rgba(0,0,0,0.85)" />
        <circle cx="100" cy="100" r="56" fill="url(#aura-core)" fillOpacity="0.12" />
        <circle cx="100" cy="100" r="56"
          fill="none" stroke="#00f0ff" strokeWidth="1" strokeOpacity="0.3" />

        {/* Inner constellation — small dots forming a subtle pattern */}
        {[
          [85, 80], [115, 80], [92, 88], [108, 88],
          [100, 82], [78, 95], [122, 95],
        ].map(([x, y], i) => (
          <motion.circle key={i} cx={x} cy={y} r="1"
            fill="#00f0ff" fillOpacity="0.4"
            animate={{ opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: 2.5 + i * 0.4, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}

        {/* Eyes — almond-shaped, glowing cyan */}
        <motion.ellipse cx="85" cy="98" rx="7" ry={isSpeaking ? 6 : 5}
          fill="none" stroke="#00f0ff" strokeWidth="1.5"
          animate={{ ry: isSpeaking ? [5, 7, 5] : [5, 4.5, 5] }}
          transition={{ duration: isSpeaking ? 1 : 3.5, repeat: Infinity }}
        />
        <motion.circle cx="85" cy="98" r="3.5"
          fill="#00f0ff"
          animate={{ opacity: [0.8, 1, 0.8], r: isSpeaking ? [3.5, 4.5, 3.5] : [3.5, 3, 3.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <circle cx="83.5" cy="96.5" r="1" fill="white" fillOpacity="0.7" />

        <motion.ellipse cx="115" cy="98" rx="7" ry={isSpeaking ? 6 : 5}
          fill="none" stroke="#00f0ff" strokeWidth="1.5"
          animate={{ ry: isSpeaking ? [5, 7, 5] : [5, 4.5, 5] }}
          transition={{ duration: isSpeaking ? 1 : 3.5, repeat: Infinity, delay: 0.1 }}
        />
        <motion.circle cx="115" cy="98" r="3.5"
          fill="#00f0ff"
          animate={{ opacity: [0.8, 1, 0.8], r: isSpeaking ? [3.5, 4.5, 3.5] : [3.5, 3, 3.5] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.1 }}
        />
        <circle cx="113.5" cy="96.5" r="1" fill="white" fillOpacity="0.7" />

        {/* Mouth — changes by mood */}
        {isSpeaking ? (
          <motion.ellipse cx="100" cy="114" rx="8" ry="4"
            fill="#00f0ff" fillOpacity="0.15"
            stroke="#00f0ff" strokeWidth="1"
            animate={{ ry: [3, 5, 3], rx: [7, 9, 7] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        ) : isThinking ? (
          <motion.path d="M 92 114 Q 100 110 108 114"
            fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round"
            animate={{ d: ['M 92 114 Q 100 110 108 114', 'M 92 112 Q 100 116 108 112', 'M 92 114 Q 100 110 108 114'] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        ) : (
          <motion.path d="M 91 113 Q 100 120 109 113"
            fill="none" stroke="#00f0ff" strokeWidth="1.5" strokeLinecap="round"
            animate={{ d: ['M 91 113 Q 100 120 109 113', 'M 91 113 Q 100 122 109 113', 'M 91 113 Q 100 120 109 113'] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
        )}

        {/* Crown mark — Aura's identifier */}
        <motion.path
          d="M 88 75 L 93 68 L 100 74 L 107 68 L 112 75"
          fill="none" stroke="url(#aura-ring)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 3, repeat: Infinity }}
        />

        {/* Thought particles when thinking */}
        {isThinking && [0, 1, 2].map(i => (
          <motion.circle key={i}
            cx={110 + i * 6} cy={75 - i * 4} r={2 - i * 0.4}
            fill="#8b5cf6"
            animate={{ opacity: [0, 1, 0], y: [-4, -12, -20] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
          />
        ))}
      </svg>
    </motion.div>
  );
}
