import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Download, 
  Scale, 
  AlertTriangle,
  Check,
  Clock,
  Hash,
  Search
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { getUserAgreements } from '@/legal/eulaBoilerplate';

interface AgreementRecord {
  id: string;
  userId: string;
  assetId: string;
  assetTitle: string;
  creatorName: string;
  licenseTier: 'art_3pct' | 'integration_10pct' | 'functional_15pct' | 'source_20pct' | 'opensource';
  royaltyPercentage: number;
  signatureName: string;
  signedAt: string;
  agreementText: string;
  version: string;
}

export default function AgreementsPage() {
  const { user } = useAuthStore();
  const [agreements, setAgreements] = useState<AgreementRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgreement, setSelectedAgreement] = useState<AgreementRecord | null>(null);
  const [filter, setFilter] = useState<'all' | 'royalty' | 'opensource'>('all');

  useEffect(() => {
    if (user) {
      const userAgreements = getUserAgreements(user.id);
      setAgreements(userAgreements);
    }
  }, [user]);

  const filteredAgreements = agreements.filter(agreement => {
    const matchesSearch = 
      agreement.assetTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agreement.creatorName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = 
      filter === 'all' ? true :
      filter === 'royalty' ? agreement.royaltyPercentage > 0 :
      agreement.royaltyPercentage === 0;
    
    return matchesSearch && matchesFilter;
  });

  const downloadAgreement = (agreement: AgreementRecord) => {
    const blob = new Blob([agreement.agreementText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NovAura-Agreement-${agreement.assetTitle.replace(/[^a-z0-9]/gi, '_')}-${agreement.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totalRoyaltyObligations = agreements
    .filter(a => a.royaltyPercentage > 0)
    .reduce((sum, a) => sum + a.royaltyPercentage, 0);

  if (!user) {
    return (
      <div className="min-h-screen pt-24 pb-12">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center py-20">
            <FileText className="w-16 h-16 text-text-muted mx-auto mb-4" />
            <h1 className="font-heading text-2xl font-bold text-text-primary mb-2">
              Please Log In
            </h1>
            <p className="text-text-secondary">
              You need to be logged in to view your license agreements.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-heading text-3xl font-bold text-text-primary mb-2">
              Your License Agreements
            </h1>
            <p className="text-text-secondary">
              Access and download copies of all your signed royalty agreements
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-void-light border border-white/5 rounded-xl p-6"
            >
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-5 h-5 text-neon-cyan" />
                <span className="text-text-muted">Total Agreements</span>
              </div>
              <p className="font-heading text-3xl font-bold text-text-primary">
                {agreements.length}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-void-light border border-white/5 rounded-xl p-6"
            >
              <div className="flex items-center gap-3 mb-2">
                <Scale className="w-5 h-5 text-neon-magenta" />
                <span className="text-text-muted">Royalty Obligations</span>
              </div>
              <p className="font-heading text-3xl font-bold text-neon-magenta">
                {agreements.filter(a => a.royaltyPercentage > 0).length}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-void-light border border-white/5 rounded-xl p-6"
            >
              <div className="flex items-center gap-3 mb-2">
                <Check className="w-5 h-5 text-neon-lime" />
                <span className="text-text-muted">Open Source</span>
              </div>
              <p className="font-heading text-3xl font-bold text-neon-lime">
                {agreements.filter(a => a.royaltyPercentage === 0).length}
              </p>
            </motion.div>
          </div>

          {/* Royalty Warning Banner */}
          {totalRoyaltyObligations > 0 && (
            <div className="mb-8 p-4 bg-neon-magenta/10 border border-neon-magenta/30 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-neon-magenta flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-neon-magenta mb-1">
                    Active Royalty Obligations
                  </p>
                  <p className="text-sm text-neon-magenta/80">
                    You have {agreements.filter(a => a.royaltyPercentage > 0).length} assets with 
                    royalty obligations. Remember to report commercial revenue and pay royalties 
                    quarterly as specified in each agreement.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-grow">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
              <Input
                type="text"
                placeholder="Search agreements..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 py-5 bg-void-light border-white/10 text-text-primary placeholder:text-text-muted rounded-xl"
              />
            </div>
            <div className="flex gap-2">
              {(['all', 'royalty', 'opensource'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    filter === f
                      ? 'bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan'
                      : 'border-white/10 text-text-muted hover:text-text-primary'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Agreements List */}
          <div className="space-y-4">
            {filteredAgreements.length === 0 ? (
              <div className="text-center py-16 bg-void-light border border-white/5 rounded-xl">
                <FileText className="w-16 h-16 text-text-muted mx-auto mb-4" />
                <h3 className="font-heading text-xl font-bold text-text-primary mb-2">
                  No agreements yet
                </h3>
                <p className="text-text-secondary">
                  Your signed license agreements will appear here after purchase.
                </p>
              </div>
            ) : (
              filteredAgreements.map((agreement, index) => (
                <motion.div
                  key={agreement.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-void-light border border-white/5 rounded-xl p-6 hover:border-white/10 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Asset Info */}
                    <div className="flex-grow">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-text-primary">
                          {agreement.assetTitle}
                        </h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          agreement.royaltyPercentage > 0
                            ? 'bg-neon-magenta/10 text-neon-magenta border border-neon-magenta/30'
                            : 'bg-neon-lime/10 text-neon-lime border border-neon-lime/30'
                        }`}>
                          {agreement.royaltyPercentage > 0 
                            ? `${agreement.royaltyPercentage}% Royalty` 
                            : 'Open Source'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted">
                        <span>by {agreement.creatorName}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Signed {new Date(agreement.signedAt).toLocaleDateString()}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Hash className="w-3.5 h-3.5" />
                          {agreement.id}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedAgreement(agreement)}
                        className="px-4 py-2 text-sm text-neon-cyan hover:bg-neon-cyan/10 rounded-lg transition-colors"
                      >
                        View
                      </button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-white/20"
                        onClick={() => downloadAgreement(agreement)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* Important Notice */}
          <div className="mt-8 p-4 bg-void border border-white/5 rounded-xl">
            <div className="flex items-start gap-3">
              <Scale className="w-5 h-5 text-text-muted flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-text-primary mb-1">
                  Legal Notice
                </p>
                <p className="text-sm text-text-muted">
                  These agreements are legally binding contracts. You are obligated to comply with 
                  all terms including royalty payments and audit provisions. NovAura Market maintains 
                  these records as a neutral ledger provider only. 
                  <a href="/help" className="text-neon-cyan hover:underline ml-1">
                    Learn more about your obligations.
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Agreement Detail Modal */}
      {selectedAgreement && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-void-light border border-white/10 rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div>
                <h3 className="font-heading text-xl font-bold text-text-primary">
                  {selectedAgreement.assetTitle}
                </h3>
                <p className="text-text-muted text-sm">
                  Agreement ID: {selectedAgreement.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedAgreement(null)}
                className="p-2 text-text-muted hover:text-text-primary hover:bg-white/5 rounded-lg transition-colors"
              >
                <span className="sr-only">Close</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Agreement Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="prose prose-invert prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-mono text-sm text-text-secondary bg-void p-4 rounded-lg">
                  {selectedAgreement.agreementText}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-6 border-t border-white/10">
              <div className="text-sm text-text-muted">
                Signed by <span className="text-text-primary">{selectedAgreement.signatureName}</span> on{' '}
                {new Date(selectedAgreement.signedAt).toLocaleString()}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="border-white/20"
                  onClick={() => setSelectedAgreement(null)}
                >
                  Close
                </Button>
                <Button
                  className="bg-gradient-rgb text-void font-bold"
                  onClick={() => downloadAgreement(selectedAgreement)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Copy
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
