/**
 * WishlistButton Component
 * 
 * Heart/Star button for adding/removing assets from wishlist.
 * Features RGB pulse animation, tooltips, and count display for navbar.
 */

import React, { useState, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWishlistStore } from '@/stores/wishlistStore';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Size variants for the button
type ButtonSize = 'sm' | 'md' | 'lg';

interface WishlistButtonProps {
  /** Asset ID to add/remove from wishlist */
  assetId: string;
  /** Button size variant */
  size?: ButtonSize;
  /** Additional CSS classes */
  className?: string;
  /** Show count badge (for navbar usage) */
  showCount?: boolean;
  /** Optional note to save with the wishlist item */
  note?: string;
  /** Callback when toggled */
  onToggle?: (isInWishlist: boolean) => void;
  /** Use star icon instead of heart */
  useStar?: boolean;
  /** Variant style */
  variant?: 'default' | 'ghost' | 'outline' | 'solid';
}

// Size configurations
const sizeConfig: Record<ButtonSize, { icon: number; button: string }> = {
  sm: { icon: 16, button: 'w-8 h-8' },
  md: { icon: 20, button: 'w-10 h-10' },
  lg: { icon: 24, button: 'w-12 h-12' },
};

/**
 * WishlistButton Component
 * 
 * @example
 * // Basic usage on asset card
 * <WishlistButton assetId={asset.id} size="sm" />
 * 
 * @example
 * // With count badge for navbar
 * <WishlistButton assetId="" size="md" showCount />
 * 
 * @example
 * // Large variant for detail page
 * <WishlistButton assetId={asset.id} size="lg" variant="outline" />
 */
export const WishlistButton: React.FC<WishlistButtonProps> = ({
  assetId,
  size = 'md',
  className,
  showCount = false,
  note,
  onToggle,
  variant = 'default',
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const { toggleItem, isInWishlist, itemCount } = useWishlistStore();
  const { isAuthenticated } = useAuthStore();
  const { openLoginModal } = useUIStore();

  const inWishlist = isInWishlist(assetId);
  const config = sizeConfig[size];

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // If just showing count (navbar mode), navigate to wishlist
    if (showCount) {
      window.location.href = `${import.meta.env.BASE_URL}wishlist`;
      return;
    }

    // Require authentication
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }

    // Trigger animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);

    // Toggle wishlist
    const added = toggleItem(assetId, note);
    onToggle?.(added);
  }, [assetId, note, toggleItem, isAuthenticated, openLoginModal, onToggle, showCount]);

  // Navbar variant with count
  if (showCount) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleClick}
              className={cn(
                'relative flex items-center justify-center rounded-lg transition-all duration-300',
                'text-text-secondary hover:text-neon-magenta hover:bg-neon-magenta/10',
                config.button,
                className
              )}
            >
              <Heart className={cn(
                'transition-all duration-300',
                itemCount > 0 && 'fill-neon-magenta text-neon-magenta'
              )} size={config.icon} />
              
              {/* Count badge */}
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-neon-magenta text-void text-xs font-bold rounded-full flex items-center justify-center animate-in zoom-in">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{itemCount > 0 ? `${itemCount} item${itemCount !== 1 ? 's' : ''} in wishlist` : 'View wishlist'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Variant styles
  const variantStyles = {
    default: cn(
      'rounded-full transition-all duration-300',
      inWishlist
        ? 'bg-neon-magenta/20 text-neon-magenta'
        : 'bg-white/5 text-text-muted hover:text-text-primary hover:bg-white/10'
    ),
    ghost: cn(
      'rounded-lg transition-all duration-300',
      'hover:bg-white/5',
      inWishlist ? 'text-neon-magenta' : 'text-text-muted hover:text-text-primary'
    ),
    outline: cn(
      'rounded-lg border transition-all duration-300',
      inWishlist
        ? 'border-neon-magenta bg-neon-magenta/10 text-neon-magenta'
        : 'border-white/10 text-text-muted hover:text-text-primary hover:border-white/20'
    ),
    solid: cn(
      'rounded-lg transition-all duration-300',
      inWishlist
        ? 'bg-neon-magenta text-white'
        : 'bg-void-light text-text-muted hover:text-text-primary'
    ),
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            onClick={handleClick}
            className={cn(
              'relative flex items-center justify-center',
              variantStyles[variant],
              config.button,
              className
            )}
            whileTap={{ scale: 0.9 }}
            animate={isAnimating ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            {/* RGB Glow Effect when active */}
            {inWishlist && (
              <span className="absolute inset-0 rounded-lg animate-rgb-pulse opacity-50" />
            )}
            
            {/* Heart Icon */}
            <AnimatePresence mode="wait">
              <motion.div
                key={inWishlist ? 'filled' : 'outline'}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Heart
                  className={cn(
                    'relative z-10 transition-all duration-300',
                    inWishlist && 'fill-neon-magenta drop-shadow-[0_0_8px_rgba(255,0,128,0.5)]'
                  )}
                  size={config.icon}
                />
              </motion.div>
            </AnimatePresence>

            {/* Particle burst effect on add */}
            {isAnimating && inWishlist && (
              <>
                {[...Array(6)].map((_, i) => (
                  <motion.span
                    key={i}
                    className="absolute w-1 h-1 rounded-full bg-neon-magenta"
                    initial={{ scale: 0, x: 0, y: 0 }}
                    animate={{
                      scale: [0, 1, 0],
                      x: Math.cos((i * 60 * Math.PI) / 180) * 20,
                      y: Math.sin((i * 60 * Math.PI) / 180) * 20,
                    }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                ))}
              </>
            )}
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/**
 * Compact Wishlist Button for Asset Cards
 * Smaller, simpler variant for grid layouts
 */
export const WishlistCardButton: React.FC<{
  assetId: string;
  className?: string;
}> = ({ assetId, className }) => {
  const [_isAnimating, setIsAnimating] = useState(false);
  const { toggleItem, isInWishlist } = useWishlistStore();
  const { isAuthenticated } = useAuthStore();
  const { openLoginModal } = useUIStore();

  const inWishlist = isInWishlist(assetId);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      openLoginModal();
      return;
    }

    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
    toggleItem(assetId);
  }, [assetId, toggleItem, isAuthenticated, openLoginModal]);

  return (
    <motion.button
      onClick={handleClick}
      className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center',
        'bg-void/80 backdrop-blur-sm border border-white/10',
        'transition-all duration-300',
        inWishlist
          ? 'text-neon-magenta border-neon-magenta/50 bg-neon-magenta/20'
          : 'text-text-muted hover:text-white hover:bg-white/10',
        className
      )}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
    >
      <Heart
        className={cn(
          'w-4 h-4 transition-all duration-300',
          inWishlist && 'fill-neon-magenta'
        )}
      />
      
      {/* Subtle pulse animation when active */}
      {inWishlist && (
        <span className="absolute inset-0 rounded-full animate-ping bg-neon-magenta/20" />
      )}
    </motion.button>
  );
};

export default WishlistButton;
