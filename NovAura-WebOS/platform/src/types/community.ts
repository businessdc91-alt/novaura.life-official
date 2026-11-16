import { User } from './user';
import { ContentRating } from './asset';

export type GalleryContentRating = ContentRating;
export type GallerySubmissionType = 'artwork' | 'video' | 'screenshot' | 'photography' | 'wip' | 'other';
export type GallerySubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface GallerySubmission {
  id: string;
  creatorId: string;
  creator?: User;
  title: string;
  description: string;
  type: GallerySubmissionType;
  contentRating: GalleryContentRating;
  mediaUrls: string[];
  thumbnailUrl: string;
  tags: string[];
  status: GallerySubmissionStatus;
  rejectionReason?: string;
  likes: number;
  views: number;
  comments: number;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
}

export interface GalleryComment {
  id: string;
  submissionId: string;
  authorId: string;
  author?: User;
  content: string;
  likes: number;
  createdAt: string;
}

export interface SocialPost {
  id: string;
  creatorId: string;
  creator?: User;
  content: string;
  mediaUrls?: string[];
  likes: number;
  comments: number;
  likedBy?: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SocialComment {
  id: string;
  postId: string;
  authorId: string;
  author?: User;
  content: string;
  likes: number;
  createdAt: string;
}

export interface ForumThread {
  id: string;
  authorId: string;
  author?: User;
  title: string;
  content: string;
  category: 'general' | 'showcase' | 'help' | 'discussion' | 'announcement';
  tags: string[];
  views: number;
  replyCount: number;
  lastReplyAt: string;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ForumReply {
  id: string;
  threadId: string;
  authorId: string;
  author?: User;
  content: string;
  likes: number;
  isSolution?: boolean;
  createdAt: string;
  updatedAt: string;
}
