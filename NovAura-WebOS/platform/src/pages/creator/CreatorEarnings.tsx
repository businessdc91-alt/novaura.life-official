import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Download,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/services/apiClient';
import { formatPrice, formatDate } from '@/utils/format';

interface RoyaltyEntry {
  id: string;
  assetId: string;
  assetTitle: string;
  amount: number;        // cents
  percentage: number;
  reason: string;
  status: 'pending_transfer' | 'transferred' | 'transfer_failed';
  createdAt: string;
}

interface RoyaltySummary {
  lifetimeCents: number;
  availableCents: number;
  pendingCents: number;
}

// Build simple monthly buckets from ledger entries
function buildMonthlyChart(entries: RoyaltyEntry[]) {
  const buckets: Record<string, number> = {};
  entries.forEach(e => {
    const d = new Date(e.createdAt);
    const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    buckets[key] = (buckets[key] || 0) + (e.amount || 0);
  });
  // Last 6 months in order
  const months = Object.keys(buckets).slice(-6);
  const max = Math.max(...months.map(m => buckets[m]), 1);
  return months.map(m => ({ label: m, cents: buckets[m], pct: (buckets[m] / max) * 100 }));
}

export default function CreatorEarnings() {
  const [entries, setEntries] = useState<RoyaltyEntry[]>([]);
  const [summary, setSummary] = useState<RoyaltySummary>({ lifetimeCents: 0, availableCents: 0, pendingCents: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get<{ entries: RoyaltyEntry[]; summary: RoyaltySummary }>('/royalties/my')
      .then(data => {
        setEntries(data.entries);
        setSummary(data.summary);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const chartData = buildMonthlyChart(entries);

  const statusBadge = (status: string) => {
    if (status === 'transferred') return 'bg-neon-lime/20 text-neon-lime';
    if (status === 'transfer_failed') return 'bg-red-500/20 text-red-400';
    return 'bg-yellow-400/20 text-yellow-400';
  };

  const statusLabel = (status: string) => {
    if (status === 'transferred') return 'Paid';
    if (status === 'transfer_failed') return 'Failed';
    return 'Pending';
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-text-primary mb-2">Earnings</h1>
        <p className="text-text-secondary">Track your sales, royalties, and payouts</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 mb-6">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-void-light border border-white/5 rounded-xl p-6"
        >
          <div className="w-10 h-10 rounded-lg bg-neon-cyan/10 flex items-center justify-center mb-4">
            <DollarSign className="w-5 h-5 text-neon-cyan" />
          </div>
          <p className="text-text-muted text-sm mb-1">Lifetime Earnings</p>
          <p className="font-heading text-2xl font-bold text-text-primary">
            {loading ? '—' : formatPrice(summary.lifetimeCents)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-void-light border border-white/5 rounded-xl p-6"
        >
          <div className="w-10 h-10 rounded-lg bg-neon-lime/10 flex items-center justify-center mb-4">
            <TrendingUp className="w-5 h-5 text-neon-lime" />
          </div>
          <p className="text-text-muted text-sm mb-1">Transferred</p>
          <p className="font-heading text-2xl font-bold text-neon-lime">
            {loading ? '—' : formatPrice(summary.availableCents)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-void-light border border-white/5 rounded-xl p-6"
        >
          <div className="w-10 h-10 rounded-lg bg-neon-violet/10 flex items-center justify-center mb-4">
            <TrendingDown className="w-5 h-5 text-neon-violet" />
          </div>
          <p className="text-text-muted text-sm mb-1">Pending Transfer</p>
          <p className="font-heading text-2xl font-bold text-text-primary">
            {loading ? '—' : formatPrice(summary.pendingCents)}
          </p>
        </motion.div>
      </div>

      {/* Earnings Chart */}
      <div className="bg-void-light border border-white/5 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-lg font-bold text-text-primary">Earnings Overview</h2>
          <Button variant="outline" size="sm" className="border-white/20" disabled>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>

        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-white/30" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-text-muted text-sm">
            No earnings data yet
          </div>
        ) : (
          <div className="h-48 flex items-end gap-4">
            {chartData.map(d => (
              <div key={d.label} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-gradient-to-t from-neon-cyan/50 to-neon-cyan rounded-t-lg transition-all hover:from-neon-cyan hover:to-neon-cyan"
                  style={{ height: `${Math.max(d.pct, 4)}%` }}
                />
                <span className="text-xs text-text-muted mt-2">{d.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Royalty Ledger */}
      <div className="bg-void-light border border-white/5 rounded-xl p-6">
        <h2 className="font-heading text-lg font-bold text-text-primary mb-6">Royalty Ledger</h2>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-white/30" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-text-muted text-sm py-6 text-center">No royalty entries yet. Earnings appear here when assets sell.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3 text-text-muted font-medium text-sm">Asset</th>
                  <th className="text-left px-4 py-3 text-text-muted font-medium text-sm">Reason</th>
                  <th className="text-left px-4 py-3 text-text-muted font-medium text-sm">Amount</th>
                  <th className="text-left px-4 py-3 text-text-muted font-medium text-sm">Status</th>
                  <th className="text-left px-4 py-3 text-text-muted font-medium text-sm">Date</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <tr key={entry.id} className="border-b border-white/5 last:border-b-0">
                    <td className="px-4 py-4 text-text-primary text-sm">{entry.assetTitle}</td>
                    <td className="px-4 py-4 text-text-secondary text-sm">{entry.reason}</td>
                    <td className="px-4 py-4 font-heading font-bold text-neon-cyan">
                      {formatPrice(entry.amount)}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadge(entry.status)}`}>
                        {statusLabel(entry.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-text-secondary text-sm">{formatDate(entry.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
