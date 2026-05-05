/**
 * Simple credit/tier service for the main WebOS
 */

import { db } from '../config/firebase';
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { TIER_CONFIG } from '../config/tierConfig';

const CREDITS_COLLECTION = 'userCredits';

function monthKey() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

/**
 * Get user's membership tier from Firestore
 * @param {string} userId 
 * @param {string} email
 * @returns {Promise<string>} tier - 'free', 'spark', 'emergent', 'catalyst', 'nova', 'catalytic-crew'
 */
const SUPERUSERS = ['lostitonce420@gmail.com', 'dillan.copeland@novaura.xyz'];

export async function getUserTier(userId, email) {
  if (email && SUPERUSERS.includes(email)) return 'catalytic-crew';
  if (!db || !userId) return 'free';
  
  try {
    const docRef = doc(db, 'userCredits', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.tier || 'free';
    }
    
    return 'free';
  } catch (e) {
    console.error('Error fetching user tier:', e);
    return 'free';
  }
}

/**
 * Get display name for tier
 */
export function getTierDisplayName(tier) {
  const names = {
    free: 'Novice',
    spark: 'Spark',
    emergent: 'Emergent', 
    catalyst: 'Catalyst',
    nova: 'Nova',
    'catalytic-crew': 'Crew Member',
  };
  return names[tier] || 'Novice';
}

/**
 * Check if user can use Exhaustive Research
 */
export async function checkAndSpendExhaustiveResearch(
  userId,
  tier = 'free',
  deduct = true
) {
  if (!db) throw new Error('Firestore not initialized');
  const config = { ...(TIER_CONFIG[tier] || TIER_CONFIG.free) };
  
  // Check for partner status in user credits or auth
  // For simplicity here, we'll fetch the multiplier
  let multiplier = 1;
  try {
    const docRef = doc(db, CREDITS_COLLECTION, userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().partnership) {
      multiplier = 1.75;
    }
  } catch (e) {}

  const monthlyQuota = Math.floor(config.exhaustiveResearchPerMonth * multiplier);

  // If user has no monthly quota, they can't use it
  if (monthlyQuota <= 0) {
    return {
      allowed: false,
      cost: 0,
      reason: 'Exhaustive Research is a premium feature (Catalyst tier and above).',
      dailyRemaining: 0,
      monthlyRemaining: 0,
      purchasedRemaining: 0
    };
  }

  const docRef = doc(db, CREDITS_COLLECTION, userId);

  try {
    return await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(docRef);
      const state = (docSnap.exists() ? docSnap.data() : { 
        exhaustiveResearchUsed: 0,
        monthlyReset: monthKey() 
      });

      // Double check month reset inside transaction
      if (state.monthlyReset !== monthKey()) {
        state.exhaustiveResearchUsed = 0;
      }

      if (state.exhaustiveResearchUsed >= monthlyQuota) {
        return {
          allowed: false,
          cost: 0,
          reason: `Monthly Exhaustive Research quota reached (${state.exhaustiveResearchUsed}/${monthlyQuota}).`,
          dailyRemaining: 0,
          monthlyRemaining: 0,
          purchasedRemaining: 0
        };
      }

      if (deduct) {
        transaction.set(docRef, {
          ...state,
          exhaustiveResearchUsed: (state.exhaustiveResearchUsed || 0) + 1,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      return {
        allowed: true,
        cost: 0,
        dailyRemaining: 0,
        monthlyRemaining: monthlyQuota - ((state.exhaustiveResearchUsed || 0) + (deduct ? 1 : 0)),
        purchasedRemaining: 0
      };
    });
  } catch (error) {
    console.error('Exhaustive research check failed:', error);
    throw error;
  }
}
