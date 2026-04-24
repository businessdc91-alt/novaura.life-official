/**
 * Stripe Service - Client-side Stripe integration
 * Creates checkout sessions and handles subscription flows
 */

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || '/api';

/**
 * Create a Stripe checkout session for subscription
 * @param {string} userId - Firebase user ID
 * @param {string} planId - Plan ID (spark, emergent, catalyst, nova, catalytic-crew)
 * @returns {Promise<{url: string}>} Stripe checkout URL
 */
export async function createSubscriptionCheckout(userId, planId) {
  const planToPriceMap = {
    'spark': { price: 999, name: 'Spark Membership' },
    'emergent': { price: 1799, name: 'Emergent Membership' },
    'catalyst': { price: 2999, name: 'Catalyst Membership' },
    'nova': { price: 7500, name: 'Nova Membership' },
    'catalytic-crew': { price: 34999, name: 'Catalytic Crew Membership' },
    // Founders Tiers (One-time Passes)
    'founding-spark': { price: 7500, name: 'Founding Spark Pass' },
    'founding-catalyst': { price: 25000, name: 'Founding Catalyst Pass' },
    'founding-nova': { price: 50000, name: 'Founding Nova Pass' },
    'catalyst-crew-founders': { price: 1000000, name: 'Catalyst Crew Founders' },
    'strategic-investor': { price: 2500000, name: 'Strategic Investor' },
  };

  const plan = planToPriceMap[planId];
  if (!plan) {
    throw new Error(`Unknown plan: ${planId}`);
  }

  const response = await fetch(`${API_BASE_URL}/stripe/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      items: [{
        asset: {
          id: `membership-${planId}`,
          title: plan.name,
          shortDescription: `NovAura ${plan.name} - Monthly Subscription`,
          price: plan.price,
          type: 'subscription',
        },
      }],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create checkout session');
  }

  return response.json();
}

/**
 * Verify a completed checkout session
 * @param {string} sessionId - Stripe checkout session ID
 */
export async function verifyCheckoutSession(sessionId) {
  const response = await fetch(`${API_BASE_URL}/stripe/session/${sessionId}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to verify session');
  }

  return response.json();
}

/**
 * Get current user's subscription status
 * @param {string} userId - Firebase user ID
 */
export async function getSubscriptionStatus(userId) {
  // This would fetch from your Firestore or a dedicated endpoint
  // For now, we'll return the local state from Firebase
  const { getDoc, doc } = await import('firebase/firestore');
  const { db } = await import('../config/firebase');
  
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) return { tier: 'free', status: 'inactive' };
  
  const data = userDoc.data();
  return {
    tier: data.membershipTier || 'free',
    status: data.subscriptionStatus || 'inactive',
    subscriptionId: data.stripeSubscriptionId || null,
  };
}

/**
 * Cancel subscription
 * @param {string} subscriptionId - Stripe subscription ID
 */
export async function cancelSubscription(subscriptionId) {
  const response = await fetch(`${API_BASE_URL}/stripe/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subscriptionId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to cancel subscription');
  }

  return response.json();
}

/**
 * Update subscription tier
 * @param {string} subscriptionId - Current Stripe subscription ID
 * @param {string} newPlanId - New plan ID to upgrade/downgrade to
 */
export async function updateSubscription(subscriptionId, newPlanId) {
  const planToPriceMap = {
    'spark': { price: 999, name: 'Spark Membership' },
    'emergent': { price: 1799, name: 'Emergent Membership' },
    'catalyst': { price: 2999, name: 'Catalyst Membership' },
    'nova': { price: 7500, name: 'Nova Membership' },
    'catalytic-crew': { price: 34999, name: 'Catalytic Crew Membership' },
  };

  const plan = planToPriceMap[newPlanId];
  if (!plan) {
    throw new Error(`Unknown plan: ${newPlanId}`);
  }

  const response = await fetch(`${API_BASE_URL}/stripe/update-subscription`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subscriptionId,
      newPlanId,
      newPrice: plan.price,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update subscription');
  }

  return response.json();
}

/**
 * Create a Stripe checkout session for a one-time Founders Pass purchase
 * @param {string} userId - Firebase user ID (optional for guest, but preferred)
 * @param {string} tierId - Tier ID (founding-spark, founding-catalyst, founding-nova)
 * @param {string} email - User email for guest checkout
 * @returns {Promise<{url: string}>} Stripe checkout URL
 */
export async function createOneTimeCheckout(userId, tierId, email = null) {
  const tierToPriceMap = {
    'founding-spark': { price: 7500, name: 'Founding Spark Pass', shares: 5, claimDate: 'August 10, 2026' },
    'founding-catalyst': { price: 25000, name: 'Founding Catalyst Pass', shares: 30, claimDate: 'August 10, 2026' },
    'founding-nova': { price: 50000, name: 'Founding Nova Pass', shares: 200, claimDate: 'July 15, 2026' },
    'catalyst-crew-founders': { price: 1000000, name: 'Catalyst Crew Founders', shares: 25000, claimDate: 'June 15, 2026' },
    'strategic-investor': { price: 2500000, name: 'Strategic Investor', shares: 150000, claimDate: 'June 15, 2026' },
  };

  const tier = tierToPriceMap[tierId];
  if (!tier) {
    throw new Error(`Unknown tier: ${tierId}`);
  }

  const response = await fetch(`${API_BASE_URL}/stripe/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      customerEmail: email,
      items: [{
        asset: {
          id: `founders-${tierId}`,
          title: tier.name,
          shortDescription: `NovAura ${tier.name} - Lifetime Membership + ${tier.shares} Company Shares`,
          price: tier.price,
          type: 'one-time',
        },
      }],
      metadata: {
        tier: tierId,
        type: 'founders_pass',
        shares: tier.shares.toString(),
        claimDate: tier.claimDate
      }
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create checkout session');
  }

  return response.json();
}

/**
 * Purchase additional company shares (exclusive for Nova Class or special offers)
 * @param {string} userId - Firebase user ID
 * @param {number} count - Number of shares to buy ($1 each)
 * @returns {Promise<{url: string}>} Stripe checkout URL
 */
export async function purchaseExtraShares(userId, count) {
  if (count <= 0 || count > 10000) {
    throw new Error('Invalid share count. Maximum is 10,000.');
  }

  const response = await fetch(`${API_BASE_URL}/stripe/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      items: [{
        asset: {
          id: 'extra-shares',
          title: 'NovAura Company Shares',
          shortDescription: `Purchase of ${count} additional company shares.`,
          price: count * 100, // $1.00 each in cents
          type: 'one-time',
        },
      }],
      metadata: {
        type: 'extra_shares',
        count: count.toString(),
      }
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create share purchase session');
  }

  return response.json();
}
