import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import { auth, db } from '../config/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  updateProfile as updateFirebaseProfile,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  signup: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  claimDailyCoins: () => Promise<void>;
  useCoins: (amount: number) => Promise<boolean>;
  useActionTokens: (amount: number) => Promise<boolean>;
  init: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setUser: (user: User | null) => void;
  isOwner: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      setUser: (user: any | null) => set({ user, isAuthenticated: !!user }),

      init: () => {
        if (!auth) return;
        set({ isLoading: true });
        
        onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            try {
              const userDocRef = doc(db!, 'users', firebaseUser.uid);
              const userDoc = await getDoc(userDocRef);
              if (userDoc.exists()) {
                const data = userDoc.data();
                set({ 
                  user: { id: firebaseUser.uid, emailVerified: firebaseUser.emailVerified, actionTokens: 0, ...data } as User, 
                  isAuthenticated: true,
                  isLoading: false 
                });
              } else {
                // Construct fallback if missing from DB and save it
                const fallbackUser = {
                  email: firebaseUser.email || '',
                  username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                  role: 'buyer',
                  membershipTier: 'free',
                  actionTokens: 0,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
                try {
                  await setDoc(userDocRef, fallbackUser, { merge: true });
                } catch (writeErr) {
                  console.warn('Failed to write new user doc on init:', writeErr);
                }
                set({ user: { id: firebaseUser.uid, emailVerified: firebaseUser.emailVerified, ...fallbackUser } as User, isAuthenticated: true, isLoading: false });
              }
            } catch (e) {
              console.warn('Failed to read user doc', e);
              set({ isLoading: false });
            }
          } else {
            set({ user: null, isAuthenticated: false, isLoading: false });
          }
        });
      },

      login: async (email: string, password: string) => {
        if (!auth) throw new Error('Firebase not initialized');
        set({ isLoading: true, error: null });
        try {
          const cred = await signInWithEmailAndPassword(auth, email, password);
          const userDocRef = doc(db!, 'users', cred.user.uid);
          const userDoc = await getDoc(userDocRef);
          let userData;
          if (userDoc.exists()) {
            userData = userDoc.data();
          } else {
            userData = {
              email: cred.user.email || '',
              username: cred.user.displayName || (cred.user.email ? cred.user.email.split('@')[0] : 'User'),
              role: 'buyer',
              membershipTier: 'free',
              actionTokens: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            try {
              await setDoc(userDocRef, userData, { merge: true });
            } catch (writeErr) {
              console.warn('Failed to write new user doc on login:', writeErr);
            }
          }
          
          set({ 
            user: { id: cred.user.uid, emailVerified: cred.user.emailVerified, ...userData } as User, 
            isAuthenticated: true, 
            isLoading: false, 
            error: null 
          });
        } catch (err: any) {
          set({ isLoading: false, error: err.message });
          throw err;
        }
      },

      loginWithGoogle: async () => {
        if (!auth || !db) throw new Error('Firebase not initialized');
        set({ isLoading: true, error: null });
        try {
          const provider = new GoogleAuthProvider();
          provider.addScope('email');
          provider.addScope('profile');
          
          const cred = await signInWithPopup(auth, provider);
          const firebaseUser = cred.user;
          
          // Force synchronization of the token state to Firestore instance
          await firebaseUser.getIdToken(true);
          
          // Check if user exists in Firestore
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (!userDoc.exists()) {
            // Create new user from Google data
            const newUser: Omit<User, 'id'> = {
              email: firebaseUser.email || '',
              username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              role: 'buyer',
              preferences: {
                showNsfw: false,
                ageVerified: false,
                emailNotifications: true,
                marketingEmails: true,
                publicProfile: true,
                showActivity: true,
              },
              membershipTier: 'free',
              actionTokens: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              avatar: firebaseUser.photoURL || undefined
            };
            
            await setDoc(userDocRef, newUser);
            
            set({ 
              user: { id: firebaseUser.uid, ...newUser } as User, 
              isAuthenticated: true, 
              isLoading: false, 
              error: null 
            });
          } else {
            // Existing user
            const userData = userDoc.data();
            set({ 
              user: { id: firebaseUser.uid, ...userData } as User, 
              isAuthenticated: true, 
              isLoading: false, 
              error: null 
            });
          }
        } catch (err: any) {
          console.error('Google login error:', err);
          set({ isLoading: false, error: err.message });
          throw err;
        }
      },

      signup: async (email: string, password: string, username: string) => {
        if (!auth || !db) throw new Error('Firebase not initialized');
        set({ isLoading: true, error: null });
        try {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          await updateFirebaseProfile(cred.user, { displayName: username });
          
          // Send email verification
          try {
            await sendEmailVerification(cred.user);
          } catch (verifyErr) {
            console.warn('Failed to send verification email:', verifyErr);
          }
          
          const newUser: Omit<User, 'id'> = {
            email,
            username,
            role: 'buyer',
            preferences: {
              showNsfw: false,
              ageVerified: false,
              emailNotifications: true,
              marketingEmails: true,
              publicProfile: true,
              showActivity: true
            },
            actionTokens: 0,
            membershipTier: 'free',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          } as any;
          
          // Save to Firestore
          await setDoc(doc(db, 'users', cred.user.uid), newUser);
          
          set({ 
            user: { id: cred.user.uid, emailVerified: false, ...newUser } as User, 
            isAuthenticated: true, 
            isLoading: false, 
            error: null 
          });
        } catch (err: any) {
          set({ isLoading: false, error: err.message });
          throw err;
        }
      },

      resendVerification: async () => {
        if (!auth || !auth.currentUser) throw new Error('No user logged in');
        set({ isLoading: true, error: null });
        try {
          await sendEmailVerification(auth.currentUser);
          set({ isLoading: false });
        } catch (err: any) {
          set({ isLoading: false, error: err.message });
          throw err;
        }
      },

      logout: async () => {
        if (auth) await signOut(auth);
        set({ user: null, isAuthenticated: false, error: null });
      },

      updateProfile: async (data: Partial<User>) => {
        const { user } = get();
        if (!user || !db) return;
        set({ isLoading: true });
        try {
          await updateDoc(doc(db, 'users', user.id), data);
          set({ user: { ...user, ...data } as User, isLoading: false });
        } catch (err: any) {
          set({ isLoading: false, error: err.message });
          throw err;
        }
      },

      claimDailyCoins: async () => {},
      useCoins: async (amount: number) => {
        return get().useActionTokens(amount);
      },

      useActionTokens: async (amount: number) => {
        const { user } = get();
        if (!user || !db) return false;
        
        const currentTokens = user.actionTokens || 0;
        if (currentTokens < amount) return false;

        try {
          const newTokens = currentTokens - amount;
          await updateDoc(doc(db, 'users', user.id), {
            actionTokens: newTokens,
            updatedAt: new Date().toISOString()
          });
          
          set({ user: { ...user, actionTokens: newTokens } as User });
          return true;
        } catch (err) {
          console.error('Failed to use action tokens:', err);
          return false;
        }
      },

      setError: (error: string | null) => set({ error }),
      clearError: () => set({ error: null }),
      
      isOwner: () => {
        const user = get().user;
        if (!user || !user.email) return false;
        const ownerEmails = [
          'dillan.copeland@novaura.xyz',
          'business.dc91@gmail.com',
          'the.lost.catalyst@gmail.com',
          'lostitonce420@gmail.com'
        ];
        return ownerEmails.includes(user.email.toLowerCase());
      },
    }),
    {
      name: 'novaura-auth-unified',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
