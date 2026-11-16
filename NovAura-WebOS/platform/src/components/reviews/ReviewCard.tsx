import React, { useState } from 'react';
import { format } from 'date-fns';
import { ThumbsUp, MessageCircle, CheckCircle2, Flag, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExtendedReview } from '@/services/reviewService';
import { StarRating } from './StarRating';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface ReviewCardProps {
  /** Review data to display */
  review: ExtendedReview;
  /** Whether the current user is the creator of the asset */
  isCreator?: boolean;
  /** Current user ID */
  currentUserId?: string;
  /** Callback when helpful is clicked */
  onHelpful?: (reviewId: string) => void;
  /** Callback when reply is clicked */
  onReply?: (reviewId: string) => void;
  /** Callback when report is clicked */
  onReport?: (reviewId: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether the review is highlighted (e.g., user's own review) */
  highlighted?: boolean;
}

/**
 * ReviewCard Component
 * 
 * Displays an individual review with:
 * - User avatar and name
 * - Star rating
 * - Review title and content
 * - Date posted
 * - Helpful button with count
 * - Verified purchase badge
 * - Reply button (for creator)
 * - RGB border glow on hover
 */
export const ReviewCard: React.FC<ReviewCardProps> = ({
  review,
  isCreator = false,
  currentUserId,
  onHelpful,
  onReply,
  onReport,
  className,
  highlighted = false,
}) => {
  const [helpfulCount, setHelpfulCount] = useState(review.helpful);
  const [hasMarkedHelpful, setHasMarkedHelpful] = useState(false);
  const [isHelpfulAnimating, setIsHelpfulAnimating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const isOwnReview = currentUserId === review.userId;
  
  const handleHelpfulClick = () => {
    if (hasMarkedHelpful || isOwnReview) return;
    
    setIsHelpfulAnimating(true);
    setHelpfulCount(prev => prev + 1);
    setHasMarkedHelpful(true);
    
    onHelpful?.(review.id);
    
    setTimeout(() => setIsHelpfulAnimating(false), 300);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    
    return format(date, 'MMM d, yyyy');
  };

  const shouldTruncate = review.content.length > 300;
  const displayContent = shouldTruncate && !isExpanded 
    ? review.content.slice(0, 300) + '...' 
    : review.content;

  return (
    <div
      className={cn(
        'relative rounded-xl p-5 transition-all duration-300',
        'bg-zinc-900/50 border border-zinc-800',
        'hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(0,240,255,0.1)]',
        highlighted && 'border-cyan-500/50 bg-cyan-500/5',
        className
      )}
    >
      {/* RGB Border Effect */}
      <div className="absolute inset-0 rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-pink-500/10" />
      </div>

      <div className="relative">
        {/* Header: Avatar, Name, Rating, Date */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 ring-2 ring-zinc-800">
              <AvatarImage src={review.userAvatar} alt={review.userName} />
              <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-violet-500 text-white text-sm">
                {getInitials(review.userName)}
              </AvatarFallback>
            </Avatar>
            
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-white text-sm">
                  {review.userName}
                </span>
                
                {/* Verified Purchase Badge */}
                {review.verifiedPurchase && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified
                  </span>
                )}
                
                {/* Own Review Badge */}
                {isOwnReview && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    Your Review
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2 mt-0.5">
                <StarRating rating={review.rating} size="sm" />
                <span className="text-zinc-500 text-xs">•</span>
                <span className="text-zinc-500 text-xs">{formatDate(review.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* More Options Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-white">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
              {!isOwnReview && (
                <DropdownMenuItem 
                  onClick={() => onReport?.(review.id)}
                  className="text-zinc-400 focus:text-red-400 focus:bg-red-500/10"
                >
                  <Flag className="h-4 w-4 mr-2" />
                  Report Review
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Review Title */}
        <h4 className="font-semibold text-white mb-2 text-base">
          {review.title}
        </h4>

        {/* Review Content */}
        <p className="text-zinc-300 text-sm leading-relaxed mb-3">
          {displayContent}
        </p>
        
        {/* Expand/Collapse Button */}
        {shouldTruncate && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-cyan-400 hover:text-cyan-300 text-sm mb-3 transition-colors"
          >
            {isExpanded ? 'Show less' : 'Read more'}
          </button>
        )}

        {/* Pros & Cons */}
        {((review.pros?.length ?? 0) > 0 || (review.cons?.length ?? 0) > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {(review.pros?.length ?? 0) > 0 && (
              <div className="space-y-1">
                <span className="text-xs font-medium text-emerald-400">Pros</span>
                <ul className="space-y-0.5">
                  {review.pros!.map((pro, i) => (
                    <li key={i} className="text-xs text-zinc-400 flex items-center gap-1">
                      <span className="text-emerald-500">+</span> {pro}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(review.cons?.length ?? 0) > 0 && (
              <div className="space-y-1">
                <span className="text-xs font-medium text-red-400">Cons</span>
                <ul className="space-y-0.5">
                  {review.cons!.map((con, i) => (
                    <li key={i} className="text-xs text-zinc-400 flex items-center gap-1">
                      <span className="text-red-500">-</span> {con}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Actions Bar */}
        <div className="flex items-center gap-4 pt-3 border-t border-zinc-800">
          {/* Helpful Button */}
          <button
            onClick={handleHelpfulClick}
            disabled={hasMarkedHelpful || isOwnReview}
            className={cn(
              'flex items-center gap-1.5 text-sm transition-all duration-200',
              hasMarkedHelpful 
                ? 'text-cyan-400' 
                : 'text-zinc-500 hover:text-zinc-300',
              isOwnReview && 'opacity-50 cursor-not-allowed',
              isHelpfulAnimating && 'scale-110'
            )}
          >
            <ThumbsUp className={cn(
              'w-4 h-4 transition-transform',
              isHelpfulAnimating && 'scale-125'
            )} />
            <span>Helpful</span>
            {helpfulCount > 0 && (
              <span className={cn(
                'tabular-nums transition-all',
                isHelpfulAnimating && 'text-cyan-400 font-medium'
              )}>
                ({helpfulCount})
              </span>
            )}
          </button>

          {/* Reply Button (Creator Only) */}
          {isCreator && !review.reply && (
            <button
              onClick={() => onReply?.(review.id)}
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-cyan-400 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Reply</span>
            </button>
          )}
        </div>

        {/* Creator Reply */}
        {review.reply && (
          <div className="mt-4 pl-4 border-l-2 border-cyan-500/30 bg-cyan-500/5 rounded-r-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={review.reply.creatorAvatar} alt={review.reply.creatorName} />
                <AvatarFallback className="bg-violet-500 text-white text-xs">
                  {getInitials(review.reply.creatorName)}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-cyan-400 text-sm">{review.reply.creatorName}</span>
              <span className="text-zinc-500 text-xs">• Creator</span>
              <span className="text-zinc-500 text-xs">• {formatDate(review.reply.createdAt)}</span>
            </div>
            <p className="text-zinc-300 text-sm">{review.reply.content}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewCard;
