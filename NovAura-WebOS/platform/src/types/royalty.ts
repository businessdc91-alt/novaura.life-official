import { User } from './user';
import { Asset, LicenseTier } from './asset';

export type OrderStatus = 'pending' | 'completed' | 'refunded' | 'cancelled';
export type RoyaltyStatus = 'pending' | 'available' | 'paid' | 'held';

export interface RoyaltyLedger {
  id: string;
  orderId: string;
  recipientId: string;
  amount: number;
  percentageUsed: number;
  reason: string;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  assetId: string;
  asset?: Asset;
  pricePaid: number;
  royaltyAmount: number;
  licenseType: LicenseTier;
  downloadUrl?: string;
  downloadExpiresAt?: string;
  revenueBreakdown?: RoyaltyLedger[];
  createdAt: string;
}

export interface Order {
  id: string;
  buyerId: string;
  buyer?: User;
  items: OrderItem[];
  totalAmount: number;
  platformFee: number;
  status: OrderStatus;
  stripePaymentIntentId?: string;
  createdAt: string;
  completedAt?: string;
}

export interface Royalty {
  id: string;
  creatorId: string;
  assetId: string;
  asset?: Asset;
  orderId: string;
  amount: number;
  status: RoyaltyStatus;
  paidAt?: string;
  stripeTransferId?: string;
  createdAt: string;
}

export interface CreatorStats {
  totalAssets: number;
  totalSales: number;
  totalDownloads: number;
  totalEarnings: number;
  pendingRoyalties: number;
  availableRoyalties: number;
  lifetimeRoyalties: number;
}
