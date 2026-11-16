import type { GallerySubmission, GalleryComment, GallerySubmissionType, GalleryContentRating } from '@/types';
import { kernelStorage } from '@/kernel/kernelStorage.js';

const STORAGE_KEYS = {
  submissions: 'novaura_gallery_submissions',
  comments: 'novaura_gallery_comments',
};

// Initialize storage
export const initializeGalleryStorage = () => {
  if (!kernelStorage.getItem(STORAGE_KEYS.submissions)) {
    kernelStorage.setItem(STORAGE_KEYS.submissions, JSON.stringify([]));
  }
  if (!kernelStorage.getItem(STORAGE_KEYS.comments)) {
    kernelStorage.setItem(STORAGE_KEYS.comments, JSON.stringify([]));
  }
};

// Get all submissions
export const getAllSubmissions = (): GallerySubmission[] => {
  const data = kernelStorage.getItem(STORAGE_KEYS.submissions);
  return data ? JSON.parse(data) : [];
};

// Get approved submissions (for public viewing)
export const getApprovedSubmissions = (options?: {
  type?: GallerySubmissionType;
  contentRating?: GalleryContentRating;
  tag?: string;
  creatorId?: string;
}): GallerySubmission[] => {
  let submissions = getAllSubmissions().filter((s) => s.status === 'approved');

  if (options?.type) {
    submissions = submissions.filter((s) => s.type === options.type);
  }

  if (options?.contentRating) {
    submissions = submissions.filter((s) => s.contentRating === options.contentRating);
  }

  if (options?.tag) {
    submissions = submissions.filter((s) => s.tags.includes(options.tag!));
  }

  if (options?.creatorId) {
    submissions = submissions.filter((s) => s.creatorId === options.creatorId);
  }

  return submissions.sort((a, b) => new Date(b.approvedAt || b.createdAt).getTime() - new Date(a.approvedAt || a.createdAt).getTime());
};

// Get pending submissions (for admin review)
export const getPendingSubmissions = (): GallerySubmission[] => {
  return getAllSubmissions()
    .filter((s) => s.status === 'pending')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

// Get submissions by creator
export const getCreatorSubmissions = (creatorId: string): GallerySubmission[] => {
  return getAllSubmissions()
    .filter((s) => s.creatorId === creatorId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

// Get single submission
export const getSubmission = (id: string): GallerySubmission | null => {
  const submissions = getAllSubmissions();
  const submission = submissions.find((s) => s.id === id);
  if (submission) {
    submission.views++;
    kernelStorage.setItem(STORAGE_KEYS.submissions, JSON.stringify(submissions));
  }
  return submission || null;
};

// Create submission
export const createSubmission = (
  creatorId: string,
  title: string,
  description: string,
  type: GallerySubmissionType,
  contentRating: GalleryContentRating,
  mediaUrls: string[],
  thumbnailUrl: string,
  tags: string[]
): GallerySubmission => {
  const submissions = getAllSubmissions();

  const newSubmission: GallerySubmission = {
    id: `gallery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    creatorId,
    title,
    description,
    type,
    contentRating,
    mediaUrls,
    thumbnailUrl,
    tags,
    status: 'pending',
    likes: 0,
    views: 0,
    comments: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  submissions.push(newSubmission);
  kernelStorage.setItem(STORAGE_KEYS.submissions, JSON.stringify(submissions));

  return newSubmission;
};

// Approve submission
export const approveSubmission = (id: string): void => {
  const submissions = getAllSubmissions();
  const submission = submissions.find((s) => s.id === id);
  if (submission) {
    submission.status = 'approved';
    submission.approvedAt = new Date().toISOString();
    submission.updatedAt = new Date().toISOString();
    kernelStorage.setItem(STORAGE_KEYS.submissions, JSON.stringify(submissions));
  }
};

// Reject submission
export const rejectSubmission = (id: string, reason: string): void => {
  const submissions = getAllSubmissions();
  const submission = submissions.find((s) => s.id === id);
  if (submission) {
    submission.status = 'rejected';
    submission.rejectionReason = reason;
    submission.updatedAt = new Date().toISOString();
    kernelStorage.setItem(STORAGE_KEYS.submissions, JSON.stringify(submissions));
  }
};

// Delete submission
export const deleteSubmission = (id: string): void => {
  const submissions = getAllSubmissions();
  const filtered = submissions.filter((s) => s.id !== id);
  kernelStorage.setItem(STORAGE_KEYS.submissions, JSON.stringify(filtered));
};

// Like submission
export const likeSubmission = (id: string): void => {
  const submissions = getAllSubmissions();
  const submission = submissions.find((s) => s.id === id);
  if (submission) {
    submission.likes++;
    kernelStorage.setItem(STORAGE_KEYS.submissions, JSON.stringify(submissions));
  }
};

// Unlike submission
export const unlikeSubmission = (id: string): void => {
  const submissions = getAllSubmissions();
  const submission = submissions.find((s) => s.id === id);
  if (submission && submission.likes > 0) {
    submission.likes--;
    kernelStorage.setItem(STORAGE_KEYS.submissions, JSON.stringify(submissions));
  }
};

// Get comments for submission
export const getSubmissionComments = (submissionId: string): GalleryComment[] => {
  const data = kernelStorage.getItem(STORAGE_KEYS.comments);
  const comments = data ? JSON.parse(data) : [];
  return comments
    .filter((c: GalleryComment) => c.submissionId === submissionId)
    .sort((a: GalleryComment, b: GalleryComment) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

// Add comment
export const addComment = (submissionId: string, authorId: string, content: string): GalleryComment => {
  const comments = JSON.parse(kernelStorage.getItem(STORAGE_KEYS.comments) || '[]');
  const submissions = getAllSubmissions();

  const newComment: GalleryComment = {
    id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    submissionId,
    authorId,
    content,
    likes: 0,
    createdAt: new Date().toISOString(),
  };

  comments.push(newComment);
  kernelStorage.setItem(STORAGE_KEYS.comments, JSON.stringify(comments));

  // Update submission comment count
  const submission = submissions.find((s) => s.id === submissionId);
  if (submission) {
    submission.comments++;
    kernelStorage.setItem(STORAGE_KEYS.submissions, JSON.stringify(submissions));
  }

  return newComment;
};

// Gallery submission type labels
export const submissionTypeLabels: Record<GallerySubmissionType, string> = {
  artwork: 'Artwork',
  video: 'Video',
  screenshot: 'Screenshot',
  photography: 'Photography',
  wip: 'Work in Progress',
  other: 'Other',
};

// Gallery submission type icons (for reference)
export const submissionTypeIcons: Record<GallerySubmissionType, string> = {
  artwork: 'Palette',
  video: 'Video',
  screenshot: 'Monitor',
  photography: 'Camera',
  wip: 'Hammer',
  other: 'File',
};
