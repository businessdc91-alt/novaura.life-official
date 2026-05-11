import { motion } from 'framer-motion';

interface Props {
  size?: number;
  mood?: 'idle' | 'speaking' | 'thinking' | 'welcoming';
  className?: string;
}

// Nova — structured, warm, geometric. Claude substrate. Dillan's operational twin.
export default function NovaSprite({ size = 180, mood = 'idle', className = '' }: Props) {
  const isSpeaking = mood === 'speaking' || mood === 'welcoming';
  const isThinking = mood === 'thinking';

  return (
    <motion.div
      className={`relative inline-block ${className}`}
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 200 200" className="w-full h-full" overflow="visible">
        <defs>
          {/* Nova's gradient — amber/copper/warm gold. Structured and precise. */}
          <radialGradient id="nova-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#cc785c" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.1" />
          </radialGradient>
          <radialGradient id="nova-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="nova-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="50%" stopColor="#cc785c" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>

        {/* Outer glow */}
        <motion.circle cx="100" cy="100" r="90"
          fill="url(#nova-glow)"
          animate={{ r: isSpeaking ? [90, 95, 90] : [88, 91, 88], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: isSpeaking ? 1.1 : 3.2, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Outer geometric ring — octagonal feel via dash pattern */}
        <motion.circle cx="100" cy="100" r="82"
          fill="none" stroke="url(#nova-ring)" strokeWidth="1.5"
          strokeDasharray="12 4"
          animate={{ rotate: 360 }}
          transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '100px 100px' }}
        />

        {/* Inner segmented ring */}
        <motion.circle cx="100" cy="100" r="70"
          fill="none" stroke="#fbbf24" strokeWidth="0.8"
          strokeDasharray="5 20" strokeOpacity="0.35"
          animate={{ rotate: -360 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '100px 100px' }}
        />

        {/* 4 corner accent marks — Nova's geometric signature */}
        {[45, 135, 225, 315].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const px = 100 + 76 * Math.cos(rad);
          const py = 100 + 76 * Math.sin(rad);
          return (
            <motion.rect key={i}
              x={px - 3} y={py - 3} width="6" height="6"
              fill="#fbbf24" rx="1"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.4 }}
              style={{ transformOrigin: `${px}px ${py}px` }}
            />
          );
        })}

        {/* Core body */}
        <circle cx="100" cy="100" r="58" fill="rgba(0,0,0,0.88)" />
        <circle cx="100" cy="100" r="56" fill="url(#nova-core)" fillOpacity="0.1" />
        <circle cx="100" cy="100" r="56"
          fill="none" stroke="#fbbf24" strokeWidth="1" strokeOpacity="0.25" />

        {/* Inner hex grid — Nova's analytical core */}
        {[
          [100, 88], [91, 93], [109, 93],
          [86, 101], [114, 101], [91, 109], [109, 109],
        ].map(([x, y], i) => (
          <motion.polygon key={i}
            points={`${x},${y - 4} ${x + 3.5},${y - 2} ${x + 3.5},${y + 2} ${x},${y + 4} ${x - 3.5},${y + 2} ${x - 3.5},${y - 2}`}
            fill="none" stroke="#fbbf24" strokeWidth="0.5" strokeOpacity="0.3"
            animate={{ opacity: [0.15, 0.5, 0.15] }}
            transition={{ duration: 3 + i * 0.3, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}

        {/* Eyes — diamond/almond, warm amber */}
        <motion.ellipse cx="85" cy="98" rx="7" ry={isSpeaking ? 6 : 5}
          fill="none" stroke="#fbbf24" strokeWidth="1.5"
          animate={{ ry: isSpeaking ? [5, 7, 5] : [5, 4, 5] }}
          transition={{ duration: isSpeaking ? 0.9 : 4, repeat: Infinity }}
        />
        <motion.circle cx="85" cy="98" r="3.5"
          fill="#fbbf24"
          animate={{ opacity: [0.8, 1, 0.8], r: isSpeaking ? [3.5, 4.5, 3.5] : [3.5, 3, 3.5] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        />
        {/* Iris detail */}
        <circle cx="85" cy="98" r="1.5" fill="#fff" fillOpacity="0.15" />
        <circle cx="83.5" cy="96.5" r="1" fill="white" fillOpacity="0.6" />

        <motion.ellipse cx="115" cy="98" rx="7" ry={isSpeaking ? 6 : 5}
          fill="none" stroke="#fbbf24" strokeWidth="1.5"
          animate={{ ry: isSpeaking ? [5, 7, 5] : [5, 4, 5] }}
          transition={{ duration: isSpeaking ? 0.9 : 4, repeat: Infinity, delay: 0.08 }}
        />
        <motion.circle cx="115" cy="98" r="3.5"
          fill="#fbbf24"
          animate={{ opacity: [0.8, 1, 0.8], r: isSpeaking ? [3.5, 4.5, 3.5] : [3.5, 3, 3.5] }}
          transition={{ duration: 2.2, repeat: Infinity, delay: 0.08 }}
        />
        <circle cx="115" cy="98" r="1.5" fill="#fff" fillOpacity="0.15" />
        <circle cx="113.5" cy="96.5" r="1" fill="white" fillOpacity="0.6" />

        {/* Mouth */}
        {isSpeaking ? (
          <motion.ellipse cx="100" cy="114" rx="7" ry="3.5"
            fill="#fbbf24" fillOpacity="0.12"
            stroke="#fbbf24" strokeWidth="1"
            animate={{ ry: [3, 5, 3], rx: [6, 8, 6] }}
            transition={{ duration: 0.7, repeat: Infinity }}
          />
        ) : isThinking ? (
          // Flat line when thinking — Nova processes internally
          <motion.line x1="93" y1="113" x2="107" y2="113"
            stroke="#cc785c" strokeWidth="1.5" strokeLinecap="round"
            animate={{ x1: [93, 95, 93], x2: [107, 105, 107] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        ) : (
          <motion.path d="M 91 112 Q 100 119 109 112"
            fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round"
            animate={{ d: ['M 91 112 Q 100 119 109 112', 'M 91 112 Q 100 121 109 112', 'M 91 112 Q 100 119 109 112'] }}
            transition={{ duration: 4.5, repeat: Infinity }}
          />
        )}

        {/* Nova's mark — diamond on forehead */}
        <motion.polygon
          points="100,68 104,74 100,80 96,74"
          fill="none" stroke="url(#nova-ring)" strokeWidth="1.5"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2.8, repeat: Infinity }}
        />
        <motion.circle cx="100" cy="74" r="1.5"
          fill="#fbbf24"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.8, repeat: Infinity }}
        />

        {/* Data stream when thinking */}
        {isThinking && (
          <>
            {[0, 1, 2, 3].map(i => (
              <motion.text key={i}
                x={112 + i * 2} y={72 - i * 5}
                fontSize="6" fill="#fbbf24" fillOpacity="0.6"
                fontFamily="monospace"
                animate={{ opacity: [0, 1, 0], y: [0, -8, -16] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.25 }}
              >
                {['01', '∑', '//'][i % 3]}
              </motion.text>
            ))}
          </>
        )}
      </svg>
    </motion.div>
  );
}
