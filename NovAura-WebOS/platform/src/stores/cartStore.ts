import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Asset, CartItem } from '@/types';

interface CartState {
  items: CartItem[];
  
  // Getters
  total: number;
  itemCount: number;
  
  // Actions
  addItem: (asset: Asset, customPrice?: number) => void;
  removeItem: (assetId: string) => void;
  clearCart: () => void;
  isInCart: (assetId: string) => boolean;
}

export const useCartStore = create<CartState>()(
  persist(
    (set: any, get: () => CartState) => ({
      items: [],

      get total() {
        return get().items.reduce((sum, item) => sum + (item.customPrice ?? item.asset.price), 0);
      },

      get itemCount() {
        return get().items.length;
      },

      addItem: (asset: Asset, customPrice?: number) => {
        const { items } = get();
        
        // Check if already in cart
        const existingItemIndex = items.findIndex(item => item.assetId === asset.id);
        if (existingItemIndex >= 0) {
          // If a custom price is provided and it differs, update it
          if (customPrice !== undefined && customPrice !== items[existingItemIndex].customPrice) {
            const newItems = [...items];
            newItems[existingItemIndex].customPrice = customPrice;
            set({ items: newItems });
          }
          return;
        }
        
        const newItem: CartItem = {
          assetId: asset.id,
          asset,
          addedAt: new Date().toISOString(),
          customPrice,
        };
        
        set({ items: [...items, newItem] });
      },

      removeItem: (assetId: string) => {
        const { items } = get();
        set({ items: items.filter(item => item.assetId !== assetId) });
      },

      clearCart: () => {
        set({ items: [] });
      },

      isInCart: (assetId: string) => {
        return get().items.some(item => item.assetId === assetId);
      },
    }),
    {
      name: 'novaura-cart',
    }
  )
);
