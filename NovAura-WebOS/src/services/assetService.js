import { db, isFirebaseConfigured } from '../config/firebase.js';
import { 
  collection, doc, getDocs, getDoc, setDoc, updateDoc, 
  deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp, 
  addDoc, arrayUnion, arrayRemove
} from 'firebase/firestore';

/**
 * assetService.js
 * 
 * The source of truth for all user-owned assets, trades, and avatars.
 * Moves persistence from kernelStorage (local) to Firestore (permanent).
 */

// ─── ASSET MANAGEMENT ────────────────────────────────────────────────────────

/**
 * Fetches all assets owned by a specific user.
 */
export const getUserAssets = async (uid) => {
  if (!isFirebaseConfigured || !db || !uid) return [];
  try {
    const colRef = collection(db, 'users', uid, 'inventory');
    const q = query(colRef, orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('[AssetService] Error fetching assets:', e);
    return [];
  }
};

/**
 * Saves or updates an asset in the user's inventory.
 */
export const saveAsset = async (uid, asset) => {
  if (!isFirebaseConfigured || !db || !uid) return null;
  try {
    const assetId = asset.id || `asset_${Date.now()}`;
    const docRef = doc(db, 'users', uid, 'inventory', assetId);
    const data = {
      ...asset,
      id: assetId,
      updatedAt: serverTimestamp(),
      createdAt: asset.createdAt || serverTimestamp(),
    };
    await setDoc(docRef, data, { merge: true });
    return data;
  } catch (e) {
    console.error('[AssetService] Error saving asset:', e);
    return null;
  }
};

/**
 * Removes an asset from inventory.
 */
export const deleteAsset = async (uid, assetId) => {
  if (!isFirebaseConfigured || !db || !uid) return false;
  try {
    const docRef = doc(db, 'users', uid, 'inventory', assetId);
    await deleteDoc(docRef);
    return true;
  } catch (e) {
    console.error('[AssetService] Error deleting asset:', e);
    return false;
  }
};

// ─── AVATAR MANAGEMENT (Aura Studio) ─────────────────────────────────────────

/**
 * Saves a Living Avatar to the permanent vault.
 */
export const saveAvatar = async (uid, avatarData) => {
  if (!isFirebaseConfigured || !db || !uid) return null;
  try {
    const avatarId = avatarData.id || `avatar_${Date.now()}`;
    const docRef = doc(db, 'users', uid, 'avatars', avatarId);
    const data = {
      ...avatarData,
      id: avatarId,
      updatedAt: serverTimestamp(),
    };
    await setDoc(docRef, data, { merge: true });
    return data;
  } catch (e) {
    console.error('[AssetService] Error saving avatar:', e);
    return null;
  }
};

/**
 * Loads all avatars for a user.
 */
export const getUserAvatars = async (uid) => {
  if (!isFirebaseConfigured || !db || !uid) return [];
  try {
    const colRef = collection(db, 'users', uid, 'avatars');
    const snap = await getDocs(colRef);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('[AssetService] Error fetching avatars:', e);
    return [];
  }
};

/**
 * Removes an avatar from the vault.
 */
export const deleteAvatar = async (uid, avatarId) => {
  if (!isFirebaseConfigured || !db || !uid) return false;
  try {
    const docRef = doc(db, 'users', uid, 'avatars', avatarId);
    await deleteDoc(docRef);
    return true;
  } catch (e) {
    console.error('[AssetService] Error deleting avatar:', e);
    return false;
  }
};

// ─── TRADE SYSTEM ────────────────────────────────────────────────────────────

/**
 * Creates a real-time listener for trade requests involving the user.
 */
export const listenToTrades = (uid, onUpdate) => {
  if (!isFirebaseConfigured || !db || !uid) return () => {};
  
  // Trades where user is the sender OR the receiver
  const colRef = collection(db, 'trades');
  const q = query(colRef, 
    where('participants', 'array-contains', uid),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(q, (snap) => {
    const trades = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    onUpdate(trades);
  });
};

/**
 * Initiates a new trade request.
 */
export const createTrade = async (fromUid, toHandle, offerItems, requestItems, message) => {
  if (!isFirebaseConfigured || !db || !fromUid) return null;
  try {
    // 1. Resolve toHandle to a UID (assuming we have a lookup or they provided UID)
    // For now, we'll store the handle and resolve it on the receiver's side
    // In a full production env, we'd have a user-lookup service.
    
    const tradeData = {
      sender: fromUid,
      receiverHandle: toHandle,
      participants: [fromUid], // Will add receiver once resolved
      offerItems,
      requestItems,
      message,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'trades'), tradeData);
    return { id: docRef.id, ...tradeData };
  } catch (e) {
    console.error('[AssetService] Error creating trade:', e);
    return null;
  }
};

/**
 * Responds to a trade request.
 */
export const respondToTrade = async (tradeId, uid, action) => {
  if (!isFirebaseConfigured || !db || !tradeId) return false;
  try {
    const docRef = doc(db, 'trades', tradeId);
    await updateDoc(docRef, {
      status: action, // 'accepted', 'declined', 'cancelled'
      updatedAt: serverTimestamp(),
      // If accepted, add the UID to participants if not already there
      participants: arrayUnion(uid) 
    });
    return true;
  } catch (e) {
    console.error('[AssetService] Error responding to trade:', e);
    return false;
  }
};

// ─── DECK MANAGEMENT ──────────────────────────────────────────────────────────

export const saveDeck = async (uid, deck) => {
  if (!isFirebaseConfigured || !db || !uid) return null;
  try {
    const deckId = deck.id || `deck_${Date.now()}`;
    const docRef = doc(db, 'users', uid, 'decks', deckId);
    await setDoc(docRef, {
      ...deck,
      id: deckId,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return deckId;
  } catch (e) {
    console.error('[AssetService] Error saving deck:', e);
    return null;
  }
};

export const getUserDecks = async (uid) => {
  if (!isFirebaseConfigured || !db || !uid) return [];
  try {
    const colRef = collection(db, 'users', uid, 'decks');
    const snap = await getDocs(colRef);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    return [];
  }
};
