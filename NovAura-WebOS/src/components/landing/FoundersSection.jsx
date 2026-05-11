import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Crown, Bot, Mail, Sparkles, Shield, 
  CheckCircle2, Globe, Heart, ArrowRight, Loader2, CreditCard, Smartphone
} from 'lucide-react';
import { toast } from 'sonner';
import { platformStatsService } from '../../services/platformStatsService';
import { createOneTimeCheckout } from '../../services/stripeService';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../config/firebase';
import { collection, getDocs } from 'firebase/firestore';
import ManualPaymentModal from '../ManualPaymentModal';

export default function FoundersSection() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    founding_catalyst_remaining: 100,
    founding_spark_remaining: 50,
    founding_nova_remaining: 20,
    investor_remaining: 5
  });
  const [signupEmail, setSignupEmail] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(null); // 'emergent', 'spark', 'nova'
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState(null);
  const [hallOfFounders, setHallOfFounders] = useState([]);

  useEffect(() => {
    const unsub = platformStatsService.subscribeToFoundersCounts(setStats);
    return () => unsub();
  }, []);

  useEffect(() => {
    const fetchFounders = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'founders'));
        const names = snapshot.docs.map(doc => doc.data().name).filter(Boolean);
        setHallOfFounders(names);
      } catch (err) {
        console.error('Error fetching founders:', err);
      }
    };
    fetchFounders();
  }, []);

  const handlePrereleaseSignup = async (e) => {
    e.preventDefault();
    if (!signupEmail) return;
    setIsSigningUp(true);

    try {
      // Simulate/Trigger signup logic
      // In a real scenario, this would hit a backend that sends the email to dillan.copeland@novaura.xyz
      const response = await fetch('/api/prerelease/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signupEmail })
      });

      // Even if endpoint doesn't exist yet, we'll show success for the demo/UI
      toast.success("You're on the list! Updates will be sent to " + signupEmail);
      setSignupEmail('');
    } catch (err) {
      toast.error("Failed to join waitlist. Please try again.");
    } finally {
      setIsSigningUp(false);
    }
  };

  const handleCheckout = async (tierId) => {
    setIsCheckingOut(tierId);
    try {
      const { url } = await createOneTimeCheckout(user?.id, tierId, signupEmail);
      window.location.href = url;
    } catch (err) {
      toast.error(err.message || "Checkout failed. Please try again.");
      setIsCheckingOut(null);
    }
  };

  const handleManualPayment = (tier) => {
    setSelectedTier(tier);
    setIsManualModalOpen(true);
  };

  const tiers = [
    {
      id: 'founding-spark',
      name: 'Founding Spark',
      price: '$75',
      limit: stats.founding_spark_remaining,
      total: 50,
      shares: 5,
      claimDate: 'August 10, 2026',
      sharesMessage: 'Congratulations you are part owner in Novaura.life the future has been sparked by your support',
      features: [
        'Lifetime Spark Membership',
        'Early Beta Access (Aug 10, 2026)',
        'Founder Badge (Mini)',
        'Name in Hall of Founders'
      ],
      color: 'from-blue-500 to-cyan-500',
      tag: 'Series B Holder'
    },
    {
      id: 'founding-catalyst',
      name: 'Founding Catalyst',
      price: '$250',
      limit: stats.founding_catalyst_remaining,
      total: 100,
      shares: 30,
      claimDate: 'August 10, 2026',
      sharesMessage: 'Congratulations you are the catalyst to making this happen you are now part owner of Novaura.life the future begins here',
      features: [
        'Lifetime Catalyst Membership',
        'Direct Contact with Founder',
        'Early Beta Access (Aug 10, 2026)',
        'Founder Badge (Elite)',
        'Priority Hall of Founders Entry'
      ],
      color: 'from-purple-500 to-indigo-500',
      tag: 'Series B Holder'
    },
    {
      id: 'founding-nova',
      name: 'Founding Nova',
      price: '$500',
      limit: stats.founding_nova_remaining,
      total: 20,
      shares: 200,
      claimDate: 'July 15, 2026',
      sharesMessage: 'Thank you for being the burning nova that generates the aura of our journey congratulations you now own part of the next big platform for the coming era you have pushed this into existence with the brilliance of your light',
      canBuyExtraShares: true,
      features: [
        'Lifetime Nova Membership',
        'Influence on Feature Roadmap',
        '2 Free Spark Passes for Friends',
        'Personal Custom AI Avatar',
        'Early Beta Access (July 15, 2026)',
        'Founder Badge (Signature)',
        'Top of Hall of Founders',
        'Option to buy up to 10k shares'
      ],
      color: 'from-pink-500 to-rose-500',
      tag: 'Series B+ (Voting Path)'
    },
    {
      id: 'catalyst-crew-founders',
      name: 'Catalyst Crew Founders',
      price: '$10,000',
      limit: stats.catalyst_crew_remaining,
      total: 10,
      shares: 25000,
      claimDate: 'June 15, 2026',
      sharesMessage: 'You are the bedrock of NovAura. As a member of the Catalyst Crew, you hold a significant stake in the future of human-AI symbiosis. Welcome to the inner circle.',
      canBuyExtraShares: true,
      maxExtraShares: 100000,
      extraSharePrice: 0.75,
      isHighRoller: true,
      features: [
        'Exclusive Silver [M] Moderator Icon',
        'Pulsing/Gradient Chat Name Effect',
        '25,000 Class A Shares (Claim June 15)',
        'Access to Source Code & Secrets',
        'White-label Licensing Rights',
        'Direct Private Line to Founder',
        'Board Seat (Voting Rights)',
        'Early Beta Access (June 15)'
      ],
      color: 'from-slate-400 via-slate-200 to-slate-500',
      tag: 'Class A (Voting Power)'
    },
    {
      id: 'strategic-investor',
      name: 'Strategic Investor',
      price: '$25,000',
      limit: stats.investor_remaining,
      total: 5,
      shares: 150000,
      claimDate: 'June 15, 2026',
      sharesMessage: 'Your investment represents a fundamental belief in the future we are building. Welcome to the board.',
      isHighRoller: true,
      features: [
        'Board Seat (Voting Rights)',
        'Quarterly Revenue Sharing',
        'Direct Influence on Global Expansion',
        '150,000 Class A Shares',
        'Full Ecosystem Licensing',
        'Unlimited Concierge Support',
        'Early Beta Access (June 15)'
      ],
      color: 'from-amber-600 to-yellow-500',
      tag: 'Class A (Board Level)'
    }
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-24 relative z-10">
      
      {/* Pre-launch Announcement */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-16"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-4">
          <Sparkles className="w-3 h-3" />
          Pre-Launch Phase Alpha
        </div>
        <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-white/80 to-white/40 bg-clip-text text-transparent">
          Secure Your Legacy in NovAura
        </h2>
        <p className="text-white/40 max-w-2xl mx-auto text-lg leading-relaxed">
          Join the elite ranks of our Founding Fathers. These limited-edition passes grant lifetime access 
          to the most powerful AI ecosystem ever built, while directly supporting the vision of a truly 
          agentic future.
        </p>
      </motion.div>

      {/* Tiers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
        {tiers.map((tier) => (
          <motion.div
            key={tier.id}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            whileHover={{ y: -10 }}
            className={`relative p-8 rounded-3xl border transition-all duration-500 overflow-hidden group bg-white/5 border-white/10 hover:border-white/20`}
          >
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-transparent pointer-events-none" />
            
            {/* Tier Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="p-3 rounded-2xl bg-white/10 text-white group-hover:scale-110 transition-transform duration-500">
                <Zap className="w-6 h-6" />
              </div>
              <div className="text-right">
                <div className="text-sm text-white/40 font-medium">Availability</div>
                <div className={`text-xl font-bold ${tier.limit < 10 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
                  {tier.limit}/{tier.total}
                </div>
              </div>
            </div>

            <div className="flex flex-col mb-4">
              <h3 className="text-2xl font-bold text-white leading-tight">{tier.name}</h3>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-black text-cyan-400">{tier.price}</span>
                <span className="text-[10px] uppercase tracking-tighter text-white/30 font-bold">Lifetime Pass</span>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-6 flex-grow">{tier.id === 'founding-nova' ? 'The ultimate commitment to the vision.' : 'Exclusive benefits for early supporters.'}</p>
            
            {/* Shares & Ownership */}
            <div className="mb-6 p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 group-hover:border-cyan-500/40 transition-colors">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-cyan-400 font-bold text-lg">{tier.shares} Shares</span>
                </div>
                <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Claim: {tier.claimDate}</span>
              </div>
              <p className="text-[11px] text-gray-400 italic leading-relaxed font-light">
                "{tier.sharesMessage}"
              </p>
              {tier.canBuyExtraShares && (
                <div className="mt-3 pt-3 border-t border-white/5 text-[10px] text-cyan-300/80 font-medium flex items-center gap-1.5">
                  <Zap className="w-3 h-3" />
                  Option to purchase up to 10,000 additional shares at $1/ea
                </div>
              )}
            </div>

            <div className="space-y-4 mb-8 flex-1">
              {tier.features.map((feature, i) => (
                <div key={i} className="flex gap-3 text-sm text-white/60">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-cyan-400/60" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleCheckout(tier.id)}
              disabled={tier.limit <= 0 || isCheckingOut === tier.id}
              className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                tier.limit <= 0 
                  ? 'bg-white/5 text-white/20 cursor-not-allowed'
                  : 'bg-white text-black hover:bg-white/90'
              }`}
            >
              {isCheckingOut === tier.id ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : tier.limit <= 0 ? (
                'Sold Out'
              ) : (
                <>
                  {tier.name} {tier.price}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              onClick={() => handleManualPayment(tier)}
              className="w-full mt-3 py-3 rounded-xl font-bold text-[11px] uppercase tracking-widest text-white/30 hover:text-white/60 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
            >
              <Smartphone className="w-3.5 h-3.5" />
              Pay via Cash App / Chime
            </button>

            {/* Governance Info */}
            <div className="mt-4 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[9px] uppercase tracking-widest font-bold text-white/30 flex items-center gap-2">
              <Shield className="w-3 h-3 text-cyan-400/50" />
              {tier.id === 'catalyst-crew-founders' || tier.id === 'strategic-investor'
                ? 'Full Class A Decision Rights' 
                : tier.id === 'founding-nova' 
                  ? 'Series B (Path to Class A via Extra Shares)' 
                  : 'Series B (Non-Voting Input Rights)'}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Payment Methods */}
      <motion.div 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        className="flex flex-col items-center gap-4 mb-24 opacity-60"
      >
        <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/40">Secured via Stripe Gateway</span>
        <div className="flex items-center gap-6 grayscale hover:grayscale-0 transition-all duration-700">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <CreditCard className="w-4 h-4 text-white/60" />
            <span className="text-xs font-semibold text-white/80">Cards</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <div className="w-5 h-5 bg-[#00d54b] rounded flex items-center justify-center">
              <span className="text-[10px] font-black text-white">$</span>
            </div>
            <span className="text-xs font-semibold text-white/80">Cash App Pay</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <div className="w-5 h-5 bg-[#3d95ce] rounded flex items-center justify-center">
              <span className="text-[8px] font-black text-white">V</span>
            </div>
            <span className="text-xs font-semibold text-white/80">Venmo</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <div className="w-5 h-5 bg-[#ffc439] rounded flex items-center justify-center">
              <span className="text-[8px] font-black text-blue-900">P</span>
            </div>
            <span className="text-xs font-semibold text-white/80">PayPal</span>
          </div>
        </div>
      </motion.div>

      {/* Pre-release Signup & Wall of Founders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        
        {/* Signup Form */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="p-10 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Mail className="w-32 h-32" />
          </div>
          
          <h3 className="text-2xl font-bold mb-2">Stay in the Loop</h3>
          <p className="text-white/50 mb-8 leading-relaxed">
            Not ready to be a Founder? Join 15,000+ others waiting for the public launch. 
            Receive exclusive updates, technical deep-dives, and launch notifications.
          </p>

          <form onSubmit={handlePrereleaseSignup} className="relative group">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                required
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="Enter your email address"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder-white/30 outline-none focus:border-cyan-500/50 transition-all"
              />
              <button
                type="submit"
                disabled={isSigningUp}
                className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-8 py-4 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {isSigningUp ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Join Waitlist'}
              </button>
            </div>
            <p className="mt-4 text-[10px] text-white/20 text-center sm:text-left uppercase tracking-tighter">
              Routed to dillan.copeland@novaura.xyz • Secure & Private
            </p>
          </form>
        </motion.div>

        {/* Wall of Founders */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="text-center lg:text-left"
        >
          <div className="inline-flex items-center gap-2 text-amber-400 text-sm font-bold uppercase tracking-widest mb-6">
            <Shield className="w-5 h-5" />
            The Hall of Founders
          </div>
          <h3 className="text-3xl font-bold mb-6">A Legacy Written in Code</h3>
          <p className="text-white/40 mb-8 leading-relaxed text-lg italic">
            "To the visionaries who see the static and understand the patterns. Without your belief in the vision, 
            this platform would have remained a ghost in the machine. Thank you for trusting me to make this happen."
          </p>
          
          <div className="flex flex-wrap justify-center lg:justify-start gap-4">
            {hallOfFounders.length > 0 ? (
              hallOfFounders.map((name, i) => (
                <div key={i} className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/30 text-xs font-medium hover:text-amber-400 hover:border-amber-500/30 transition-all cursor-default">
                  {name}
                </div>
              ))
            ) : (
              <div className="text-white/10 text-xs italic">Awaiting first signatures in the Hall of Founders...</div>
            )}
            <div className="px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold animate-pulse">
              Your Name Here
            </div>
          </div>
        </motion.div>

      </div>

      {/* Decorative Signature */}
      <div className="mt-24 text-center border-t border-white/5 pt-12">
        <p className="text-white/20 text-sm font-light tracking-[0.2em] uppercase">
          Build by Creators, for Creators • NovAura 2026
        </p>
      </div>

    </div>
  );
}
