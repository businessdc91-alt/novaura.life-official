
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';

const COLLECTION_NAME = 'research_reports';

export const researchService = {
  /**
   * Saves a research report to Firestore.
   */
  async saveReport(userId, report) {
    if (!db) throw new Error('Firestore not initialized');

    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...report,
      userId,
      timestamp: serverTimestamp()
    });

    return docRef.id;
  },

  /**
   * Retrieves the most recent research reports for a user.
   */
  async getUserReports(userId, maxResults = 10) {
    if (!db) throw new Error('Firestore not initialized');

    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(maxResults)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }
};
