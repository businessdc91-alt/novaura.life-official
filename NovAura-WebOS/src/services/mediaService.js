import { db, storage, auth } from '../config/firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';

/**
 * NovAura Media Persistence Service
 * Handles cloud storage and database synchronization for user media libraries.
 */

/**
 * Upload a media file to Firebase Storage and save its metadata to Firestore.
 * @param {File} file - The file to upload.
 * @param {'audio' | 'video'} mediaType - The type of media.
 * @param {Object} extraMetadata - Additional info like duration, artist, etc.
 */
export async function uploadAndSaveMedia(file, mediaType, extraMetadata = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('User must be logged in to save media');

  const fileId = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const fileExtension = file.name.split('.').pop();
  const storagePath = `users/${user.uid}/media/${mediaType}/${fileId}.${fileExtension}`;
  const storageRef = ref(storage, storagePath);

  // 1. Upload to Storage
  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);

  // 2. Save metadata to Firestore
  const mediaEntry = {
    uid: user.uid,
    title: extraMetadata.title || file.name.replace(/\.[^.]+$/, ''),
    artist: extraMetadata.artist || 'Unknown Artist',
    duration: extraMetadata.duration || '--:--',
    durationSeconds: extraMetadata.durationSeconds || 0,
    url: downloadURL,
    storagePath: storagePath,
    type: mediaType,
    mimeType: file.type,
    size: file.size,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, `users/${user.uid}/media_library`), mediaEntry);
  
  return { id: docRef.id, ...mediaEntry };
}

/**
 * Retrieve the media library for the current user.
 * @param {'audio' | 'video' | 'all'} type - Filter by media type.
 */
export async function getUserMediaLibrary(type = 'all') {
  const user = auth.currentUser;
  if (!user) return [];

  const libraryRef = collection(db, `users/${user.uid}/media_library`);
  let q = query(libraryRef);
  
  if (type !== 'all') {
    q = query(libraryRef, where('type', '==', type));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    // Convert Firestore timestamp to JS date if needed
    createdAt: doc.data().createdAt?.toDate?.() || new Date(),
  })).sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Delete a media item from both Firestore and Storage.
 * @param {string} docId - The Firestore document ID.
 * @param {string} storagePath - The path in Firebase Storage.
 */
export async function deleteMediaItem(docId, storagePath) {
  const user = auth.currentUser;
  if (!user) throw new Error('Authentication required');

  // 1. Delete from Storage
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (err) {
    console.warn('File not found in storage or delete failed:', err.message);
    // Continue deleting from DB even if storage fails (file might already be gone)
  }

  // 2. Delete from Firestore
  const docRef = doc(db, `users/${user.uid}/media_library`, docId);
  await deleteDoc(docRef);
}
