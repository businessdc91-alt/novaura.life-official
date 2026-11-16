/**
 * EmptyState Component
 * 
 * A reusable empty state component for NovAura Unified platform.
 * Supports various contexts like search results, cart, wishlist, orders, and downloads.
 * 
 * @example
 * // Browse page - No search results
 * <EmptyState
 *   icon={Search}
 *   title="No results found"
 *   description="We couldn't find any assets matching your search. Try different keywords or filters."
 *   action={{ label: "Clear Filters", onClick: handleClearFilters }}
 *   secondaryAction={{ label: "Browse All", onClick: () => navigate('/browse') }}
 * />
 * 
 * @example
 * // Cart page - Empty cart
 * <EmptyState
 *   icon={ShoppingCart}
 *   title="Your cart is empty"
 *   description="Looks like you haven't added any assets to your cart yet."
 *   action={{ label: "Start Shopping", onClick: () => navigate('/browse') }}
 * />
 * 
 * @example
 * // Creator dashboard - No assets
 * <EmptyState
 *   icon={Package}
 *   title="No assets yet"
 *   description="Start building your portfolio by uploading your first asset."
 *   action={{ label: "Upload Asset", onClick: () => navigate('/creator/upload') }}
 * />
 */

import {
  Search,
  ShoppingCart,
  Heart,
  Package,
  Download,
  Upload,
  Bell,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface EmptyStateAction {
  /** Label text for the action button */
  label: string;
  /** Click handler for the action button */
  onClick: () => void;
  /** Optional href for link-style actions */
  href?: string;
}

export interface EmptyStateProps {
  /** Lucide icon component to display */
  icon: LucideIcon;
  /** Title text */
  title: string;
  /** Description text */
  description: string;
  /** Primary action button configuration */
  action?: EmptyStateAction;
  /** Secondary action button configuration */
  secondaryAction?: EmptyStateAction;
  /** Optional suggestion chips or related links */
  suggestions?: Array<{
    label: string;
    onClick: () => void;
  }>;
  /** Additional CSS classes */
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  suggestions,
  className,
}: EmptyStateProps) {
  const handleActionClick = (actionConfig?: EmptyStateAction) => {
    if (actionConfig) {
      actionConfig.onClick();
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-12 text-center',
        className
      )}
    >
      {/* Icon Container */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
        <Icon className="h-10 w-10 text-neon-cyan" strokeWidth={1.5} />
      </div>

      {/* Title */}
      <h3 className="mb-2 text-xl font-semibold text-white font-heading">
        {title}
      </h3>

      {/* Description */}
      <p className="mb-6 max-w-sm text-text-secondary text-sm leading-relaxed">
        {description}
      </p>

      {/* Action Buttons */}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {action && (
            <Button
              onClick={() => handleActionClick(action)}
              className="bg-gradient-to-r from-neon-cyan via-neon-violet to-neon-magenta hover:opacity-90 text-white font-medium transition-all duration-300 hover:shadow-glow-cyan"
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outline"
              onClick={() => handleActionClick(secondaryAction)}
              className="border-white/20 text-white hover:bg-white/5 hover:text-white"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}

      {/* Suggestion Chips */}
      {suggestions && suggestions.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <span className="text-sm text-text-muted">Try:</span>
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={suggestion.onClick}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-text-secondary transition-colors hover:border-neon-cyan/50 hover:text-neon-cyan"
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Pre-configured EmptyState variants for common use cases
 */

export function SearchEmptyState({
  searchTerm,
  onClearFilters,
  onBrowseAll,
  className,
}: {
  searchTerm?: string;
  onClearFilters: () => void;
  onBrowseAll: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={Search}
      title={searchTerm ? `No results for "${searchTerm}"` : 'No results found'}
      description="We couldn't find any assets matching your search. Try different keywords, check your spelling, or browse all available assets."
      action={{ label: 'Clear Filters', onClick: onClearFilters }}
      secondaryAction={{ label: 'Browse All', onClick: onBrowseAll }}
      className={className}
    />
  );
}

export function CartEmptyState({
  onStartShopping,
  className,
}: {
  onStartShopping: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={ShoppingCart}
      title="Your cart is empty"
      description="Looks like you haven't added any assets to your cart yet. Discover amazing 3D models, textures, and more in our marketplace."
      action={{ label: 'Start Shopping', onClick: onStartShopping }}
      className={className}
    />
  );
}

export function WishlistEmptyState({
  onBrowseAssets,
  className,
}: {
  onBrowseAssets: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={Heart}
      title="Your wishlist is empty"
      description="Save your favorite assets here for quick access. Click the heart icon on any asset to add it to your wishlist."
      action={{ label: 'Browse Assets', onClick: onBrowseAssets }}
      className={className}
    />
  );
}

export function OrdersEmptyState({
  onBrowseAssets,
  className,
}: {
  onBrowseAssets: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={Package}
      title="No orders yet"
      description="You haven't made any purchases yet. Start exploring our marketplace to find amazing assets for your projects."
      action={{ label: 'Browse Assets', onClick: onBrowseAssets }}
      className={className}
    />
  );
}

export function DownloadsEmptyState({
  onBrowseAssets,
  onViewOrders,
  className,
}: {
  onBrowseAssets: () => void;
  onViewOrders?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={Download}
      title="No downloads available"
      description="Your downloaded assets will appear here. Purchase assets from the marketplace to access your downloads."
      action={{ label: 'Browse Assets', onClick: onBrowseAssets }}
      secondaryAction={onViewOrders ? { label: 'View Orders', onClick: onViewOrders } : undefined}
      className={className}
    />
  );
}

export function CreatorAssetsEmptyState({
  onUploadAsset,
  className,
}: {
  onUploadAsset: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={Upload}
      title="No assets published"
      description="Start building your creator portfolio by uploading your first asset. Share your 3D models, textures, audio, and more with the community."
      action={{ label: 'Upload Asset', onClick: onUploadAsset }}
      className={className}
    />
  );
}

export function NotificationsEmptyState({
  className,
}: {
  className?: string;
}) {
  return (
    <EmptyState
      icon={Bell}
      title="No notifications"
      description="You're all caught up! New notifications about your orders, assets, and account will appear here."
      className={className}
    />
  );
}

export function MessagesEmptyState({
  onStartConversation,
  className,
}: {
  onStartConversation?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={MessageSquare}
      title="No messages"
      description="Your conversations with creators and buyers will appear here. Start a conversation to discuss assets or get support."
      action={onStartConversation ? { label: 'New Message', onClick: onStartConversation } : undefined}
      className={className}
    />
  );
}

export default EmptyState;
