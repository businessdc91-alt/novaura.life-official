# NovAura Reviews & Ratings System

A comprehensive UI component library for the NovAura asset marketplace reviews and ratings system.

## Components

### StarRating
Interactive star rating display with RGB glow effects.

```tsx
import { StarRating } from '@/components/reviews';

// Read-only display
<StarRating rating={4.5} />

// Interactive selector
<StarRating 
  rating={rating} 
  interactive 
  onChange={setRating} 
  size="lg"
/>
```

### ReviewCard
Individual review display with user info, ratings, and actions.

```tsx
import { ReviewCard } from '@/components/reviews';

<ReviewCard
  review={reviewData}
  isCreator={true}
  currentUserId="user_123"
  onHelpful={(id) => console.log('Marked helpful:', id)}
  onReply={(id) => console.log('Reply to:', id)}
/>
```

### ReviewList
Complete review list with filters, sorting, and pagination.

```tsx
import { ReviewList } from '@/components/reviews';

<ReviewList
  assetId="asset_123"
  currentUserId="user_123"
  isCreator={false}
  onHelpful={(id) => console.log('Marked helpful:', id)}
  onReply={(id) => console.log('Reply to:', id)}
/>
```

### ReviewForm
Form for writing new reviews with validation.

```tsx
import { ReviewForm } from '@/components/reviews';

<ReviewForm
  assetId="asset_123"
  userId="user_123"
  userName="John Doe"
  userAvatar="https://..."
  onSubmit={async (review) => {
    await reviewService.addReview(review);
  }}
  onCancel={() => setShowForm(false)}
/>
```

## Service Integration

```tsx
import { reviewService } from '@/services/reviewService';

// Get reviews
const reviews = await reviewService.getReviews(assetId, {
  filterType: 'positive',
  sortBy: 'newest'
});

// Get summary
const summary = await reviewService.getReviewSummary(assetId);

// Add review
await reviewService.addReview({
  assetId: 'asset_123',
  userId: 'user_123',
  userName: 'John Doe',
  rating: 5,
  title: 'Great asset!',
  content: 'This asset exceeded my expectations...'
});

// Mark helpful
await reviewService.markHelpful(reviewId);

// Add reply (creator only)
await reviewService.addReply(reviewId, creatorId, creatorName, content);
```

## Asset Detail Page Integration

```tsx
// In AssetDetailPage.tsx
import { ReviewList, ReviewForm } from '@/components/reviews';
import { reviewService, ExtendedReview } from '@/services/reviewService';
import { useAuth } from '@/hooks/useAuth';

export function AssetDetailPage({ asset }: { asset: Asset }) {
  const { user } = useAuth();
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [userReview, setUserReview] = useState<ExtendedReview | null>(null);
  const [canReview, setCanReview] = useState(false);

  useEffect(() => {
    if (user && asset) {
      checkUserReview();
    }
  }, [user, asset]);

  const checkUserReview = async () => {
    const review = await reviewService.getUserReview(asset.id, user.id);
    const can = await reviewService.canUserReview(asset.id, user.id);
    setUserReview(review);
    setCanReview(can);
  };

  const handleSubmitReview = async (reviewData: NewReview) => {
    await reviewService.addReview(reviewData);
    setShowReviewForm(false);
    checkUserReview();
  };

  return (
    <div className="space-y-8">
      {/* ... other asset info ... */}
      
      {/* Reviews Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Reviews</h2>
          {canReview && !userReview && !showReviewForm && (
            <Button onClick={() => setShowReviewForm(true)}>
              Write a Review
            </Button>
          )}
        </div>

        {showReviewForm && (
          <ReviewForm
            assetId={asset.id}
            userId={user.id}
            userName={user.username}
            userAvatar={user.avatar}
            onSubmit={handleSubmitReview}
            onCancel={() => setShowReviewForm(false)}
          />
        )}

        <ReviewList
          assetId={asset.id}
          currentUserId={user?.id}
          isCreator={user?.id === asset.creatorId}
        />
      </section>
    </div>
  );
}
```

## Features

- ⭐ Interactive star rating with half-star support
- 🎨 RGB gradient accents and glow effects
- ✅ Verified purchase badges
- 👍 Helpful voting with animations
- 💬 Creator replies
- 🔍 Filter by: All, Positive, Critical, Verified
- 📊 Sort by: Newest, Highest, Lowest, Most Helpful
- 📈 Rating distribution visualization
- ✍️ Review form with validation
- 🏷️ Pros/Cons tags
- 📱 Fully responsive design
- ♿ Accessible (ARIA labels, keyboard navigation)

## Styling

All components use Tailwind CSS with the NovAura design system:
- Dark cards with `bg-zinc-900/50`
- RGB accents (cyan-500, violet-500, pink-500)
- Gold/yellow stars with amber-400
- Verified badges in emerald-400
- Hover effects with glow shadows
