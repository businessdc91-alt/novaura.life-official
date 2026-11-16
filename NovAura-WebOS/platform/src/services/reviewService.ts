import type { Review } from '@/types';

// Extended Review type with additional fields for the reviews system
export interface ReviewReply {
  id: string;
  reviewId: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string;
  content: string;
  createdAt: string;
}

export interface ExtendedReview extends Review {
  userId: string;
  userName: string;
  userAvatar?: string;
  helpful: number;
  verifiedPurchase: boolean;
  reply?: ReviewReply;
  pros?: string[];
  cons?: string[];
  recommend?: boolean;
}

export interface ReviewSummary {
  average: number;
  total: number;
  distribution: { 5: number; 4: number; 3: number; 2: number; 1: number };
  recommendPercentage?: number;
}

export interface NewReview {
  assetId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title: string;
  content: string;
  pros?: string[];
  cons?: string[];
  recommend?: boolean;
}

export interface ReviewFilters {
  rating?: number;
  verifiedOnly?: boolean;
  sortBy?: 'newest' | 'highest' | 'lowest' | 'helpful';
  filterType?: 'all' | 'positive' | 'critical' | 'verified';
}

// In-memory storage for reviews (keyed by assetId)
const reviewsStorage: Map<string, ExtendedReview[]> = new Map();

// In-memory user reviews tracking
const userReviews: Map<string, ExtendedReview> = new Map(); // key: `${userId}_${assetId}`

class ReviewService {
  /**
   * Get reviews for an asset with optional filtering
   */
  async getReviews(assetId: string, filters?: ReviewFilters): Promise<ExtendedReview[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    let reviews = reviewsStorage.get(assetId) || [];

    // Apply filters
    if (filters) {
      // Filter by type
      if (filters.filterType) {
        switch (filters.filterType) {
          case 'positive':
            reviews = reviews.filter(r => r.rating >= 4);
            break;
          case 'critical':
            reviews = reviews.filter(r => r.rating <= 3);
            break;
          case 'verified':
            reviews = reviews.filter(r => r.verifiedPurchase);
            break;
        }
      }

      // Filter by specific rating
      if (filters.rating) {
        reviews = reviews.filter(r => r.rating === filters.rating);
      }

      // Filter by verified only
      if (filters.verifiedOnly) {
        reviews = reviews.filter(r => r.verifiedPurchase);
      }

      // Apply sorting
      if (filters.sortBy) {
        switch (filters.sortBy) {
          case 'newest':
            reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            break;
          case 'highest':
            reviews.sort((a, b) => b.rating - a.rating);
            break;
          case 'lowest':
            reviews.sort((a, b) => a.rating - b.rating);
            break;
          case 'helpful':
            reviews.sort((a, b) => b.helpful - a.helpful);
            break;
        }
      }
    }

    return reviews;
  }

  /**
   * Get review summary for an asset
   */
  async getReviewSummary(assetId: string): Promise<ReviewSummary> {
    await new Promise(resolve => setTimeout(resolve, 200));

    const reviews = reviewsStorage.get(assetId) || [];

    if (reviews.length === 0) {
      return {
        average: 0,
        total: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        recommendPercentage: 0,
      };
    }

    const total = reviews.length;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const average = parseFloat((sum / total).toFixed(1));

    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => {
      if (r.rating >= 1 && r.rating <= 5) {
        distribution[r.rating as keyof typeof distribution]++;
      }
    });

    const recommendCount = reviews.filter(r => r.recommend).length;
    const recommendPercentage = Math.round((recommendCount / total) * 100);

    return {
      average,
      total,
      distribution,
      recommendPercentage,
    };
  }

  /**
   * Add a new review
   */
  async addReview(review: NewReview): Promise<ExtendedReview> {
    await new Promise(resolve => setTimeout(resolve, 500));

    const newReview: ExtendedReview = {
      id: `review_${review.assetId}_${Date.now()}`,
      assetId: review.assetId,
      reviewerId: review.userId,
      userId: review.userId,
      userName: review.userName,
      userAvatar: review.userAvatar,
      rating: review.rating,
      title: review.title,
      content: review.content,
      helpful: 0,
      helpfulCount: 0,
      verifiedPurchase: true, // Assume verified for new reviews
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pros: review.pros,
      cons: review.cons,
      recommend: review.recommend,
    };

    // Add to storage
    const existingReviews = reviewsStorage.get(review.assetId) || [];
    existingReviews.unshift(newReview);
    reviewsStorage.set(review.assetId, existingReviews);

    // Track user review
    userReviews.set(`${review.userId}_${review.assetId}`, newReview);

    return newReview;
  }

  /**
   * Mark a review as helpful
   */
  async markHelpful(reviewId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));

    // Find and update the review
    for (const [, reviews] of reviewsStorage.entries()) {
      const review = reviews.find(r => r.id === reviewId);
      if (review) {
        review.helpful++;
        review.helpfulCount++;
        break;
      }
    }
  }

  /**
   * Add a reply to a review
   */
  async addReply(reviewId: string, creatorId: string, creatorName: string, content: string): Promise<ReviewReply> {
    await new Promise(resolve => setTimeout(resolve, 300));

    const reply: ReviewReply = {
      id: `reply_${reviewId}_${Date.now()}`,
      reviewId,
      creatorId,
      creatorName,
      content,
      createdAt: new Date().toISOString(),
    };

    // Find and update the review
    for (const [, reviews] of reviewsStorage.entries()) {
      const review = reviews.find(r => r.id === reviewId);
      if (review) {
        review.reply = reply;
        break;
      }
    }

    return reply;
  }

  /**
   * Get user's review for an asset
   */
  async getUserReview(assetId: string, userId: string): Promise<ExtendedReview | null> {
    await new Promise(resolve => setTimeout(resolve, 100));

    const key = `${userId}_${assetId}`;
    return userReviews.get(key) || null;
  }

  /**
   * Check if user can review (purchased the asset)
   */
  async canUserReview(assetId: string, userId: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check if user already reviewed
    const existingReview = await this.getUserReview(assetId, userId);
    if (existingReview) {
      return false;
    }

    // In real implementation, check purchase history
    return true;
  }

  /**
   * Update an existing review
   */
  async updateReview(reviewId: string, updates: Partial<NewReview>): Promise<ExtendedReview> {
    await new Promise(resolve => setTimeout(resolve, 300));

    for (const [assetId, reviews] of reviewsStorage.entries()) {
      const reviewIndex = reviews.findIndex(r => r.id === reviewId);
      if (reviewIndex !== -1) {
        const updatedReview = {
          ...reviews[reviewIndex],
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        reviews[reviewIndex] = updatedReview;

        // Update user review tracking
        userReviews.set(`${updatedReview.userId}_${assetId}`, updatedReview);

        return updatedReview;
      }
    }

    throw new Error('Review not found');
  }

  /**
   * Delete a review
   */
  async deleteReview(reviewId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));

    for (const [assetId, reviews] of reviewsStorage.entries()) {
      const reviewIndex = reviews.findIndex(r => r.id === reviewId);
      if (reviewIndex !== -1) {
        const review = reviews[reviewIndex];
        reviews.splice(reviewIndex, 1);

        // Remove from user tracking
        userReviews.delete(`${review.userId}_${assetId}`);
        break;
      }
    }
  }
}

export const reviewService = new ReviewService();
export default reviewService;
