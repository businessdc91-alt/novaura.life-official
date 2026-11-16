import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Eye, EyeOff, ChevronRight, Lock } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { apiClient } from '@/services/apiClient';
import { kernelStorage } from '@/kernel/kernelStorage.js';
import { auth, googleProvider } from '../../../src/config/firebase';
import { signInWithPopup } from 'firebase/auth';

const ONBOARDING_KEY = 'novaura_staff_onboarding';

const STAFF_TITLES = [
  'Catalyst (Owner)',
  'AI Orchestrator',
  'Developer',
  'Motion Picture Director',
  'Graphics Designer',
  'Audio Technician',
  'Researcher',
  'Marketeer',
  'Testers',
];

export default function StaffLoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const { addToast } = useUIStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [title, setTitle]         = useState('');
  const [loading, setLoading]     = useState(false);

  // Check if onboarding is enabled
  const onboardingEnabled = kernelStorage.getItem(ONBOARDING_KEY) !== 'false';

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Auto-fill from Google
      const [first, ...last] = (user.displayName || '').split(' ');
      setFirstName(first || '');
      setLastName(last.join(' ') || '');
      setEmail(user.email || '');
      setAvatarUrl(user.photoURL || '');
      
      // Suggest a username if not set
      if (!username) {
        setUsername(user.email?.split('@')[0] || '');
      }

      toast.success('Identity verified via Google');
      setStep(2);
    } catch (err: any) {
      console.error('Staff Auth Error:', err);
      toast.error('Google Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !password || !title) {
      addToast({ type: 'error', title: 'Missing fields', message: 'All fields are required.' });
      return;
    }

    setLoading(true);
    try {
      const { token, user } = await apiClient.post<{ token: string; user: any }>('/auth/staff-login', {
        email: email.trim(),
        password,
        firstName,
        lastName,
        title,
        avatar: avatarUrl,
        isNewRegistration: true,
      });
      apiClient.setToken(token);
      setUser(user);
      addToast({ type: 'success', title: `Welcome, ${firstName}!`, message: `Registered as ${title}.` });
      navigate('/admin/command-center');
    } catch (err: any) {
      addToast({ type: 'error', title: 'Registration failed', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (!onboardingEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void px-4">
        <div className="text-center max-w-sm">
          <Lock className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h2 className="font-heading text-xl text-text-primary mb-2">Staff Onboarding Closed</h2>
          <p className="text-text-secondary text-sm">
            Staff registration is currently disabled. Contact the platform owner.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-void px-4 py-16">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full"
             style={{ background: 'radial-gradient(circle, rgba(0,240,255,0.05) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="bg-void-light border border-white/5 rounded-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-neon-cyan/10 border border-neon-cyan/20">
              <Shield className="w-7 h-7 text-neon-cyan" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-text-primary mb-1">Staff Login</h1>
            <p className="text-text-muted text-sm">NovAura internal — authorized personnel only</p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-3 mb-8">
            {[1, 2].map(n => (
              <div key={n} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                  (step === 'login' ? 3 : step) >= n
                    ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan'
                    : 'border-white/10 text-text-muted'
                }`}>
                  {n}
                </div>
                {n === 1 && <div className={`w-12 h-0.5 ${(step === 'login' ? 3 : step) >= 2 ? 'bg-neon-cyan' : 'bg-white/10'}`} />}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* ── Step 1: Identity Verification ── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <p className="text-text-secondary text-sm mb-6">
                    Sign in with your Google account to verify your identity before joining the NovAura staff.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white text-void font-bold rounded-xl hover:bg-white/90 transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-void/30 border-t-void rounded-full animate-spin" />
                  ) : (
                    <>
                      <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                      Continue with Google
                    </>
                  )}
                </button>

                <p className="text-center text-[10px] text-text-muted uppercase tracking-widest">
                  Secure Identity verification required
                </p>
              </motion.div>
            )}

            {/* ── Step 2: Staff Registration ── */}
            {step === 2 && (
              <motion.form
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleRegister}
                className="space-y-4"
              >
                {/* Name row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-text-muted mb-1">First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="Dillan"
                      className="w-full bg-void border border-white/10 rounded-lg px-3 py-2.5 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-neon-cyan/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder="Rosales"
                      className="w-full bg-void border border-white/10 rounded-lg px-3 py-2.5 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-neon-cyan/40"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs text-text-muted mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@novaura.tech"
                    className="w-full bg-void border border-white/10 rounded-lg px-3 py-2.5 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-neon-cyan/40"
                  />
                </div>

                {/* Username */}
                <div>
                  <label className="block text-xs text-text-muted mb-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="dillan_nova"
                    className="w-full bg-void border border-white/10 rounded-lg px-3 py-2.5 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-neon-cyan/40"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs text-text-muted mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-void border border-white/10 rounded-lg px-3 py-2.5 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-neon-cyan/40 pr-9"
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Title / Role */}
                <div>
                  <label className="block text-xs text-text-muted mb-1">Staff Title</label>
                  <select
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full bg-void border border-white/10 rounded-lg px-3 py-2.5 text-text-primary text-sm focus:outline-none focus:border-neon-cyan/40"
                  >
                    <option value="">Select your role...</option>
                    {STAFF_TITLES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 border border-white/10 rounded-lg py-3 text-text-secondary text-sm hover:border-white/20 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gradient-rgb text-void font-bold py-3 rounded-lg flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-void/30 border-t-void rounded-full animate-spin" />
                    ) : 'Join as Staff'}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
