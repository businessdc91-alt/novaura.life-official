/**
 * WishlistGrid Component
 * 
 * Displays wishlist items in a responsive grid layout.
 * Features asset cards with quick actions, bulk operations, and empty state.
 */

import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart,
  X,
  Share2,
  Trash2,
  Heart,
  ExternalLink,
  MoreVertical,
  Download,
} from 'lucide-react';
import { useWishlistStore } from '@/stores/wishlistStore';
import { useCartStore } from '@/stores/cartStore';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { WishlistEmptyState } from '@/components/ui/EmptyState';
import { formatPrice, getLicenseBadgeClass, getLicenseDisplayName } from '@/utils/format';
import { cn } from '@/lib/utils';
import type { Asset } from '@/types';

// Props interface
interface WishlistGridProps {
  /** Additional CSS classes */
  className?: string;
  /** Layout mode */
  layout?: 'grid' | 'list';
}

/**
 * Individual Wishlist Card Component
 */
const WishlistCard: React.FC<{
  asset: Asset;
  addedAt: string;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onRemove: () => void;
  onMoveToCart: () => void;
  layout: 'grid' | 'list';
}> = ({ asset, addedAt, isSelected, onSelect, onRemove, onMoveToCart, layout }) => {
  const navigate = useNavigate();
  const { isInCart } = useCartStore();
  const inCart = isInCart(asset.id);
  
  // Check if on sale
  const isOnSale = asset.salePrice !== undefined && asset.salePrice < asset.price;
  const displayPrice = isOnSale ? (asset.salePrice ?? 0) : asset.price;
  const discount = isOnSale ? Math.round(((asset.price - asset.salePrice!) / asset.price) * 100) : 0;

  if (layout === 'list') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -100 }}
        className={cn(
          'flex items-center gap-4 p-4 bg-void-light border rounded-xl transition-all',
          isSelected
            ? 'border-neon-cyan/50 bg-neon-cyan/5'
            : 'border-white/5 hover:border-white/10'
        )}
      >
        {/* Selection checkbox */}
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          className="border-white/20"
        />

        {/* Thumbnail */}
        <Link
          to={`/asset/${asset.slug}`}
          className="w-20 h-20 rounded-lg bg-void flex-shrink-0 overflow-hidden group"
        >
          {asset.thumbnailUrl ? (
            <img
              src={asset.thumbnailUrl}
              alt={asset.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neon-cyan/10 to-neon-violet/10">
              <Heart className="w-8 h-8 text-white/20" />
            </div>
          )}
        </Link>

        {/* Content */}
        <div className="flex-grow min-w-0">
          <Link to={`/asset/${asset.slug}`}>
            <h3 className="font-medium text-text-primary hover:text-neon-cyan transition-colors truncate">
              {asset.title}
            </h3>
          </Link>
          <p className="text-text-muted text-sm">
            by {asset.creator?.username || 'Unknown'} • {asset.engineType}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('px-2 py-0.5 rounded text-xs border', getLicenseBadgeClass(asset.licenseTier))}>
              {getLicenseDisplayName(asset.licenseTier)}
            </span>
            {isOnSale && (
              <span className="px-2 py-0.5 rounded text-xs bg-neon-green/20 text-neon-green border border-neon-green/30">
                -{discount}%
              </span>
            )}
          </div>
        </div>

        {/* Price */}
        <div className="text-right">
          {isOnSale ? (
            <div>
              <span className="font-heading text-xl font-bold text-neon-green">
                {formatPrice(displayPrice)}
              </span>
              <span className="text-text-muted line-through text-sm ml-2">
                {formatPrice(asset.price)}
              </span>
            </div>
          ) : (
            <span className="font-heading text-xl font-bold text-neon-cyan">
              {asset.pricingType === 'free' ? 'Free' : formatPrice(asset.price)}
            </span>
          )}
          <p className="text-text-muted text-xs">
            Added {new Date(addedAt).toLocaleDateString()}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="bg-gradient-rgb text-void font-bold"
            onClick={onMoveToCart}
            disabled={inCart}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {inCart ? 'In Cart' : 'Add to Cart'}
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-text-muted hover:text-text-primary">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-void-light border-white/10">
              <DropdownMenuItem onClick={() => navigate(`/asset/${asset.slug}`)}>
                <ExternalLink className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={onRemove} className="text-neon-red focus:text-neon-red">
                <Trash2 className="w-4 h-4 mr-2" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>
    );
  }

  // Grid Layout
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        'group bg-void-light border rounded-xl overflow-hidden transition-all',
        isSelected
          ? 'border-neon-cyan/50 shadow-[0_0_20px_rgba(0,240,255,0.1)]'
          : 'border-white/5 hover:border-white/10'
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-void overflow-hidden">
        <Link to={`/asset/${asset.slug}`}>
          {asset.thumbnailUrl ? (
            <img
              src={asset.thumbnailUrl}
              alt={asset.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neon-cyan/10 to-neon-violet/10">
              <Heart className="w-16 h-16 text-white/10" />
            </div>
          )}
        </Link>

        {/* Selection checkbox */}
        <div className="absolute top-3 left-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            className="border-white/40 data-[state=checked]:bg-neon-cyan data-[state=checked]:border-neon-cyan"
          />
        </div>

        {/* Sale badge */}
        {isOnSale && (
          <div className="absolute top-3 right-3 px-2 py-1 rounded-lg text-xs font-bold bg-neon-green text-void">
            -{discount}%
          </div>
        )}

        {/* License badge */}
        <div className="absolute bottom-3 left-3">
          <span className={cn('px-2 py-1 rounded text-xs border', getLicenseBadgeClass(asset.licenseTier))}>
            {getLicenseDisplayName(asset.licenseTier)}
          </span>
        </div>

        {/* Quick actions overlay */}
        <div className="absolute inset-0 bg-void/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button
            size="sm"
            className="bg-gradient-rgb text-void font-bold"
            onClick={onMoveToCart}
            disabled={inCart}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {inCart ? 'In Cart' : 'Add to Cart'}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <Link to={`/asset/${asset.slug}`}>
          <h3 className="font-medium text-text-primary hover:text-neon-cyan transition-colors line-clamp-1 mb-1">
            {asset.title}
          </h3>
        </Link>
        <p className="text-text-muted text-sm mb-3">
          by {asset.creator?.username || 'Unknown'}
        </p>

        {/* Price and actions */}
        <div className="flex items-center justify-between">
          <div>
            {isOnSale ? (
              <div className="flex items-center gap-2">
                <span className="font-heading text-lg font-bold text-neon-green">
                  {formatPrice(displayPrice)}
                </span>
                <span className="text-text-muted line-through text-sm">
                  {formatPrice(asset.price)}
                </span>
              </div>
            ) : (
              <span className="font-heading text-lg font-bold text-neon-cyan">
                {asset.pricingType === 'free' ? 'Free' : formatPrice(asset.price)}
              </span>
            )}
          </div>

          <button
            onClick={onRemove}
            className="p-2 text-text-muted hover:text-neon-red hover:bg-neon-red/10 rounded-lg transition-colors"
            title="Remove from wishlist"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Added date */}
        <p className="text-text-muted text-xs mt-2">
          Added {new Date(addedAt).toLocaleDateString()}
        </p>
      </div>
    </motion.div>
  );
};

/**
 * Main WishlistGrid Component
 */
export const WishlistGrid: React.FC<WishlistGridProps> = ({
  className,
  layout: initialLayout = 'grid',
}) => {
  const navigate = useNavigate();
  const { items, removeItem, moveItemToCart, moveAllToCart, clearWishlist } = useWishlistStore();
  
  const [layout, setLayout] = useState<'grid' | 'list'>(initialLayout);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  // Filter items with valid assets
  const validItems = items.filter(item => item.asset !== null);

  // Selection handlers
  const toggleSelect = useCallback((assetId: string, selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(assetId);
      } else {
        next.delete(assetId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === validItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(validItems.map(item => item.assetId)));
    }
  }, [selectedIds.size, validItems]);

  // Bulk actions
  const handleRemoveSelected = useCallback(() => {
    selectedIds.forEach(id => removeItem(id));
    setSelectedIds(new Set());
  }, [selectedIds, removeItem]);

  const handleMoveSelectedToCart = useCallback(() => {
    selectedIds.forEach(id => moveItemToCart(id));
    setSelectedIds(new Set());
  }, [selectedIds, moveItemToCart]);

  // Share wishlist
  const handleShare = useCallback(() => {
    const ids = validItems.map(item => item.assetId);
    const encoded = btoa(JSON.stringify(ids));
    const url = `${window.location.origin}/wishlist/shared?ids=${encoded}`;
    setShareUrl(url);
    navigator.clipboard.writeText(url);
  }, [validItems]);

  // Export wishlist
  const handleExport = useCallback(() => {
    const dataStr = JSON.stringify(items, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `novaura-wishlist-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [items]);

  // Empty state
  if (validItems.length === 0) {
    return (
      <div className={className}>
        <WishlistEmptyState onBrowseAssets={() => navigate('/browse')} />
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 p-4 bg-void-light border border-white/5 rounded-xl">
        {/* Left: Selection */}
        <div className="flex items-center gap-4">
          <Checkbox
            checked={selectedIds.size === validItems.length && validItems.length > 0}
            onCheckedChange={toggleSelectAll}
            className="border-white/20"
          />
          <span className="text-text-secondary text-sm">
            {selectedIds.size > 0
              ? `${selectedIds.size} selected`
              : `${validItems.length} item${validItems.length !== 1 ? 's' : ''}`}
          </span>

          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-white/10"
                onClick={handleMoveSelectedToCart}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Move to Cart
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-neon-red/30 text-neon-red hover:bg-neon-red/10"
                onClick={handleRemoveSelected}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove
              </Button>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Layout toggle */}
          <div className="flex border border-white/10 rounded-lg overflow-hidden">
            <button
              onClick={() => setLayout('grid')}
              className={cn(
                'p-2 transition-colors',
                layout === 'grid'
                  ? 'bg-neon-cyan/10 text-neon-cyan'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setLayout('list')}
              className={cn(
                'p-2 transition-colors',
                layout === 'list'
                  ? 'bg-neon-cyan/10 text-neon-cyan'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* More actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="border-white/10">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-void-light border-white/10">
              <DropdownMenuItem onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                Share Wishlist
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={() => setShowClearDialog(true)} className="text-neon-red focus:text-neon-red">
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Move all to cart */}
          <Button
            size="sm"
            className="bg-gradient-rgb text-void font-bold"
            onClick={moveAllToCart}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Move All to Cart
          </Button>
        </div>
      </div>

      {/* Items Grid/List */}
      <AnimatePresence mode="popLayout">
        {layout === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {validItems.map(({ assetId, asset, addedAt }) => (
              asset && (
                <WishlistCard
                  key={assetId}
                  asset={asset}
                  addedAt={addedAt}
                  isSelected={selectedIds.has(assetId)}
                  onSelect={(selected) => toggleSelect(assetId, selected)}
                  onRemove={() => removeItem(assetId)}
                  onMoveToCart={() => moveItemToCart(assetId)}
                  layout={layout}
                />
              )
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {validItems.map(({ assetId, asset, addedAt }) => (
              asset && (
                <WishlistCard
                  key={assetId}
                  asset={asset}
                  addedAt={addedAt}
                  isSelected={selectedIds.has(assetId)}
                  onSelect={(selected) => toggleSelect(assetId, selected)}
                  onRemove={() => removeItem(assetId)}
                  onMoveToCart={() => moveItemToCart(assetId)}
                  layout={layout}
                />
              )
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Clear Confirmation Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="bg-void-light border-white/10">
          <DialogHeader>
            <DialogTitle className="text-text-primary">Clear Wishlist</DialogTitle>
            <DialogDescription className="text-text-secondary">
              Are you sure you want to remove all items from your wishlist? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearDialog(false)} className="border-white/10">
              Cancel
            </Button>
            <Button
              className="bg-neon-red text-white hover:bg-neon-red/90"
              onClick={() => {
                clearWishlist();
                setShowClearDialog(false);
              }}
            >
              Clear All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={!!shareUrl} onOpenChange={() => setShareUrl(null)}>
        <DialogContent className="bg-void-light border-white/10">
          <DialogHeader>
            <DialogTitle className="text-text-primary">Share Wishlist</DialogTitle>
            <DialogDescription className="text-text-secondary">
              Link copied to clipboard! Share this link with others to show them your wishlist.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 bg-void rounded-lg border border-white/10 break-all text-sm text-text-secondary">
            {shareUrl}
          </div>
          <DialogFooter>
            <Button onClick={() => setShareUrl(null)} className="bg-gradient-rgb text-void font-bold">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WishlistGrid;
