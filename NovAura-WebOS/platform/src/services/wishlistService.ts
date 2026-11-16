/**
 * wishlistService.ts — NovAura Wishlist (Firestore-backed)
 *
 * All wishlist data lives in Firestore:
 *   users/{userId}/wishlist/{assetId}
 *
 * Each document is the wishlist item itself, keyed by assetId for
 * O(1) lookups and atomic add/remove operations without array rewrites.
 *
 * Real-time listener exported for components that want live updates.
 */

import type { Asset } from '@/types';
import { db } from '@/config/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import { getAssetById } from './marketService';

export interface WishlistServiceItem {
  assetId:  string;
  addedAt:  string;
  note?:    string;
}

export interface SyncResult {
  success:   boolean;
  message?:  string;
  itemCount?: number;
}

// ── Firestore path ─────────────────────────────────────────────────────────────

function wishlistCol(userId: string) {
  return collection(db!, 'users', userId, 'wishlist');
}

function wishlistItemDoc(userId: string, assetId: string) {
  return doc(db!, 'users', userId, 'wishlist', assetId);
}

// ── Core CRUD ──────────────────────────────────────────────────────────────────

export async function getWishlist(userId: string): Promise<WishlistServiceItem[]> {
  if (!db || !userId) return [];
  try {
    const q    = query(wishlistCol(userId), orderBy('addedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ assetId: d.id, ...d.data() } as WishlistServiceItem));
  } catch (err) {
    console.error('[wishlistService] getWishlist failed:', err);
    return [];
  }
}

export async function addToWishlist(
  userId:  string,
  assetId: string,
  note?:   string
): Promise<void> {
  if (!db || !userId) return;
  try {
    const item: WishlistServiceItem = {
      assetId,
      addedAt: new Date().toISOString(),
      note,
    };
    await setDoc(wishlistItemDoc(userId, assetId), {
      ...item,
      addedAtServer: serverTimestamp(),
    });
  } catch (err) {
    console.error('[wishlistService] addToWishlist failed:', err);
  }
}

export async function removeFromWishlist(userId: string, assetId: string): Promise<void> {
  if (!db || !userId) return;
  try {
    await deleteDoc(wishlistItemDoc(userId, assetId));
  } catch (err) {
    console.error('[wishlistService] removeFromWishlist failed:', err);
  }
}

export async function isInWishlist(userId: string, assetId: string): Promise<boolean> {
  if (!db || !userId) return false;
  try {
    const snap = await getDoc(wishlistItemDoc(userId, assetId));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function toggleWishlist(
  userId:  string,
  assetId: string,
  note?:   string
): Promise<{ added: boolean }> {
  const inList = await isInWishlist(userId, assetId);
  if (inList) {
    await removeFromWishlist(userId, assetId);
    return { added: false };
  } else {
    await addToWishlist(userId, assetId, note);
    return { added: true };
  }
}

export async function clearWishlist(userId: string): Promise<void> {
  if (!db || !userId) return;
  try {
    const snap = await getDocs(wishlistCol(userId));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  } catch (err) {
    console.error('[wishlistService] clearWishlist failed:', err);
  }
}

export async function updateWishlistNote(
  userId:  string,
  assetId: string,
  note?:   string
): Promise<void> {
  if (!db || !userId) return;
  try {
    await setDoc(wishlistItemDoc(userId, assetId), { note }, { merge: true });
  } catch (err) {
    console.error('[wishlistService] updateWishlistNote failed:', err);
  }
}

export async function getWishlistCount(userId: string): Promise<number> {
  const items = await getWishlist(userId);
  return items.length;
}

// ── Real-time subscription ─────────────────────────────────────────────────────

/**
 * Subscribe to live wishlist updates for a user.
 * Returns an unsubscribe function. Used by WishlistPage / header badge.
 */
export function subscribeToWishlist(
  userId:    string,
  onUpdate:  (items: WishlistServiceItem[]) => void
): Unsubscribe {
  if (!db || !userId) {
    onUpdate([]);
    return () => {};
  }
  const q = query(wishlistCol(userId), orderBy('addedAt', 'desc'));
  return onSnapshot(q, (snap) => {
    onUpdate(snap.docs.map(d => ({ assetId: d.id, ...d.data() } as WishlistServiceItem)));
  }, (err) => {
    console.error('[wishlistService] subscription error:', err);
    onUpdate([]);
  });
}

// ── Asset enrichment ──────────────────────────────────────────────────────────

export async function getWishlistAssets(
  userId: string
): Promise<Array<{ item: WishlistServiceItem; asset: Asset | null }>> {
  const wishlist = await getWishlist(userId);
  return Promise.all(
    wishlist.map(async item => {
      try {
        const asset = await getAssetById(item.assetId);
        return { item, asset };
      } catch {
        return { item, asset: null };
      }
    })
  );
}

/** Move an item from wishlist to cart (removes from wishlist, caller handles cart add). */
export async function moveToCart(userId: string, assetId: string): Promise<string | null> {
  const inList = await isInWishlist(userId, assetId);
  if (!inList) return null;
  await removeFromWishlist(userId, assetId);
  return assetId;
}

// ── Share / Export ─────────────────────────────────────────────────────────────

export async function generateShareableUrl(userId: string): Promise<string> {
  const items  = await getWishlist(userId);
  const ids    = items.map(i => i.assetId);
  const encoded = btoa(JSON.stringify(ids));
  return `${window.location.origin}/wishlist/shared?ids=${encoded}`;
}

export function loadFromSharedUrl(encodedIds: string): string[] {
  try {
    const decoded = JSON.parse(atob(encodedIds));
    return Array.isArray(decoded) ? decoded : [];
  } catch {
    return [];
  }
}

export async function exportWishlist(userId: string): Promise<void> {
  const wishlist = await getWishlist(userId);
  const dataStr  = JSON.stringify(wishlist, null, 2);
  const blob     = new Blob([dataStr], { type: 'application/json' });
  const url      = URL.createObjectURL(blob);
  const link     = document.createElement('a');
  link.href      = url;
  link.download  = `novaura-wishlist-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function importWishlist(
  userId: string,
  file:   File
): Promise<{ success: boolean; count: number; errors: string[] }> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (!Array.isArray(imported)) {
          resolve({ success: false, count: 0, errors: ['Invalid file format'] });
          return;
        }
        const errors: string[] = [];
        let addedCount = 0;

        for (const item of imported) {
          if (item.assetId && typeof item.assetId === 'string') {
            const alreadyIn = await isInWishlist(userId, item.assetId);
            if (!alreadyIn) {
              await addToWishlist(userId, item.assetId, item.note);
              addedCount++;
            }
          } else {
            errors.push(`Invalid item: ${JSON.stringify(item)}`);
          }
        }
        resolve({ success: true, count: addedCount, errors });
      } catch {
        resolve({ success: false, count: 0, errors: ['Failed to parse file'] });
      }
    };
    reader.onerror = () => resolve({ success: false, count: 0, errors: ['Failed to read file'] });
    reader.readAsText(file);
  });
}

// Backwards-compatible no-ops (the "sync" functions are now implicit in Firestore)
export const syncToServer   = async (_userId: string): Promise<SyncResult> =>
  ({ success: true, message: 'Firestore is always in sync', itemCount: 0 });
export const syncFromServer = async (_userId: string): Promise<SyncResult> =>
  ({ success: true, message: 'Firestore is always in sync', itemCount: 0 });
export const mergeWishlists = (
  local:  WishlistServiceItem[],
  server: WishlistServiceItem[]
): WishlistServiceItem[] => {
  const m = new Map<string, WishlistServiceItem>();
  [...local, ...server].forEach(i => m.set(i.assetId, i));
  return Array.from(m.values());
};
