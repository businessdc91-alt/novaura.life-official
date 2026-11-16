import type {
  PioneerBadge,
  PioneerBadgeTier,
  SearchTermRecord,
  BadgeSearchResult,
  BadgeTransfer,
} from '@/types';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Collection names ─────────────────────────────────────────────────────────
const BADGES_COLLECTION = 'pioneerBadges';
const SEARCH_TERMS_COLLECTION = 'searchTerms';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const normalizeTerm = (raw: string): string => raw.trim().toLowerCase();

const id = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// ─── Aura congratulation messages ─────────────────────────────────────────────

const auraMessages: Record<PioneerBadgeTier, (term: string, pos?: number) => string> = {
  pioneer_1: (term) =>
    `You are the very first soul to search for "${term}" in the Novaura gallery. The universe noticed. You've been awarded the Pioneer #1 shield — a permanent mark of discovery.`,
  pioneer_2: (term) =>
    `You arrived second to "${term}" — but second is still legend. Your Pioneer #2 shield is yours to keep, trade, or treasure.`,
  pioneer_3: (term) =>
    `Third to discover "${term}". The founding trio is now complete. Your Pioneer #3 shield is sealed into history.`,
  milestone_100: (term) =>
    `"${term}" just hit its 100th search. You were there. The Milestone 100 shield for this term has been awarded to you.`,
  milestone_500: (term) =>
    `500 searches for "${term}". This term is ascending. Your Milestone 500 shield marks you as a witness to its rise.`,
  milestone_1000: (term) =>
    `"${term}" has reached 1,000 searches. This is the final badge ever issued for this term — and it belongs to you. No more will ever be minted.`,
};

// ─── Core: record a search and award any earned badges ────────────────────────

/**
 * Called every time a user performs a gallery search.
 * Returns any badges awarded + updated term record.
 */
export const recordSearch = async (rawTerm: string, userId: string): Promise<BadgeSearchResult> => {
  if (!db) throw new Error('Firestore not initialized');
  
  const term = normalizeTerm(rawTerm);
  const displayTerm = rawTerm.trim();
  
  const termDocRef = doc(db, SEARCH_TERMS_COLLECTION, term);
  
  try {
    return await runTransaction(db, async (transaction) => {
      const termDoc = await transaction.get(termDocRef);
      
      let record: SearchTermRecord;
      const isNewTerm = !termDoc.exists();
      
      if (!termDoc.exists()) {
        record = {
          term,
          displayTerm,
          searchCount: 0,
          firstSearchedAt: new Date().toISOString(),
          pioneers: [],
          milestonesAwarded: [],
        };
      } else {
        record = termDoc.data() as SearchTermRecord;
      }
      
      record.searchCount += 1;
      const newBadges: PioneerBadge[] = [];
      
      const award = (tier: PioneerBadgeTier): PioneerBadge => {
        const badge: PioneerBadge = {
          id: id('badge'),
          tier,
          searchTerm: term,
          searchTermDisplay: record.displayTerm,
          ownerId: userId,
          originalEarnerId: userId,
          earnedAt: new Date().toISOString(),
          transferHistory: [],
          isListed: false,
        };
        newBadges.push(badge);
        return badge;
      };
      
      // ── Pioneer slots (only first 3 unique users per term) ──────────────────────
      const pioneerPositions = record.pioneers.map((p) => p.position);
      const alreadyPioneer = record.pioneers.some((p) => p.userId === userId);
      
      const badgesToAdd: PioneerBadge[] = [];
      
      if (!alreadyPioneer) {
        if (!pioneerPositions.includes(1)) {
          record.pioneers.push({ userId, position: 1, searchedAt: new Date().toISOString() });
          badgesToAdd.push(award('pioneer_1'));
        } else if (!pioneerPositions.includes(2)) {
          record.pioneers.push({ userId, position: 2, searchedAt: new Date().toISOString() });
          badgesToAdd.push(award('pioneer_2'));
        } else if (!pioneerPositions.includes(3)) {
          record.pioneers.push({ userId, position: 3, searchedAt: new Date().toISOString() });
          badgesToAdd.push(award('pioneer_3'));
        }
      }
      
      // ── Milestone slots ─────────────────────────────────────────────────────────
      const milestones = [100, 500, 1000] as const;
      for (const threshold of milestones) {
        if (
          record.searchCount >= threshold &&
          !record.milestonesAwarded.includes(threshold)
        ) {
          record.milestonesAwarded.push(threshold);
          badgesToAdd.push(award(`milestone_${threshold}` as PioneerBadgeTier));
        }
      }
      
      // Save term record
      transaction.set(termDocRef, record, { merge: true });
      
      // Save badges to Firestore
      for (const badge of badgesToAdd) {
        const badgeDocRef = doc(db, BADGES_COLLECTION, badge.id);
        transaction.set(badgeDocRef, {
          ...badge,
          createdAt: serverTimestamp()
        });
      }
      
      // Build Aura message for the first awarded badge (most significant)
      let auraMessage: string | undefined;
      if (newBadges.length > 0) {
        const topBadge = newBadges[0];
        const pos = topBadge.tier.startsWith('pioneer_')
          ? Number(topBadge.tier.split('_')[1])
          : undefined;
        auraMessage = auraMessages[topBadge.tier](record.displayTerm, pos);
      }
      
      return { newBadges, isNewTerm, termRecord: record, auraMessage };
    });
  } catch (error) {
    console.error('Record search failed:', error);
    throw error;
  }
};

// ─── Badge queries ─────────────────────────────────────────────────────────────

export const getUserBadges = async (userId: string): Promise<PioneerBadge[]> => {
  if (!db) return [];
  
  const q = query(
    collection(db, BADGES_COLLECTION),
    where('ownerId', '==', userId)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as PioneerBadge);
};

export const getBadgesForTerm = async (rawTerm: string): Promise<PioneerBadge[]> => {
  if (!db) return [];
  
  const term = normalizeTerm(rawTerm);
  const q = query(
    collection(db, BADGES_COLLECTION),
    where('searchTerm', '==', term)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as PioneerBadge);
};

export const getBadgeById = async (badgeId: string): Promise<PioneerBadge | null> => {
  if (!db) return null;
  
  const docRef = doc(db, BADGES_COLLECTION, badgeId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as PioneerBadge;
  }
  return null;
};

export const getListedBadges = async (): Promise<PioneerBadge[]> => {
  if (!db) return [];
  
  const q = query(
    collection(db, BADGES_COLLECTION),
    where('isListed', '==', true)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as PioneerBadge);
};

export const getTermRecord = async (rawTerm: string): Promise<SearchTermRecord | null> => {
  if (!db) return null;
  
  const term = normalizeTerm(rawTerm);
  const docRef = doc(db, SEARCH_TERMS_COLLECTION, term);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as SearchTermRecord;
  }
  return null;
};

// ─── Trading ───────────────────────────────────────────────────────────────────

/** List a badge for trade at a given Aura Coin price. */
export const listBadgeForTrade = async (
  badgeId: string,
  ownerId: string,
  price: number
): Promise<boolean> => {
  if (!db) return false;
  
  const badgeDocRef = doc(db, BADGES_COLLECTION, badgeId);
  const badgeDoc = await getDoc(badgeDocRef);
  
  if (!badgeDoc.exists()) return false;
  
  const badge = badgeDoc.data() as PioneerBadge;
  if (badge.ownerId !== ownerId) return false;
  
  await updateDoc(badgeDocRef, {
    isListed: true,
    listPrice: price,
    updatedAt: serverTimestamp()
  });
  
  return true;
};

/** Remove a badge from the trade listing. */
export const unlistBadge = async (badgeId: string, ownerId: string): Promise<boolean> => {
  if (!db) return false;
  
  const badgeDocRef = doc(db, BADGES_COLLECTION, badgeId);
  const badgeDoc = await getDoc(badgeDocRef);
  
  if (!badgeDoc.exists()) return false;
  
  const badge = badgeDoc.data() as PioneerBadge;
  if (badge.ownerId !== ownerId) return false;
  
  await updateDoc(badgeDocRef, {
    isListed: false,
    listPrice: null,
    updatedAt: serverTimestamp()
  });
  
  return true;
};

/** Transfer ownership of a badge (trade or gift). */
export const transferBadge = async (
  badgeId: string,
  fromUserId: string,
  toUserId: string,
  price?: number
): Promise<boolean> => {
  if (!db) return false;
  
  const badgeDocRef = doc(db, BADGES_COLLECTION, badgeId);
  
  try {
    return await runTransaction(db, async (transaction) => {
      const badgeDoc = await transaction.get(badgeDocRef);
      
      if (!badgeDoc.exists()) return false;
      
      const badge = badgeDoc.data() as PioneerBadge;
      if (badge.ownerId !== fromUserId) return false;
      
      const transfer: BadgeTransfer = {
        fromUserId,
        toUserId,
        price,
        transferredAt: new Date().toISOString(),
      };
      
      const updatedTransferHistory = [...(badge.transferHistory || []), transfer];
      
      transaction.update(badgeDocRef, {
        ownerId: toUserId,
        isListed: false,
        listPrice: null,
        transferHistory: updatedTransferHistory,
        updatedAt: serverTimestamp()
      });
      
      return true;
    });
  } catch (error) {
    console.error('Badge transfer failed:', error);
    return false;
  }
};

// ─── Stats & display helpers ───────────────────────────────────────────────────

/** Human-readable label for each badge tier. */
export const BADGE_LABELS: Record<PioneerBadgeTier, string> = {
  pioneer_1: '#1 Pioneer',
  pioneer_2: '#2 Pioneer',
  pioneer_3: '#3 Pioneer',
  milestone_100: '100 Searches',
  milestone_500: '500 Searches',
  milestone_1000: '1,000 Searches',
};

/** Color scheme for rendering badge shields. */
export const BADGE_COLORS: Record<PioneerBadgeTier, { bg: string; border: string; text: string }> = {
  pioneer_1: { bg: 'bg-yellow-500/20', border: 'border-yellow-400', text: 'text-yellow-300' },
  pioneer_2: { bg: 'bg-slate-400/20', border: 'border-slate-300', text: 'text-slate-200' },
  pioneer_3: { bg: 'bg-amber-700/20', border: 'border-amber-600', text: 'text-amber-400' },
  milestone_100: { bg: 'bg-cyan-500/20', border: 'border-cyan-400', text: 'text-cyan-300' },
  milestone_500: { bg: 'bg-violet-500/20', border: 'border-violet-400', text: 'text-violet-300' },
  milestone_1000: { bg: 'bg-rose-500/20', border: 'border-rose-400', text: 'text-rose-300' },
};

/** Whether a term has exhausted all possible badges (post-1000 milestone). */
export const isTermFullyMinted = async (rawTerm: string): Promise<boolean> => {
  const record = await getTermRecord(rawTerm);
  return record?.milestonesAwarded.includes(1000) ?? false;
};

/** Total badges ever possible per term: 3 pioneers + 3 milestones = 6. */
export const MAX_BADGES_PER_TERM = 6;
