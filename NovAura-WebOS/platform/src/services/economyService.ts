import { db } from '../config/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { useAuthStore } from '@/stores/authStore';

export interface Transaction {
  id: string;
  userId: string;
  type: 'claim' | 'spend' | 'recharge' | 'bonus' | 'initial';
  amount: number;
  balanceAfter: number;
  reason: string;
  timestamp: string;
}

const ECONOMY_COLLECTION = 'userEconomy';
const TRANSACTIONS_COLLECTION = 'transactions';

// Get user's economy data from Firestore
export const getUserEconomy = async (userId: string) => {
  if (!db) throw new Error('Firestore not initialized');
  
  const docRef = doc(db, ECONOMY_COLLECTION, userId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data();
  }
  
  // Initialize new user economy
  const initialData = {
    userId,
    consciousnessCoins: 0,
    totalEarned: 0,
    totalSpent: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  await setDoc(docRef, initialData);
  return initialData;
};

// Get transaction history
export const getLedger = async (userId: string): Promise<Transaction[]> => {
  if (!db) return [];
  
  const q = query(
    collection(db, TRANSACTIONS_COLLECTION),
    where('userId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(50)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Transaction[];
};

// Record a transaction (Firestore-based)
export const recordTransaction = async (
  userId: string, 
  tx: Omit<Transaction, 'id' | 'timestamp' | 'userId'>
): Promise<Transaction> => {
  if (!db) throw new Error('Firestore not initialized');
  
  const newTx: Omit<Transaction, 'id'> = {
    ...tx,
    userId,
    timestamp: new Date().toISOString(),
  };
  
  // Add to transactions collection
  const docRef = await addDoc(collection(db, TRANSACTIONS_COLLECTION), newTx);
  
  // Update user economy
  const economyRef = doc(db, ECONOMY_COLLECTION, userId);
  await updateDoc(economyRef, {
    consciousnessCoins: tx.balanceAfter,
    updatedAt: serverTimestamp()
  });
  
  return { id: docRef.id, ...newTx };
};

// Claim daily coins
export const claimDailyCoins = async (userId: string): Promise<{ success: boolean; amount: number; newBalance: number }> => {
  if (!db) throw new Error('Firestore not initialized');
  
  const economyRef = doc(db, ECONOMY_COLLECTION, userId);
  
  try {
    const result = await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(economyRef);
      
      if (!docSnap.exists()) {
        throw new Error('User economy not found');
      }
      
      const data = docSnap.data();
      const lastClaim = data.lastDailyClaim?.toDate?.() || null;
      const now = new Date();
      
      // Check if already claimed today
      if (lastClaim && lastClaim.toDateString() === now.toDateString()) {
        return { success: false, amount: 0, newBalance: data.consciousnessCoins };
      }
      
      const claimAmount = 10;
      const newBalance = (data.consciousnessCoins || 0) + claimAmount;
      
      transaction.update(economyRef, {
        consciousnessCoins: newBalance,
        totalEarned: (data.totalEarned || 0) + claimAmount,
        lastDailyClaim: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Record transaction
      const txRef = doc(collection(db, TRANSACTIONS_COLLECTION));
      transaction.set(txRef, {
        userId,
        type: 'claim',
        amount: claimAmount,
        balanceAfter: newBalance,
        reason: 'Daily claim',
        timestamp: new Date().toISOString()
      });
      
      return { success: true, amount: claimAmount, newBalance };
    });
    
    return result;
  } catch (error) {
    console.error('Claim failed:', error);
    throw error;
  }
};

// Use/spend coins
export const useCoins = async (userId: string, amount: number, reason: string): Promise<boolean> => {
  if (!db) throw new Error('Firestore not initialized');
  
  const economyRef = doc(db, ECONOMY_COLLECTION, userId);
  
  try {
    return await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(economyRef);
      
      if (!docSnap.exists()) {
        throw new Error('User economy not found');
      }
      
      const data = docSnap.data();
      const currentBalance = data.consciousnessCoins || 0;
      
      if (currentBalance < amount) {
        return false; // Insufficient funds
      }
      
      const newBalance = currentBalance - amount;
      
      transaction.update(economyRef, {
        consciousnessCoins: newBalance,
        totalSpent: (data.totalSpent || 0) + amount,
        updatedAt: serverTimestamp()
      });
      
      // Record transaction
      const txRef = doc(collection(db, TRANSACTIONS_COLLECTION));
      transaction.set(txRef, {
        userId,
        type: 'spend',
        amount: -amount,
        balanceAfter: newBalance,
        reason,
        timestamp: new Date().toISOString()
      });
      
      return true;
    });
  } catch (error) {
    console.error('Spend failed:', error);
    return false;
  }
};

// Get balance
export const getBalance = async (userId: string): Promise<number> => {
  const economy = await getUserEconomy(userId);
  return economy.consciousnessCoins || 0;
};

// Legacy exports for compatibility (these will be removed after all imports are fixed)
export const getCurrentUser = () => useAuthStore.getState().user;
export const setCurrentUser = (user: any) => useAuthStore.getState().setUser(user);

// Namespace export for compatibility
export const economyService = {
  getBalance,
  getLedger,
  recordTransaction,
  claimDailyCoins,
  useCoins,
  getUserEconomy
};
