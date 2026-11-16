import type { Asset, RoyaltyLedger, LicenseTier } from '@/types';
import { getAssetById } from './marketService';

/**
 * Service to handle the "Fair Creator Stake" logic.
 * Automatically calculates revenue splits for foundation builders and collaborators.
 */

// Helper to get royalty percentage from license tier based on user request logic
export const getRoyaltyFromTier = (tier: LicenseTier): number => {
  switch (tier) {
    case 'art_3pct': return 3.0;
    case 'music_1pct': return 1.0;
    case 'integration_10pct': return 10.0;
    case 'functional_15pct': return 15.0;
    case 'source_20pct': return 20.0;
    case 'opensource': return 0;
    default: return 0;
  }
};

/**
 * Recursively calculates the full revenue breakdown for an asset sale.
 * Supports "Foundation Royalties" where original creators get a cut of derivative works.
 */
export const calculateRevenueSplits = async (
  asset: Asset, 
  salePrice: number
): Promise<RoyaltyLedger[]> => {
  const ledger: RoyaltyLedger[] = [];
  const orderId = `order_${Date.now()}`;

  // 1. Platform Fee (Fixed 10%)
  const platformFeePercentage = 10.0;
  const platformFeeAmount = Math.round(salePrice * (platformFeePercentage / 100));
  const remainingPot = salePrice - platformFeeAmount;

  ledger.push({
    id: `split_platform_${Date.now()}`,
    orderId,
    recipientId: 'novAura_treasury',
    amount: platformFeeAmount,
    percentageUsed: platformFeePercentage,
    reason: "Platform Maintenance & Infrastructure (10%)",
    createdAt: new Date().toISOString(),
  });

  // 2. Collect all potential splits (Foundations and Collaborators)
  const initialSplits: { recipientId: string, percentage: number, reason: string }[] = [];
  
  // Foundations
  if (asset.foundationAssets && asset.foundationAssets.length > 0) {
    for (const foundationId of asset.foundationAssets) {
      const foundation = await getAssetById(foundationId);
      if (foundation) {
        const royaltyPercent = getRoyaltyFromTier(foundation.licenseTier);
        if (royaltyPercent > 0) {
          initialSplits.push({
            recipientId: foundation.creatorId,
            percentage: royaltyPercent,
            reason: `Foundation Royalty: ${foundation.title}`
          });
        }
      }
    }
  }

  // Collaborators
  if (asset.revenueSplits && asset.revenueSplits.length > 0) {
    for (const split of asset.revenueSplits) {
      initialSplits.push({
        recipientId: split.userId,
        percentage: split.percentage,
        reason: `${split.role === 'original_creator' ? 'Original Creator' : 'Collaborator'} Share`
      });
    }
  }

  // 3. Calculate Cap (Max 50% for external parties, calculated against the REMAINING pot)
  const totalExternalPercentage = initialSplits.reduce((acc, s) => acc + s.percentage, 0);
  const scalingFactor = totalExternalPercentage > 50 ? 50 / totalExternalPercentage : 1;

  // 4. Generate Ledger entries with scaling
  for (const split of initialSplits) {
    const scaledPercentage = split.percentage * scalingFactor;
    const amount = Math.round(remainingPot * (scaledPercentage / 100)); // Payout from pot after platform fee
    
    ledger.push({
      id: `split_${Math.random().toString(36).substr(2, 9)}`,
      orderId,
      recipientId: split.recipientId,
      amount,
      percentageUsed: Number(scaledPercentage.toFixed(2)),
      reason: `${split.reason} (${scaledPercentage.toFixed(1)}%${scalingFactor < 1 ? ' scaled' : ''})`,
      createdAt: new Date().toISOString(),
    });
  }

  // 5. Main Creator gets the guaranteed remainder of the pot
  const mainCreatorAmount = remainingPot - (ledger.filter(l => l.recipientId !== 'novAura_treasury').reduce((acc, l) => acc + l.amount, 0));
  const mainCreatorPercentage = (mainCreatorAmount / salePrice) * 100;

  if (mainCreatorAmount > 0) {
    ledger.push({
      id: `split_main_${Date.now()}`,
      orderId,
      recipientId: asset.creatorId,
      amount: mainCreatorAmount,
      percentageUsed: Number(mainCreatorPercentage.toFixed(2)),
      reason: "Asset Creator Share (Guaranteed Stake)",
      createdAt: new Date().toISOString(),
    });
  }

  return ledger;
};

/**
 * Traces the lineage of an asset back to all its foundation builders.
 * Useful for transparency in the Checkout UI.
 */
export const getAssetLineage = async (asset: Asset): Promise<Asset[]> => {
  const lineage: Asset[] = [];
  if (!asset.foundationAssets) return lineage;

  for (const id of asset.foundationAssets) {
    const foundation = await getAssetById(id);
    if (foundation) {
      lineage.push(foundation);
      // Optional: Recurse if foundations have foundations
      // const deeperLineage = await getAssetLineage(foundation);
      // lineage.push(...deeperLineage);
    }
  }
  return lineage;
};
