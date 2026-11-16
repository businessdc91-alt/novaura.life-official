import type { Asset, LicenseTier, User } from '@/types';
import { getLicenseSpecificTerms } from '@/legal/eulaBoilerplate';

/**
 * Checkout Payload Interface
 * This is the legal ledger record sent to the database
 */
export interface CheckoutPayload {
  // Transaction Identifiers
  transactionId: string;
  userId: string;
  assetId: string;
  creatorId: string;
  
  // Timestamp (ISO 8601 format)
  timestamp: string;
  
  // Clickwrap Agreement Status
  clickwrapAccepted: boolean;
  clickwrapAcceptedAt: string;
  
  // Digital Signature
  signatureName: string;
  signatureMethod: 'typed_name';
  
  // License Terms
  licenseTier: LicenseTier;
  royaltyPercentage: number;
  licenseTermsVersion: string;
  
  // Payment Information
  purchasePrice: number;
  currency: string;
  platformFee: number;
  royaltyAmount: number;
  creatorPayout: number;
  
  // Technical Metadata
  userAgent: string;
  ipAddress?: string;
  referrer?: string;
  
  // Agreement Reference
  agreementId: string;
  agreementHash: string;
  
  // Status
  status: 'pending' | 'completed' | 'failed' | 'refunded';
}

/**
 * Purchase Record Interface
 * Stored in database for legal and audit purposes
 */
export interface PurchaseRecord {
  // Primary Keys
  id: string;
  orderId: string;
  
  // Parties
  buyerId: string;
  buyerEmail: string;
  sellerId: string;
  sellerEmail: string;
  
  // Asset Info
  assetId: string;
  assetTitle: string;
  assetSlug: string;
  
  // Financial
  purchasePrice: number;
  platformFee: number;
  royaltyRate: number;
  royaltyOwed: number;
  sellerPayout: number;
  currency: string;
  
  // Legal Agreement
  licenseTier: LicenseTier;
  agreementId: string;
  agreementVersion: string;
  agreementAccepted: boolean;
  agreementAcceptedAt: string;
  signatureName: string;
  signatureHash: string;
  fullAgreementText: string;
  
  // Audit Trail
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  ipAddress?: string;
  userAgent: string;
  
  // Status
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  downloadStatus: 'locked' | 'available' | 'downloaded';
  
  // Royalty Tracking
  royaltyPayments: RoyaltyPaymentRecord[];
}

export interface RoyaltyPaymentRecord {
  id: string;
  period: string; // e.g., "2026-Q1"
  amount: number;
  status: 'pending' | 'paid' | 'overdue';
  dueDate: string;
  paidAt?: string;
  reportedRevenue?: number;
}

/**
 * Generate unique transaction ID
 */
export const generateTransactionId = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN-${timestamp}-${random}`;
};

/**
 * Generate agreement ID
 */
export const generateAgreementId = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `AGR-${timestamp}-${random}`;
};

/**
 * Simple hash function for agreement verification
 * In production, use a proper cryptographic hash
 */
export const generateAgreementHash = (payload: CheckoutPayload): string => {
  const data = `${payload.userId}:${payload.assetId}:${payload.timestamp}:${payload.signatureName}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(16, '0');
};

/**
 * Build the checkout payload
 * This constructs the JSON payload sent to the database
 */
export interface BuildCheckoutPayloadParams {
  user: User;
  asset: Asset;
  signatureName: string;
  clickwrapAccepted: boolean;
  ipAddress?: string;
  referrer?: string;
}

export const buildCheckoutPayload = ({
  user,
  asset,
  signatureName,
  clickwrapAccepted,
  ipAddress,
  referrer,
}: BuildCheckoutPayloadParams): CheckoutPayload => {
  const now = new Date();
  const licenseTerms = getLicenseSpecificTerms(asset.licenseTier);
  
  // Calculate financials
  const purchasePrice = asset.price;
  const platformFee = Math.round(purchasePrice * 0.10); // 10% platform fee
  const royaltyAmount = Math.round(purchasePrice * (licenseTerms.royaltyPercentage / 100));
  const creatorPayout = purchasePrice - platformFee - royaltyAmount;
  
  const payload: CheckoutPayload = {
    // Transaction Identifiers
    transactionId: generateTransactionId(),
    userId: user.id,
    assetId: asset.id,
    creatorId: asset.creatorId,
    
    // Timestamp
    timestamp: now.toISOString(),
    
    // Clickwrap Agreement
    clickwrapAccepted,
    clickwrapAcceptedAt: now.toISOString(),
    
    // Digital Signature
    signatureName: signatureName.trim(),
    signatureMethod: 'typed_name',
    
    // License Terms
    licenseTier: asset.licenseTier,
    royaltyPercentage: licenseTerms.royaltyPercentage,
    licenseTermsVersion: '1.0.0',
    
    // Payment Information
    purchasePrice,
    currency: 'USD',
    platformFee,
    royaltyAmount,
    creatorPayout,
    
    // Technical Metadata
    userAgent: navigator.userAgent,
    ipAddress,
    referrer,
    
    // Agreement Reference
    agreementId: generateAgreementId(),
    agreementHash: '', // Will be set after construction
    
    // Status
    status: 'pending',
  };
  
  // Generate hash after all other fields are set
  payload.agreementHash = generateAgreementHash(payload);
  
  return payload;
};

/**
 * Build complete purchase record for database storage
 */
export const buildPurchaseRecord = ({
  user,
  asset,
  signatureName,
  clickwrapAccepted,
  ipAddress,
  fullAgreementText,
}: BuildCheckoutPayloadParams & { fullAgreementText: string }): PurchaseRecord => {
  const now = new Date();
  const licenseTerms = getLicenseSpecificTerms(asset.licenseTier);
  const transactionId = generateTransactionId();
  const agreementId = generateAgreementId();
  
  const purchasePrice = asset.price;
  const platformFee = Math.round(purchasePrice * 0.10);
  const royaltyOwed = Math.round(purchasePrice * (licenseTerms.royaltyPercentage / 100));
  const sellerPayout = purchasePrice - platformFee - royaltyOwed;
  
  // Generate signature hash
  const sigData = `${user.id}:${asset.id}:${now.toISOString()}:${signatureName}`;
  let sigHash = 0;
  for (let i = 0; i < sigData.length; i++) {
    const char = sigData.charCodeAt(i);
    sigHash = ((sigHash << 5) - sigHash) + char;
    sigHash = sigHash & sigHash;
  }
  const signatureHash = Math.abs(sigHash).toString(16).toUpperCase().padStart(16, '0');
  
  return {
    id: transactionId,
    orderId: `ORD-${transactionId.split('-')[1]}`,
    
    buyerId: user.id,
    buyerEmail: user.email,
    sellerId: asset.creatorId,
    sellerEmail: asset.creator?.email || '',
    
    assetId: asset.id,
    assetTitle: asset.title,
    assetSlug: asset.slug,
    
    purchasePrice,
    platformFee,
    royaltyRate: licenseTerms.royaltyPercentage,
    royaltyOwed,
    sellerPayout,
    currency: 'USD',
    
    licenseTier: asset.licenseTier,
    agreementId,
    agreementVersion: '1.0.0',
    agreementAccepted: clickwrapAccepted,
    agreementAcceptedAt: now.toISOString(),
    signatureName: signatureName.trim(),
    signatureHash,
    fullAgreementText,
    
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ipAddress,
    userAgent: navigator.userAgent,
    
    paymentStatus: 'pending',
    downloadStatus: 'locked',
    
    royaltyPayments: [],
  };
};

/**
 * Submit checkout to backend
 * This function sends the payload to your database
 */
export interface CheckoutResponse {
  success: boolean;
  transactionId?: string;
  orderId?: string;
  error?: string;
  paymentIntent?: any; // Stripe payment intent
}

const API_BASE = import.meta.env.VITE_BACKEND_URL || '/api';

export const submitCheckout = async (
  payload: CheckoutPayload
): Promise<CheckoutResponse> => {
  try {
    // Call the real Stripe checkout backend
    const response = await fetch(`${API_BASE}/stripe/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: payload.userId,
        items: [{
          asset: {
            id: payload.assetId,
            title: payload.transactionId, // populated upstream
            price: payload.purchasePrice,
            creatorId: payload.creatorId,
            type: 'asset',
          },
          customPrice: payload.purchasePrice,
        }],
        checkoutPayload: payload,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      return { success: false, error: err.error || 'Checkout failed' };
    }

    const data = await response.json();

    // Backend returns a Stripe Checkout URL — redirect user
    if (data.url) {
      window.location.href = data.url;
      return { success: true, transactionId: payload.transactionId };
    }

    return { success: true, transactionId: payload.transactionId, orderId: data.orderId };
  } catch (error: any) {
    console.error('[Checkout] Failed to reach backend:', error);
    return { success: false, error: error.message || 'Network error' };
  }
};

/**
 * Get transaction by ID
 */
export const getTransaction = (transactionId: string): CheckoutPayload | null => {
  const transactions = JSON.parse(kernelStorage.getItem('novaura_transactions') || '[]');
  return transactions.find((t: CheckoutPayload) => t.transactionId === transactionId) || null;
};

/**
 * Get all transactions for a user
 */
export const getUserTransactions = (userId: string): CheckoutPayload[] => {
  const transactions = JSON.parse(kernelStorage.getItem('novaura_transactions') || '[]');
  return transactions.filter((t: CheckoutPayload) => t.userId === userId);
};

/**
 * Get royalty obligations for a user
 * Returns all purchases where user owes royalties
 */
export const getUserRoyaltyObligations = (userId: string): CheckoutPayload[] => {
  const transactions = getUserTransactions(userId);
  return transactions.filter(t => t.royaltyPercentage > 0);
};

/**
 * Calculate total royalties owed by a user
 */
export const calculateTotalRoyaltiesOwed = (userId: string): number => {
  const obligations = getUserRoyaltyObligations(userId);
  return obligations.reduce((total, t) => total + t.royaltyAmount, 0);
};

/**
 * Generate royalty report for audit purposes
 */
export interface RoyaltyReport {
  reportId: string;
  userId: string;
  generatedAt: string;
  period?: string;
  totalPurchases: number;
  totalRoyaltiesOwed: number;
  totalRoyaltiesPaid: number;
  outstandingBalance: number;
  assets: Array<{
    assetId: string;
    assetTitle: string;
    creatorName: string;
    royaltyRate: number;
    purchasePrice: number;
    royaltyOwed: number;
    purchaseDate: string;
  }>;
}

export const generateRoyaltyReport = (userId: string): RoyaltyReport => {
  const obligations = getUserRoyaltyObligations(userId);
  
  return {
    reportId: `RPT-${Date.now().toString(36).toUpperCase()}`,
    userId,
    generatedAt: new Date().toISOString(),
    totalPurchases: obligations.length,
    totalRoyaltiesOwed: obligations.reduce((sum, t) => sum + t.royaltyAmount, 0),
    totalRoyaltiesPaid: 0, // Would come from payment records
    outstandingBalance: obligations.reduce((sum, t) => sum + t.royaltyAmount, 0),
    assets: obligations.map(t => ({
      assetId: t.assetId,
      assetTitle: '', // Would need to lookup asset
      creatorName: '', // Would need to lookup creator
      royaltyRate: t.royaltyPercentage,
      purchasePrice: t.purchasePrice,
      royaltyOwed: t.royaltyAmount,
      purchaseDate: t.timestamp,
    })),
  };
};
