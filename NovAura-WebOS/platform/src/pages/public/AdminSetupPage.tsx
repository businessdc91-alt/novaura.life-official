import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { apiClient } from '@/services/apiClient';

export default function AdminSetupPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const { addToast } = useUIStore();
  
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    // Check via API if admin already exists — redirect to login if so
    apiClient.post('/auth/admin-setup', {})
      .catch((err: Error) => {
        if (err.message === 'Admin already exists.') navigate('/login');
      });
  }, [navigate]);

  const validateStep1 = () => {
    if (!email || !email.includes('@')) {
      addToast({
        type: 'error',
        title: 'Invalid email',
        message: 'Please enter a valid email address.',
      });
      return false;
    }
    if (!username || username.length < 3) {
      addToast({
        type: 'error',
        title: 'Invalid username',
        message: 'Username must be at least 3 characters.',
      });
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!password || password.length < 8) {
      addToast({
        type: 'error',
        title: 'Weak password',
        message: 'Password must be at least 8 characters.',
      });
      return false;
    }
    if (password !== confirmPassword) {
      addToast({
        type: 'error',
        title: 'Passwords do not match',
        message: 'Please make sure your passwords match.',
      });
      return false;
    }
    return true;
  };

  const handleCreateAdmin = async () => {
    if (!validateStep2()) return;
    setIsLoading(true);
    try {
      const { token, user } = await apiClient.post('/auth/admin-setup', { email, password, username });
      apiClient.setToken(token);
      setUser(user);
      addToast({
        type: 'success',
        title: 'Admin account created!',
        message: 'Welcome to NovAura Market, owner!',
      });
      navigate('/admin/dashboard');
    } catch (err: any) {
      addToast({ type: 'error', title: 'Setup failed', message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center pt-20 pb-12 px-4">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-void-light border border-white/5 rounded-2xl p-8"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-gradient-rgb flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-void" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-text-primary mb-2">
              Admin Setup
            </h1>
            <p className="text-text-secondary text-sm">
              Create the owner account for NovAura Market
            </p>
          </div>

          {/* Progress */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-neon-cyan' : 'text-text-muted'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                step >= 1 ? 'border-neon-cyan bg-neon-cyan/10' : 'border-text-muted'
              }`}>
                1
              </div>
            </div>
            <div className={`w-12 h-0.5 ${step >= 2 ? 'bg-neon-cyan' : 'bg-white/10'}`} />
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-neon-cyan' : 'text-text-muted'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                step >= 2 ? 'border-neon-cyan bg-neon-cyan/10' : 'border-text-muted'
              }`}>
                2
              </div>
            </div>
          </div>

          {/* Step 1: Account Info */}
          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm text-text-muted mb-2">
                  Owner Email *
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="py-6 bg-void border-white/10 text-text-primary placeholder:text-text-muted"
                />
                <p className="text-xs text-text-muted mt-1">
                  This will be your login email
                </p>
              </div>

              <div>
                <label className="block text-sm text-text-muted mb-2">
                  Username *
                </label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="novaura_owner"
                  className="py-6 bg-void border-white/10 text-text-primary placeholder:text-text-muted"
                />
                <p className="text-xs text-text-muted mt-1">
                  This will be your public display name
                </p>
              </div>

              <Button
                className="w-full bg-gradient-rgb text-void font-bold py-6"
                onClick={() => {
                  if (validateStep1()) setStep(2);
                }}
              >
                Continue
              </Button>
            </motion.div>
          )}

          {/* Step 2: Password */}
          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 p-4 bg-neon-cyan/10 border border-neon-cyan/30 rounded-lg mb-4">
                <AlertCircle className="w-5 h-5 text-neon-cyan flex-shrink-0" />
                <p className="text-sm text-neon-cyan">
                  Choose a strong password. This is the master admin account.
                </p>
              </div>

              <div>
                <label className="block text-sm text-text-muted mb-2">
                  Password *
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="py-6 bg-void border-white/10 text-text-primary placeholder:text-text-muted"
                />
                <p className="text-xs text-text-muted mt-1">
                  Minimum 8 characters
                </p>
              </div>

              <div>
                <label className="block text-sm text-text-muted mb-2">
                  Confirm Password *
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="py-6 bg-void border-white/10 text-text-primary placeholder:text-text-muted"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-white/20"
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 bg-gradient-rgb text-void font-bold py-6"
                  onClick={handleCreateAdmin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-void/30 border-t-void rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Create Admin
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Footer */}
          <p className="text-center text-text-muted text-xs mt-6">
            This setup page will be disabled once an admin is created.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
