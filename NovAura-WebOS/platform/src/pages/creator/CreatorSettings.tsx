import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Twitter, Github, Globe, DollarSign, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { connectStripeAccount } from '@/services/marketService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function CreatorSettings() {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [isConnecting, setIsConnecting] = useState(false);

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold text-text-primary mb-8">
        Creator Settings
      </h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-void-light border border-white/5 mb-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="social">Social Links</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-0">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-void-light border border-white/5 rounded-xl p-6"
          >
            <h2 className="font-heading text-xl font-bold text-text-primary mb-6">
              Creator Profile
            </h2>

            <div className="flex items-center gap-6 mb-8">
              <img 
                src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`}
                alt={user?.username}
                className="w-24 h-24 rounded-xl"
              />
              <div>
                <Button variant="outline" className="border-white/20 mb-2">
                  Change Avatar
                </Button>
                <p className="text-text-muted text-sm">
                  This will be displayed on your creator page
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-muted mb-2">Display Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <Input 
                    defaultValue={user?.username}
                    className="pl-12 py-6 bg-void border-white/10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-muted mb-2">Bio</label>
                <textarea 
                  rows={4}
                  defaultValue={user?.bio}
                  className="w-full px-4 py-3 bg-void border border-white/10 rounded-lg text-text-primary resize-none focus:outline-none focus:border-neon-cyan"
                  placeholder="Tell buyers about yourself and your work..."
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button className="bg-gradient-rgb text-void font-bold">
                Save Changes
              </Button>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="payouts" className="mt-0">
          <div className="bg-void-light border border-white/5 rounded-xl p-6">
            <h2 className="font-heading text-xl font-bold text-text-primary mb-6">
              Payout Settings
            </h2>

            {user?.stripeConnectStatus === 'active' ? (
              <div className="p-8 border-2 border-neon-lime/30 bg-neon-lime/5 rounded-xl flex items-center gap-6 mb-6">
                <div className="w-12 h-12 rounded-full bg-neon-lime/20 flex items-center justify-center">
                  <Check className="w-6 h-6 text-neon-lime" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-neon-lime mb-1">Stripe Connected</h3>
                  <p className="text-text-secondary text-sm">Your payouts are fully active and mapped directly to your bank account.</p>
                </div>
                <div className="ml-auto">
                  <Button variant="outline" className="border-white/20">
                    Dashboard
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-8 border-2 border-dashed border-white/10 rounded-xl text-center mb-6">
                <DollarSign className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <p className="text-text-secondary mb-2">Stripe Connect Required</p>
                <p className="text-text-muted text-sm mb-4">
                  Connect your debit card or bank account to instantly receive 90% of your sales.
                </p>
                <Button 
                  disabled={isConnecting}
                  onClick={async () => {
                    if (!user) return;
                    setIsConnecting(true);
                    try {
                      const url = await connectStripeAccount(user.id);
                      window.location.href = url; // Redirect to Stripe Onboarding
                    } catch (error) {
                      addToast({ type: 'error', title: 'Connection Failed', message: 'Could not reach the secure payment gateway. Check your internet or contact support.' });
                      setIsConnecting(false);
                    }
                  }}
                  className="bg-gradient-rgb text-void font-bold"
                >
                  {isConnecting ? 'Connecting...' : 'Connect Stripe'}
                </Button>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="font-medium text-text-primary">Platform Payout Structure</h3>
              <div className="p-4 bg-void rounded-lg border border-white/5">
                <ul className="text-text-secondary text-sm space-y-2">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-neon-cyan" /> You keep exactly <b>90%</b> of every sale.</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-neon-cyan" /> The platform fee is locked at <b>10%</b> and splits automatically.</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-neon-cyan" /> Funds arrive directly to your connected Stripe account instantly per transaction.</li>
                </ul>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="social" className="mt-0">
          <div className="bg-void-light border border-white/5 rounded-xl p-6">
            <h2 className="font-heading text-xl font-bold text-text-primary mb-6">
              Social Links
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-muted mb-2">Website</label>
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <Input 
                    defaultValue={user?.website}
                    placeholder="https://yourwebsite.com"
                    className="pl-12 py-6 bg-void border-white/10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-muted mb-2">Twitter</label>
                <div className="relative">
                  <Twitter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <Input 
                    defaultValue={user?.twitter}
                    placeholder="@username"
                    className="pl-12 py-6 bg-void border-white/10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-muted mb-2">GitHub</label>
                <div className="relative">
                  <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <Input 
                    defaultValue={user?.github}
                    placeholder="username"
                    className="pl-12 py-6 bg-void border-white/10"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button className="bg-gradient-rgb text-void font-bold">
                Save Changes
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
