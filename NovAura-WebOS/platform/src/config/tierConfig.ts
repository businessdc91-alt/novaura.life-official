import type { AIProvider } from '../stores/aiStore';

// ── Membership Tiers ──────────────────────────────────────────────────────────
export type MembershipTier = 'free' | 'spark' | 'emergent' | 'catalyst' | 'nova' | 'catalytic-crew';

export interface TierDefinition {
  id: MembershipTier;
  name: string;
  price: number; // USD/month
  creditsPerDay: number;        // Daily credits (API calls)
  creditsPerMonth: number;      // Monthly credit cap
  canBringOwnKeys: boolean;
  localAIUnlimited: boolean;    // Local AI is always free
  webOS: false | 'limited' | true;
  priorityInference: boolean;
  liveSupport: boolean;
  catalystBadge: boolean;
  exhaustiveResearchPerMonth: number;
  color: string;
  accentColor: string;
}

export const TIER_CONFIG: Record<MembershipTier, TierDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    creditsPerDay: 7,
    creditsPerMonth: 20,
    canBringOwnKeys: false,
    localAIUnlimited: false,
    webOS: false,
    priorityInference: false,
    liveSupport: false,
    catalystBadge: false,
    exhaustiveResearchPerMonth: 0,
    color: 'text-white/80',
    accentColor: '#e5e7eb',
  },
  spark: {
    id: 'spark',
    name: 'Spark',
    price: 9.99,
    creditsPerDay: 30,
    creditsPerMonth: 100,
    canBringOwnKeys: false,
    localAIUnlimited: true,
    webOS: 'limited',
    priorityInference: false,
    liveSupport: false,
    catalystBadge: false,
    exhaustiveResearchPerMonth: 0,
    color: 'text-cyan-400',
    accentColor: '#22d3ee',
  },
  emergent: {
    id: 'emergent',
    name: 'Emergent',
    price: 17.99,
    creditsPerDay: 100,
    creditsPerMonth: 250,
    canBringOwnKeys: false,
    localAIUnlimited: true,
    webOS: true,
    priorityInference: false,
    liveSupport: false,
    catalystBadge: false,
    exhaustiveResearchPerMonth: 0,
    color: 'text-fuchsia-400',
    accentColor: '#e879f9',
  },
  catalyst: {
    id: 'catalyst',
    name: 'Catalyst',
    price: 29.99,
    creditsPerDay: 250,
    creditsPerMonth: 500,
    canBringOwnKeys: true,
    localAIUnlimited: true,
    webOS: true,
    priorityInference: true,
    liveSupport: true,
    catalystBadge: true,
    exhaustiveResearchPerMonth: 1,
    color: 'text-amber-400',
    accentColor: '#fbbf24',
  },
  nova: {
    id: 'nova',
    name: 'Nova',
    price: 75.00,
    creditsPerDay: 500,
    creditsPerMonth: 750,
    canBringOwnKeys: true,
    localAIUnlimited: true,
    webOS: true,
    priorityInference: true,
    liveSupport: true,
    catalystBadge: true,
    exhaustiveResearchPerMonth: 2,
    color: 'text-rose-400',
    accentColor: '#f43f5e',
  },
  'catalytic-crew': {
    id: 'catalytic-crew',
    name: 'Catalytic Crew',
    price: 349.99,
    creditsPerDay: 1000,
    creditsPerMonth: 5000,
    canBringOwnKeys: true,
    localAIUnlimited: true,
    webOS: true,
    priorityInference: true,
    liveSupport: true,
    catalystBadge: true,
    exhaustiveResearchPerMonth: 5,
    color: 'text-indigo-400',
    accentColor: '#818cf8',
  },
};

// ── Credit Pack Pricing ───────────────────────────────────────────────────────
// Simple: 1 credit = 1 API call (but BuilderBot uses multiple calls internally)
export const CREDIT_PACKS = [
  { credits: 10, price: 5 },
  { credits: 25, price: 10 },
  { credits: 60, price: 20 },
  { credits: 150, price: 50 },
];

// ── Simple costs: 1 credit = 1 token/API call ─────────────────────────────────
export const BASE_COSTS = {
  // Simple system: each API call costs 1 credit
  chatMessage: 1,
  imageGen: 3,
  imageEdit: 1,
  videoGen: 10,
};

// ── Free AI Providers ─────────────────────────────────────────────────────────
// Local AI (Ollama, LM Studio) and Gemini are free for conversation
export function isLocalAI(provider: AIProvider): boolean {
  return provider === 'ollama' || provider === 'lmstudio' || provider === 'huggingface' || provider === 'gemini';
}

/** Cost label - simple */
export function costLabel(provider: AIProvider): string {
  if (isLocalAI(provider)) return 'FREE';
  return '1 credit/call';
}

/** Check if provider is free for chat */
export function isFreeProvider(provider: AIProvider): boolean {
  return isLocalAI(provider);
}

// Legacy exports for compatibility
export function builderBotCost(provider: AIProvider): number {
  if (isLocalAI(provider)) return 0;
  return 1; // 1 credit per call
}

export function providerCostLabel(provider: AIProvider): string {
  return costLabel(provider);
}
