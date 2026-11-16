/**
 * Wishlist Store
 * 
 * Zustand store for global wishlist state management.
 * Handles localStorage persistence and server sync.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Asset } from '@/types';
import {
  getWishlist,
  saveWishlist,
  addToWishlist,
  removeFromWishlist,
  isInWishlist as checkIsInWishlist,
  toggleWishlist,
  clearWishlist,
  moveToCart,
  syncToServer,
  syncFromServer,
  getWishlistAssetsSync,
} from '@/services/wishlistService';
import type { WishlistServiceItem } from '@/services/wishlistService';
import { useCartStore } from './cartStore';
import { useUIStore } from './uiStore';

// Extended wishlist item with full asset data
export interface WishlistStoreItem extends WishlistServiceItem {
  asset?: Asset;
}

interface WishlistState {
  // State
  items: WishlistStoreItem[];
  isLoading: boolean;
  lastSyncAt: string | null;
  
  // Getters (computed)
  itemCount: number;
  assetIds: string[];
  
  // Actions
  addItem: (assetId: string, note?: string) => void;
  removeItem: (assetId: string) => void;
  toggleItem: (assetId: string, note?: string) => boolean;
  clearWishlist: () => void;
  loadFromStorage: () => void;
  syncWithServer: (userId: string) => Promise<void>;
  isInWishlist: (assetId: string) => boolean;
  moveItemToCart: (assetId: string) => boolean;
  moveAllToCart: () => number;
  updateNote: (assetId: string, note?: string) => void;
  refreshAssets: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      isLoading: false,
      lastSyncAt: null,

      // Computed getters
      get itemCount() {
        return get().items.length;
      },

      get assetIds() {
        return get().items.map(item => item.assetId);
      },

      // Load items from localStorage and resolve asset data
      loadFromStorage: () => {
        const serviceItems = getWishlist();
        const assets = getWishlistAssetsSync();
        
        const items = serviceItems.map(item => ({
          ...item,
          asset: assets.find(a => a.item.assetId === item.assetId)?.asset || undefined,
        }));
        
        set({ items });
      },

      // Add an item to wishlist
      addItem: (assetId: string, note?: string) => {
        const updatedServiceItems = addToWishlist(assetId, note);
        const assets = getWishlistAssetsSync();
        
        const items = updatedServiceItems.map(item => ({
          ...item,
          asset: assets.find(a => a.item.assetId === item.assetId)?.asset || undefined,
        }));
        
        set({ items });

        // Show toast notification
        const { addToast } = useUIStore.getState();
        const asset = assets.find(a => a.item.assetId === assetId)?.asset;
        addToast({
          type: 'success',
          title: 'Added to wishlist',
          message: asset ? `"${asset.title}" has been added to your wishlist.` : 'Item added to wishlist.',
        });
      },

      // Remove an item from wishlist
      removeItem: (assetId: string) => {
        const updatedServiceItems = removeFromWishlist(assetId);
        const assets = getWishlistAssetsSync();
        
        const items = updatedServiceItems.map(item => ({
          ...item,
          asset: assets.find(a => a.item.assetId === item.assetId)?.asset || undefined,
        }));
        
        set({ items });

        // Show toast notification
        const { addToast } = useUIStore.getState();
        addToast({
          type: 'info',
          title: 'Removed from wishlist',
          message: 'Item has been removed from your wishlist.',
        });
      },

      // Toggle an item in wishlist
      toggleItem: (assetId: string, note?: string) => {
        const result = toggleWishlist(assetId, note);
        const assets = getWishlistAssetsSync();
        
        const items = result.items.map(item => ({
          ...item,
          asset: assets.find(a => a.item.assetId === item.assetId)?.asset || undefined,
        }));
        
        set({ items });

        // Show toast notification
        const { addToast } = useUIStore.getState();
        const asset = assets.find(a => a.item.assetId === assetId)?.asset;
        
        if (result.added) {
          addToast({
            type: 'success',
            title: 'Added to wishlist',
            message: asset ? `"${asset.title}" has been added to your wishlist.` : 'Item added to wishlist.',
          });
        } else {
          addToast({
            type: 'info',
            title: 'Removed from wishlist',
            message: asset ? `"${asset.title}" has been removed from your wishlist.` : 'Item removed from wishlist.',
          });
        }
        
        return result.added;
      },

      // Clear all items
      clearWishlist: () => {
        clearWishlist();
        set({ items: [] });

        const { addToast } = useUIStore.getState();
        addToast({
          type: 'info',
          title: 'Wishlist cleared',
          message: 'All items have been removed from your wishlist.',
        });
      },

      // Sync with server (when user logs in)
      syncWithServer: async (userId: string) => {
        set({ isLoading: true });
        
        try {
          // First, sync local changes to server
          await syncToServer(userId);
          
          // Then, get any new items from server
          await syncFromServer(userId);
          
          // Reload items
          get().loadFromStorage();
          
          set({ 
            lastSyncAt: new Date().toISOString(),
            isLoading: false,
          });
        } catch (error) {
          console.error('Failed to sync wishlist:', error);
          set({ isLoading: false });
        }
      },

      // Check if an asset is in wishlist
      isInWishlist: (assetId: string) => {
        return checkIsInWishlist(assetId);
      },

      // Move an item to cart
      moveItemToCart: (assetId: string) => {
        const movedId = moveToCart(assetId);
        
        if (movedId) {
          // Get asset from current items
          const { items } = get();
          const asset = items.find(i => i.assetId === movedId)?.asset;
          
          if (asset) {
            // Add to cart
            const { addItem } = useCartStore.getState();
            addItem(asset);
          }
          
          // Update wishlist state
          get().loadFromStorage();
          
          // Show toast
          const { addToast } = useUIStore.getState();
          addToast({
            type: 'success',
            title: 'Moved to cart',
            message: asset ? `"${asset.title}" has been moved to your cart.` : 'Item moved to cart.',
          });
          
          return true;
        }
        
        return false;
      },

      // Move all items to cart
      moveAllToCart: () => {
        const { items } = get();
        const { addItem } = useCartStore.getState();
        let movedCount = 0;
        
        items.forEach(({ asset }) => {
          if (asset) {
            moveToCart(asset.id);
            addItem(asset);
            movedCount++;
          }
        });
        
        // Update state
        set({ items: [] });
        
        // Show toast
        if (movedCount > 0) {
          const { addToast } = useUIStore.getState();
          addToast({
            type: 'success',
            title: 'All items moved to cart',
            message: `${movedCount} item${movedCount !== 1 ? 's' : ''} moved to your cart.`,
          });
        }
        
        return movedCount;
      },

      // Update item note
      updateNote: (assetId: string, note?: string) => {
        const updatedServiceItems = getWishlist().map(item =>
          item.assetId === assetId ? { ...item, note } : item
        );
        saveWishlist(updatedServiceItems);
        
        const assets = getWishlistAssetsSync();
        const items = updatedServiceItems.map(item => ({
          ...item,
          asset: assets.find(a => a.item.assetId === item.assetId)?.asset || undefined,
        }));
        
        set({ items });
      },

      // Refresh asset data for all items
      refreshAssets: () => {
        const serviceItems = getWishlist();
        const assets = getWishlistAssetsSync();
        
        const items = serviceItems.map(item => ({
          ...item,
          asset: assets.find(a => a.item.assetId === item.assetId)?.asset || undefined,
        }));
        
        set({ items });
      },
    }),
    {
      name: 'novaura-wishlist-store',
      partialize: (state) => ({
        // Only persist metadata, items are stored in localStorage via service
        lastSyncAt: state.lastSyncAt,
      }),
    }
  )
);

// Initialize store on import (for client-side)
if (typeof window !== 'undefined') {
  // Use setTimeout to ensure this runs after store creation
  setTimeout(() => {
    useWishlistStore.getState().loadFromStorage();
  }, 0);
}
