import { User, EngineType } from './user';

export type AssetStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export type LicenseTier = 
  | 'art_3pct'
  | 'music_1pct'
  | 'integration_10pct'
  | 'functional_15pct'
  | 'source_20pct'
  | 'opensource';

export type ContentRating = 'safe' | 'suggestive' | 'mature' | 'explicit';
export type Complexity = 'beginner' | 'intermediate' | 'advanced';
export type PricingType = 'fixed' | 'donation' | 'free';

export type AssetType = 'dev_asset' | 'game' | 'software' | 'writing' | 'avatar' | 'animation' | 'vfx' | 'environment' | 'audio' | 'ui' | 'armor' | 'weapon';

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  parentId?: string;
  sortOrder: number;
  assetCount?: number;
}

export interface AssetFile {
  id: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  fileType: string;
}

export interface Asset {
  id: string;
  creatorId: string;
  creator?: User;
  title: string;
  slug: string;
  assetType?: AssetType;
  description: string;
  shortDescription: string;
  category: string;
  subcategory?: string;
  tags: string[];
  engineType: EngineType;
  complexity: Complexity;
  contentRating: ContentRating;
  licenseTier: LicenseTier;
  pricingType: PricingType;
  price: number;
  minPrice?: number;
  suggestedPrice?: number;
  suggestedDonation?: number;
  salePrice?: number;
  files: AssetFile[];
  thumbnailUrl: string;
  screenshotUrls: string[];
  videoUrl?: string;
  documentationUrl?: string;
  version: string;
  changelog?: string;
  status: AssetStatus;
  rejectionReason?: string;
  downloadCount: number;
  viewCount: number;
  ratingAverage: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  foundationAssets?: string[];
  revenueSplits?: RoyaltyStake[];
}

export interface RoyaltyStake {
  id: string;
  userId: string;
  username: string;
  percentage: number;
  role: 'original_creator' | 'foundation_builder' | 'collaborator' | 'curator';
  assetId?: string;
}

export interface Review {
  id: string;
  assetId: string;
  reviewerId: string;
  reviewer?: User;
  rating: number;
  title: string;
  content: string;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssetStats {
  views: number;
  downloads: number;
  sales: number;
  revenue: number;
  royalties: number;
}

export interface AssetFilters {
  category?: string;
  assetType?: AssetType;
  engineType?: EngineType;
  complexity?: Complexity;
  contentRating?: ContentRating;
  licenseTier?: LicenseTier;
  pricingType?: PricingType;
  priceMin?: number;
  priceMax?: number;
  rating?: number;
  search?: string;
  sortBy?: 'popular' | 'newest' | 'price_asc' | 'price_desc' | 'rating';
}

// Writing Types
export type WritingCategory =
  | 'game_dialogue' | 'screenplay' | 'quest_design' | 'lore_worldbuilding'
  | 'song_lyrics' | 'marketing_copy' | 'character_design' | 'story_bible';

export type WritingCommissionStatus = 'open' | 'in_review' | 'assigned' | 'in_progress' | 'review' | 'completed' | 'cancelled';

export interface WritingCharacter {
  name: string;
  description: string;
  traits?: string[];
  goals?: string;
  voice?: string;
}

export interface WritingMilestone {
  id: string;
  name: string;
  description: string;
  dueDate: string;
  status: 'pending' | 'submitted' | 'approved';
}

export interface WritingBid {
  id: string;
  writerId: string;
  writer?: User;
  price: number;
  royaltyPercentage: number;
  estimatedDays: number;
  proposal: string;
  portfolioLinks?: string[];
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface WritingDeliverable {
  id: string;
  files: { name: string; content: string; format: string }[];
  message: string;
  milestone?: string;
  status: 'pending_review' | 'approved' | 'revision_requested';
  revisionRequest?: {
    feedback: string;
    specificChanges: string[];
    requestedAt: string;
  };
  submittedAt: string;
}

export interface WritingCommission {
  id: string;
  clientId: string;
  client?: User;
  writerId?: string;
  writer?: User;
  status: WritingCommissionStatus;
  category: WritingCategory;
  title: string;
  description: string;
  gameGenre?: string;
  targetAudience?: string;
  tone?: 'serious' | 'humorous' | 'dark' | 'lighthearted' | 'epic' | 'romantic';
  wordCount?: { min: number; max: number };
  characters?: WritingCharacter[];
  styleReference?: string;
  mustInclude?: string[];
  avoid?: string[];
  budgetMin: number;
  budgetMax: number;
  royaltyPercentage: number;
  deadline?: string;
  milestones?: WritingMilestone[];
  bids: WritingBid[];
  deliverables: WritingDeliverable[];
  revisions: number;
  maxRevisions: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface WritingRoyaltyContract {
  id: string;
  commissionId: string;
  writerId: string;
  clientId: string;
  upfrontPayment: number;
  royaltyPercentage: number;
  rights: {
    scope: 'exclusive_per_game' | 'exclusive_franchise' | 'non_exclusive';
    territory: string;
    duration: string;
    modifications: string;
    attribution: 'credited' | 'ghost' | 'optional';
  };
  usage: {
    gameTitle?: string;
    gameRevenue: number;
    royaltiesPaid: number;
    lastReported?: string;
  };
  status: 'active' | 'completed' | 'disputed';
  createdAt: string;
}
