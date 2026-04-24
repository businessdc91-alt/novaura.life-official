import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, Zap, Star, Flame, Users, Sparkles, Crown, Coins, 
  Loader2, AlertCircle, TrendingUp, Award, ArrowRight, X
} from 'lucide-react';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { createSubscriptionCheckout, getSubscriptionStatus } from '../services/stripeService';

// Synchronized Plans - Source of Truth alignment
const PLANS = [
  {
    id: 'free',
    name: 'Free',
    subtitle: 'The Beginning',
    price: 0,
    description: 'Start your journey',
    features: ['7 credits/day', '20 credits/month cap', 'Core WebOS access', 'Local AI (Ollama/LM Studio)', 'Community Support'],
    color: 'from-gray-400 to-gray-600',
    glow: 'rgba(156,163,175,0.3)',
    icon: Zap,
  },
  {
    id: 'spark',
    name: 'Spark',
    subtitle: 'Wonder Into',
    price: 9.99,
    description: 'Ignite your curiosity',
    features: ['30 credits/day', '100 credits/month cap', 'BYOK Support', 'WebOS access (limited)', 'Standard Support'],
    color: 'from-cyan-400 to-blue-500',
    glow: 'rgba(34,211,238,0.4)',
    icon: Sparkles,
  },
  {
    id: 'emergent',
    name: 'Emergent',
    subtitle: 'Discovering',
    price: 17.99,
    description: 'Find your flow',
    features: ['100 credits/day', '250 credits/month cap', 'Full WebOS access', 'BYOK Support', 'Standard Support'],
    color: 'from-fuchsia-400 to-purple-600',
    glow: 'rgba(232,121,249,0.4)',
    icon: Star,
  },
  {
    id: 'catalyst',
    name: 'Catalyst',
    subtitle: 'Biggest Bang for Your Buck',
    price: 29.99,
    description: 'Accelerate everything',
    features: ['250 credits/day', '500 credits/month cap', '1 Exhaustive Research/mo', 'Priority Inference', 'Live Support'],
    color: 'from-amber-400 via-orange-400 to-pink-500',
    glow: 'rgba(251,191,36,0.5)',
    icon: Flame,
    popular: true,
  },
  {
    id: 'nova',
    name: 'Nova',
    subtitle: 'Ultimate',
    price: 75.00,
    description: 'Maximum power',
    features: ['500 credits/day', '750 credits/month cap', '2 Exhaustive Research/mo', 'Advanced Analytics', 'Secrets Manager'],
    color: 'from-rose-400 via-pink-500 to-violet-600',
    glow: 'rgba(244,63,94,0.5)',
    icon: Crown,
  },
  {
    id: 'catalytic-crew',
    name: 'Catalytic Crew',
    subtitle: 'Enterprise',
    price: 349.99,
    description: 'For teams and organizations',
    features: ['1000 credits/day', '5000 credits/month cap', '5 Exhaustive Research/mo', 'SSO & SAML ready', 'Dedicated Support'],
    color: 'from-indigo-400 via-purple-500 to-pink-500',
    glow: 'rgba(99,102,241,0.5)',
    icon: Users,
  },
];

const RGBCard = ({ children, plan, isPopular }) => (
  <div className="relative group h-full">
    <div 
      className={`absolute -inset-[1px] rounded-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-500 ${isPopular ? 'opacity-100' : ''}`}
      style={{
        background: `linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3, #ff00ff, #ff0000)`,
        backgroundSize: '400% 400%',
        animation: 'rgbFlow 8s ease infinite',
        filter: 'blur(2px)',
      }}
    />
    <div 
      className="absolute inset-[1px] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
      style={{ boxShadow: `inset 0 0 30px ${plan.glow}` }}
    />
    <div className="relative h-full rounded-2xl bg-[#0a0a0f]/95 backdrop-blur-md border border-white/10 overflow-hidden flex flex-col">
      <div className={`h-1.5 bg-gradient-to-r ${plan.color}`} />
      {children}
    </div>
  </div>
);

export default function PricingPage({ onOpenWindow }) {
  const [user, setUser] = useState(null);
  const [currentPlan, setCurrentPlan] = useState('free');
  const [isLoading, setIsLoading] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const status = await getSubscriptionStatus(currentUser.uid);
          setCurrentPlan(status.tier || 'free');
        } catch (err) {
          console.error('Failed to load status:', err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSubscribe = async (planId, price) => {
    if (planId === 'free') return;
    if (!user) {
      setError('Please sign in to subscribe');
      return;
    }

    setIsLoading(planId);
    setError(null);

    try {
      const { url } = await createSubscriptionCheckout(user.uid, planId);
      window.location.href = url;
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err.message || 'Failed to start checkout');
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="min-h-full bg-[#050508] text-white p-8 overflow-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto py-12">
        <div className="text-center mb-16">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent"
          >
            Membership Ecosystem
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-white/40 text-lg max-w-2xl mx-auto"
          >
            Scalable power for creators, investors, and founders. 
            All tiers include core WebOS access and standard AI features.
          </motion.p>
        </div>

        {error && (
          <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 font-medium">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan, i) => {
            const Icon = plan.icon;
            const isCurrent = currentPlan === plan.id;
            const isLoadingThis = isLoading === plan.id;
            
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <RGBCard plan={plan} isPopular={plan.popular}>
                  <div className="p-6 flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${plan.color} shadow-lg shadow-black/20`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg leading-tight">{plan.name}</h3>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest">{plan.subtitle}</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <span className="text-3xl font-bold">${plan.price}</span>
                      {plan.price > 0 && <span className="text-white/30 text-sm">/mo</span>}
                    </div>

                    <p className="text-xs text-white/50 mb-6 min-h-[32px]">{plan.description}</p>

                    <div className="space-y-3 mb-8 flex-1">
                      {plan.features.map((feature, fi) => (
                        <div key={fi} className="flex items-start gap-2.5">
                          <Check className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                          <span className="text-xs text-white/70 leading-normal">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => handleSubscribe(plan.id, plan.price)}
                      disabled={isCurrent || isLoadingThis}
                      className={`w-full py-3 rounded-xl font-bold text-xs transition-all ${
                        isCurrent 
                          ? 'bg-white/5 text-white/30 cursor-default'
                          : plan.popular
                          ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-black hover:scale-[1.02] active:scale-95'
                          : 'bg-white/10 hover:bg-white/20 text-white active:scale-95'
                      }`}
                    >
                      {isLoadingThis ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : isCurrent ? (
                        'Current Active Plan'
                      ) : (
                        'Select Tier'
                      )}
                    </button>
                  </div>
                </RGBCard>
              </motion.div>
            );
          })}
        </div>

        {/* Investor & Governance Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 p-10 rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-cyan-500/10 border border-white/10 backdrop-blur-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
            <TrendingUp className="w-64 h-64" />
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
            <div className="w-20 h-20 rounded-2xl bg-cyan-500/20 flex items-center justify-center shrink-0">
              <TrendingUp className="w-10 h-10 text-cyan-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">Investor Governance</h2>
              <p className="text-white/50 max-w-2xl">
                Tiers from "Investor" and above include voting power on the NovAura roadmap and access to the private equity portal. 
                Help us architect the next generation of spatial computing.
              </p>
            </div>
            <button 
              onClick={() => {
                if (onOpenWindow) {
                  onOpenWindow('founding-father-chat', 'Founding Fathers Lounge');
                } else {
                  window.location.href = '/os/?app=founding-father-chat';
                }
              }}
              className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-2xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              Investor Portal
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </div>

      <style>{`
        @keyframes rgbFlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
