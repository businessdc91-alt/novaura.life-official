import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { ExtendedReview, ReviewSummary, ReviewFilters } from '@/services/reviewService';
import { reviewService } from '@/services/reviewService';
import { ReviewCard } from './ReviewCard';
import { StarRating } from './StarRating';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageSquare, Filter, ChevronDown, Loader2, Star } from 'lucide-react';

export interface ReviewListProps {
  /** Asset ID to fetch reviews for */
  assetId: string;
  /** Current user ID */
  currentUserId?: string;
  /** Whether the current user is the creator of the asset */
  isCreator?: boolean;
  /** Callback when a review is marked helpful */
  onHelpful?: (reviewId: string) => void;
  /** Callback when creator wants to reply */
  onReply?: (reviewId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

type FilterTab = 'all' | 'positive' | 'critical' | 'verified';

/**
 * ReviewList Component
 * 
 * Displays a list of reviews with:
 * - Summary header (average rating, total reviews, star distribution)
 * - Filter tabs: All, Positive (4-5), Critical (1-3), Verified Purchase
 * - Sort options: Newest, Highest, Lowest, Most Helpful
 * - Load more pagination
 * - Empty state when no reviews
 */
export const ReviewList: React.FC<ReviewListProps> = ({
  assetId,
  currentUserId,
  isCreator = false,
  onHelpful,
  onReply,
  className,
}) => {
  const [reviews, setReviews] = useState<ExtendedReview[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [sortBy, setSortBy] = useState<ReviewFilters['sortBy']>('newest');
  const [displayCount, setDisplayCount] = useState(5);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async (isLoadMore = false) => {
    if (!isLoadMore) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const filters: ReviewFilters = {
        filterType: activeTab,
        sortBy,
      };

      const [reviewsData, summaryData] = await Promise.all([
        reviewService.getReviews(assetId, filters),
        reviewService.getReviewSummary(assetId),
      ]);

      setReviews(reviewsData);
      setSummary(summaryData);
    } catch (err) {
      setError('Failed to load reviews. Please try again.');
      console.error('Error fetching reviews:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [assetId, activeTab, sortBy]);

  useEffect(() => {
    fetchReviews();
    // Reset display count when filters change
    setDisplayCount(5);
  }, [fetchReviews]);

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value as ReviewFilters['sortBy']);
  };

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + 5);
  };

  const handleHelpful = async (reviewId: string) => {
    try {
      await reviewService.markHelpful(reviewId);
      onHelpful?.(reviewId);
    } catch (err) {
      console.error('Error marking helpful:', err);
    }
  };

  const displayedReviews = reviews.slice(0, displayCount);
  const hasMore = displayCount < reviews.length;

  // Calculate percentage for distribution bars
  const getPercentage = (count: number) => {
    if (!summary || summary.total === 0) return 0;
    return (count / summary.total) * 100;
  };

  const tabs: { value: FilterTab; label: string; count?: number }[] = [
    { value: 'all', label: 'All Reviews', count: summary?.total },
    { value: 'positive', label: 'Positive' },
    { value: 'critical', label: 'Critical' },
    { value: 'verified', label: 'Verified Purchase' },
  ];

  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-zinc-800/50 rounded-xl" />
          <div className="h-48 bg-zinc-800/50 rounded-xl" />
          <div className="h-48 bg-zinc-800/50 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('text-center py-12', className)}>
        <p className="text-red-400 mb-4">{error}</p>
        <Button onClick={() => fetchReviews()} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Summary Header */}
      {summary && summary.total > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Average Rating */}
            <div className="flex flex-col items-center justify-center md:border-r md:border-zinc-800 md:pr-6">
              <div className="text-5xl font-bold text-white mb-2">
                {summary.average.toFixed(1)}
              </div>
              <StarRating rating={summary.average} size="md" />
              <p className="text-zinc-500 text-sm mt-2">
                {summary.total} {summary.total === 1 ? 'review' : 'reviews'}
              </p>
              {summary.recommendPercentage !== undefined && (
                <p className="text-emerald-400 text-xs mt-1">
                  {summary.recommendPercentage}% would recommend
                </p>
              )}
            </div>

            {/* Distribution Bars */}
            <div className="flex-1 space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = summary.distribution[star as keyof typeof summary.distribution];
                const percentage = getPercentage(count);
                
                return (
                  <div key={star} className="flex items-center gap-3">
                    <span className="text-sm text-zinc-400 w-3">{star}</span>
                    <Star className="w-4 h-4 text-zinc-600" />
                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          star >= 4 ? 'bg-emerald-500' : star >= 3 ? 'bg-amber-500' : 'bg-red-500'
                        )}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-500 w-8 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filters & Sort */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800 overflow-x-auto max-w-full">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleTabChange(tab.value)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap',
                activeTab === tab.value
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1.5 text-xs text-zinc-500">
                  ({tab.count})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[160px] bg-zinc-900 border-zinc-800 text-sm">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="highest">Highest Rated</SelectItem>
              <SelectItem value="lowest">Lowest Rated</SelectItem>
              <SelectItem value="helpful">Most Helpful</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Reviews List */}
      {reviews.length > 0 ? (
        <div className="space-y-4">
          {displayedReviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              isCreator={isCreator}
              currentUserId={currentUserId}
              onHelpful={handleHelpful}
              onReply={onReply}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-16 bg-zinc-900/30 rounded-xl border border-zinc-800/50 border-dashed">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800/50 flex items-center justify-center">
            <MessageSquare className="w-8 h-8 text-zinc-600" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            No reviews yet
          </h3>
          <p className="text-zinc-500 text-sm max-w-sm mx-auto">
            {activeTab === 'all' 
              ? 'Be the first to share your thoughts on this asset.'
              : 'No reviews match the selected filter. Try a different filter.'}
          </p>
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            onClick={handleLoadMore}
            disabled={loadingMore}
            variant="outline"
            className="border-zinc-700 hover:border-cyan-500/50 hover:bg-cyan-500/10"
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-2" />
                Load More Reviews ({reviews.length - displayCount} remaining)
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ReviewList;
