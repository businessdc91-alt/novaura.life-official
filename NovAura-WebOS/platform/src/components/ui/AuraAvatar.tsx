import { motion } from 'framer-motion';

export type AuraEmotion = 'neutral' | 'thinking' | 'happy' | 'confused' | 'alert' | 'sleepy';

interface AuraAvatarProps {
  emotion: AuraEmotion;
  isThinking?: boolean;
  className?: string;
  size?: number;
}

export const AuraAvatar = ({ emotion, isThinking, className = "", size = 40 }: AuraAvatarProps) => {
  // Eye paths for different emotions
  const getEyePath = (side: 'left' | 'right') => {
    switch (emotion) {
      case 'happy':
        return "M 0 0 C 2 -4 8 -4 10 0"; // Upward curve
      case 'confused':
        return side === 'left' ? "M 0 -2 L 10 2" : "M 0 2 L 10 -2"; // Slanted eyes
      case 'alert':
        return "M 0 0 L 10 0"; // Sharp flat eyes
      case 'sleepy':
        return "M 0 2 C 2 4 8 4 10 2"; // Downward curve
      default:
        return "M 0 0 L 10 0"; // Default horizontal line (will scale to circle)
    }
  };

  return (
    <div 
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Outer Glow / Aura */}
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.6, 0.3],
          boxShadow: emotion === 'happy' 
            ? '0 0 20px #FF00E5' 
            : emotion === 'thinking' || isThinking
            ? '0 0 20px #39FF14'
            : '0 0 20px #00F0FF'
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 rounded-full"
      />

      <svg 
        viewBox="0 0 100 100" 
        className="w-full h-full relative z-10"
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Face / Shell */}
        <motion.circle
          cx="50"
          cy="50"
          r="45"
          className="stroke-[2px]"
          stroke={emotion === 'happy' ? '#FF00E5' : emotion === 'thinking' || isThinking ? '#39FF14' : '#00F0FF'}
          initial={false}
          animate={{
            stroke: emotion === 'happy' ? '#FF00E5' : emotion === 'thinking' || isThinking ? '#39FF14' : '#00F0FF',
            r: isThinking ? [45, 47, 45] : 45
          }}
          transition={{ duration: 0.5 }}
        />

        {/* Eye - Left */}
        <motion.g transform="translate(25, 45)">
          {emotion === 'neutral' || emotion === 'thinking' ? (
            <motion.circle
              cx="5"
              cy="0"
              r={isThinking ? 4 : 3}
              fill={isThinking ? '#39FF14' : '#00F0FF'}
              animate={{
                scaleY: isThinking ? [1, 0.2, 1] : 1,
                opacity: isThinking ? [1, 0.5, 1] : 1
              }}
              transition={{ duration: isThinking ? 1.5 : 3, repeat: Infinity }}
            />
          ) : (
            <motion.path
              d={getEyePath('left')}
              stroke={emotion === 'happy' ? '#FF00E5' : '#00F0FF'}
              strokeWidth="4"
              strokeLinecap="round"
              initial={false}
              animate={{ d: getEyePath('left') }}
            />
          )}
        </motion.g>

        {/* Eye - Right */}
        <motion.g transform="translate(65, 45)">
          {emotion === 'neutral' || emotion === 'thinking' ? (
            <motion.circle
              cx="5"
              cy="0"
              r={isThinking ? 4 : 3}
              fill={isThinking ? '#39FF14' : '#00F0FF'}
              animate={{
                scaleY: isThinking ? [1, 0.2, 1] : 1,
                opacity: isThinking ? [1, 0.5, 1] : 1
              }}
              transition={{ duration: isThinking ? 1.5 : 3, repeat: Infinity, delay: 0.1 }}
            />
          ) : (
            <motion.path
              d={getEyePath('right')}
              stroke={emotion === 'happy' ? '#FF00E5' : '#00F0FF'}
              strokeWidth="4"
              strokeLinecap="round"
              initial={false}
              animate={{ d: getEyePath('right') }}
            />
          )}
        </motion.g>

        {/* Thinking / Data Bars */}
        {(isThinking || emotion === 'thinking') && (
          <motion.g transform="translate(30, 70)">
            {[0, 1, 2, 3].map((i) => (
              <motion.rect
                key={i}
                x={i * 12}
                y="0"
                width="8"
                height="4"
                fill="#39FF14"
                animate={{
                  opacity: [0.2, 1, 0.2],
                  height: [4, 12, 4],
                  y: [0, -4, 0]
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.15
                }}
              />
            ))}
          </motion.g>
        )}

        {/* Happy Jitter / Particles */}
        {emotion === 'happy' && (
          <motion.g>
            {[...Array(6)].map((_, i) => (
              <motion.circle
                key={i}
                r="2"
                fill="#FF00E5"
                initial={{ cx: 50, cy: 50, opacity: 0 }}
                animate={{
                  cx: 50 + (Math.random() - 0.5) * 80,
                  cy: 50 + (Math.random() - 0.5) * 80,
                  opacity: [0, 1, 0],
                  scale: [0, 1.5, 0]
                }}
                transition={{
                  duration: 1 + Math.random(),
                  repeat: Infinity,
                  delay: Math.random() * 2
                }}
              />
            ))}
          </motion.g>
        )}
      </svg>
    </div>
  );
};
