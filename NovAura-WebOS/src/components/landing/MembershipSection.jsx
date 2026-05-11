import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, Star, Flame, Users, Sparkles, Crown, ArrowRight, TrendingUp, Award, Loader2 } from 'lucide-react';
import { createSubscriptionCheckout } from '../../services/stripeService';

const PLANS = [
  {
    id: 'free',
    name: 'Free (Community)',
    price: 0,
    features: ['7 builder calls/day', '20 credits/month cap', 'Core WebOS access', 'Community Support'],
    color: 'from-gray-400 to-gray-600',
    icon: Zap,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 5.00,
    features: ['Managed AI Navigation', 'Zero-Cost Flagship Models', '30 builder calls/day', 'Standard AI Support'],
    color: 'from-blue-400 to-cyan-500',
    icon: Sparkles,
  },
  {
    id: 'spark',
    name: 'Spark',
    price: 9.99,
    features: ['Everything in Starter', '100 credits/month cap', 'Full WebOS access', 'Priority Support'],
    color: 'from-cyan-400 to-blue-500',
    icon: Sparkles,
  },
  {
    id: 'emergent',
    name: 'Emergent',
    price: 17.99,
    features: ['100 builder calls/day', 'Unlimited projects', 'Advanced Search', 'Priority Support'],
    color: 'from-fuchsia-400 to-purple-600',
    icon: Star,
  },
  {
    id: 'catalyst',
    name: 'Catalyst',
    price: 29.99,
    features: ['Unlimited Local & BYOK Access', 'Full Agent Swarm', 'Advanced Orchestration', 'Priority Inference'],
    color: 'from-amber-400 via-orange-400 to-pink-500',
    icon: Flame,
    popular: true,
  },
  {
    id: 'nova',
    name: 'Nova',
    price: 75.00,
    features: ['Unlimited Power with BYOK', 'Secrets Manager', 'Advanced Analytics', 'Ultimate Branding'],
    color: 'from-rose-400 via-pink-500 to-violet-600',
    icon: Crown,
  },
  {
    id: 'catalytic-crew',
    name: 'Catalytic Crew',
    price: 349.99,
    features: ['Everything in Nova', 'Unlimited team seats', 'SSO & SAML', 'Dedicated support'],
    color: 'from-indigo-400 via-purple-500 to-pink-500',
    icon: Users,
  },
];

export default function MembershipSection() {
  const [isLoading, setIsLoading] = useState(null);

  const handleSubscribe = async (planId) => {
    if (planId === 'free') {
      window.location.href = '/auth'; // Redirect to signup
      return;
    }
    setIsLoading(planId);
    try {
      const { url } = await createSubscriptionCheckout(null, planId);
      window.location.href = url;
    } catch (err) {
      console.error(err);
      setIsLoading(null);
    }
  };

  return (
    <section id="memberships" className="w-full max-w-7xl mx-auto px-6 py-24 relative z-10 border-t border-white/5">
      <div className="text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-white/80 to-white/40 bg-clip-text text-transparent">
          Subscription Tiers
        </h2>
        <p className="text-white/40 max-w-2xl mx-auto text-lg">
          Flexible monthly plans designed to grow with your vision. 
          From solo builders to global organizations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PLANS.map((plan, i) => {
          const Icon = plan.icon;
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className={`relative p-8 rounded-3xl border transition-all duration-500 bg-white/5 border-white/10 hover:border-white/20 group flex flex-col h-full ${plan.popular ? 'ring-2 ring-amber-500/50' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-black text-[10px] font-black uppercase tracking-widest shadow-lg">
                  Most Popular
                </div>
              )}

              <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 rounded-2xl bg-gradient-to-br ${plan.color} text-white shadow-lg shadow-black/20 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
              </div>

              <div className="mb-6">
                <span className="text-3xl font-bold text-white">${plan.price}</span>
                {plan.price > 0 && <span className="text-white/30 text-sm">/mo</span>}
              </div>

              <div className="space-y-4 mb-8 flex-1">
                {plan.features.map((feature, fi) => (
                  <div key={fi} className="flex gap-3 text-xs text-white/50">
                    <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={isLoading === plan.id}
                className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                  plan.popular 
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-black hover:scale-[1.02]' 
                    : 'bg-white text-black hover:bg-white/90'
                }`}
              >
                {isLoading === plan.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {plan.id === 'free' ? 'Get Started' : 'Subscribe Now'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
