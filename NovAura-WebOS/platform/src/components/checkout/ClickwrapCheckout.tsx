import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  FileText, 
  Check, 
  AlertTriangle, 
  Shield, 
  Scale,
  Download,
  CreditCard,
  Lock,
  User,
  Clock,
  Hash
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { formatPrice } from '@/utils/format';
import type { Asset, LicenseTier } from '@/types';
import { getLicenseSpecificTerms } from '@/legal/eulaBoilerplate';
import { kernelStorage } from '../@/kernel/kernelStorage.js';

interface ClickwrapCheckoutProps {
  asset: Asset;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (payload: ClickwrapPayload) => void;
}

export interface ClickwrapPayload {
  userId: string;
  assetId: string;
  timestamp: string;
  clickwrapAccepted: boolean;
  signatureName: string;
  licenseTier: LicenseTier;
  royaltyPercentage: number;
  agreementVersion: string;
  userAgent: string;
  ipAddress?: string;
}

const SCROLL_THRESHOLD = 0.9; // User must scroll to 90% of content

export default function ClickwrapCheckout({ asset, isOpen, onClose, onComplete }: ClickwrapCheckoutProps) {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [hasCheckedAgreement, setHasCheckedAgreement] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSignatureConfirm, setShowSignatureConfirm] = useState(false);
  const [agreementSent, setAgreementSent] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const licenseTerms = getLicenseSpecificTerms(asset.licenseTier);
  const royaltyRate = asset.licenseTier === 'source_20pct' ? 20 : asset.licenseTier === 'functional_15pct' ? 15 : asset.licenseTier === 'integration_10pct' ? 10 : asset.licenseTier === 'art_3pct' ? 3 : 0;

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setHasScrolledToBottom(false);
      setHasCheckedAgreement(false);
      setSignatureName('');
      setShowSignatureConfirm(false);
      setAgreementSent(false);
    }
  }, [isOpen]);

  // Handle scroll detection
  const handleScroll = () => {
    if (!scrollRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
    
    if (scrollPercentage >= SCROLL_THRESHOLD && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  // Check if all requirements are met
  const canProceed = hasScrolledToBottom && hasCheckedAgreement && signatureName.trim().length >= 3;

  // Handle checkout submission
  const handleCheckout = async () => {
    if (!canProceed || !user) return;
    
    setIsSubmitting(true);
    
    // Construct the legal payload
    const payload: ClickwrapPayload = {
      userId: user.id,
      assetId: asset.id,
      timestamp: new Date().toISOString(),
      clickwrapAccepted: true,
      signatureName: signatureName.trim(),
      licenseTier: asset.licenseTier,
      royaltyPercentage: royaltyRate,
      agreementVersion: '1.0.0',
      userAgent: navigator.userAgent,
      // Note: IP would be captured server-side for security
    };

    // Simulate API call to record the agreement
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Store agreement in localStorage for user reference
    const userAgreements = JSON.parse(kernelStorage.getItem('novaura_agreements') || '[]');
    userAgreements.push({
      ...payload,
      assetTitle: asset.title,
      creatorName: asset.creator?.username,
      savedAt: new Date().toISOString(),
    });
    kernelStorage.setItem('novaura_agreements', JSON.stringify(userAgreements));
    
    // Send agreement copy to user (simulated)
    setAgreementSent(true);
    
    addToast({
      type: 'success',
      title: 'Agreement Recorded',
      message: 'A copy of the royalty agreement has been saved to your account.',
    });
    
    setIsSubmitting(false);
    onComplete(payload);
  };

  // Handle signature confirmation
  const handleSignatureConfirm = () => {
    if (signatureName.trim().length < 3) {
      addToast({
        type: 'error',
        title: 'Invalid Signature',
        message: 'Please enter your full legal name (minimum 3 characters).',
      });
      return;
    }
    setShowSignatureConfirm(true);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />
        
        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl max-h-[90vh] bg-void-light border border-white/10 rounded-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-r from-neon-cyan/5 to-neon-violet/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-neon-cyan/10 flex items-center justify-center">
                <Scale className="w-5 h-5 text-neon-cyan" />
              </div>
              <div>
                <h2 className="font-heading text-xl font-bold text-text-primary">
                  License Agreement & Checkout
                </h2>
                <p className="text-text-muted text-sm">
                  Legal acknowledgment required before purchase
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-text-muted hover:text-text-primary hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
            {/* Left: Asset Info */}
            <div className="lg:w-72 p-6 border-b lg:border-b-0 lg:border-r border-white/10 bg-void">
              <div className="aspect-video bg-void-light rounded-lg mb-4 overflow-hidden">
                {asset.thumbnailUrl ? (
                  <img src={asset.thumbnailUrl} alt={asset.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileText className="w-12 h-12 text-text-muted" />
                  </div>
                )}
              </div>
              
              <h3 className="font-medium text-text-primary mb-1 line-clamp-2">{asset.title}</h3>
              <p className="text-text-muted text-sm mb-4">by {asset.creator?.username}</p>
              
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">License</span>
                  <span className="text-neon-cyan font-medium">{licenseTerms.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">Royalty</span>
                  <span className={`font-medium ${royaltyRate > 0 ? 'text-neon-magenta' : 'text-neon-lime'}`}>
                    {royaltyRate > 0 ? `${royaltyRate}%` : 'Citation Only'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">Price</span>
                  <span className="font-heading text-lg font-bold text-neon-cyan">
                    {formatPrice(asset.price)}
                  </span>
                </div>
              </div>

              {/* Legal Badges */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <Shield className="w-3.5 h-3.5 text-neon-lime" />
                  <span>Legally binding contract</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <Lock className="w-3.5 h-3.5 text-neon-lime" />
                  <span>Encrypted transaction</span>
                </div>
              </div>
            </div>

            {/* Right: Agreement */}
            <div className="flex-1 flex flex-col">
              {/* Scrollable EULA */}
              <div 
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-6 space-y-6"
              >
                {/* Warning Banner */}
                <div className="p-4 bg-neon-magenta/10 border border-neon-magenta/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-neon-magenta flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-neon-magenta mb-1">
                        Important Legal Notice
                      </p>
                      <p className="text-sm text-neon-magenta/80">
                        This is a legally binding contract. By purchasing this asset, you agree to 
                        pay {royaltyRate}% royalties on all commercial revenue generated using this 
                        code/framework. Failure to report revenue may result in legal action and audits.
                      </p>
                    </div>
                  </div>
                </div>

                {/* EULA Content */}
                <div className="prose prose-invert prose-sm max-w-none">
                  <EULAContent 
                    assetTitle={asset.title}
                    creatorName={asset.creator?.username || 'Unknown'}
                    royaltyRate={royaltyRate}
                  />
                </div>

                {/* Scroll indicator */}
                {!hasScrolledToBottom && (
                  <div className="flex items-center justify-center gap-2 py-4 text-text-muted text-sm">
                    <div className="w-2 h-2 bg-neon-cyan rounded-full animate-bounce" />
                    <span>Scroll to continue reading</span>
                  </div>
                )}
              </div>

              {/* Action Area */}
              <div className="p-6 border-t border-white/10 bg-void space-y-4">
                {/* Progress Indicator */}
                <div className="flex items-center gap-4 text-xs">
                  <div className={`flex items-center gap-1.5 ${hasScrolledToBottom ? 'text-neon-lime' : 'text-text-muted'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${hasScrolledToBottom ? 'bg-neon-lime/20' : 'bg-white/10'}`}>
                      {hasScrolledToBottom ? <Check className="w-3 h-3" /> : '1'}
                    </div>
                    <span>Read agreement</span>
                  </div>
                  <div className="flex-1 h-px bg-white/10" />
                  <div className={`flex items-center gap-1.5 ${hasCheckedAgreement ? 'text-neon-lime' : 'text-text-muted'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${hasCheckedAgreement ? 'bg-neon-lime/20' : 'bg-white/10'}`}>
                      {hasCheckedAgreement ? <Check className="w-3 h-3" /> : '2'}
                    </div>
                    <span>Accept terms</span>
                  </div>
                  <div className="flex-1 h-px bg-white/10" />
                  <div className={`flex items-center gap-1.5 ${signatureName.length >= 3 ? 'text-neon-lime' : 'text-text-muted'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${signatureName.length >= 3 ? 'bg-neon-lime/20' : 'bg-white/10'}`}>
                      {signatureName.length >= 3 ? <Check className="w-3 h-3" /> : '3'}
                    </div>
                    <span>Sign & purchase</span>
                  </div>
                </div>

                {/* Checkbox */}
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={hasCheckedAgreement}
                    onChange={(e) => setHasCheckedAgreement(e.target.checked)}
                    disabled={!hasScrolledToBottom}
                    className="custom-checkbox mt-1 disabled:opacity-30"
                  />
                  <span className={`text-sm ${hasScrolledToBottom ? 'text-text-secondary group-hover:text-text-primary' : 'text-text-muted'}`}>
                    I have read and agree to the {licenseTerms.name}, including the 
                    <span className="text-neon-magenta font-medium"> Audit Rights clause</span>. 
                    I understand that {royaltyRate > 0 ? `a ${royaltyRate}% royalty` : 'attribution'} 
                    is owed on all commercial revenue generated using this asset.
                  </span>
                </label>

                {/* Digital Signature */}
                <div className="space-y-2">
                  <label className="block text-sm text-text-muted">
                    Digital Signature <span className="text-neon-red">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                    <Input
                      type="text"
                      value={signatureName}
                      onChange={(e) => setSignatureName(e.target.value)}
                      placeholder="Type your full legal name"
                      disabled={!hasCheckedAgreement}
                      className="pl-12 py-5 bg-void border-white/10 text-text-primary placeholder:text-text-muted disabled:opacity-50"
                    />
                  </div>
                  <p className="text-xs text-text-muted">
                    By typing your name, you are digitally signing this agreement under the ESIGN Act.
                  </p>
                </div>

                {/* Checkout Button */}
                <Button
                  onClick={handleSignatureConfirm}
                  disabled={!canProceed}
                  className="w-full bg-gradient-rgb text-void font-bold py-6 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {!hasScrolledToBottom ? (
                    <span className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Scroll to Read Full Agreement
                    </span>
                  ) : !hasCheckedAgreement ? (
                    <span className="flex items-center gap-2">
                      <Check className="w-5 h-5" />
                      Check the Agreement Box to Continue
                    </span>
                  ) : signatureName.length < 3 ? (
                    <span className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Enter Your Name to Sign
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5" />
                      Complete Purchase — {formatPrice(asset.price)}
                    </span>
                  )}
                </Button>

                {/* Platform Protection Notice */}
                <p className="text-xs text-text-muted text-center">
                  NovAura Market is a neutral marketplace and ledger provider. 
                  We are not a party to this agreement. 
                  <a href="/legal/terms" className="text-neon-cyan hover:underline ml-1">
                    Read our indemnification policy.
                  </a>
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Signature Confirmation Modal */}
        {showSignatureConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="bg-void-light border border-white/10 rounded-2xl p-8 max-w-lg w-full"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-neon-magenta/10 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-neon-magenta" />
                </div>
                <h3 className="font-heading text-xl font-bold text-text-primary mb-2">
                  Final Confirmation
                </h3>
                <p className="text-text-secondary">
                  You are about to enter a legally binding contract.
                </p>
              </div>

              <div className="bg-void rounded-lg p-4 mb-6 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <User className="w-4 h-4 text-text-muted" />
                  <span className="text-text-muted">Signing as:</span>
                  <span className="text-text-primary font-medium">{signatureName}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <FileText className="w-4 h-4 text-text-muted" />
                  <span className="text-text-muted">Asset:</span>
                  <span className="text-text-primary font-medium line-clamp-1">{asset.title}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Scale className="w-4 h-4 text-text-muted" />
                  <span className="text-text-muted">Royalty obligation:</span>
                  <span className={`font-medium ${royaltyRate > 0 ? 'text-neon-magenta' : 'text-neon-lime'}`}>
                    {royaltyRate > 0 ? `${royaltyRate}% of commercial revenue` : 'Attribution only'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="w-4 h-4 text-text-muted" />
                  <span className="text-text-muted">Timestamp:</span>
                  <span className="text-text-primary font-medium">{new Date().toLocaleString()}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-white/20"
                  onClick={() => setShowSignatureConfirm(false)}
                >
                  Review Again
                </Button>
                <Button
                  className="flex-1 bg-gradient-rgb text-void font-bold"
                  onClick={handleCheckout}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-void/30 border-t-void rounded-full animate-spin" />
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      Confirm & Purchase
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Agreement Sent Confirmation */}
        {agreementSent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="bg-void-light border border-neon-lime/30 rounded-2xl p-8 max-w-md w-full text-center"
            >
              <div className="w-20 h-20 rounded-full bg-neon-lime/10 flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-neon-lime" />
              </div>
              <h3 className="font-heading text-2xl font-bold text-text-primary mb-2">
                Agreement Recorded!
              </h3>
              <p className="text-text-secondary mb-6">
                A copy of your royalty agreement has been saved to your account and sent to your email.
              </p>
              <div className="bg-void rounded-lg p-4 mb-6 text-left">
                <div className="flex items-center gap-2 text-sm text-neon-lime mb-2">
                  <Hash className="w-4 h-4" />
                  <span>Agreement ID: {Math.random().toString(36).substring(2, 15).toUpperCase()}</span>
                </div>
                <p className="text-xs text-text-muted">
                  Save this ID for your records. You can access your agreements anytime from your account settings.
                </p>
              </div>
              <Button
                className="w-full bg-neon-lime text-void font-bold"
                onClick={onClose}
              >
                <Download className="w-4 h-4 mr-2" />
                Continue to Download
              </Button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}

// EULA Content Component
function EULAContent({ 
  assetTitle, 
  creatorName, 
  royaltyRate 
}: { 
  assetTitle: string; 
  creatorName: string; 
  royaltyRate: number;
}) {
  return (
    <div className="space-y-6 text-text-secondary">
      <div className="text-center border-b border-white/10 pb-4">
        <h1 className="font-heading text-2xl font-bold text-text-primary mb-2">
          END USER LICENSE AGREEMENT
        </h1>
        <p className="text-sm">Commercial Royalty License v1.0</p>
      </div>

      <div className="space-y-4">
        <p>
          This End User License Agreement ("Agreement") is a legally binding contract between 
          <strong className="text-text-primary"> {creatorName} </strong>("Licensor") and 
          <strong className="text-text-primary"> You </strong>("Licensee") regarding the use of 
          <strong className="text-text-primary"> {assetTitle} </strong>("Asset").
        </p>

        <p>
          BY PURCHASING, DOWNLOADING, INSTALLING, OR USING THIS ASSET, YOU ACKNOWLEDGE THAT YOU HAVE 
          READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THE TERMS OF THIS AGREEMENT. IF YOU DO NOT AGREE 
          TO THESE TERMS, DO NOT PURCHASE OR USE THIS ASSET.
        </p>
      </div>

      <Section title="1. LICENSE GRANT">
        <p>
          Subject to the terms and conditions of this Agreement, Licensor grants Licensee a limited, 
          non-exclusive, non-transferable, perpetual license to:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Use the Asset in personal, educational, or commercial projects</li>
          <li>Modify the Asset for use within Licensee's own projects</li>
          <li>Distribute the Asset only as compiled/integrated into Licensee's own products</li>
          <li>Create derivative works based on the Asset for Licensee's own use</li>
        </ul>
      </Section>

      <Section title={`2. ROYALTY OBLIGATION (${royaltyRate}%)`} highlight={royaltyRate > 0}>
        {royaltyRate > 0 ? (
          <>
            <p className="text-neon-magenta font-medium">
              THIS IS A COMMERCIAL ROYALTY LICENSE. LICENSEE AGREES TO PAY {royaltyRate}% OF ALL 
              GROSS COMMERCIAL REVENUE GENERATED FROM PRODUCTS OR SERVICES THAT INCORPORATE THIS ASSET.
            </p>
            <div className="bg-neon-magenta/10 border border-neon-magenta/30 rounded-lg p-4 my-4">
              <p className="font-medium text-neon-magenta mb-2">Royalty Calculation:</p>
              <ul className="list-disc pl-5 space-y-1 text-neon-magenta/80">
                <li><strong>Gross Revenue</strong> = Total revenue before any deductions</li>
                <li><strong>Royalty Rate</strong> = {royaltyRate}% of Gross Revenue</li>
                <li><strong>Payment Due</strong> = Quarterly, within 30 days of quarter end</li>
                <li><strong>Currency</strong> = USD or equivalent at time of payment</li>
              </ul>
            </div>
            <p>
              <strong>Example:</strong> If your product generates $100,000 in revenue, you owe 
              ${(100000 * royaltyRate / 100).toLocaleString()} in royalties to {creatorName}.
            </p>
            <p>
              <strong>Perpetual Obligation:</strong> This royalty obligation continues for as long as 
              the Asset remains integrated into your commercial product, even if you cease active development.
            </p>
          </>
        ) : (
          <>
            <p className="text-neon-lime font-medium">
              This is an OPEN SOURCE license. No monetary royalties are required.
            </p>
            <p>
              However, Licensee MUST include proper attribution to {creatorName} in all derivative works, 
              including in documentation, about pages, and source code comments.
            </p>
          </>
        )}
      </Section>

      <Section title="3. AUDIT RIGHTS" highlight>
        <div className="bg-neon-magenta/10 border border-neon-magenta/30 rounded-lg p-4">
          <p className="font-medium text-neon-magenta mb-2">
            LICENSOR RETAINS THE RIGHT TO CONDUCT FINANCIAL AUDITS
          </p>
          <p>
            If Licensor has reasonable suspicion that Licensee has underreported or failed to report 
            commercial revenue generated using the Asset, Licensor may:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-neon-magenta/80">
            <li>
              Demand a third-party financial audit of Licensee's business records related to products 
              incorporating the Asset
            </li>
            <li>
              Request access to sales data, payment processor records, and financial statements
            </li>
            <li>
              The cost of the audit shall be borne by Licensee if underreporting of 5% or more is discovered
            </li>
            <li>
              Licensee must provide requested documentation within 30 days of written request
            </li>
          </ul>
        </div>
        <p>
          <strong>Non-Compliance:</strong> Failure to comply with an audit request constitutes a 
          material breach of this Agreement and may result in license termination and legal action.
        </p>
      </Section>

      <Section title="4. PLATFORM INDEMNIFICATION">
        <div className="bg-void border border-white/10 rounded-lg p-4">
          <p className="font-medium text-text-primary mb-2">
            NOVARAURA MARKET IS NOT A PARTY TO THIS AGREEMENT
          </p>
          <p>
            NovAura Market, Inc. ("Platform") operates solely as a neutral marketplace and transaction 
            ledger provider. By using this Platform, both Licensor and Licensee acknowledge and agree:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>
              <strong>No Liability:</strong> The Platform bears absolutely no legal responsibility for 
              enforcing royalty payments, resolving disputes, or mediating conflicts between parties.
            </li>
            <li>
              <strong>No Warranty:</strong> The Platform makes no representations or warranties about 
              the quality, functionality, or fitness for purpose of any Asset sold.
            </li>
            <li>
              <strong>Indemnification:</strong> Both parties agree to indemnify and hold harmless the 
              Platform, its employees, agents, and affiliates from any claims, damages, or liabilities 
              arising from this Agreement or the use of any Asset.
            </li>
            <li>
              <strong>Dispute Resolution:</strong> Any disputes between Licensor and Licensee must be 
              resolved directly between those parties. The Platform will not intervene.
            </li>
            <li>
              <strong>Ledger Only:</strong> The Platform's sole function is to record that a transaction 
              occurred and store the terms agreed upon at the time of purchase.
            </li>
          </ul>
        </div>
      </Section>

      <Section title="5. RESTRICTIONS">
        <p>Licensee may NOT:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Resell, redistribute, or sublicense the Asset as a standalone product</li>
          <li>Use the Asset in any way that violates applicable laws</li>
          <li>Remove or alter any copyright notices or attribution</li>
          <li>Use the Asset in malware, spyware, or malicious software</li>
          <li>Claim ownership or authorship of the original Asset</li>
          <li>Use the Asset in training AI/ML models without explicit written permission</li>
        </ul>
      </Section>

      <Section title="6. TERMINATION">
        <p>
          This Agreement may be terminated by Licensor if Licensee materially breaches any term. 
          Upon termination:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>All licenses granted herein immediately terminate</li>
          <li>Licensee must cease all use of the Asset</li>
          <li>Royalty obligations for revenue already earned remain in effect</li>
          <li>Products already distributed containing the Asset may remain in market, subject to continued royalty payments</li>
        </ul>
      </Section>

      <Section title="7. GOVERNING LAW">
        <p>
          This Agreement shall be governed by and construed in accordance with the laws of the State 
          of Delaware, United States, without regard to its conflict of law principles.
        </p>
      </Section>

      <div className="border-t border-white/10 pt-4 mt-8 text-center text-sm text-text-muted">
        <p>Agreement Version: 1.0.0 | Last Updated: {new Date().toLocaleDateString()}</p>
        <p className="mt-1">
          This agreement was presented via Clickwrap UI at the time of purchase.
        </p>
      </div>
    </div>
  );
}

function Section({ 
  title, 
  children, 
  highlight = false 
}: { 
  title: string; 
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`border-l-2 pl-4 ${highlight ? 'border-neon-magenta' : 'border-white/20'}`}>
      <h3 className={`font-heading text-lg font-bold mb-2 ${highlight ? 'text-neon-magenta' : 'text-text-primary'}`}>
        {title}
      </h3>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}
