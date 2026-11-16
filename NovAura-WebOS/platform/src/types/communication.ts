import { User, UserRole } from './user';

// Message Types
export type MessageType = 'text' | 'contract' | 'system' | 'image';
export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface Message {
  id: string;
  senderId: string;
  sender?: User;
  recipientId: string;
  recipient?: User;
  type: MessageType;
  content: string;
  contractData?: {
    assetId: string;
    assetTitle: string;
    royaltyRate: number;
    status: 'pending' | 'accepted' | 'declined';
  };
  attachments?: string[];
  status: MessageStatus;
  createdAt: string;
  readAt?: string;
}

export interface Conversation {
  id: string;
  participants: User[];
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: string;
}

// Notification Types
export type NotificationType =
  | 'sale'
  | 'message'
  | 'review'
  | 'system'
  | 'mention'
  | 'follower'
  | 'new_asset'
  | 'price_drop'
  | 'creator_update'
  | 'follow'
  | 'pioneer_badge';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  description?: string;
  creatorId?: string;
  creatorUsername?: string;
  creatorAvatar?: string;
  assetId?: string;
  assetTitle?: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

// Job & Recruitment Types
export type JobType = 'full_time' | 'part_time' | 'contract' | 'freelance' | 'commission';
export type JobStatus = 'open' | 'closed' | 'filled';

export interface JobPost {
  id: string;
  recruiterId: string;
  recruiter?: User;
  title: string;
  description: string;
  requirements: string[];
  budget?: {
    min: number;
    max: number;
    currency: string;
    type: 'hourly' | 'fixed' | 'milestone';
  };
  jobType: JobType;
  category: 'developer' | 'artist' | 'designer' | 'musician' | 'other';
  status: JobStatus;
  applications: number;
  createdAt: string;
  expiresAt?: string;
}

export interface JobApplication {
  id: string;
  jobId: string;
  applicantId: string;
  applicant?: User;
  coverLetter: string;
  portfolioUrl?: string;
  status: 'pending' | 'reviewing' | 'accepted' | 'rejected';
  createdAt: string;
}

// Pioneer Badge Types
export type PioneerBadgeTier =
  | 'pioneer_1'
  | 'pioneer_2'
  | 'pioneer_3'
  | 'milestone_100'
  | 'milestone_500'
  | 'milestone_1000';

export interface BadgeTransfer {
  fromUserId: string;
  toUserId: string;
  price?: number;
  transferredAt: string;
}

export interface PioneerBadge {
  id: string;
  tier: PioneerBadgeTier;
  searchTerm: string;
  searchTermDisplay: string;
  ownerId: string;
  originalEarnerId: string;
  earnedAt: string;
  transferHistory: BadgeTransfer[];
  isListed: boolean;
  listPrice?: number;
}
