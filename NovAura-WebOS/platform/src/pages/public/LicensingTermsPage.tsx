import { motion } from 'framer-motion';
import { Scale, Percent, Code, Shield, AlertTriangle, Check, FileText, Lock } from 'lucide-react';

export default function LicensingTermsPage() {
  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="w-16 h-16 rounded-full bg-neon-violet/10 flex items-center justify-center mx-auto mb-4">
              <Scale className="w-8 h-8 text-neon-violet" />
            </div>
            <h1 className="font-heading text-4xl font-bold text-text-primary mb-4">
              Licensing Terms
            </h1>
            <p className="text-text-secondary">
              Understanding royalty agreements and platform rights
            </p>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-8"
          >
            {/* Royalty Tiers Overview */}
            <div className="bg-void-light border border-white/5 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-neon-cyan/10 flex items-center justify-center">
                  <Percent className="w-5 h-5 text-neon-cyan" />
                </div>
                <h2 className="font-heading text-2xl font-bold text-text-primary">
                  Royalty Agreement Overview
                </h2>
              </div>

              <p className="text-text-secondary mb-6">
                NovAura Market uses a graduated royalty system that fairly compensates creators 
                based on the scope and impact of their work. When you purchase an asset, you 
                enter into a legally binding agreement to pay royalties on commercial revenue.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <RoyaltyCard
                  tier="Individual Art & Audio"
                  rate="3%"
                  color="text-neon-lime"
                  bgColor="bg-neon-lime/10"
                  description="Single sprites, textures, SFX, or music tracks used as components"
                />
                <RoyaltyCard
                  tier="Asset Collection"
                  rate="10%"
                  color="text-neon-cyan"
                  bgColor="bg-neon-cyan/10"
                  description="Multiple assets from one creator defining your game's aesthetic"
                />
                <RoyaltyCard
                  tier="Game Framework"
                  rate="15%"
                  color="text-neon-violet"
                  bgColor="bg-neon-violet/10"
                  description="Reusable systems powering core mechanics (card games, UI kits, etc.)"
                />
                <RoyaltyCard
                  tier="Full Source Code"
                  rate="20%"
                  color="text-neon-magenta"
                  bgColor="bg-neon-magenta/10"
                  description="Complete game projects with full source code"
                />
                <RoyaltyCard
                  tier="Open Source"
                  rate="0%"
                  color="text-text-muted"
                  bgColor="bg-white/10"
                  description="MIT/Apache licensed - attribution only required"
                />
              </div>

              <div className="bg-neon-magenta/10 border border-neon-magenta/30 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-neon-magenta flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-neon-magenta mb-2">
                      Important Legal Notice
                    </h3>
                    <p className="text-neon-magenta/80 text-sm">
                      All commercial royalty licenses include an <strong>Audit Rights clause</strong>. 
                      Creators retain the right to demand third-party financial audits if commercial 
                      revenue is suspected to be underreported. Audit costs are borne by the purchaser 
                      if underreporting of 5% or more is discovered.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Platform Code Rights */}
            <div className="bg-void-light border border-white/5 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-neon-violet/10 flex items-center justify-center">
                  <Code className="w-5 h-5 text-neon-violet" />
                </div>
                <h2 className="font-heading text-2xl font-bold text-text-primary">
                  Platform Code Rights
                </h2>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="font-medium text-text-primary mb-2 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-neon-cyan" />
                    NovAura Market Platform Code
                  </h3>
                  <p className="text-text-secondary">
                    The NovAura Market platform, its underlying codebase, architecture, and all 
                    proprietary systems are the exclusive intellectual property of NovAura Market, Inc. 
                    This includes but is not limited to:
                  </p>
                  <ul className="list-disc pl-5 mt-2 space-y-1 text-text-secondary">
                    <li>Platform frontend and backend code</li>
                    <li>Database schemas and structures</li>
                    <li>API designs and implementations</li>
                    <li>User interface designs and components</li>
                    <li>Transaction processing systems</li>
                    <li>Royalty tracking and reporting systems</li>
                  </ul>
                </div>

                <div className="border-t border-white/10 pt-6">
                  <h3 className="font-medium text-text-primary mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-neon-lime" />
                    Creator Asset Rights
                  </h3>
                  <p className="text-text-secondary">
                    Creators retain full ownership of their uploaded assets. By uploading to NovAura Market, 
                    creators grant the platform a limited license to:
                  </p>
                  <ul className="list-disc pl-5 mt-2 space-y-1 text-text-secondary">
                    <li>Display and promote the asset on the platform</li>
                    <li>Deliver the asset to verified purchasers</li>
                    <li>Include the asset in search results and recommendations</li>
                    <li>Use thumbnails and descriptions for marketing purposes</li>
                  </ul>
                  <p className="text-text-secondary mt-3">
                    Creators may remove their assets from the platform at any time, subject to existing 
                    license agreements with purchasers.
                  </p>
                </div>

                <div className="border-t border-white/10 pt-6">
                  <h3 className="font-medium text-text-primary mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-neon-magenta" />
                    Purchaser Rights
                  </h3>
                  <p className="text-text-secondary">
                    Purchasers receive a license to use the asset according to the terms specified 
                    by the creator at time of purchase. Rights vary by license tier:
                  </p>
                  <ul className="list-disc pl-5 mt-2 space-y-1 text-text-secondary">
                    <li>Use in personal, educational, and commercial projects</li>
                    <li>Modify and adapt for your own use</li>
                    <li>Distribute only as compiled/integrated into your products</li>
                    <li>Create derivative works (subject to royalty obligations)</li>
                  </ul>
                  <p className="text-text-secondary mt-3">
                    Purchasers may NOT resell, redistribute, or sublicense assets as standalone products.
                  </p>
                </div>
              </div>
            </div>

            {/* Platform Indemnification */}
            <div className="bg-void-light border border-white/5 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-neon-magenta/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-neon-magenta" />
                </div>
                <h2 className="font-heading text-2xl font-bold text-text-primary">
                  Platform Indemnification
                </h2>
              </div>

              <div className="bg-neon-magenta/5 border border-neon-magenta/20 rounded-xl p-6">
                <p className="text-text-primary font-medium mb-4">
                  NOVARAURA MARKET IS NOT A PARTY TO LICENSE AGREEMENTS
                </p>
                <p className="text-text-secondary mb-4">
                  NovAura Market operates solely as a neutral marketplace and transaction ledger provider. 
                  We are strictly a technology platform that facilitates connections between creators and purchasers.
                </p>
                <div className="space-y-3 text-text-secondary">
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-neon-lime flex-shrink-0 mt-0.5" />
                    <span>We do not enforce royalty payments between parties</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-neon-lime flex-shrink-0 mt-0.5" />
                    <span>We do not mediate disputes between creators and purchasers</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-neon-lime flex-shrink-0 mt-0.5" />
                    <span>We do not provide legal advice or representation</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-neon-lime flex-shrink-0 mt-0.5" />
                    <span>We do not guarantee the quality or fitness of any asset</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-neon-lime flex-shrink-0 mt-0.5" />
                    <span>We maintain records only as a neutral ledger service</span>
                  </div>
                </div>
                <p className="text-text-secondary mt-4">
                  By using NovAura Market, both creators and purchasers agree to indemnify and hold 
                  harmless the platform from any claims, damages, or liabilities arising from license 
                  agreements or asset usage.
                </p>
              </div>
            </div>

            {/* Agreement Acceptance */}
            <div className="bg-gradient-to-br from-neon-cyan/10 to-neon-violet/10 border border-neon-cyan/30 rounded-2xl p-8">
              <h2 className="font-heading text-xl font-bold text-text-primary mb-4">
                Clickwrap Agreement
              </h2>
              <p className="text-text-secondary mb-4">
                Every purchase on NovAura Market requires explicit acceptance of the license terms 
                through our clickwrap system. This includes:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-text-secondary">
                <li>Scrolling through the complete license agreement</li>
                <li>Checking the acknowledgment checkbox</li>
                <li>Typing your full legal name as a digital signature</li>
                <li>Confirming the final purchase</li>
              </ul>
              <p className="text-text-secondary mt-4">
                A copy of each signed agreement is saved to your account and can be accessed at any 
                time from your <a href="/agreements" className="text-neon-cyan hover:underline">Agreements page</a>.
              </p>
            </div>

            {/* Contact */}
            <div className="text-center py-8">
              <p className="text-text-muted">
                Questions about licensing? Contact us at{' '}
                <a href="mailto:Dillan.Copeland@Novauraverse.com" className="text-neon-cyan hover:underline">
                  Dillan.Copeland@Novauraverse.com
                </a>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function RoyaltyCard({ 
  tier, 
  rate, 
  color, 
  bgColor, 
  description 
}: { 
  tier: string; 
  rate: string; 
  color: string; 
  bgColor: string;
  description: string;
}) {
  return (
    <div className="bg-void border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors">
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg ${bgColor} mb-3`}>
        <span className={`font-heading text-2xl font-bold ${color}`}>{rate}</span>
        <span className={`text-sm ${color}`}>royalty</span>
      </div>
      <h3 className="font-medium text-text-primary mb-1">{tier}</h3>
      <p className="text-text-muted text-sm">{description}</p>
    </div>
  );
}
