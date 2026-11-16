import type { SocialPost, SocialComment } from '@/types';
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
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment
} from 'firebase/firestore';

const POSTS_COLLECTION = 'posts';
const COMMENTS_COLLECTION = 'comments';

// Get all posts (World Feed) - Firestore
export const getGlobalFeed = async (): Promise<SocialPost[]> => {
  if (!db) return [];
  
  try {
    const q = query(
      collection(db, POSTS_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as SocialPost[];
  } catch (error) {
    console.error('Error fetching feed:', error);
    return [];
  }
};

// Get posts for a specific user profile - Firestore
export const getUserPosts = async (userId: string): Promise<SocialPost[]> => {
  if (!db) return [];
  
  try {
    const q = query(
      collection(db, POSTS_COLLECTION),
      where('creatorId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as SocialPost[];
  } catch (error) {
    console.error('Error fetching user posts:', error);
    return [];
  }
};

// Create a social post - Firestore
export const createPost = async (
  userId: string,
  content: string,
  mediaUrls: string[] = [],
  tags: string[] = []
): Promise<SocialPost | null> => {
  if (!db) return null;
  
  try {
    const newPost = {
      creatorId: userId,
      content,
      mediaUrls,
      likes: 0,
      comments: 0,
      likedBy: [],
      tags,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    const docRef = await addDoc(collection(db, POSTS_COLLECTION), newPost);
    
    return {
      id: docRef.id,
      ...newPost,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as SocialPost;
  } catch (error) {
    console.error('Error creating post:', error);
    return null;
  }
};

// Like/Unlike a post - Firestore
export const toggleLike = async (postId: string, userId: string): Promise<boolean> => {
  if (!db) return false;
  
  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);
    const postSnap = await getDoc(postRef);
    
    if (!postSnap.exists()) return false;
    
    const post = postSnap.data();
    const likedBy = post.likedBy || [];
    const isLiked = likedBy.includes(userId);
    
    if (isLiked) {
      // Unlike
      await updateDoc(postRef, {
        likedBy: arrayRemove(userId),
        likes: increment(-1)
      });
    } else {
      // Like
      await updateDoc(postRef, {
        likedBy: arrayUnion(userId),
        likes: increment(1)
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error toggling like:', error);
    return false;
  }
};

// Check if user liked a post
export const hasUserLiked = async (postId: string, userId: string): Promise<boolean> => {
  if (!db) return false;
  
  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);
    const postSnap = await getDoc(postRef);
    
    if (!postSnap.exists()) return false;
    
    const post = postSnap.data();
    return (post.likedBy || []).includes(userId);
  } catch (error) {
    return false;
  }
};

// Get comments for a post - Firestore
export const getComments = async (postId: string): Promise<SocialComment[]> => {
  if (!db) return [];
  
  try {
    const q = query(
      collection(db, COMMENTS_COLLECTION),
      where('postId', '==', postId),
      orderBy('createdAt', 'asc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as SocialComment[];
  } catch (error) {
    console.error('Error fetching comments:', error);
    return [];
  }
};

// Add comment to a post - Firestore
export const addComment = async (
  postId: string,
  userId: string,
  content: string
): Promise<SocialComment | null> => {
  if (!db) return null;
  
  try {
    const newComment = {
      postId,
      creatorId: userId,
      content,
      createdAt: serverTimestamp(),
    };
    
    const docRef = await addDoc(collection(db, COMMENTS_COLLECTION), newComment);
    
    // Update post comment count
    const postRef = doc(db, POSTS_COLLECTION, postId);
    await updateDoc(postRef, {
      comments: increment(1)
    });
    
    return {
      id: docRef.id,
      ...newComment,
      createdAt: new Date().toISOString()
    } as SocialComment;
  } catch (error) {
    console.error('Error adding comment:', error);
    return null;
  }
};

// Delete a post - Firestore
export const deletePost = async (postId: string, userId: string): Promise<boolean> => {
  if (!db) return false;
  
  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);
    const postSnap = await getDoc(postRef);
    
    if (!postSnap.exists()) return false;
    
    const post = postSnap.data();
    if (post.creatorId !== userId) return false; // Only creator can delete
    
    await deleteDoc(postRef);
    
    // Delete associated comments
    const commentsQuery = query(
      collection(db, COMMENTS_COLLECTION),
      where('postId', '==', postId)
    );
    const commentsSnap = await getDocs(commentsQuery);
    const deletePromises = commentsSnap.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    return true;
  } catch (error) {
    console.error('Error deleting post:', error);
    return false;
  }
};

// Legacy initialization (no-op now)
export const initializeSocialStorage = () => {
  // Firestore is ready immediately, no initialization needed
};

// Alias for compatibility
export const addPostComment = addComment;

// More aliases for compatibility
export const getPostComments = getComments;
