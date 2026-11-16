import React, { useState, useCallback } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StarRatingProps {
  /** Rating value from 0-5, supports decimals for half stars */
  rating: number;
  /** Maximum number of stars (default: 5) */
  maxStars?: number;
  /** Size of stars: 'sm' | 'md' | 'lg' */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the rating is interactive (clickable) */
  interactive?: boolean;
  /** Callback when rating changes (only called if interactive is true) */
  onChange?: (rating: number) => void;
  /** Additional CSS classes */
  className?: string;
  /** Show numeric rating next to stars */
  showValue?: boolean;
  /** Custom label to show next to rating */
  label?: string;
}

const sizeClasses = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

const containerSizeClasses = {
  sm: 'gap-0.5',
  md: 'gap-1',
  lg: 'gap-1.5',
};

/**
 * StarRating Component
 * 
 * Displays a star rating with support for:
 * - Full and half stars
 * - Interactive rating selection
 * - Hover effects
 * - RGB glow effects
 * - Multiple sizes
 */
export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxStars = 5,
  size = 'md',
  interactive = false,
  onChange,
  className,
  showValue = false,
  label,
}) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const displayRating = hoverRating !== null ? hoverRating : rating;
  
  const handleStarClick = useCallback((index: number) => {
    if (!interactive || !onChange) return;
    
    setIsAnimating(true);
    onChange(index);
    
    setTimeout(() => setIsAnimating(false), 200);
  }, [interactive, onChange]);

  const handleStarHover = useCallback((index: number) => {
    if (!interactive) return;
    setHoverRating(index);
  }, [interactive]);

  const handleMouseLeave = useCallback(() => {
    if (!interactive) return;
    setHoverRating(null);
  }, [interactive]);

  const renderStar = (index: number) => {
    const starValue = index + 1;
    const isFilled = displayRating >= starValue;
    const isHalf = displayRating >= starValue - 0.5 && displayRating < starValue;
    const isHovered = hoverRating !== null && starValue <= hoverRating;
    
    return (
      <button
        key={index}
        type="button"
        disabled={!interactive}
        onClick={() => handleStarClick(starValue)}
        onMouseEnter={() => handleStarHover(starValue)}
        className={cn(
          'relative transition-all duration-200',
          interactive && 'cursor-pointer hover:scale-110',
          isAnimating && 'scale-90',
          !interactive && 'cursor-default'
        )}
        aria-label={`Rate ${starValue} out of ${maxStars} stars`}
      >
        {/* Background star (empty/gray) */}
        <Star
          className={cn(
            sizeClasses[size],
            'transition-colors duration-200',
            isFilled || isHalf
              ? 'text-transparent'
              : 'text-zinc-600'
          )}
          strokeWidth={1.5}
        />
        
        {/* Filled star overlay */}
        {(isFilled || isHalf) && (
          <div className="absolute inset-0 overflow-hidden">
            {isHalf ? (
              <div className="w-1/2 overflow-hidden">
                <Star
                  className={cn(
                    sizeClasses[size],
                    'text-amber-400',
                    'drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]'
                  )}
                  fill="url(#starGradient)"
                  strokeWidth={0}
                />
              </div>
            ) : (
              <Star
                className={cn(
                  sizeClasses[size],
                  'text-amber-400',
                  isHovered && interactive && 'drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]',
                  !interactive && 'drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]'
                )}
                fill="url(#starGradient)"
                strokeWidth={0}
              />
            )}
          </div>
        )}
        
        {/* RGB glow effect for filled stars */}
        {(isFilled || isHalf) && interactive && isHovered && (
          <div 
            className="absolute inset-0 blur-md opacity-60 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(251,191,36,0.4) 0%, transparent 70%)',
            }}
          />
        )}
      </button>
    );
  };

  return (
    <div 
      className={cn(
        'flex items-center',
        className
      )}
      onMouseLeave={handleMouseLeave}
    >
      {/* SVG Gradient Definition */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="starGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="50%" stopColor="#FCD34D" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <linearGradient id="starGradientHover" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FCD34D" />
            <stop offset="50%" stopColor="#FDE68A" />
            <stop offset="100%" stopColor="#FBBF24" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Stars container */}
      <div className={cn('flex', containerSizeClasses[size])}>
        {Array.from({ length: maxStars }, (_, i) => renderStar(i))}
      </div>
      
      {/* Rating value display */}
      {showValue && (
        <span className={cn(
          'ml-2 font-medium tabular-nums',
          size === 'sm' && 'text-xs',
          size === 'md' && 'text-sm',
          size === 'lg' && 'text-base',
          'text-amber-400'
        )}>
          {rating.toFixed(1)}
        </span>
      )}
      
      {/* Custom label */}
      {label && (
        <span className={cn(
          'ml-2 text-zinc-400',
          size === 'sm' && 'text-xs',
          size === 'md' && 'text-sm',
          size === 'lg' && 'text-base'
        )}>
          {label}
        </span>
      )}
    </div>
  );
};

export default StarRating;
