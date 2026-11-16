import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  Lock, 
  Check, 
  ArrowLeft,
  FileText,
  Shield,
  Box,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/stores/cartStore';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { formatPrice, getLicenseDisplayName } from '@/utils/format';
import { calculateRevenueSplits } from '@/services/royaltyService';
import { createCheckoutSession } from '@/services/marketService';
import type { RoyaltyLedger } from '@/types';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, total } = useCartStore();
  const { addToast } = useUIStore();
  const { user } = useAuthStore();
  
  const [step, setStep] = useState(1);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [revenueBreakdown, setRevenueBreakdown] = useState<RoyaltyLedger[]>([]);

  // Calculate splits on component mount or items change
  useEffect(() => {
    const calculateAllSplits = async () => {
      const allSplits: RoyaltyLedger[] = [];
      for (const item of items) {
        const itemPrice = item.customPrice ?? item.asset.price;
        const splits = await calculateRevenueSplits(item.asset, itemPrice);
        allSplits.push(...splits);
      }
      setRevenueBreakdown(allSplits);
    };

    if (items.length > 0) {
      calculateAllSplits();
    }
  }, [items]);

  const platformFee = Math.round(total * 0.1);
  const grandTotal = total;

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  const handleCheckout = async () => {
    if (!agreedToTerms) {
      addToast({
        type: 'error',
        title: 'Terms required',
        message: 'Please agree to the license terms to continue.',
      });
      return;
    }

    setIsProcessing(true);

    try {
      if (!user) {
        addToast({
          type: 'error',
          title: 'Authentication Required',
          message: 'Please log in to check out.',
        });
        setIsProcessing(false);
        return;
      }
      
      const url = await createCheckoutSession(user.id, items);
      window.location.href = url; // Redirect to Stripe Checkout

    } catch (error) {
      console.error(error);
      addToast({
        type: 'error',
        title: 'Gateway Error',
        message: 'Failed to securely connect to the payment processor. Please try again later.',
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => navigate('/cart')}
            className="flex items-center gap-2 text-text-muted hover:text-text-primary mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to cart
          </button>

          {/* Progress */}
          <div className="flex items-center gap-4 mb-8">
            {['Review', 'License Agreement', 'Payment'].map((s, i) => (
              <div key={s} className="flex items-center gap-4">
                <div className={`flex items-center gap-2 ${step >= i + 1 ? 'text-neon-cyan' : 'text-text-muted'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                    step > i + 1 
                      ? 'bg-neon-cyan border-neon-cyan text-void' 
                      : step === i + 1 
                        ? 'border-neon-cyan text-neon-cyan' 
                        : 'border-white/20 text-text-muted'
                  }`}>
                    {step > i + 1 ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className="hidden sm:inline text-sm font-medium">{s}</span>
                </div>
                {i < 2 && <div className={`w-12 h-px ${step > i + 1 ? 'bg-neon-cyan' : 'bg-white/10'}`} />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h1 className="font-heading text-3xl font-bold text-text-primary mb-6">
                Review Your Order
              </h1>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Items */}
                <div className="lg:col-span-2 space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.assetId}
                      className="bg-void-light border border-white/5 rounded-xl p-6"
                    >
                      <div className="flex gap-4">
                        <div className="w-20 h-20 bg-void rounded-lg flex items-center justify-center">
                          <Box className="w-8 h-8 text-white/20" />
                        </div>
                        <div className="flex-grow">
                          <h3 className="font-medium text-text-primary">{item.asset.title}</h3>
                          <p className="text-text-muted text-sm">
                            by {item.asset.creator?.username || 'Unknown'}
                          </p>
                          <p className="text-sm text-neon-violet mt-1">
                            {getLicenseDisplayName(item.asset.licenseTier)}
                          </p>
                        </div>
                        <p className="font-heading text-lg font-bold text-neon-cyan">
                          {formatPrice(item.customPrice ?? item.asset.price)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="lg:col-span-1">
                  <div className="bg-void-light border border-white/5 rounded-xl p-6">
                    <h2 className="font-heading text-lg font-bold text-text-primary mb-4">
                      Order Summary
                    </h2>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-text-secondary">
                        <span>Subtotal</span>
                        <span>{formatPrice(total)}</span>
                      </div>
                      <div className="flex justify-between text-text-secondary">
                        <span>Platform Fee</span>
                        <span>{formatPrice(platformFee)}</span>
                      </div>
                    </div>
                    <div className="border-t border-white/10 pt-4">
                      <div className="flex justify-between">
                        <span className="font-medium text-text-primary">Total</span>
                        <span className="font-heading text-2xl font-bold text-neon-cyan">
                          {formatPrice(grandTotal)}
                        </span>
                      </div>
                    </div>
                    <Button 
                      className="w-full mt-6 bg-gradient-rgb text-void font-bold py-6"
                      onClick={() => setStep(2)}
                    >
                      Continue
                    </Button>

                    {/* Royalty Transparency Section */}
                    {revenueBreakdown.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-white/10">
                        <div className="flex items-center gap-2 mb-4 text-xs font-bold text-neon-cyan uppercase tracking-widest">
                          <Sparkles className="w-3 h-3" />
                          Fair Creator Stake Breakdown
                        </div>
                        <div className="space-y-3">
                          {revenueBreakdown.map((split, idx) => (
                            <div key={idx} className="flex justify-between items-start gap-4">
                              <div className="flex-grow">
                                <p className="text-xs text-text-primary font-medium">{split.reason}</p>
                                <p className="text-[10px] text-text-muted">Recipient ID: {split.recipientId.substring(0, 8)}...</p>
                              </div>
                              <p className="text-xs font-heading font-bold text-text-primary">
                                {formatPrice(split.amount)}
                              </p>
                            </div>
                          ))}
                        </div>
                        <p className="mt-4 text-[10px] text-text-muted leading-relaxed italic">
                          "Helping streamline the creative process by ensuring value flows back to the foundations."
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h1 className="font-heading text-3xl font-bold text-text-primary mb-6">
                License Agreement
              </h1>

              <div className="bg-void-light border border-white/5 rounded-xl p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="w-6 h-6 text-neon-cyan" />
                  <h2 className="font-medium text-text-primary">Terms of Use</h2>
                </div>

                <div className="bg-void rounded-lg p-4 max-h-64 overflow-y-auto custom-scrollbar mb-4">
                  <div className="prose prose-invert prose-sm max-w-none">
                    <h3>NovAura Market License Agreement</h3>
                    <p>
                      By purchasing and downloading assets from NovAura Market, you agree to the following terms:
                    </p>
                    <h4>1. Grant of License</h4>
                    <p>
                      Upon purchase, you are granted a non-exclusive, non-transferable license to use the asset 
                      in accordance with the specific license tier selected (Art & Sprites, Full Source, or Open Source).
                    </p>
                    <h4>2. Permitted Uses</h4>
                    <ul>
                      <li>Use in personal and commercial projects</li>
                      <li>Modification and adaptation for your needs</li>
                      <li>Integration into your own products</li>
                    </ul>
                    <h4>3. Prohibited Uses</h4>
                    <ul>
                      <li>Resale or redistribution of original files</li>
                      <li>Use in ways that violate applicable laws</li>
                      <li>Claiming ownership of the original work</li>
                    </ul>
                    <h4>4. Royalties</h4>
                    <p>
                      Depending on the license tier, you may be required to pay royalties on revenue generated 
                      from products using this asset. See the specific license terms for details.
                    </p>
                    <h4>5. Attribution</h4>
                    <p>
                      You must provide appropriate credit to the original creator as specified in the license terms.
                    </p>
                  </div>
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="custom-checkbox mt-1"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                  />
                  <span className="text-sm text-text-secondary">
                    I have read and agree to the license terms for all assets in my cart.
                  </span>
                </label>
              </div>

              <div className="flex gap-4">
                <Button 
                  variant="outline"
                  className="border-white/20"
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button 
                  className="bg-gradient-rgb text-void font-bold"
                  onClick={() => setStep(3)}
                  disabled={!agreedToTerms}
                >
                  Continue to Payment
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h1 className="font-heading text-3xl font-bold text-text-primary mb-6">
                Payment
              </h1>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Payment Form (Placeholder) */}
                <div className="bg-void-light border border-white/5 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <CreditCard className="w-6 h-6 text-neon-cyan" />
                    <h2 className="font-medium text-text-primary">Payment Method</h2>
                  </div>

                  <div className="p-8 bg-void rounded-lg border border-dashed border-neon-cyan/30 text-center">
                    <Lock className="w-12 h-12 text-neon-cyan/30 mx-auto mb-4" />
                    <p className="text-text-secondary mb-2">
                      Secure checkout powered by Stripe
                    </p>
                    <p className="text-text-muted text-sm">
                      You will be redirected to Stripe to complete your purchase safely
                    </p>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div className="flex items-center gap-3 text-text-secondary">
                      <Shield className="w-5 h-5 text-neon-cyan" />
                      <span className="text-sm">Secure SSL encryption</span>
                    </div>
                    <div className="flex items-center gap-3 text-text-secondary">
                      <Lock className="w-5 h-5 text-neon-cyan" />
                      <span className="text-sm">Your payment info is never stored</span>
                    </div>
                  </div>
                </div>

                {/* Order Summary */}
                <div>
                  <div className="bg-void-light border border-white/5 rounded-xl p-6 mb-6">
                    <h2 className="font-heading text-lg font-bold text-text-primary mb-4">
                      Order Summary
                    </h2>
                    <div className="space-y-2 mb-4">
                      {items.map(item => (
                        <div key={item.assetId} className="flex justify-between text-sm">
                          <span className="text-text-secondary truncate">{item.asset.title}</span>
                          <span className="text-text-primary">{formatPrice(item.customPrice ?? item.asset.price)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-white/10 pt-4 space-y-2">
                      <div className="flex justify-between text-text-secondary">
                        <span>Subtotal</span>
                        <span>{formatPrice(total)}</span>
                      </div>
                      <div className="flex justify-between text-text-secondary">
                        <span>Platform Fee</span>
                        <span>{formatPrice(platformFee)}</span>
                      </div>
                    </div>
                    <div className="border-t border-white/10 pt-4 mt-4">
                      <div className="flex justify-between">
                        <span className="font-medium text-text-primary">Total</span>
                        <span className="font-heading text-2xl font-bold text-neon-cyan">
                          {formatPrice(grandTotal)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button 
                    className="w-full bg-gradient-rgb text-void font-bold py-6"
                    onClick={handleCheckout}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <div className="w-5 h-5 border-2 border-void/30 border-t-void rounded-full animate-spin" />
                    ) : (
                      <>
                        Complete Purchase
                        <Lock className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
