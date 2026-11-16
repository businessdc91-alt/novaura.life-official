import { create } from 'zustand';
import type { PioneerBadge, BadgeSearchResult } from '@/types';
import {
  recordSearch,
  getUserBadges,
  getListedBadges,
  listBadgeForTrade,
  unlistBadge,
  transferBadge,
} from '@/services/pioneerBadgeService';

interface PioneerBadgeState {
  // Current user's badges
  userBadges: PioneerBadge[];
  // Marketplace: all listed badges
  listedBadges: PioneerBadge[];
  // Last search result (for showing Aura messages / badge awards)
  lastSearchResult: BadgeSearchResult | null;

  // Actions
  loadUserBadges: (userId: string) => void;
  loadListedBadges: () => void;
  performSearch: (term: string, userId: string) => BadgeSearchResult;
  listBadge: (badgeId: string, ownerId: string, price: number) => boolean;
  unlistBadge: (badgeId: string, ownerId: string) => boolean;
  transferBadge: (badgeId: string, fromUserId: string, toUserId: string, price?: number) => boolean;
  clearLastResult: () => void;
}

export const usePioneerBadgeStore = create<PioneerBadgeState>((set, _get) => ({
  userBadges: [],
  listedBadges: [],
  lastSearchResult: null,

  loadUserBadges: (userId) => {
    set({ userBadges: getUserBadges(userId) });
  },

  loadListedBadges: () => {
    set({ listedBadges: getListedBadges() });
  },

  performSearch: (term, userId) => {
    const result = recordSearch(term, userId);
    // Refresh user badges if new ones were awarded
    if (result.newBadges.length > 0) {
      set({
        userBadges: getUserBadges(userId),
        lastSearchResult: result,
      });
    } else {
      set({ lastSearchResult: result });
    }
    return result;
  },

  listBadge: (badgeId, ownerId, price) => {
    const ok = listBadgeForTrade(badgeId, ownerId, price);
    if (ok) {
      set({
        userBadges: getUserBadges(ownerId),
        listedBadges: getListedBadges(),
      });
    }
    return ok;
  },

  unlistBadge: (badgeId, ownerId) => {
    const ok = unlistBadge(badgeId, ownerId);
    if (ok) {
      set({
        userBadges: getUserBadges(ownerId),
        listedBadges: getListedBadges(),
      });
    }
    return ok;
  },

  transferBadge: (badgeId, fromUserId, toUserId, price) => {
    const ok = transferBadge(badgeId, fromUserId, toUserId, price);
    if (ok) {
      set({
        userBadges: getUserBadges(fromUserId),
        listedBadges: getListedBadges(),
      });
    }
    return ok;
  },

  clearLastResult: () => set({ lastSearchResult: null }),
}));
