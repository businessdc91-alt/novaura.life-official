// Account Types & Badge System
// Foundation for gamification & MMORPG integration

export type AccountTier = 'free' | 'indie' | 'solo' | 'multi' | 'team' | 'enterprise';

export interface AccountType {
  id: AccountTier;
  name: string;
  description: string;
  maxProjects: number;
  maxStorage: number;
  maxTeamMembers: number;
  marketplaceFee: number; // Percentage kept by platform
  badgeIcon: string;
  badgeColor: string;
  auraMultiplier: number; // XP gain multiplier for gamification
  features: string[];
}

export const ACCOUNT_TYPES: Record<AccountTier, AccountType> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Get started creating',
    maxProjects: 5,
    maxStorage: 1024 * 1024 * 1024, // 1GB
    maxTeamMembers: 1,
    marketplaceFee: 30, // Platform keeps 30%
    badgeIcon: '⭐',
    badgeColor: '#9ca3af',
    auraMultiplier: 1.0,
    features: ['Core tools', 'Community support', 'Basic AI'],
  },
  indie: {
    id: 'indie',
    name: 'Indie',
    description: 'Independent creator',
    maxProjects: 20,
    maxStorage: 10 * 1024 * 1024 * 1024, // 10GB
    maxTeamMembers: 1,
    marketplaceFee: 20,
    badgeIcon: '💎',
    badgeColor: '#00f0ff',
    auraMultiplier: 1.2,
    features: ['Priority AI', 'Custom domains', 'Analytics'],
  },
  solo: {
    id: 'solo',
    name: 'Solo Dev',
    description: 'One-person powerhouse',
    maxProjects: 50,
    maxStorage: 50 * 1024 * 1024 * 1024, // 50GB
    maxTeamMembers: 1,
    marketplaceFee: 15,
    badgeIcon: '⚔️',
    badgeColor: '#ff00ff',
    auraMultiplier: 1.5,
    features: ['API access', 'Advanced export', 'Priority support'],
  },
  multi: {
    id: 'multi',
    name: 'Multi-Tool',
    description: 'Jack of all trades',
    maxProjects: 100,
    maxStorage: 100 * 1024 * 1024 * 1024, // 100GB
    maxTeamMembers: 3,
    marketplaceFee: 15,
    badgeIcon: '🎭',
    badgeColor: '#7000ff',
    auraMultiplier: 1.8,
    features: ['Team collaboration', 'Shared assets', 'Team analytics'],
  },
  team: {
    id: 'team',
    name: 'Team',
    description: 'Creative collective',
    maxProjects: -1, // Unlimited
    maxStorage: 500 * 1024 * 1024 * 1024, // 500GB
    maxTeamMembers: 10,
    marketplaceFee: 10,
    badgeIcon: '👑',
    badgeColor: '#ffaa00',
    auraMultiplier: 2.0,
    features: ['SSO', 'Admin controls', 'Dedicated support'],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Organization scale',
    maxProjects: -1,
    maxStorage: -1, // Unlimited
    maxTeamMembers: -1,
    marketplaceFee: 5,
    badgeIcon: '🏛️',
    badgeColor: '#00ff88',
    auraMultiplier: 3.0,
    features: ['SLA', 'Custom integrations', 'White-label'],
  },
};

// Creator Types - Extensible system
export interface CreatorType {
  id: string;
  label: string;
  icon: string;
  category: 'dev' | 'art' | 'audio' | 'writing' | 'business' | 'other';
  description?: string;
  unlockedAtLevel?: number; // For gamification
  auraBonus?: number;
}

export const DEFAULT_CREATOR_TYPES: CreatorType[] = [
  // Development
  { id: 'frontend', label: 'Frontend Dev', icon: '🌐', category: 'dev', auraBonus: 10 },
  { id: 'backend', label: 'Backend Dev', icon: '⚙️', category: 'dev', auraBonus: 10 },
  { id: 'fullstack', label: 'Full Stack Dev', icon: '💻', category: 'dev', auraBonus: 15 },
  { id: 'mobile', label: 'Mobile Dev', icon: '📱', category: 'dev', auraBonus: 10 },
  { id: 'gamedev', label: 'Game Developer', icon: '🎮', category: 'dev', auraBonus: 15 },
  { id: 'ai_dev', label: 'AI/ML Developer', icon: '🤖', category: 'dev', auraBonus: 20 },
  { id: 'blockchain', label: 'Blockchain Dev', icon: '⛓️', category: 'dev', auraBonus: 20 },
  
  // Art & Design
  { id: 'graphic_designer', label: 'Graphic Designer', icon: '🎨', category: 'art', auraBonus: 10 },
  { id: 'ui_ux', label: 'UI/UX Designer', icon: '✨', category: 'art', auraBonus: 10 },
  { id: 'illustrator', label: 'Illustrator', icon: '🖌️', category: 'art', auraBonus: 10 },
  { id: '3d_artist', label: '3D Artist', icon: '🎲', category: 'art', auraBonus: 15 },
  { id: 'animator', label: 'Animator', icon: '🎬', category: 'art', auraBonus: 15 },
  { id: 'pixel_artist', label: 'Pixel Artist', icon: '👾', category: 'art', auraBonus: 10 },
  { id: 'concept_artist', label: 'Concept Artist', icon: '🖼️', category: 'art', auraBonus: 10 },
  
  // Audio
  { id: 'musician', label: 'Musician', icon: '🎵', category: 'audio', auraBonus: 10 },
  { id: 'producer', label: 'Music Producer', icon: '🎹', category: 'audio', auraBonus: 15 },
  { id: 'voice_actor', label: 'Voice Actor', icon: '🎙️', category: 'audio', auraBonus: 10 },
  { id: 'sound_designer', label: 'Sound Designer', icon: '🔊', category: 'audio', auraBonus: 15 },
  { id: 'composer', label: 'Composer', icon: '🎼', category: 'audio', auraBonus: 15 },
  { id: 'podcaster', label: 'Podcaster', icon: '🎧', category: 'audio', auraBonus: 10 },
  
  // Writing
  { id: 'writer', label: 'Writer', icon: '✍️', category: 'writing', auraBonus: 10 },
  { id: 'author', label: 'Author', icon: '📖', category: 'writing', auraBonus: 15 },
  { id: 'blogger', label: 'Blogger', icon: '📝', category: 'writing', auraBonus: 10 },
  { id: 'copywriter', label: 'Copywriter', icon: '📢', category: 'writing', auraBonus: 10 },
  { id: 'screenwriter', label: 'Screenwriter', icon: '🎭', category: 'writing', auraBonus: 15 },
  { id: 'technical_writer', label: 'Technical Writer', icon: '📚', category: 'writing', auraBonus: 10 },
  
  // Business/Creator
  { id: 'indie_hacker', label: 'Indie Hacker', icon: '🚀', category: 'business', auraBonus: 20 },
  { id: 'content_creator', label: 'Content Creator', icon: '🎥', category: 'business', auraBonus: 10 },
  { id: 'youtuber', label: 'YouTuber', icon: '📺', category: 'business', auraBonus: 15 },
  { id: 'streamer', label: 'Streamer', icon: '📡', category: 'business', auraBonus: 10 },
  { id: 'entrepreneur', label: 'Entrepreneur', icon: '💼', category: 'business', auraBonus: 20 },
  { id: 'consultant', label: 'Consultant', icon: '🤝', category: 'business', auraBonus: 10 },
  
  // Special
  { id: 'multi_tool', label: 'Multi-Tool', icon: '🛠️', category: 'other', auraBonus: 25 },
  { id: 'student', label: 'Student', icon: '🎓', category: 'other', auraBonus: 5 },
  { id: 'hobbyist', label: 'Hobbyist', icon: '🎯', category: 'other', auraBonus: 5 },
  { id: 'educator', label: 'Educator', icon: '📖', category: 'other', auraBonus: 15 },
  { id: 'researcher', label: 'Researcher', icon: '🔬', category: 'other', auraBonus: 10 },
];

// Badge System
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
  category: 'account' | 'achievement' | 'skill' | 'event' | 'special';
  unlockedAt?: Date;
  auraBonus?: number;
  mmorpgShopId?: string; // Link to future MMORPG shop item
}

export const DEFAULT_BADGES: Badge[] = [
  // Account Badges
  {
    id: 'novaura_member',
    name: 'NovAura Member',
    description: 'Joined the NovAura ecosystem',
    icon: '✨',
    color: '#00f0ff',
    rarity: 'common',
    category: 'account',
    auraBonus: 10,
  },
  {
    id: 'beta_tester',
    name: 'Beta Pioneer',
    description: 'Early beta tester',
    icon: '🧪',
    color: '#ff00ff',
    rarity: 'rare',
    category: 'account',
    auraBonus: 50,
  },
  {
    id: 'indie_badge',
    name: 'Indie Creator',
    description: 'Indie tier member',
    icon: '💎',
    color: '#00f0ff',
    rarity: 'common',
    category: 'account',
    auraBonus: 20,
  },
  {
    id: 'solo_dev_badge',
    name: 'Solo Dev',
    description: 'One-person powerhouse',
    icon: '⚔️',
    color: '#ff00ff',
    rarity: 'rare',
    category: 'account',
    auraBonus: 40,
  },
  {
    id: 'multi_tool_badge',
    name: 'Multi-Tool',
    description: 'Jack of all trades',
    icon: '🎭',
    color: '#7000ff',
    rarity: 'epic',
    category: 'account',
    auraBonus: 60,
  },
  {
    id: 'team_lead_badge',
    name: 'Team Lead',
    description: 'Leading a creative team',
    icon: '👑',
    color: '#ffaa00',
    rarity: 'legendary',
    category: 'account',
    auraBonus: 100,
  },
  
  // Achievement Badges
  {
    id: 'first_project',
    name: 'First Steps',
    description: 'Created your first project',
    icon: '🚀',
    color: '#00ff88',
    rarity: 'common',
    category: 'achievement',
    auraBonus: 15,
  },
  {
    id: 'ten_projects',
    name: 'Prolific',
    description: 'Created 10 projects',
    icon: '📚',
    color: '#00f0ff',
    rarity: 'rare',
    category: 'achievement',
    auraBonus: 50,
  },
  {
    id: 'first_sale',
    name: 'First Sale',
    description: 'Made your first marketplace sale',
    icon: '💰',
    color: '#ffaa00',
    rarity: 'rare',
    category: 'achievement',
    auraBonus: 75,
  },
  {
    id: 'hundred_sales',
    name: 'Top Seller',
    description: '100+ marketplace sales',
    icon: '🏆',
    color: '#ff00ff',
    rarity: 'legendary',
    category: 'achievement',
    auraBonus: 200,
  },
  {
    id: 'community_hero',
    name: 'Community Hero',
    description: 'Helped 50+ community members',
    icon: '🦸',
    color: '#ff4444',
    rarity: 'epic',
    category: 'achievement',
    auraBonus: 150,
  },
  
  // Skill Badges
  {
    id: 'code_master',
    name: 'Code Master',
    description: 'Shipped 10+ code projects',
    icon: '👨‍💻',
    color: '#00f0ff',
    rarity: 'epic',
    category: 'skill',
    auraBonus: 100,
  },
  {
    id: 'art_virtuoso',
    name: 'Art Virtuoso',
    description: 'Created 50+ art assets',
    icon: '🎨',
    color: '#ff00ff',
    rarity: 'epic',
    category: 'skill',
    auraBonus: 100,
  },
  {
    id: 'sound_wizard',
    name: 'Sound Wizard',
    description: 'Produced 20+ audio tracks',
    icon: '🎵',
    color: '#7000ff',
    rarity: 'epic',
    category: 'skill',
    auraBonus: 100,
  },
  {
    id: 'voice_shaper',
    name: 'Voice Shaper',
    description: 'Trained 3+ voice models',
    icon: '🗣️',
    color: '#00ff88',
    rarity: 'rare',
    category: 'skill',
    auraBonus: 80,
  },
  
  // Special Badges
  {
    id: 'founder',
    name: 'Founder',
    description: 'Original NovAura founder',
    icon: '🌟',
    color: '#ffaa00',
    rarity: 'mythic',
    category: 'special',
    auraBonus: 1000,
  },
  {
    id: 'og_member',
    name: 'OG Member',
    description: 'Joined in the first 1000',
    icon: '💎',
    color: '#00f0ff',
    rarity: 'legendary',
    category: 'special',
    auraBonus: 500,
  },
  {
    id: 'bug_hunter',
    name: 'Bug Hunter',
    description: 'Found and reported critical bugs',
    icon: '🐛',
    color: '#ff4444',
    rarity: 'epic',
    category: 'special',
    auraBonus: 120,
  },
  {
    id: 'feature_sage',
    name: 'Feature Sage',
    description: 'Suggested implemented features',
    icon: '💡',
    color: '#ffaa00',
    rarity: 'rare',
    category: 'special',
    auraBonus: 75,
  },
];

// Gamification - Aura System (Foundation for MMORPG)
export interface AuraSystem {
  level: number;
  currentXP: number;
  nextLevelXP: number;
  totalAura: number; // Reputation score
  rank: string;
  streak: number; // Daily login streak
  lastActive: Date;
}

export const AURA_RANKS = [
  { level: 1, name: 'Novice', minAura: 0, color: '#9ca3af' },
  { level: 10, name: 'Apprentice', minAura: 1000, color: '#22c55e' },
  { level: 25, name: 'Adept', minAura: 5000, color: '#3b82f6' },
  { level: 50, name: 'Expert', minAura: 15000, color: '#a855f7' },
  { level: 75, name: 'Master', minAura: 50000, color: '#f59e0b' },
  { level: 100, name: 'Grandmaster', minAura: 150000, color: '#ef4444' },
  { level: 150, name: 'Legend', minAura: 500000, color: '#ec4899' },
  { level: 200, name: 'Mythic', minAura: 2000000, color: '#00f0ff' },
  { level: 300, name: 'Transcendent', minAura: 10000000, color: '#ff00ff' },
];

export function calculateLevel(totalAura: number): { level: number; rank: string; color: string; nextLevelXP: number } {
  for (let i = AURA_RANKS.length - 1; i >= 0; i--) {
    if (totalAura >= AURA_RANKS[i].minAura) {
      const nextLevel = AURA_RANKS[i + 1];
      return {
        level: AURA_RANKS[i].level,
        rank: AURA_RANKS[i].name,
        color: AURA_RANKS[i].color,
        nextLevelXP: nextLevel ? nextLevel.minAura : Infinity,
      };
    }
  }
  return { level: 1, rank: 'Novice', color: '#9ca3af', nextLevelXP: 1000 };
}

// XP Sources for gamification
export const XP_SOURCES = {
  // Content Creation
  CREATE_PROJECT: 50,
  PUBLISH_ASSET: 100,
  COMPLETE_TASK: 25,
  SHIP_PRODUCT: 200,
  
  // Community
  HELPFUL_COMMENT: 10,
  RECEIVE_LIKE: 5,
  RECEIVE_FOLLOW: 25,
  MENTOR_SOMEONE: 100,
  
  // Marketplace
  MAKE_SALE: 100,
  RECEIVE_5_STAR: 50,
  REFERRAL: 150,
  
  // Learning
  COMPLETE_TUTORIAL: 30,
  EARN_CERTIFICATION: 500,
  TEACH_WORKSHOP: 300,
  
  // Consistency
  DAILY_LOGIN: 10,
  WEEK_STREAK: 50,
  MONTH_STREAK: 200,
  YEAR_STREAK: 2000,
  
  // Special
  BUG_REPORT: 75,
  FEATURE_IMPLEMENTED: 500,
  COMMUNITY_EVENT: 150,
  PARTNERSHIP: 1000,
};

// Future MMORPG Integration (Shops as Functions)
export interface MMORPGShop {
  id: string;
  name: string;
  description: string;
  type: 'weapon' | 'armor' | 'consumable' | 'cosmetic' | 'mount' | 'pet' | 'house';
  cost: number; // In-game currency
  auraRequirement: number;
  realWorldFunction: string; // Maps to actual NovAura feature
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
  effects: {
    auraMultiplier?: number;
    xpBoost?: number;
    storageBonus?: number;
    teamSizeBonus?: number;
  };
}

export const MMORPG_SHOPS: MMORPGShop[] = [
  // Weapon Shop (Code/Dev Tools)
  {
    id: 'legendary_keyboard',
    name: 'Keyboard of Infinite Code',
    description: 'Type at the speed of thought. 2x coding XP.',
    type: 'weapon',
    cost: 50000,
    auraRequirement: 10000,
    realWorldFunction: 'IDE premium features',
    icon: '⌨️',
    rarity: 'legendary',
    effects: { auraMultiplier: 2.0 },
  },
  {
    id: 'debugging_staff',
    name: 'Staff of Debugging',
    description: 'Find bugs before they find you.',
    type: 'weapon',
    cost: 15000,
    auraRequirement: 3000,
    realWorldFunction: 'AI debugging assistant',
    icon: '🪄',
    rarity: 'epic',
    effects: { xpBoost: 1.5 },
  },
  
  // Armor Shop (Protection/Storage)
  {
    id: 'cloud_armor',
    name: 'Armor of the Cloud',
    description: '+100GB storage capacity.',
    type: 'armor',
    cost: 25000,
    auraRequirement: 5000,
    realWorldFunction: 'Extra storage space',
    icon: '☁️',
    rarity: 'epic',
    effects: { storageBonus: 100 },
  },
  
  // Consumables (Boosts)
  {
    id: 'focus_potion',
    name: 'Potion of Deep Focus',
    description: '3 hours of uninterrupted flow state.',
    type: 'consumable',
    cost: 500,
    auraRequirement: 100,
    realWorldFunction: 'Distraction-free mode',
    icon: '🧪',
    rarity: 'rare',
    effects: { xpBoost: 3.0 },
  },
  {
    id: 'inspiration_elixir',
    name: 'Elixir of Inspiration',
    description: 'AI creativity boost for 24 hours.',
    type: 'consumable',
    cost: 1000,
    auraRequirement: 500,
    realWorldFunction: 'Premium AI credits',
    icon: '🧃',
    rarity: 'epic',
    effects: { auraMultiplier: 1.5 },
  },
  
  // Cosmetics (Profile/Badges)
  {
    id: 'aurora_cape',
    name: 'Aurora Cape',
    description: 'Animated profile background.',
    type: 'cosmetic',
    cost: 10000,
    auraRequirement: 2000,
    realWorldFunction: 'Animated avatar frame',
    icon: '🦸',
    rarity: 'legendary',
    effects: {},
  },
  
  // Mounts (Speed/Access)
  {
    id: 'rocket_mount',
    name: 'Rocket of Rapid Deployment',
    description: 'Deploy projects instantly.',
    type: 'mount',
    cost: 30000,
    auraRequirement: 8000,
    realWorldFunction: 'Priority deployment queue',
    icon: '🚀',
    rarity: 'legendary',
    effects: {},
  },
  
  // Pets (Companions/Bonuses)
  {
    id: 'ai_companion',
    name: 'AI Companion Bot',
    description: 'Your personal assistant in the ecosystem.',
    type: 'pet',
    cost: 20000,
    auraRequirement: 4000,
    realWorldFunction: 'Custom AI agent',
    icon: '🤖',
    rarity: 'epic',
    effects: { xpBoost: 1.2 },
  },
  
  // Houses (Team/Space)
  {
    id: 'guild_hall',
    name: 'Guild Hall',
    description: '+5 team member slots.',
    type: 'house',
    cost: 100000,
    auraRequirement: 25000,
    realWorldFunction: 'Expanded team capacity',
    icon: '🏰',
    rarity: 'mythic',
    effects: { teamSizeBonus: 5 },
  },
];
