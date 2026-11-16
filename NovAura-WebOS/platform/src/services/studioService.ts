import { 
  db, 
  storage, 
  auth 
} from '../config/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  orderBy, 
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';

export interface StudioProject {
  id?: string;
  name: string;
  bpm: number;
  tracks: any[];
  masterTrack: any;
  ownerId?: string;
  updatedAt?: any;
}

/**
 * Saves a DAW project to Firestore.
 */
export const saveProject = async (projectData: StudioProject) => {
  if (!auth.currentUser) throw new Error('Authentication required');

  const uid = auth.currentUser.uid;
  const projectId = projectData.id || `proj_${Date.now()}`;
  
  const projectRef = doc(db, 'users', uid, 'studioProjects', projectId);
  
  // Strip binary data before saving
  const sanitizedProject = {
    ...projectData,
    id: projectId,
    updatedAt: serverTimestamp(),
    ownerId: uid,
    tracks: projectData.tracks.map(track => ({
      ...track,
      clips: track.clips.map((clip: any) => ({
        ...clip,
        audioBuffer: null, // Binary data must be uploaded to Storage separately
      }))
    })),
    masterTrack: {
      ...projectData.masterTrack,
      clips: projectData.masterTrack.clips.map((clip: any) => ({
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
export const uploadStudioClip = async (projectId: string, clipId: string, blob: Blob) => {
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
  })) as StudioProject[];
};

/**
 * Deletes a project.
 */
export const deleteProject = async (projectId: string) => {
  if (!auth.currentUser) throw new Error('Authentication required');
  
  const uid = auth.currentUser.uid;
  const projectRef = doc(db, 'users', uid, 'studioProjects', projectId);
  await deleteDoc(projectRef);
};
