import { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { kernelStorage } from '../kernel/kernelStorage.js';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../config/firebase.js';

const AuthContext = createContext({
  user: null,
  tier: 'free',
  loading: true,
  isAuthenticated: false,
});

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    user: null,
    tier: 'free',
    loading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    // Firebase is the only source of truth — no localStorage auth bypass
    if (!isFirebaseConfigured || !auth) {
      setState({ user: null, tier: 'free', loading: false, isAuthenticated: false });
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let tier = 'free';
        try {
          // Fetch user doc from Firestore for membership tier
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            tier = userDoc.data().membershipTier || 'free';
          }
        } catch (e) {
          console.warn('[Auth] Failed to fetch tier, defaulting to free', e);
        }

        const userData = {
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          photoURL: firebaseUser.photoURL,
          avatar: firebaseUser.photoURL,
        };
        // Cache for faster re-renders only — never used to bypass auth
        kernelStorage.setItem('novaura_user_cache', JSON.stringify(userData));
        setState({ user: userData, tier, loading: false, isAuthenticated: true });
      } else {
        kernelStorage.removeItem('novaura_user_cache');
        setState({ user: null, tier: 'free', loading: false, isAuthenticated: false });
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={state}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
