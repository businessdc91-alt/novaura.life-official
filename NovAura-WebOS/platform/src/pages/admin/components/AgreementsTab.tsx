import { motion } from 'framer-motion';
import { CheckCircle as CheckCircleIcon } from 'lucide-react';

interface Agreement {
  id: string;
  assetTitle: string;
  creatorName: string;
  royaltyPercentage: number;
  signedAt: string;
  signatureName: string;
}

interface AgreementsTabProps {
  agreements: Agreement[];
}

export const AgreementsTab = ({ agreements }: AgreementsTabProps) => {
  return (
    <motion.div
      key="agreements"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className="bg-void-light border border-white/5 rounded-xl p-6">
        <h3 className="font-heading text-xl font-bold text-text-primary mb-6">
          Royalty Agreements
        </h3>
        
        {agreements.length === 0 ? (
          <p className="text-text-muted">No agreements recorded yet</p>
        ) : (
          <div className="space-y-3">
            {agreements.slice(0, 20).map((agreement) => (
              <div key={agreement.id} className="flex items-center gap-4 p-4 bg-void rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-neon-cyan/10 flex items-center justify-center">
                  <CheckCircleIcon className="w-5 h-5 text-neon-cyan" />
                </div>
                <div className="flex-grow">
                  <p className="font-medium text-text-primary">{agreement.assetTitle}</p>
                  <p className="text-text-muted text-sm">
                    by {agreement.creatorName} • {agreement.royaltyPercentage}% royalty
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-text-muted text-sm">{new Date(agreement.signedAt).toLocaleDateString()}</p>
                  <p className="text-text-muted text-xs">{agreement.signatureName}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};
