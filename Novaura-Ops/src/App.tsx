import { useEffect, useState } from 'react';
import { useAppStore } from './stores/appStore';
import { auth, googleProvider } from './services/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import AppShell from './components/layout/AppShell';
import OnboardingFlow from './components/onboarding/OnboardingFlow';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Shield, LogIn } from 'lucide-react';

// @novaura.xyz = internal team/partner domain — auto-granted staff access
// @novaura.life = customer domain — NOT allowed here (that's the public platform)
// Add individual gmail addresses for Dillan + any gmail-based partners below

const STAFF_DOMAIN = 'novaura.xyz';       // auto-assigned 'partner' role
const BLOCKED_DOMAIN = 'novaura.life';    // customers — block from Ops

const OWNER_EMAILS = [
  'lostitonce420@gmail.com',
  'dillan.copeland@novaura.xyz',
  'business.dc91@gmail.com',
];

const ALLOWED_EMAILS = [
  ...OWNER_EMAILS,
  // add partner/staff gmail addresses here as the team grows
];

export function getEmailDomain(email: string) {
  return email.split('@')[1]?.toLowerCase() || '';
}

export function isAuthorized(email: string | null): boolean {
  if (!email) return false;
  const domain = getEmailDomain(email);
  if (domain === BLOCKED_DOMAIN) return false;         // customers blocked
  if (domain === STAFF_DOMAIN) return true;            // @novaura.xyz always in
  return ALLOWED_EMAILS.includes(email.toLowerCase()); // explicit allowlist
}

export function resolveRole(email: string): 'owner' | 'partner' | 'dev' | 'staff' {
  const domain = getEmailDomain(email);
  if (OWNER_EMAILS.includes(email.toLowerCase())) return 'owner';
  if (domain === STAFF_DOMAIN) return 'partner';
  return 'staff';
}

export default function App() {
  const { user, authLoading, init } = useAppStore();
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const unsub = init();
    return unsub;
  }, []);

  const handleSignIn = async () => {
    setSigningIn(true);
    setAuthError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (!isAuthorized(result.user.email)) {
        await signOut(auth);
        setAuthError('Access restricted to NovAura staff only. Contact Dillan to get added.');
      }
    } catch (e: any) {
      setAuthError(e.message || 'Sign in failed');
    } finally {
      setSigningIn(false);
    }
  };

  if (authLoading) {
    return (
      <div className="w-screen h-screen bg-void flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-2 border-neon-cyan/20 border-t-neon-cyan rounded-full"
        />
      </div>
    );
  }

  const needsOnboarding = user && isAuthorized(user.email) && useAppStore.getState().profile && !useAppStore.getState().profile?.onboarded;

  if (!user || !isAuthorized(user.email)) {
    return (
      <div className="w-screen h-screen bg-void flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-8 text-center max-w-sm"
        >
          {/* Logo ring */}
          <div className="relative w-24 h-24">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 rounded-full border-2 border-dashed border-neon-cyan/40"
            />
            <div className="absolute inset-3 rounded-full bg-void-light flex items-center justify-center">
              <Shield className="w-8 h-8 text-neon-cyan" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-black text-white tracking-tight mb-2">NovAura Ops</h1>
            <p className="text-white/40 text-sm">Staff & developer access only</p>
          </div>

          {authError && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              {authError}
            </p>
          )}

          <button
            onClick={handleSignIn}
            disabled={signingIn}
            className="flex items-center gap-3 px-8 py-4 bg-void-light border border-white/10 rounded-xl text-white font-semibold hover:border-neon-cyan/40 hover:bg-neon-cyan/5 transition-all disabled:opacity-50"
          >
            {signingIn
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <LogIn className="w-5 h-5" />
            }
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  if (needsOnboarding) {
    return <OnboardingFlow onComplete={() => useAppStore.setState(s => ({ profile: s.profile ? { ...s.profile, onboarded: true } : null }))} />;
  }

  return <AppShell />;
}
