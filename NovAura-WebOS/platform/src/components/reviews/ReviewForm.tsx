import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { StarRating } from './StarRating';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { NewReview } from '@/services/reviewService';
import { 
  Send, 
  X, 
  Plus, 
  ThumbsUp, 
  ThumbsDown, 
  AlertCircle,
  Sparkles,
  Loader2 
} from 'lucide-react';

export interface ReviewFormProps {
  /** Asset ID being reviewed */
  assetId: string;
  /** Current user ID */
  userId: string;
  /** Current user name */
  userName: string;
  /** Current user avatar URL */
  userAvatar?: string;
  /** Callback when review is submitted */
  onSubmit: (review: NewReview) => Promise<void>;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether user has verified purchase */
  verifiedPurchase?: boolean;
}

const MIN_TITLE_LENGTH = 5;
const MAX_TITLE_LENGTH = 100;
const MIN_CONTENT_LENGTH = 20;
const MAX_CONTENT_LENGTH = 2000;
const MAX_PROS_CONS = 3;

/**
 * ReviewForm Component
 * 
 * Form for writing reviews with:
 * - Interactive star rating selector
 * - Review title input with validation
 * - Review content textarea with character counter
 * - Pros/Cons tags
 * - Recommend checkbox
 * - Submit button with RGB styling
 * - Guidelines reminder
 */
export const ReviewForm: React.FC<ReviewFormProps> = ({
  assetId,
  userId,
  userName,
  userAvatar,
  onSubmit,
  onCancel,
  className,
  verifiedPurchase: _verifiedPurchase = true,
}) => {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pros, setPros] = useState<string[]>([]);
  const [cons, setCons] = useState<string[]>([]);
  const [currentPro, setCurrentPro] = useState('');
  const [currentCon, setCurrentCon] = useState('');
  const [recommend, setRecommend] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (rating === 0) {
      newErrors.rating = 'Please select a rating';
    }

    if (title.trim().length < MIN_TITLE_LENGTH) {
      newErrors.title = `Title must be at least ${MIN_TITLE_LENGTH} characters`;
    } else if (title.trim().length > MAX_TITLE_LENGTH) {
      newErrors.title = `Title must be less than ${MAX_TITLE_LENGTH} characters`;
    }

    if (content.trim().length < MIN_CONTENT_LENGTH) {
      newErrors.content = `Review must be at least ${MIN_CONTENT_LENGTH} characters`;
    } else if (content.trim().length > MAX_CONTENT_LENGTH) {
      newErrors.content = `Review must be less than ${MAX_CONTENT_LENGTH} characters`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [rating, title, content]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const review: NewReview = {
        assetId,
        userId,
        userName,
        userAvatar,
        rating,
        title: title.trim(),
        content: content.trim(),
        pros: pros.length > 0 ? pros : undefined,
        cons: cons.length > 0 ? cons : undefined,
        recommend,
      };

      await onSubmit(review);

      // Reset form on success
      setRating(0);
      setTitle('');
      setContent('');
      setPros([]);
      setCons([]);
      setRecommend(true);
      setErrors({});
    } catch (err) {
      setErrors({ submit: 'Failed to submit review. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addPro = () => {
    if (currentPro.trim() && pros.length < MAX_PROS_CONS) {
      setPros([...pros, currentPro.trim()]);
      setCurrentPro('');
    }
  };

  const addCon = () => {
    if (currentCon.trim() && cons.length < MAX_PROS_CONS) {
      setCons([...cons, currentCon.trim()]);
      setCurrentCon('');
    }
  };

  const removePro = (index: number) => {
    setPros(pros.filter((_, i) => i !== index));
  };

  const removeCon = (index: number) => {
    setCons(cons.filter((_, i) => i !== index));
  };

  const contentLength = content.length;
  const isNearLimit = contentLength > MAX_CONTENT_LENGTH * 0.9;
  const isOverLimit = contentLength > MAX_CONTENT_LENGTH;

  return (
    <form 
      onSubmit={handleSubmit}
      className={cn(
        'bg-zinc-900/70 border border-zinc-800 rounded-xl p-6',
        'transition-all duration-300',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Write a Review</h3>
          <p className="text-sm text-zinc-500">Share your experience with this asset</p>
        </div>
      </div>

      {/* Rating Selection */}
      <div className="mb-6">
        <Label className="text-sm font-medium text-zinc-300 mb-2 block">
          Overall Rating <span className="text-red-400">*</span>
        </Label>
        <div className="flex items-center gap-4">
          <StarRating
            rating={rating}
            onChange={setRating}
            interactive
            size="lg"
          />
          <span className={cn(
            'text-sm font-medium transition-colors',
            rating === 5 ? 'text-emerald-400' :
            rating === 4 ? 'text-emerald-400' :
            rating === 3 ? 'text-amber-400' :
            rating >= 1 ? 'text-red-400' : 'text-zinc-600'
          )}>
            {rating === 5 && 'Excellent!'}
            {rating === 4 && 'Very Good'}
            {rating === 3 && 'Good'}
            {rating === 2 && 'Fair'}
            {rating === 1 && 'Poor'}
            {rating === 0 && 'Select a rating'}
          </span>
        </div>
        {errors.rating && (
          <p className="text-red-400 text-xs mt-1">{errors.rating}</p>
        )}
      </div>

      {/* Title Input */}
      <div className="mb-4">
        <Label htmlFor="review-title" className="text-sm font-medium text-zinc-300 mb-2 block">
          Review Title <span className="text-red-400">*</span>
        </Label>
        <Input
          id="review-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setFocusedField('title')}
          onBlur={() => setFocusedField(null)}
          placeholder="Summarize your experience in a few words"
          className={cn(
            'bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-600',
            'focus:border-cyan-500/50 focus:ring-cyan-500/20',
            errors.title && 'border-red-500/50 focus:border-red-500/50'
          )}
          maxLength={MAX_TITLE_LENGTH}
        />
        <div className="flex justify-between mt-1">
          {errors.title ? (
            <p className="text-red-400 text-xs">{errors.title}</p>
          ) : (
            <span className="text-xs text-zinc-600">
              {focusedField === 'title' && `At least ${MIN_TITLE_LENGTH} characters`}
            </span>
          )}
          <span className={cn(
            'text-xs',
            title.length > MAX_TITLE_LENGTH * 0.9 ? 'text-amber-400' : 'text-zinc-600'
          )}>
            {title.length}/{MAX_TITLE_LENGTH}
          </span>
        </div>
      </div>

      {/* Content Textarea */}
      <div className="mb-4">
        <Label htmlFor="review-content" className="text-sm font-medium text-zinc-300 mb-2 block">
          Review Details <span className="text-red-400">*</span>
        </Label>
        <Textarea
          id="review-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onFocus={() => setFocusedField('content')}
          onBlur={() => setFocusedField(null)}
          placeholder="Tell others what you liked or disliked about this asset. How was the quality? Was it easy to use?"
          className={cn(
            'bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-600 min-h-[120px]',
            'focus:border-cyan-500/50 focus:ring-cyan-500/20 resize-none',
            errors.content && 'border-red-500/50 focus:border-red-500/50',
            isOverLimit && 'border-red-500/50'
          )}
          maxLength={MAX_CONTENT_LENGTH}
        />
        <div className="flex justify-between mt-1">
          {errors.content ? (
            <p className="text-red-400 text-xs">{errors.content}</p>
          ) : (
            <span className="text-xs text-zinc-600">
              {focusedField === 'content' && `At least ${MIN_CONTENT_LENGTH} characters`}
            </span>
          )}
          <span className={cn(
            'text-xs',
            isOverLimit ? 'text-red-400' : isNearLimit ? 'text-amber-400' : 'text-zinc-600'
          )}>
            {contentLength}/{MAX_CONTENT_LENGTH}
          </span>
        </div>
      </div>

      {/* Pros Section */}
      <div className="mb-4">
        <Label className="text-sm font-medium text-zinc-300 mb-2 block">
          Pros <span className="text-zinc-600 text-xs">(optional)</span>
        </Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {pros.map((pro, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-sm border border-emerald-500/20"
            >
              <ThumbsUp className="w-3 h-3" />
              {pro}
              <button
                type="button"
                onClick={() => removePro(index)}
                className="ml-1 hover:text-emerald-300"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        {pros.length < MAX_PROS_CONS && (
          <div className="flex gap-2">
            <Input
              value={currentPro}
              onChange={(e) => setCurrentPro(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPro())}
              placeholder="Add a pro (e.g., 'Great quality')"
              className="bg-zinc-950/50 border-zinc-800 text-white text-sm placeholder:text-zinc-600"
            />
            <Button
              type="button"
              onClick={addPro}
              disabled={!currentPro.trim()}
              variant="outline"
              size="icon"
              className="border-zinc-700 hover:border-emerald-500/50 hover:bg-emerald-500/10"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Cons Section */}
      <div className="mb-4">
        <Label className="text-sm font-medium text-zinc-300 mb-2 block">
          Cons <span className="text-zinc-600 text-xs">(optional)</span>
        </Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {cons.map((con, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/10 text-red-400 text-sm border border-red-500/20"
            >
              <ThumbsDown className="w-3 h-3" />
              {con}
              <button
                type="button"
                onClick={() => removeCon(index)}
                className="ml-1 hover:text-red-300"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        {cons.length < MAX_PROS_CONS && (
          <div className="flex gap-2">
            <Input
              value={currentCon}
              onChange={(e) => setCurrentCon(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCon())}
              placeholder="Add a con (e.g., 'Documentation lacking')"
              className="bg-zinc-950/50 border-zinc-800 text-white text-sm placeholder:text-zinc-600"
            />
            <Button
              type="button"
              onClick={addCon}
              disabled={!currentCon.trim()}
              variant="outline"
              size="icon"
              className="border-zinc-700 hover:border-red-500/50 hover:bg-red-500/10"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Recommend Checkbox */}
      <div className="mb-6">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-950/30 border border-zinc-800/50">
          <Checkbox
            id="recommend"
            checked={recommend}
            onCheckedChange={(checked) => setRecommend(checked as boolean)}
            className="mt-0.5 border-zinc-600 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
          />
          <div className="flex-1">
            <Label
              htmlFor="recommend"
              className="text-sm font-medium text-zinc-300 cursor-pointer"
            >
              Would you recommend this to others?
            </Label>
            <p className="text-xs text-zinc-500 mt-0.5">
              Let others know if you think this asset is worth purchasing
            </p>
          </div>
        </div>
      </div>

      {/* Guidelines Reminder */}
      <div className="flex items-start gap-2 p-3 mb-6 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
        <AlertCircle className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-cyan-300/80">
          Your review helps other creators make informed decisions. Please be honest, 
          constructive, and respectful. Reviews that violate our community guidelines 
          may be removed.
        </p>
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {errors.submit}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3">
        {onCancel && (
          <Button
            type="button"
            onClick={onCancel}
            variant="ghost"
            className="text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || isOverLimit}
          className={cn(
            'relative overflow-hidden bg-gradient-to-r from-cyan-500 via-violet-500 to-pink-500',
            'text-white font-medium px-6',
            'hover:opacity-90 transition-opacity',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Submit Review
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default ReviewForm;
