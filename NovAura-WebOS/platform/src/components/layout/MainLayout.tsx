import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from './Navbar';
import Footer from './Footer';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Home, Mail, AlertTriangle } from 'lucide-react';
import { AuroraBackground } from '../ui/AuroraBackground';
import { AuraGuide } from '../ui/AuraGuide';
import { useAuthStore } from '@/stores/authStore';
import { useState } from 'react';

interface MainLayoutProps {
  hideNav?: boolean;
}

function EmailVerificationBanner() {
  const { user, resendVerification } = useAuthStore();
  const [resent, setResent] = useState(false);
  const [sending, setSending] = useState(false);

  if (!user || user.emailVerified) return null;

  const handleResend = async () => {
    setSending(true);
    try {
      await resendVerification();
      setResent(true);
    } catch (err) {
      console.error('Failed to resend verification:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-full bg-amber-500/10 border-b border-amber-500/20 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-amber-200">
            Please verify your email address to unlock full platform access.
          </p>
        </div>
        <button
          onClick={handleResend}
          disabled={resent || sending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-50"
        >
          <Mail className="w-3.5 h-3.5" />
          {resent ? 'Sent!' : sending ? 'Sending...' : 'Resend Email'}
        </button>
      </div>
    </div>
  );
}

export default function MainLayout({ hideNav = false }: MainLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-void text-text-primary">
      {/* Background effects */}
      <AuroraBackground />
      
      <div className="fixed inset-0 pointer-events-none">
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 240, 255, 0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 240, 255, 0.02) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {!hideNav && <Navbar />}
        {!hideNav && <EmailVerificationBanner />}
        
        {!hideNav && location.pathname !== '/' && (
          <div className="w-full px-4 sm:px-6 lg:px-8 pt-24 pb-4">
            <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest">
              <button 
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 text-text-muted hover:text-neon-cyan transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Previous
              </button>
              <div className="w-px h-3 bg-white/10" />
              <Link 
                to="/"
                className="flex items-center gap-1.5 text-text-muted hover:text-neon-magenta transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                Home
              </Link>
            </div>
          </div>
        )}
        
        <motion.main 
          className={`flex-grow ${!hideNav && location.pathname !== '/' ? 'pt-0' : 'pt-24'}`}
          style={{ paddingTop: !hideNav && location.pathname !== '/' ? 0 : undefined }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <ErrorBoundary section="Main Layout">
            <Outlet />
          </ErrorBoundary>
        </motion.main>
        
        {!hideNav && <Footer />}
        <AuraGuide />
      </div>

    </div>
  );
}
