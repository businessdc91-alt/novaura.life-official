import { db } from '../config/firebase';
import { collection, query, where, orderBy, getDocs, limit, doc, getDoc } from 'firebase/firestore';

export const platformCategories = [
  { id: '1', name: 'Games & Demos', slug: 'games-demos', icon: 'Gamepad2' },
  { id: '2', name: 'Frameworks & Tools', slug: 'frameworks-tools', icon: 'Wrench' },
  { id: '3', name: 'UI Kits & HUDs', slug: 'ui-kits-huds', icon: 'Layout' },
  { id: '4', name: '2D Art & Sprites', slug: '2d-art-sprites', icon: 'Image' },
  { id: '5', name: '3D Models & Avatars', slug: '3d-models-avatars', icon: 'Box' },
  { id: '6', name: 'Audio & Music', slug: 'audio-music', icon: 'Music' },
  { id: '7', name: 'Writing & Scripts', slug: 'writing-scripts', icon: 'Feather' },
];

export const getAssets = async (filters = {}) => {
  if (!db) return [];
  
  let q = query(
    collection(db, 'assets'), 
    where('status', '==', 'approved'),
    orderBy('createdAt', 'desc')
  );

  if (filters.category) {
    q = query(q, where('category', '==', filters.category));
  }

  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getFeaturedAssets = async () => {
  if (!db) return [];
  const q = query(
    collection(db, 'assets'), 
    where('featured', '==', true), 
    where('status', '==', 'approved'), 
    limit(12)
  );
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getAssetById = async (id) => {
  if (!db) return null;
  const docSnap = await getDoc(doc(db, 'assets', id));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
};
