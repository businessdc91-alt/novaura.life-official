import { db } from '../config/firebase';
import { doc, onSnapshot, updateDoc, increment, setDoc, getDoc } from 'firebase/firestore';

/**
 * Platform Stats Service
 * Tracks real-time availability of Founders Passes
 */
export const platformStatsService = {
  /**
   * Subscribe to Founders Pass counts
   * @param {function} callback - Called with updated stats
   * @returns {function} Unsubscribe function
   */
  subscribeToFoundersCounts(callback) {
    const statsDoc = doc(db, 'platform_stats', 'founders_presale');
    
    return onSnapshot(statsDoc, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data());
      } else {
        // Initialize if not exists
        const initialStats = {
          founding_father_remaining: 100,
          founding_spark_remaining: 50,
          founding_nova_remaining: 20,
          catalyst_crew_remaining: 10,
          investor_remaining: 5,
          updated_at: new Date().toISOString()
        };
        setDoc(statsDoc, initialStats);
        callback(initialStats);
      }
    });
  },

  /**
   * Increment signup count (internal/admin use or triggered by Cloud Function)
   * This is usually handled by the backend after Stripe payment
   */
  async decrementRemaining(tierId) {
    const statsDoc = doc(db, 'platform_stats', 'founders_presale');
    const field = `${tierId.replace(/-/g, '_')}_remaining`;
    
    await updateDoc(statsDoc, {
      [field]: increment(-1),
      updated_at: new Date().toISOString()
    });
  }
};
