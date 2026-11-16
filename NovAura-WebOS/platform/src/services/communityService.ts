import type { ForumThread, ForumReply, JobPost, JobApplication, JobType } from '@/types';
import { db } from '../config/firebase';
import { 
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment
} from 'firebase/firestore';

const THREADS_COLLECTION = 'forumThreads';
const REPLIES_COLLECTION = 'forumReplies';
const JOBS_COLLECTION = 'jobs';
const APPLICATIONS_COLLECTION = 'jobApplications';

// --- FORUM LOGIC ---

export const getThreads = async (category?: ForumThread['category']): Promise<ForumThread[]> => {
  if (!db) return [];
  
  try {
    let q = query(
      collection(db, THREADS_COLLECTION),
      orderBy('createdAt', 'desc')
    );
    
    if (category) {
      q = query(q, where('category', '==', category));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ForumThread[];
  } catch (error) {
    console.error('Error fetching threads:', error);
    return [];
  }
};

export const getThread = async (threadId: string): Promise<ForumThread | null> => {
  if (!db) return null;
  
  try {
    const docRef = doc(db, THREADS_COLLECTION, threadId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as ForumThread;
    }
    return null;
  } catch (error) {
    console.error('Error fetching thread:', error);
    return null;
  }
};

export const createThread = async (
  userId: string,
  title: string,
  content: string,
  category: ForumThread['category']
): Promise<ForumThread | null> => {
  if (!db) return null;
  
  try {
    const newThread = {
      creatorId: userId,
      title,
      content,
      category,
      replies: 0,
      views: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    const docRef = await addDoc(collection(db, THREADS_COLLECTION), newThread);
    
    return {
      id: docRef.id,
      ...newThread,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as ForumThread;
  } catch (error) {
    console.error('Error creating thread:', error);
    return null;
  }
};

export const getReplies = async (threadId: string): Promise<ForumReply[]> => {
  if (!db) return [];
  
  try {
    const q = query(
      collection(db, REPLIES_COLLECTION),
      where('threadId', '==', threadId),
      orderBy('createdAt', 'asc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ForumReply[];
  } catch (error) {
    console.error('Error fetching replies:', error);
    return [];
  }
};

export const addReply = async (
  threadId: string,
  userId: string,
  content: string
): Promise<ForumReply | null> => {
  if (!db) return null;
  
  try {
    const newReply = {
      threadId,
      creatorId: userId,
      content,
      createdAt: serverTimestamp(),
    };
    
    const docRef = await addDoc(collection(db, REPLIES_COLLECTION), newReply);
    
    // Update thread reply count
    const threadRef = doc(db, THREADS_COLLECTION, threadId);
    await updateDoc(threadRef, {
      replies: increment(1),
      updatedAt: serverTimestamp()
    });
    
    return {
      id: docRef.id,
      ...newReply,
      createdAt: new Date().toISOString()
    } as ForumReply;
  } catch (error) {
    console.error('Error adding reply:', error);
    return null;
  }
};

// --- JOBS LOGIC ---

export const getJobs = async (type?: JobType): Promise<JobPost[]> => {
  if (!db) return [];
  
  try {
    let q = query(
      collection(db, JOBS_COLLECTION),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc')
    );
    
    if (type) {
      q = query(q, where('type', '==', type));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as JobPost[];
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return [];
  }
};

export const createJob = async (
  userId: string,
  jobData: Omit<JobPost, 'id' | 'creatorId' | 'createdAt' | 'status'>
): Promise<JobPost | null> => {
  if (!db) return null;
  
  try {
    const newJob = {
      creatorId: userId,
      ...jobData,
      status: 'open',
      applications: 0,
      createdAt: serverTimestamp(),
    };
    
    const docRef = await addDoc(collection(db, JOBS_COLLECTION), newJob);
    
    return {
      id: docRef.id,
      ...newJob,
      createdAt: new Date().toISOString()
    } as JobPost;
  } catch (error) {
    console.error('Error creating job:', error);
    return null;
  }
};

// Legacy initialization (no-op now)
export const initializeCommunityStorage = () => {
  // Firestore is ready immediately
};
