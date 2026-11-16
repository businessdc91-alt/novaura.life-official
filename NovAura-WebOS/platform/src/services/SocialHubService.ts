import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { economyService } from './economyService';

export interface UserBadge {
  id: string;
  name: string;
  icon: string;
  description: string;
  isTradable: boolean;
  tier: 'founder' | 'rare' | 'common';
  earnedAt?: string;
}

export interface SocialProfile {
  userId: string;
  badges: UserBadge[];
  nameToken: string; // Special icon next to name
  reputation: number;
  updatedAt?: any;
}

const PROFILES_COLLECTION = 'socialProfiles';

class SocialHubService {
  // --- Gambling Bot (58x2 Dice) ---
  async rollDice(userId: string, betAmount: number): Promise<{ roll: number; success: boolean; payout: number; newBalance?: number }> {
    if (betAmount > 20) throw new Error("Maximum bet is 20 Nova Coins.");
    
    // Check balance via economyService
    const balance = await economyService.getBalance(userId);
    if (balance < betAmount) throw new Error("Insufficient Nova Coins.");

    const roll = Math.floor(Math.random() * 100) + 1;
    const success = roll > 58;
    const payout = success ? betAmount * 2 : 0;

    // Resolve transaction
    if (success) {
      await economyService.useCoins(userId, -betAmount, "Dice Roll Payout (58x2)"); // Negative = add coins
    } else {
      await economyService.useCoins(userId, betAmount, "Dice Roll Bet (58x2)");
    }
    
    const newBalance = await economyService.getBalance(userId);

    console.log(`[SOCIAL_BOT] User ${userId} rolled ${roll}. Success: ${success}. Payout: ${payout}`);
    return { roll, success, payout, newBalance };
  }

  // --- Badge & Token System ---
  async getProfile(userId: string): Promise<SocialProfile> {
    if (!db) throw new Error('Firestore not initialized');
    
    const docRef = doc(db, PROFILES_COLLECTION, userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as SocialProfile;
    }
    
    // Return default profile
    return { userId, badges: [], nameToken: '👤', reputation: 0 };
  }

  async assignBadge(userId: string, badge: UserBadge): Promise<void> {
    if (!db) throw new Error('Firestore not initialized');
    
    const docRef = doc(db, PROFILES_COLLECTION, userId);
    const docSnap = await getDoc(docRef);
    
    const badgeWithTimestamp = {
      ...badge,
      earnedAt: new Date().toISOString()
    };
    
    if (!docSnap.exists()) {
      // Create new profile with badge
      const newProfile: SocialProfile = {
        userId,
        badges: [badgeWithTimestamp],
        nameToken: '👤',
        reputation: 0,
        updatedAt: serverTimestamp()
      };
      await setDoc(docRef, newProfile);
    } else {
      const profile = docSnap.data() as SocialProfile;
      
      // Check if badge already exists
      if (!profile.badges.find(b => b.id === badge.id)) {
        await updateDoc(docRef, {
          badges: [...profile.badges, badgeWithTimestamp],
          updatedAt: serverTimestamp()
        });
      }
    }
  }

  async updateNameToken(userId: string, token: string): Promise<void> {
    if (!db) throw new Error('Firestore not initialized');
    
    const docRef = doc(db, PROFILES_COLLECTION, userId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      // Create new profile with token
      const newProfile: SocialProfile = {
        userId,
        badges: [],
        nameToken: token,
        reputation: 0,
        updatedAt: serverTimestamp()
      };
      await setDoc(docRef, newProfile);
    } else {
      await updateDoc(docRef, {
        nameToken: token,
        updatedAt: serverTimestamp()
      });
    }
  }

  async updateReputation(userId: string, delta: number): Promise<number> {
    if (!db) throw new Error('Firestore not initialized');
    
    const docRef = doc(db, PROFILES_COLLECTION, userId);
    
    try {
      const newReputation = await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        
        let currentReputation = 0;
        
        if (!docSnap.exists()) {
          // Create new profile
          const newProfile: SocialProfile = {
            userId,
            badges: [],
            nameToken: '👤',
            reputation: Math.max(0, delta),
            updatedAt: serverTimestamp()
          };
          transaction.set(docRef, newProfile);
          return Math.max(0, delta);
        } else {
          const profile = docSnap.data() as SocialProfile;
          currentReputation = (profile.reputation || 0) + delta;
          currentReputation = Math.max(0, currentReputation); // No negative reputation
          
          transaction.update(docRef, {
            reputation: currentReputation,
            updatedAt: serverTimestamp()
          });
        }
        
        return currentReputation;
      });
      
      return newReputation;
    } catch (error) {
      console.error('Reputation update failed:', error);
      throw error;
    }
  }
}

export const socialHubService = new SocialHubService();
