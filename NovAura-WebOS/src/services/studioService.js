import { 
  db, 
  storage, 
  auth 
} from '../config/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';

/**
 * Saves a DAW project to Firestore and its associated assets to Storage.
 */
export const saveProject = async (projectData) => {
  if (!auth.currentUser) throw new Error('Authentication required');

  const uid = auth.currentUser.uid;
  const projectId = projectData.id || `proj_${Date.now()}`;
  
  // 1. Prepare metadata for Firestore
  const projectRef = doc(db, 'users', uid, 'studioProjects', projectId);
  
  // We don't want to store huge blobs/buffers directly in Firestore
  // We'll strip them and save the metadata
  const sanitizedProject = {
    ...projectData,
    id: projectId,
    updatedAt: serverTimestamp(),
    ownerId: uid,
    // Ensure tracks and clips are structured for JSON
    tracks: projectData.tracks.map(track => ({
      ...track,
      clips: track.clips.map(clip => ({
        ...clip,
        audioBuffer: null, // Clear binary data
      }))
    })),
    masterTrack: {
      ...projectData.masterTrack,
      clips: projectData.masterTrack.clips.map(clip => ({
        ...clip,
        audioBuffer: null,
      }))
    }
  };

  await setDoc(projectRef, sanitizedProject, { merge: true });
  return projectId;
};

/**
 * Uploads a recorded audio clip to Firebase Storage.
 */
export const uploadStudioClip = async (projectId, clipId, blob) => {
  if (!auth.currentUser) throw new Error('Authentication required');
  
  const uid = auth.currentUser.uid;
  const storagePath = `users/${uid}/studioAssets/${projectId}/${clipId}.webm`;
  const storageRef = ref(storage, storagePath);
  
  await uploadBytes(storageRef, blob);
  const downloadUrl = await getDownloadURL(storageRef);
  
  return {
    url: downloadUrl,
    storagePath
  };
};

/**
 * Fetches all studio projects for the current user.
 */
export const getUserProjects = async () => {
  if (!auth.currentUser) return [];
  
  const uid = auth.currentUser.uid;
  const projectsRef = collection(db, 'users', uid, 'studioProjects');
  const q = query(projectsRef, orderBy('updatedAt', 'desc'));
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

/**
 * Deletes a project and its associated metadata.
 * Note: Actual asset cleanup should ideally happen via Cloud Functions or manual recursive delete.
 */
export const deleteProject = async (projectId) => {
  if (!auth.currentUser) throw new Error('Authentication required');
  
  const uid = auth.currentUser.uid;
  const projectRef = doc(db, 'users', uid, 'studioProjects', projectId);
  await deleteDoc(projectRef);
};
