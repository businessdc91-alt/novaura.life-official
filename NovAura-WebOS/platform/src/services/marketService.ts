import type { Asset, Category, Review, Order, Royalty, CreatorStats } from '@/types';
import { db, storage } from '../config/firebase';
import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { apiClient } from './apiClient';

import { 
  platformCategories, 
  platformCreatorStats, 
  platformReviews, 
  platformOrders, 
  platformRoyalties 
} from '../data/marketData';

// Legacy compatibility exports
export { 
  platformCategories, 
  platformCreatorStats, 
  platformReviews, 
  platformOrders, 
  platformRoyalties 
};

export const getCategories = async (): Promise<Category[]> => {
  return platformCategories;
};

export const initializeStorage = (): void => {};
export const getStoredOrders = (): Order[] => [];
export const getStoredRoyalties = (): Royalty[] => [];

export const getAssets = async (status: AssetStatus = 'approved'): Promise<Asset[]> => {
  if (!db) return [];
  const q = query(collection(db, 'assets'), where('status', '==', status), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset));
};

export const getAssetsByCreator = async (creatorId: string): Promise<Asset[]> => {
  if (!db) return [];
  const q = query(collection(db, 'assets'), where('creatorId', '==', creatorId));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset));
};

export const getFeaturedAssets = async (): Promise<Asset[]> => {
  if (!db) return [];
  const q = query(collection(db, 'assets'), where('featured', '==', true), where('status', '==', 'approved'), limit(10));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset));
};

export const getTrendingAssets = async (): Promise<Asset[]> => {
  if (!db) return [];
  const q = query(collection(db, 'assets'), where('status', '==', 'approved'), orderBy('downloads', 'desc'), limit(10));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset));
};

export const getNewArrivals = async (): Promise<Asset[]> => {
  if (!db) return [];
  const q = query(collection(db, 'assets'), where('status', '==', 'approved'), orderBy('createdAt', 'desc'), limit(8));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset));
};

export const getAssetById = async (id: string): Promise<Asset> => {
  if (!db) throw new Error("Database not connected");
  const docSnap = await getDoc(doc(db, 'assets', id));
  if (!docSnap.exists()) throw new Error('Asset not found');
  return { id: docSnap.id, ...docSnap.data() } as Asset;
};

export const uploadAssetFile = async (
  file: File, 
  directory: string = 'assets',
  onProgress?: (progress: number) => void
): Promise<{ url: string, path: string }> => {
  if (!storage) throw new Error("Storage not configured");
  const uniqueName = `${Date.now()}_${file.name}`;
  const fullPath = `${directory}/${uniqueName}`;
  const storageRef = ref(storage, fullPath);
  
  const uploadTask = uploadBytesResumable(storageRef, file);
  
  return new Promise((resolve, reject) => {
    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      }, 
      (error) => reject(error), 
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({ url, path: fullPath });
      }
    );
  });
};

export const createAsset = async (asset: Partial<Asset>): Promise<Asset> => {
  if (!db) throw new Error("Database not connected");
  // serverTimestamp keeps createdAt a single type across client + backend
  // writes — mixed string/timestamp values split Firestore orderBy results.
  const payload = {
    ...asset,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: asset.status || 'pending',
    downloadCount: 0,
    viewCount: 0,
    ratingAverage: 0,
    ratingCount: 0,
  };
  const docRef = await addDoc(collection(db, 'assets'), payload);
  return { id: docRef.id, ...payload } as Asset;
};

export const updateAsset = async (id: string, data: Partial<Asset>): Promise<Asset> => {
  if (!db) throw new Error("Database not connected");
  await updateDoc(doc(db, 'assets', id), { ...data, updatedAt: serverTimestamp() });
  return getAssetById(id);
};

export const deleteAsset = async (id: string): Promise<void> => {
  if (!db) return;
  await deleteDoc(doc(db, 'assets', id));
};

export const getAllAssets = async (): Promise<Asset[]> => {
  if (!db) return [];
  const q = query(collection(db, 'assets'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset));
};

export const getPendingAssets = async (): Promise<Asset[]> => {
  return getAssets('pending');
};

export const approveAsset = async (id: string): Promise<void> => {
  if (!db) return;
  await updateDoc(doc(db, 'assets', id), {
    status: 'approved',
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
};

export const rejectAsset = async (id: string, reason?: string): Promise<void> => {
  if (!db) return;
  await updateDoc(doc(db, 'assets', id), {
    status: 'rejected',
    rejectionReason: reason,
    updatedAt: serverTimestamp()
  });
};

export const getAssetReviews = async (assetId: string): Promise<Review[]> => {
  if (!db) return [];
  const q = query(collection(db, 'reviews'), where('assetId', '==', assetId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
};

export const createReview = async (assetId: string, review: Partial<Review>): Promise<Review> => {
  if (!db) throw new Error("Database not connected");
  const payload = {
    ...review,
    assetId,
    helpfulCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const docRef = await addDoc(collection(db, 'reviews'), payload);
  return { id: docRef.id, ...payload } as Review;
};

export const getOrders = async (userId: string): Promise<Order[]> => {
  if (!db) return [];
  const q = query(collection(db, 'orders'), where('buyerId', '==', userId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
};

export const createOrder = async (order: Partial<Order>): Promise<Order> => {
  if (!db) throw new Error("Database not connected");
  
  const payload = {
    ...order,
    status: 'completed',
    createdAt: serverTimestamp(),
    items: order.items || [],
    totalAmount: order.totalAmount || 0,
    platformFee: order.platformFee || 0,
  };
  
  const docRef = await addDoc(collection(db, 'orders'), payload);
  
  if (order.buyerId && order.items) {
    for (const item of order.items) {
      const ownershipId = `${order.buyerId}_${item.id}`;
      await setDoc(doc(db, 'user_owned_assets', ownershipId), {
        userId: order.buyerId,
        assetId: item.id,
        orderId: docRef.id,
        purchaseDate: serverTimestamp(),
        license: item.licenseTier || 'standard'
      });
      
      await updateDoc(doc(db, 'assets', item.id), {
        downloads: (item.downloads || 0) + 1
      });
    }
  }
  
  return { id: docRef.id, ...payload } as Order;
};

export const checkOwnership = async (userId: string, assetId: string): Promise<boolean> => {
  if (!db || !userId) return false;
  const ownershipId = `${userId}_${assetId}`;
  const snap = await getDoc(doc(db, 'user_owned_assets', ownershipId));
  return snap.exists();
};

export async function connectStripeAccount(userId: string): Promise<string> {
  try {
    const data = await apiClient.post<{ url: string }>('/stripe/connect', { userId });
    return data.url;
  } catch (error) {
    console.error('Failed to connect Stripe:', error);
    throw error;
  }
}

export async function createCheckoutSession(userId: string, items: any[]): Promise<string> {
  try {
    const data = await apiClient.post<{ url: string }>('/stripe/checkout', { userId, items });
    return data.url;
  } catch (error) {
    console.error('Failed to create Checkout Session:', error);
    throw error;
  }
}

export const getRoyalties = async (creatorId: string): Promise<Royalty[]> => {
  if (!db) return [];
  const q = query(collection(db, 'royalty_ledger'), where('recipientId', '==', creatorId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
};

export const getCreatorStats = async (creatorId: string): Promise<CreatorStats> => {
  if (!db) return { totalAssets: 0, totalSales: 0, totalDownloads: 0, totalEarnings: 0, pendingRoyalties: 0, availableRoyalties: 0, lifetimeRoyalties: 0 };
  
  const royalties = await getRoyalties(creatorId);
  const totalEarnings = royalties.reduce((acc, r) => acc + (r.amount || 0), 0);
  
  return {
    totalAssets: 0, 
    totalSales: royalties.length,
    totalDownloads: 0,
    totalEarnings: totalEarnings / 100, 
    pendingRoyalties: 0,
    availableRoyalties: totalEarnings / 100,
    lifetimeRoyalties: totalEarnings / 100
  };
};

export const saveAsset = async (asset: Partial<Asset>): Promise<Asset> => createAsset(asset);
export const generateId = (): string => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
export const createSlug = (title: string): string => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
