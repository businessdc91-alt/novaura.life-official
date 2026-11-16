import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Chrome, ArrowRight, Sparkles, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';


export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithGoogle, isLoading, error, clearError } = useAuthStore();
  const { addToast } = useUIStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    // Auth is handled by Firebase
    clearError();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    
    try {
      await login(email, password);
      const currentUser = useAuthStore.getState().user;
      if (currentUser && !currentUser.emailVerified) {
        addToast({
          type: 'warning',
          title: 'Email not verified',
          message: 'Please check your inbox and verify your email to unlock all features.',
        });
      } else {
        addToast({
          type: 'success',
          title: 'Welcome back!',
          message: 'You have successfully logged in.',
        });
      }
      navigate('/');
    } catch (err) {
      // Error handled in store
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      addToast({
        type: 'success',
        title: 'Welcome!',
        message: 'You have successfully logged in with Google.',
      });
      navigate('/');
    } catch (err) {
      // Error handled in store
    }
  };

  // If no admin exists, show setup prompt
  if (needsSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div 
            className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(0, 240, 255, 0.1) 0%, transparent 70%)',
              filter: 'blur(60px)',
            }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-gradient-rgb flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-void" />
            </div>
            <h1 className="font-heading text-3xl font-bold text-text-primary mb-2">
              Platform Setup Required
            </h1>
            <p className="text-text-secondary">
              NovAura Market needs an owner account. Set up your admin account to get started.
            </p>
          </div>

          <div className="bg-void-light border border-white/5 rounded-2xl p-8 text-center">
            <p className="text-text-secondary mb-6">
              This is a one-time setup. Once complete, this page will no longer be accessible.
            </p>
            <Button
              className="w-full bg-gradient-rgb text-void font-bold py-6"
              onClick={() => navigate('/admin-setup')}
            >
              Create Owner Account
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0, 240, 255, 0.1) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        <div 
          className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="w-8 h-8 text-neon-cyan" />
            <span className="font-heading text-2xl font-bold text-gradient-rgb">
              NovAura
            </span>
          </Link>
          <h1 className="font-heading text-3xl font-bold text-text-primary mb-2">
            Welcome Back
          </h1>
          <p className="text-text-secondary">
            Sign in to access your account
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-void-light border border-white/5 rounded-2xl p-8">
          {/* Google Login */}
          <Button
            variant="outline"
            className="w-full border-white/20 text-text-primary hover:bg-white/5 mb-4"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            <Chrome className="w-5 h-5 mr-2" />
            Continue with Google
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-void-light text-text-muted">Or continue with email</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-text-muted mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-12 py-6 bg-void border-white/10 text-text-primary placeholder:text-text-muted"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-text-muted mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-12 pr-12 py-6 bg-void border-white/10 text-text-primary placeholder:text-text-muted"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="custom-checkbox" />
                <span className="text-sm text-text-secondary">Remember me</span>
              </label>
              <Link to="/help" className="text-sm text-neon-cyan hover:text-neon-cyan/80">
                Forgot password?
              </Link>
            </div>

            {error && (
              <div className="p-3 bg-neon-red/10 border border-neon-red/30 rounded-lg text-neon-red text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-rgb text-void font-bold py-6 hover:opacity-90"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-void/30 border-t-void rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Sign Up Link */}
        <p className="text-center mt-6 text-text-secondary">
          Don't have an account?{' '}
          <Link to="/signup" className="text-neon-cyan hover:text-neon-cyan/80 font-medium">
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
