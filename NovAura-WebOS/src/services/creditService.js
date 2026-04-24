/**
 * Simple credit/tier service for the main WebOS
 */

import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

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
