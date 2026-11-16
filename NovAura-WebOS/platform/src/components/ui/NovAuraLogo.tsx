import { useEffect, useState } from 'react';
import { Sparkles, Zap } from 'lucide-react';

interface NovAuraLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
  showText?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { icon: 24, text: 'text-lg' },
  md: { icon: 32, text: 'text-xl' },
  lg: { icon: 48, text: 'text-3xl' },
  xl: { icon: 64, text: 'text-5xl' },
};

export function NovAuraLogo({ 
  size = 'md', 
  animated = true, 
  showText = true,
  className = '' 
}: NovAuraLogoProps) {
  const [hoverIndex, setHoverIndex] = useState(0);
  const { icon: iconSize, text: textSize } = sizeMap[size];

  useEffect(() => {
    if (!animated) return;
    
    const interval = setInterval(() => {
      setHoverIndex((prev) => (prev + 1) % 4);
    }, 800);
    
    return () => clearInterval(interval);
  }, [animated]);

  const getShapeColor = (index: number) => {
    const colors = ['#00F0FF', '#8B5CF6', '#FF006E', '#39FF14'];
    const isActive = hoverIndex === index;
    
    return {
      color: colors[index],
      filter: isActive 
        ? `drop-shadow(0 0 15px ${colors[index]}) drop-shadow(0 0 30px ${colors[index]})` 
        : `drop-shadow(0 0 5px ${colors[index]})`,
      transform: isActive ? 'scale(1.2) rotate(15deg)' : 'scale(1) rotate(0deg)',
      opacity: isActive ? 1 : 0.7,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    };
  };

  return (
    <div className={`flex items-center gap-3 group ${className}`}>
      {/* Edgy Geometric Logo */}
      <div className="relative" style={{ width: iconSize * 1.5, height: iconSize * 1.5 }}>
        {/* Background Glow */}
        <div 
          className="absolute inset-0 rounded-full blur-xl opacity-50"
          style={{
            background: `radial-gradient(circle, 
              ${hoverIndex === 0 ? '#00F0FF' : 'transparent'} 0%, 
              ${hoverIndex === 1 ? '#8B5CF6' : 'transparent'} 33%,
              ${hoverIndex === 2 ? '#FF006E' : 'transparent'} 66%,
              ${hoverIndex === 3 ? '#39FF14' : 'transparent'} 100%
            )`,
            transition: 'all 0.5s ease',
          }}
        />
        
        {/* Geometric Shapes Layer */}
        <svg 
          viewBox="0 0 100 100" 
          className="absolute inset-0 w-full h-full"
          style={{ transform: 'rotate(-15deg)' }}
        >
          {/* Outer Hexagon */}
          <polygon 
            points="50,5 93,25 93,75 50,95 7,75 7,25"
            fill="none"
            stroke={getShapeColor(0).color}
            strokeWidth="2"
            style={{
              filter: getShapeColor(0).filter,
              opacity: getShapeColor(0).opacity,
              transition: getShapeColor(0).transition,
            }}
          />
          
          {/* Inner Triangle */}
          <polygon 
            points="50,20 75,65 25,65"
            fill="none"
            stroke={getShapeColor(1).color}
            strokeWidth="2.5"
            style={{
              filter: getShapeColor(1).filter,
              opacity: getShapeColor(1).opacity,
              transition: getShapeColor(1).transition,
              transform: getShapeColor(1).transform,
              transformOrigin: 'center',
            }}
          />
          
          {/* Center Circle Pulse */}
          <circle 
            cx="50" 
            cy="50" 
            r="12"
            fill={getShapeColor(2).color}
            style={{
              filter: getShapeColor(2).filter,
              opacity: getShapeColor(2).opacity,
              transition: getShapeColor(2).transition,
              transform: getShapeColor(2).transform,
              transformOrigin: 'center',
            }}
          />
          
          {/* Energy Lines */}
          <line x1="50" y1="5" x2="50" y2="20" stroke={getShapeColor(3).color} strokeWidth="2" style={{ filter: getShapeColor(3).filter }} />
          <line x1="93" y1="25" x2="75" y2="35" stroke={getShapeColor(3).color} strokeWidth="2" style={{ filter: getShapeColor(3).filter }} />
          <line x1="93" y1="75" x2="75" y2="65" stroke={getShapeColor(3).color} strokeWidth="2" style={{ filter: getShapeColor(3).filter }} />
          <line x1="50" y1="95" x2="50" y2="80" stroke={getShapeColor(3).color} strokeWidth="2" style={{ filter: getShapeColor(3).filter }} />
          <line x1="7" y1="75" x2="25" y2="65" stroke={getShapeColor(3).color} strokeWidth="2" style={{ filter: getShapeColor(3).filter }} />
          <line x1="7" y1="25" x2="25" y2="35" stroke={getShapeColor(3).color} strokeWidth="2" style={{ filter: getShapeColor(3).filter }} />
        </svg>
        
        {/* Floating Sparkles */}
        {animated && (
          <>
            <Sparkles 
              className="absolute -top-1 -right-1 w-3 h-3"
              style={{
                color: '#00F0FF',
                animation: 'pulse 1.5s ease-in-out infinite',
                filter: 'drop-shadow(0 0 5px #00F0FF)',
              }}
            />
            <Zap 
              className="absolute -bottom-1 -left-1 w-3 h-3"
              style={{
                color: '#FF006E',
                animation: 'pulse 1.5s ease-in-out infinite 0.5s',
                filter: 'drop-shadow(0 0 5px #FF006E)',
              }}
            />
          </>
        )}
      </div>
      
      {/* Text Logo */}
      {showText && (
        <div className="flex flex-col">
          <span 
            className={`font-black tracking-tight ${textSize}`}
            style={{
              fontFamily: 'Orbitron, system-ui, sans-serif',
              background: 'linear-gradient(135deg, #00F0FF 0%, #8B5CF6 50%, #FF006E 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: animated ? 'drop-shadow(0 0 10px rgba(0, 240, 255, 0.5))' : 'none',
            }}
          >
            NOV
            <span style={{ 
              background: 'linear-gradient(135deg, #FF006E 0%, #39FF14 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              AURA
            </span>
          </span>
          
          {/* Subtle tagline */}
          {size === 'lg' || size === 'xl' ? (
            <span 
              className="text-xs font-mono tracking-[0.3em] uppercase"
              style={{ 
                color: '#6A6A7A',
                marginTop: '-4px',
              }}
            >
              Creator Ecosystem
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function NovAuraIconOnly({ size = 32, className = '' }: { size?: number; className?: string }) {
  const [rotation, setRotation] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setRotation((prev) => (prev + 1) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* Spinning Outer Ring */}
      <svg 
        viewBox="0 0 100 100" 
        className="absolute inset-0 w-full h-full"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <defs>
          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00F0FF" />
            <stop offset="33%" stopColor="#8B5CF6" />
            <stop offset="66%" stopColor="#FF006E" />
            <stop offset="100%" stopColor="#39FF14" />
          </linearGradient>
        </defs>
        
        {/* Outer rotating ring */}
        <circle 
          cx="50" 
          cy="50" 
          r="45" 
          fill="none" 
          stroke="url(#ringGradient)" 
          strokeWidth="2"
          strokeDasharray="20 10 5 10"
          style={{ filter: 'drop-shadow(0 0 10px currentColor)' }}
        />
      </svg>
      
      {/* Static Inner Icon */}
      <svg 
        viewBox="0 0 100 100" 
        className="absolute inset-0 w-full h-full"
        style={{ transform: 'scale(0.6)' }}
      >
        <polygon 
          points="50,10 90,30 90,70 50,90 10,70 10,30"
          fill="none"
          stroke="#00F0FF"
          strokeWidth="3"
          style={{ filter: 'drop-shadow(0 0 10px #00F0FF)' }}
        />
        <circle 
          cx="50" 
          cy="50" 
          r="15"
          fill="#FF006E"
          style={{ filter: 'drop-shadow(0 0 15px #FF006E)' }}
        />
      </svg>
    </div>
  );
}

export function NovAuraLoader({ size = 64 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Pulsing rings */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-full border-2"
          style={{
            borderColor: i === 0 ? '#00F0FF' : i === 1 ? '#8B5CF6' : '#FF006E',
            animation: `pulse-ring 1.5s ease-out infinite ${i * 0.3}s`,
            opacity: 0.6 - i * 0.2,
          }}
        />
      ))}
      
      {/* Center Logo */}
      <div className="absolute inset-0 flex items-center justify-center">
        <NovAuraIconOnly size={size * 0.5} />
      </div>
    </div>
  );
}
