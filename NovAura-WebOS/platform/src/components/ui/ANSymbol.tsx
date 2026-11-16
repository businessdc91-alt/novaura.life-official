import React from 'react';

interface ANSymbolProps {
  size?: number;
  color?: string;
  glowColor?: string;
  className?: string;
}

/**
 * Sharp geometric AN monogram — A and N pushed together sharing a corner point.
 * A: two diagonals meeting at apex, crossbar at 60% height.
 * N: left post = touches A's right bottom, diagonal, right post.
 * The letters share x=9 as the meeting point, creating a seamless ligature.
 */
const ANSymbol: React.FC<ANSymbolProps> = ({
  size = 24,
  color = '#00F0FF',
  glowColor = 'rgba(0,240,255,0.6)',
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 16"
    fill="none"
    className={className}
    style={{ filter: `drop-shadow(0 0 4px ${glowColor})` }}
  >
    {/* ── A ── */}
    {/* Left diagonal: bottom-left → apex */}
    <line x1="0.5" y1="15.5" x2="6.5" y2="0.5" stroke={color} strokeWidth="1.6" strokeLinecap="square" />
    {/* Right diagonal: apex → bottom-right (shared x=12.5 with N's approach) */}
    <line x1="6.5" y1="0.5" x2="12.5" y2="15.5" stroke={color} strokeWidth="1.6" strokeLinecap="square" />
    {/* Crossbar at ~60% height */}
    <line x1="2.5" y1="9.5" x2="10.5" y2="9.5" stroke={color} strokeWidth="1.4" strokeLinecap="square" />

    {/* ── N ── (left post starts at x=10, butting up against A's right leg) */}
    {/* Left post */}
    <line x1="10.5" y1="15.5" x2="10.5" y2="0.5" stroke={color} strokeWidth="1.6" strokeLinecap="square" />
    {/* Diagonal: top-left → bottom-right */}
    <line x1="10.5" y1="0.5" x2="18.5" y2="15.5" stroke={color} strokeWidth="1.6" strokeLinecap="square" />
    {/* Right post */}
    <line x1="18.5" y1="0.5" x2="18.5" y2="15.5" stroke={color} strokeWidth="1.6" strokeLinecap="square" />
  </svg>
);

export default ANSymbol;
