import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { TIER_CONFIG, type MembershipTier } from '../config/tierConfig';
import type { AIProvider } from '../stores/aiStore';

const CREDITS_COLLECTION = 'userCredits';

interface CreditState {
  userId: string;
  dailyCredits: number;
  monthlyCredits: number;
  dailyReset: string; // ISO date (date only)
  monthlyReset: string; // ISO date (YYYY-MM)
  purchasedCredits: number; // Credits bought separately (never expire)
  exhaustiveResearchUsed: number; // Counter for monthly exhaustive research
  updatedAt: any;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function monthKey(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

// Get or initialize user credit state from Firestore
async function getOrCreateState(userId: string, tier: MembershipTier): Promise<CreditState> {
  if (!db) throw new Error('Firestore not initialized');
  
  const config = TIER_CONFIG[tier];
  const docRef = doc(db, CREDITS_COLLECTION, userId);
  const docSnap = await getDoc(docRef);
  
  const today = todayKey();
  const month = monthKey();
  
  if (docSnap.exists()) {
    const data = docSnap.data() as CreditState;
    let needsUpdate = false;
    let updates: any = { updatedAt: serverTimestamp() };
    
    // Reset daily credits if new day
    if (data.dailyReset !== today) {
      updates.dailyCredits = config.creditsPerDay;
      updates.dailyReset = today;
      needsUpdate = true;
    }
    
    // Reset monthly credits if new month
    if (data.monthlyReset !== month) {
      updates.monthlyCredits = config.creditsPerMonth;
      updates.monthlyReset = month;
      updates.exhaustiveResearchUsed = 0; // Reset exhaustive research count
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      await updateDoc(docRef, updates);
      return { ...data, ...updates };
    }
    
    return data;
  }
  
  // Initialize new user credit state
  const initialState: CreditState = {
    userId,
    dailyCredits: config.creditsPerDay,
    monthlyCredits: config.creditsPerMonth,
    dailyReset: today,
    monthlyReset: month,
    purchasedCredits: 0,
    exhaustiveResearchUsed: 0,
    updatedAt: serverTimestamp()
  };
  
  await setDoc(docRef, initialState);
  return initialState;
}

export interface CreditCheckResult {
  allowed: boolean;
  cost: number;
  reason?: string;
  dailyRemaining: number;
  monthlyRemaining: number;
  purchasedRemaining: number;
}

/**
 * Check if user has enough credits and deduct if so
 * Simple: 1 credit = 1 API call
 */
export async function checkAndSpendCredits(
  userId: string,
  tier: MembershipTier,
  cost: number,
  deduct = true
): Promise<CreditCheckResult> {
  if (!db) throw new Error('Firestore not initialized');
  
  const docRef = doc(db, CREDITS_COLLECTION, userId);
  
  try {
    return await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(docRef);
      const today = todayKey();
      const month = monthKey();
      const config = TIER_CONFIG[tier];
      
      let state: CreditState;
      
      if (!docSnap.exists()) {
        state = {
          userId,
          dailyCredits: config.creditsPerDay,
          monthlyCredits: config.creditsPerMonth,
          dailyReset: today,
          monthlyReset: month,
          purchasedCredits: 0,
          exhaustiveResearchUsed: 0,
          updatedAt: null
        };
      } else {
        state = docSnap.data() as CreditState;
        
        if (state.dailyReset !== today) {
          state.dailyCredits = config.creditsPerDay;
          state.dailyReset = today;
        }
        
        if (state.monthlyReset !== month) {
          state.monthlyCredits = config.creditsPerMonth;
          state.monthlyReset = month;
          state.exhaustiveResearchUsed = 0;
        }
      }
      
      const totalAvailable = state.dailyCredits + state.monthlyCredits + state.purchasedCredits;
      
      if (totalAvailable < cost) {
        return {
          allowed: false,
          cost,
          reason: `Not enough credits (need ${cost}, have ${totalAvailable}). Buy more or upgrade.`,
          dailyRemaining: state.dailyCredits,
          monthlyRemaining: state.monthlyCredits,
          purchasedRemaining: state.purchasedCredits,
        };
      }
      
      if (deduct) {
        let remainingCost = cost;
        
        // Deduct from daily first
        if (state.dailyCredits > 0) {
          const deductFromDaily = Math.min(state.dailyCredits, remainingCost);
          state.dailyCredits -= deductFromDaily;
          remainingCost -= deductFromDaily;
        }
        
        // Then monthly
        if (remainingCost > 0 && state.monthlyCredits > 0) {
          const deductFromMonthly = Math.min(state.monthlyCredits, remainingCost);
          state.monthlyCredits -= deductFromMonthly;
          remainingCost -= deductFromMonthly;
        }
        
        // Finally purchased
        if (remainingCost > 0 && state.purchasedCredits > 0) {
          state.purchasedCredits -= remainingCost;
        }
        
        transaction.set(docRef, {
          ...state,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      
      return {
        allowed: true,
        cost,
        dailyRemaining: state.dailyCredits,
        monthlyRemaining: state.monthlyCredits,
        purchasedRemaining: state.purchasedCredits,
      };
    });
  } catch (error) {
    console.error('Credit check failed:', error);
    throw error;
  }
}

/**
 * Check if user can use BuilderBot (1 credit per call if not local)
 * Local AI is always free
 */
export async function checkAndSpendBuilderBot(
  userId: string,
  tier: MembershipTier,
  provider: AIProvider,
  deduct = true
): Promise<CreditCheckResult> {
  // Local AI is free
  if (provider === 'ollama' || provider === 'lmstudio') {
    return { allowed: true, cost: 0, dailyRemaining: 0, monthlyRemaining: 0, purchasedRemaining: 0 };
  }
  // Cloud AI costs 1 credit per call
  return checkAndSpendCredits(userId, tier, 1, deduct);
}

/**
 * Check if user can use Exhaustive Research
 */
export async function checkAndSpendExhaustiveResearch(
  userId: string,
  tier: MembershipTier,
  deduct = true
): Promise<CreditCheckResult> {
  if (!db) throw new Error('Firestore not initialized');
  const config = TIER_CONFIG[tier];
  
  // If user has no monthly quota, they can't use it
  if (config.exhaustiveResearchPerMonth <= 0) {
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
      }) as CreditState;

      // Double check month reset inside transaction
      if (state.monthlyReset !== monthKey()) {
        state.exhaustiveResearchUsed = 0;
      }

      if (state.exhaustiveResearchUsed >= config.exhaustiveResearchPerMonth) {
        return {
          allowed: false,
          cost: 0,
          reason: `Monthly Exhaustive Research quota reached (${state.exhaustiveResearchUsed}/${config.exhaustiveResearchPerMonth}).`,
          dailyRemaining: 0,
          monthlyRemaining: 0,
          purchasedRemaining: 0
        };
      }

      if (deduct) {
        transaction.set(docRef, {
          ...state,
          exhaustiveResearchUsed: state.exhaustiveResearchUsed + 1,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      return {
        allowed: true,
        cost: 0,
        dailyRemaining: 0,
        monthlyRemaining: config.exhaustiveResearchPerMonth - (state.exhaustiveResearchUsed + (deduct ? 1 : 0)),
        purchasedRemaining: 0
      };
    });
  } catch (error) {
    console.error('Exhaustive research check failed:', error);
    throw error;
  }
}

/** Get current credit snapshot */
export async function getCreditSnapshot(userId: string, tier: MembershipTier) {
  const state = await getOrCreateState(userId, tier);
  const config = TIER_CONFIG[tier];
  return {
    dailyCredits: state.dailyCredits,
    dailyMax: config.creditsPerDay,
    monthlyCredits: state.monthlyCredits,
    monthlyMax: config.creditsPerMonth,
    purchasedCredits: state.purchasedCredits,
    totalAvailable: state.dailyCredits + state.monthlyCredits + state.purchasedCredits,
  };
}

/** Add purchased credits */
export async function addPurchasedCredits(userId: string, amount: number): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');
  
  const docRef = doc(db, CREDITS_COLLECTION, userId);
  
  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(docRef);
    
    if (!docSnap.exists()) {
      const today = todayKey();
      const month = monthKey();
      transaction.set(docRef, {
        userId,
        dailyCredits: 0,
        monthlyCredits: 0,
        dailyReset: today,
        monthlyReset: month,
        purchasedCredits: amount,
        updatedAt: serverTimestamp()
      });
    } else {
      const data = docSnap.data() as CreditState;
      transaction.update(docRef, {
        purchasedCredits: (data.purchasedCredits || 0) + amount,
        updatedAt: serverTimestamp()
      });
    }
  });
}

// Sync fallback (deprecated)
export function getCreditSnapshotSync(userId: string, tier: MembershipTier) {
  const config = TIER_CONFIG[tier];
  return {
    dailyCredits: config.creditsPerDay,
    dailyMax: config.creditsPerDay,
    monthlyCredits: config.creditsPerMonth,
    monthlyMax: config.creditsPerMonth,
    purchasedCredits: 0,
    totalAvailable: config.creditsPerDay + config.creditsPerMonth,
  };
}
