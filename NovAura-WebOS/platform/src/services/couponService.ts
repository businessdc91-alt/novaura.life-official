// Coupon/Discount System Service
// Handles client-side validation and backend integration for promo codes

export interface Cart {
  subtotal: number;
  items: Array<{
    id: string;
    categoryId?: string;
    price: number;
  }>;
}

export interface Coupon {
  code: string;
  type: 'percentage' | 'fixed';
  value: number; // percentage (20 = 20%) or fixed amount in cents
  minPurchase?: number; // minimum subtotal required (in cents)
  maxDiscount?: number; // maximum discount for percentage (in cents)
  expiresAt?: string;
  usageLimit?: number;
  usageCount: number;
  applicableTo: 'all' | 'category' | 'asset';
  applicableIds?: string[]; // category IDs or asset IDs
}

export interface CouponResult {
  valid: boolean;
  coupon?: Coupon;
  discountAmount: number;
  finalTotal: number;
  error?: string;
}

// In-memory coupon store — populated by admin at runtime, empty until then
export const MOCK_COUPONS: Coupon[] = [];

// In-memory storage for applied coupon (per session)
let appliedCoupon: Coupon | null = null;

/**
 * Format coupon code (uppercase, trim whitespace)
 */
export function formatCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Calculate discount amount based on coupon type and subtotal
 */
export function calculateDiscount(coupon: Coupon, subtotal: number): number {
  let discount = 0;

  if (coupon.type === 'percentage') {
    // Calculate percentage discount (value is already in percent, e.g., 20 = 20%)
    discount = Math.round((subtotal * coupon.value) / 100);
    
    // Apply max discount cap if set
    if (coupon.maxDiscount && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount;
    }
  } else {
    // Fixed amount discount
    discount = coupon.value;
  }

  // Ensure discount doesn't exceed subtotal
  return Math.min(discount, subtotal);
}

/**
 * Check if coupon is applicable to cart items
 */
function isApplicableToCart(coupon: Coupon, cart: Cart): boolean {
  if (coupon.applicableTo === 'all') {
    return true;
  }

  // For category-specific coupons
  if (coupon.applicableTo === 'category' && coupon.applicableIds) {
    return cart.items.some(item => 
      item.categoryId && coupon.applicableIds!.includes(item.categoryId)
    );
  }

  // For asset-specific coupons
  if (coupon.applicableTo === 'asset' && coupon.applicableIds) {
    return cart.items.some(item => 
      coupon.applicableIds!.includes(item.id)
    );
  }

  return false;
}

/**
 * Validate a coupon code against cart and business rules
 */
export async function validateCoupon(
  code: string,
  cart: Cart
): Promise<CouponResult> {
  const formattedCode = formatCouponCode(code);

  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Find coupon in mock data (in production, this would be an API call)
  const coupon = MOCK_COUPONS.find(c => c.code === formattedCode);

  // Coupon doesn't exist
  if (!coupon) {
    return {
      valid: false,
      discountAmount: 0,
      finalTotal: cart.subtotal,
      error: 'Invalid coupon code. Please check and try again.',
    };
  }

  // Check expiration
  if (coupon.expiresAt) {
    const expiryDate = new Date(coupon.expiresAt);
    if (expiryDate < new Date()) {
      return {
        valid: false,
        coupon,
        discountAmount: 0,
        finalTotal: cart.subtotal,
        error: 'This coupon has expired.',
      };
    }
  }

  // Check usage limit
  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
    return {
      valid: false,
      coupon,
      discountAmount: 0,
      finalTotal: cart.subtotal,
      error: 'This coupon has reached its usage limit.',
    };
  }

  // Check minimum purchase requirement
  if (coupon.minPurchase && cart.subtotal < coupon.minPurchase) {
    const minAmount = (coupon.minPurchase / 100).toFixed(2);
    return {
      valid: false,
      coupon,
      discountAmount: 0,
      finalTotal: cart.subtotal,
      error: `Minimum purchase of $${minAmount} required for this coupon.`,
    };
  }

  // Check applicability to cart items
  if (!isApplicableToCart(coupon, cart)) {
    return {
      valid: false,
      coupon,
      discountAmount: 0,
      finalTotal: cart.subtotal,
      error: 'This coupon is not applicable to items in your cart.',
    };
  }

  // Calculate discount
  const discountAmount = calculateDiscount(coupon, cart.subtotal);
  const finalTotal = cart.subtotal - discountAmount;

  return {
    valid: true,
    coupon,
    discountAmount,
    finalTotal,
  };
}

/**
 * Apply a coupon to the current session
 */
export function applyCoupon(coupon: Coupon): void {
  appliedCoupon = coupon;
  // In production, this would also sync with backend/session storage
}

/**
 * Remove the applied coupon
 */
export function removeCoupon(): void {
  appliedCoupon = null;
  // In production, this would also sync with backend/session storage
}

/**
 * Get the currently applied coupon
 */
export function getAppliedCoupon(): Coupon | null {
  return appliedCoupon;
}

/**
 * Format discount for display
 */
export function formatDiscountDisplay(coupon: Coupon): string {
  if (coupon.type === 'percentage') {
    return `${coupon.value}% off`;
  } else {
    const amount = (coupon.value / 100).toFixed(2);
    return `$${amount} off`;
  }
}

/**
 * Format currency for display
 */
export function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Get suggested/common coupons for display
 */
export function getSuggestedCoupons(): string[] {
  return [];
}

// Default export for convenience
export default {
  validateCoupon,
  applyCoupon,
  removeCoupon,
  getAppliedCoupon,
  calculateDiscount,
  formatCouponCode,
  formatDiscountDisplay,
  formatCurrency,
  getSuggestedCoupons,
  MOCK_COUPONS,
};
