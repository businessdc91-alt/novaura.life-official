// User Types
export type UserRole = 'buyer' | 'creator' | 'moderator' | 'admin';
export type MembershipTier = 'free' | 'spark' | 'emergent' | 'catalyst' | 'nova' | 'catalytic-crew';

export interface UserPreferences {
  showNsfw: boolean;
  ageVerified: boolean;
  ageVerifiedAt?: string;
  emailNotifications: boolean;
  marketingEmails: boolean;
  publicProfile: boolean;
  showActivity: boolean;
}

export interface HardwareSpecs {
  gpu?: string;
  cpu?: string;
  ram?: string;
  os?: string;
  monitor?: string;
  peripherals?: string[];
  notes?: string;
}

export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  thumbnailUrl: string;
  screenshotUrls: string[];
  projectUrl?: string;
  websiteUrl?: string;
  liveDemoUrl?: string;
  createdAt: string;
}

export type EngineType = 'unity' | 'unreal' | 'godot' | 'web' | 'other';

export interface User {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  avatar?: string;
  bio?: string;
  location?: string;
  website?: string;
  twitter?: string;
  github?: string;
  discord?: string;
  youtube?: string;
  instagram?: string;
  twitch?: string;
  tiktok?: string;
  linkedin?: string;
  preferences?: UserPreferences;
  createdAt: string;
  updatedAt: string;
  stripeAccountId?: string;
  stripeConnectStatus?: 'pending' | 'active' | 'inactive';
  stripeSubscriptionId?: string;
  subscriptionStatus?: 'active' | 'past_due' | 'canceled' | 'unpaid' | string;
  isOnline?: boolean;
  lastSeen?: string;
  purchasedAssetIds?: string[];
  status?: 'active' | 'inactive' | 'banned' | 'suspended';
  hardwareSpecs?: HardwareSpecs;
  portfolio?: PortfolioItem[];
  favoriteEngines?: EngineType[];
  skills?: string[];
  followerCount?: number;
  followingCount?: number;
  consciousnessCoins?: number;
  isSubscriber?: boolean;
  lastDailyClaim?: string;
  rank?: string;
  badges?: string[];
  membershipTier?: MembershipTier;
  trainingConsentGiven?: boolean;
  trainingConsentAt?: string;
  trainingConsentVersion?: string;
  portfolioUrl?: string;
  toolset?: string;
  creatorBio?: string;
  shares?: number;
  equityTier?: 'Series A' | 'Series B' | 'Founding';
  actionTokens?: number;
}

export interface FollowedCreator {
  userId: string;
  username: string;
  avatar?: string;
  followedAt: string;
}
