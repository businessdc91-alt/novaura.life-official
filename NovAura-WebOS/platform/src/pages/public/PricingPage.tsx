import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Check, Zap, Star, Flame, Users, Sparkles, Crown, Coins, Loader2, AlertCircle, TrendingUp, Award, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CREDIT_PACKS } from '@/config/tierConfig';
import { auth } from '@/config/firebase';
import { onAuthStateChanged } from 'firebase/auth';

// ── Membership Tiers (from WebOS BillingWindow) ───────────────────────────────
const PLANS = [
  {
    id: 'free',
    name: 'Free',
    subtitle: 'The Beginning',
    price: 0,
    description: 'Start your journey',
    features: ['7 credits/day', '20 credits/month cap', 'Core WebOS access', 'Local AI (Ollama/LM Studio)', 'Community Support'],
    creditsPerDay: 7,
    creditsPerMonth: 20,
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
    creditsPerDay: 30,
    creditsPerMonth: 100,
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
    creditsPerDay: 100,
    creditsPerMonth: 250,
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
    creditsPerDay: 250,
    creditsPerMonth: 500,
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
    creditsPerDay: 500,
    creditsPerMonth: 750,
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
    creditsPerDay: 1000,
    creditsPerMonth: 5000,
    color: 'from-indigo-400 via-purple-500 to-pink-500',
    glow: 'rgba(99,102,241,0.5)',
    icon: Users,
  },
];

// ── RGB Animated Border ───────────────────────────────────────────────────────
const RGBCard: React.FC<{ children: React.ReactNode; plan: typeof PLANS[0]; isPopular?: boolean }> = ({ 
  children, 
  plan,
  isPopular 
}) => (
  <div className="relative group h-full">
    {/* Animated RGB border */}
    <div 
      className={`absolute -inset-[1px] rounded-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-500 ${isPopular ? 'opacity-100' : ''}`}
      style={{
        background: `linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3, #ff00ff, #ff0000)`,
        backgroundSize: '400% 400%',
        animation: 'rgbFlow 8s ease infinite',
        filter: 'blur(2px)',
      }}
    />
    
    {/* Inner glow based on tier color */}
    <div 
      className="absolute inset-[1px] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
      style={{
        boxShadow: `inset 0 0 30px ${plan.glow}`,
      }}
    />
    
    {/* Card content */}
    <div className="relative h-full rounded-2xl bg-[#0a0a0f]/95 backdrop-blur-sm border border-white/10 overflow-hidden">
      {/* Gradient header */}
      <div 
        className={`h-2 bg-gradient-to-r ${plan.color}`}
      />
      
      {/* Subtle gradient overlay */}
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${plan.glow.replace('0.4', '0.3')}, transparent)`,
        }}
      />
      
      {children}
    </div>
    
    <style>{`
      @keyframes rgbFlow {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
    `}</style>
  </div>
);

// ── Credit Pack Card ──────────────────────────────────────────────────────────
const CreditPackCard: React.FC<{ pack: typeof CREDIT_PACKS[0]; onSelect: () => void }> = ({ pack, onSelect }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="relative group"
  >
    <div 
      className="absolute -inset-[1px] rounded-xl opacity-40 group-hover:opacity-80 transition-opacity"
      style={{
        background: 'linear-gradient(90deg, #fbbf24, #f59e0b, #fbbf24)',
        backgroundSize: '200% 200%',
        animation: 'rgbFlow 4s ease infinite',
      }}
    />
    <div className="relative p-4 rounded-xl bg-[#0a0a0f] border border-amber-500/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <Coins className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold">{pack.credits}</div>
            <div className="text-xs text-white/50">credits</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-amber-400">${pack.price}</div>
          <Button 
            size="sm" 
            onClick={onSelect}
            className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs mt-1"
          >
            Buy
          </Button>
        </div>
      </div>
    </div>
  </motion.div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PricingPage() {
  const navigate = useNavigate();
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleSubscribe = async (planId: string, price: number) => {
    if (planId === 'free') {
      navigate('/signup', { state: { tier: planId } });
      return;
    }

    if (!user) {
      // Redirect to login/signup with plan pre-selected
      navigate('/signup', { state: { tier: planId, redirect: 'checkout' } });
      return;
    }

    setIsLoading(planId);
    setError(null);

    try {
      const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || '/api';
      
      const response = await fetch(`${API_BASE_URL}/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          items: [{
            asset: {
              id: `membership-${planId}`,
              title: `NovAura ${PLANS.find(p => p.id === planId)?.name} Membership`,
              shortDescription: `Monthly subscription to NovAura ${PLANS.find(p => p.id === planId)?.name}`,
              price: Math.round(price * 100), // Convert to cents
              type: 'subscription',
            },
          }],
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'Failed to start checkout. Please try again.');
      setIsLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white relative overflow-x-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none">
        <div 
          className="absolute w-[800px] h-[800px] rounded-full blur-[150px] opacity-20"
          style={{
            background: 'conic-gradient(from 0deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3, #ff00ff, #ff0000)',
            top: '-20%',
            left: '-10%',
            animation: 'spin 30s linear infinite',
          }}
        />
        <div 
          className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-15"
          style={{
            background: 'conic-gradient(from 180deg, #00ffff, #ff00ff, #ffff00, #00ffff)',
            bottom: '-20%',
            right: '-5%',
            animation: 'spin 25s linear infinite reverse',
          }}
        />
      </div>
      
      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{
              background: 'linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3, #ff00ff)',
              backgroundSize: '400% 400%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'rgbFlow 5s ease infinite',
            }}
          >
            Choose Your Path
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-white/60 max-w-2xl mx-auto"
          >
            1 credit = 1 API call. Local AI (Ollama/LM Studio) is always FREE.
          </motion.p>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400">{error}</span>
          </motion.div>
        )}

        {/* Credit Packs Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <div className="flex items-center gap-2 mb-4">
            <Coins className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold">Need More Credits?</h2>
            <span className="text-sm text-white/50">$5 per 10 credits</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {CREDIT_PACKS.map((pack) => (
              <CreditPackCard 
                key={pack.credits} 
                pack={pack} 
                onSelect={() => navigate('/checkout/credits', { state: { pack } })}
              />
            ))}
          </div>
        </motion.div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PLANS.map((plan, i) => {
            const Icon = plan.icon;
            const isPopular = plan.popular;
            const isLoadingThis = isLoading === plan.id;
            
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                onMouseEnter={() => setHoveredPlan(plan.id)}
                onMouseLeave={() => setHoveredPlan(null)}
                className="h-full"
              >
                <RGBCard plan={plan} isPopular={isPopular}>
                  <div className="p-6 h-full flex flex-col">
                    {/* Popular Badge */}
                    {isPopular && (
                      <div className="absolute top-4 right-4">
                        <span 
                          className="px-3 py-1 rounded-full text-xs font-bold text-black"
                          style={{
                            background: 'linear-gradient(90deg, #ff00ff, #00ffff, #ffff00)',
                            backgroundSize: '300% 300%',
                            animation: 'rgbFlow 3s ease infinite',
                          }}
                        >
                          BEST VALUE
                        </span>
                      </div>
                    )}
                    
                    {/* Icon & Name */}
                    <div className="flex items-center gap-3 mb-4">
                      <div 
                        className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${plan.color}`}
                        style={{
                          boxShadow: `0 0 20px ${plan.glow}`,
                        }}
                      >
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl">{plan.name}</h3>
                        <p className="text-xs text-white/50">{plan.subtitle}</p>
                      </div>
                    </div>
                    
                    {/* Price */}
                    <div className="mb-4">
                      <span className="text-4xl font-bold">${plan.price}</span>
                      {plan.price > 0 && <span className="text-white/50">/month</span>}
                    </div>
                    
                    <p className="text-sm text-white/60 mb-6">{plan.description}</p>
                    
                    {/* Credit Stats */}
                    <div className="grid grid-cols-2 gap-4 mb-6 p-4 rounded-lg bg-white/5">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-amber-400">{plan.creditsPerDay}</div>
                        <div className="text-xs text-white/50">per day</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{plan.creditsPerMonth}</div>
                        <div className="text-xs text-white/50">per month</div>
                      </div>
                    </div>
                    
                    {/* CTA */}
                    <Button
                      onClick={() => handleSubscribe(plan.id, plan.price)}
                      disabled={isLoadingThis}
                      className={`w-full mb-6 bg-gradient-to-r ${plan.color} text-white font-bold border-0`}
                      style={{
                        boxShadow: hoveredPlan === plan.id ? `0 0 25px ${plan.glow}` : 'none',
                        transition: 'box-shadow 0.3s ease',
                      }}
                    >
                      {isLoadingThis ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : plan.price === 0 ? (
                        'Start Free'
                      ) : (
                        'Subscribe'
                      )}
                    </Button>
                    
                    {/* Features */}
                    <div className="space-y-3 flex-1">
                      {plan.features.map((feature, fi) => (
                        <div key={fi} className="flex items-start gap-3">
                          <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-white/70">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </RGBCard>
              </motion.div>
            );
          })}
        </div>



        {/* Footer */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-16 text-center"
        >
          <p className="text-white/40 text-sm mb-2">
            <strong>Simple pricing:</strong> 1 credit = 1 API call
          </p>
          <p className="text-white/40 text-sm">
            Local AI (Ollama/LM Studio) = FREE. Bring your own API keys = FREE. Buy credits anytime: $5 per 10 credits.
          </p>
        </motion.div>
      </div>
      
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
