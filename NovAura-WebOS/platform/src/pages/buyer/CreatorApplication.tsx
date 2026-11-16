import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Shield, Briefcase, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { db } from '@/config/firebase';
import { collection, addDoc } from 'firebase/firestore';

export default function CreatorApplication() {
  const { user, updateProfile } = useAuthStore();
  const { addToast } = useUIStore();
  const navigate = useNavigate();

  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [experience, setExperience] = useState('');
  const [pitch, setPitch] = useState('');
  const [trainingConsent, setTrainingConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (user?.role === 'creator' || user?.role === 'admin') {
    return <Navigate to="/creator/dashboard" />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);

    try {
      // Instant Upgrade
      await updateProfile({ 
        role: 'creator',
        creatorBio: pitch || undefined,
        portfolioUrl: portfolioUrl || undefined,
        toolset: experience || undefined,
        updatedAt: new Date().toISOString()
      });

      // Optional: Still log to creator_applications but mark as 'approved'
      if (db) {
        await addDoc(collection(db, 'creator_applications'), {
          userId: user.id,
          email: user.email,
          username: user.username,
          portfolioUrl,
          experience,
          pitch,
          status: 'approved',
          createdAt: new Date().toISOString()
        });
      }

      setSubmitted(true);
      addToast({ type: 'success', title: 'Welcome Creator!', message: 'Your account has been upgraded. You can now access the Creator Dashboard.' });
    } catch (error) {
      addToast({ type: 'error', title: 'Registration Failed', message: 'Failed to upgrade account. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-2xl mx-auto text-center px-4">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-24 h-24 bg-neon-lime/20 rounded-full flex items-center justify-center mb-6">
          <Zap className="w-12 h-12 text-neon-lime" />
        </motion.div>
        <h1 className="text-3xl font-bold font-heading mb-4 text-text-primary">Welcome to the Creator Program</h1>
        <p className="text-text-secondary text-lg mb-8">
          Your account is now ready. You can start uploading assets, managing your storefront, and building the NovAura ecosystem.
        </p>
        <Button onClick={() => navigate('/creator/dashboard')} className="bg-gradient-rgb text-void font-bold px-8 py-6 text-lg">
          Go to Creator Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold font-heading text-text-primary mb-4">Become a Creator</h1>
        <p className="text-xl text-text-secondary">Join the next generation of builders and monetize your assets with a strictly enforced 10% platform fee.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-12">
        <div>
          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-neon-lime/10 flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6 text-neon-lime" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary">Fair Stake Revenue</h3>
                <p className="text-text-secondary text-sm mt-1">Keep 90% of your earnings. We enforce a strict 10% platform fee on all sales. Compare that to Unity or Unreal.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-neon-cyan/10 flex items-center justify-center flex-shrink-0">
                <Zap className="w-6 h-6 text-neon-cyan" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary">Direct Stripe Payouts</h3>
                <p className="text-text-secondary text-sm mt-1">Connect your debit card and get paid immediately upon transaction completion via Stripe Connect Express.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-neon-violet/10 flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-6 h-6 text-neon-violet" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary">Total Control</h3>
                <p className="text-text-secondary text-sm mt-1">Free, Pay-What-You-Want, or strict Fixed pricing. You control your storefront, your licensing, and your audience.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-void-light border border-white/5 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-lime via-neon-cyan to-neon-violet" />
          <h2 className="text-2xl font-bold font-heading mb-6">Creator Registration</h2>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-text-secondary mb-2 uppercase tracking-wide">Portfolio or Main Site URL (Optional)</label>
              <Input 
                type="url" 
                value={portfolioUrl} 
                onChange={(e) => setPortfolioUrl(e.target.value)} 
                placeholder="https://your-itch-io.com" 
                className="bg-void"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-text-secondary mb-2 uppercase tracking-wide">Primary Engine / Toolset (Optional)</label>
              <Input 
                value={experience} 
                onChange={(e) => setExperience(e.target.value)} 
                placeholder="e.g. Godot 4.x, Blender, FL Studio" 
                className="bg-void"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-text-secondary mb-2 uppercase tracking-wide">What are you planning to sell? (Optional)</label>
              <Textarea 
                value={pitch} 
                onChange={(e) => setPitch(e.target.value)} 
                placeholder="Tell us about the assets, software, or games you want to distribute on NovAura..." 
                className="bg-void resize-none"
                rows={4}
              />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full bg-gradient-rgb text-void font-bold mt-4 h-12 text-lg">
              {isSubmitting ? 'Registering...' : 'Join Creator Program'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
