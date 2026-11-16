/**
 * Ghost Writer Marketplace Service
 * 
 * Commission-based creative writing marketplace integrated with NovAura Assets.
 * Writers can publish portfolio pieces and accept commissions for:
 * - Game dialogue
 * - Screenplays/Cutscenes  
 * - RPG quest design
 * - Lore & worldbuilding
 * - Song lyrics
 * - Marketing copy
 * 
 * Royalty structure: 10% default for full game dialogue usage
 * Rights: Exclusive per-game (cannot be resold word-for-word)
 */

import type { 
  WritingCommission, 
  WritingBid, 
  WritingRoyaltyContract,
  WritingCategory,
  User 
} from '@/types';
import { db } from '@/config/firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';

// ═══════════════════════════════════════════════════════════════════════════════
// COMMISSION TYPE CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const WRITING_CATEGORIES: Record<WritingCategory, {
  name: string;
  description: string;
  defaultRoyalty: number;
  minPrice: number;
  deliveryTime: string;
  deliverables: string[];
  rights: string;
}> = {
  game_dialogue: {
    name: 'Game Dialogue',
    description: 'NPC conversations, quest text, story dialogue',
    defaultRoyalty: 10,
    minPrice: 100,
    deliveryTime: '2-4 weeks',
    deliverables: ['Dialogue script', 'Character voice guides', 'Branching flowchart'],
    rights: 'Exclusive per game - cannot be reused in other projects word-for-word'
  },
  quest_design: {
    name: 'RPG Quest Design',
    description: 'Complete quest lines with dialogue, objectives, rewards',
    defaultRoyalty: 12,
    minPrice: 250,
    deliveryTime: '3-6 weeks',
    deliverables: ['Quest scripts', 'NPC dialogue', 'Lore integration', 'Reward balancing notes'],
    rights: 'Exclusive per game'
  },
  screenplay: {
    name: 'Game Screenplay',
    description: 'Cutscenes, cinematic sequences, story arcs',
    defaultRoyalty: 15,
    minPrice: 500,
    deliveryTime: '4-8 weeks',
    deliverables: ['Full screenplay', 'Scene descriptions', 'Character notes', "Director's commentary"],
    rights: 'Exclusive per game'
  },
  song_lyrics: {
    name: 'Song Lyrics',
    description: 'Theme songs, character songs, background music lyrics',
    defaultRoyalty: 8,
    minPrice: 75,
    deliveryTime: '1-2 weeks',
    deliverables: ['Lyrics document', 'Theme/mood guide', 'Singer notes'],
    rights: 'Exclusive per game/song'
  },
  lore_worldbuilding: {
    name: 'Lore & Worldbuilding',
    description: 'History, mythology, faction backstories, item descriptions',
    defaultRoyalty: 10,
    minPrice: 200,
    deliveryTime: '3-5 weeks',
    deliverables: ['Lore bible', 'Timeline', 'Faction guides', 'Item descriptions'],
    rights: 'Exclusive per game'
  },
  marketing_copy: {
    name: 'Marketing Copy',
    description: 'Store descriptions, trailer scripts, press releases',
    defaultRoyalty: 5,
    minPrice: 50,
    deliveryTime: '3-5 days',
    deliverables: ['Store copy', 'Trailer script', 'Social media posts', 'Press release'],
    rights: 'One-time use, non-exclusive'
  },
  character_design: {
    name: 'Character Writing',
    description: 'Character bios, backstories, personality profiles',
    defaultRoyalty: 8,
    minPrice: 100,
    deliveryTime: '1-2 weeks',
    deliverables: ['Character bio', 'Backstory document', 'Personality traits', 'Voice guide'],
    rights: 'Exclusive per game'
  },
  story_bible: {
    name: 'Story Bible',
    description: 'Complete narrative documentation for your game world',
    defaultRoyalty: 15,
    minPrice: 750,
    deliveryTime: '6-10 weeks',
    deliverables: ['Complete story bible', 'Character encyclopedia', 'Timeline', 'World map descriptions', 'Plot summaries'],
    rights: 'Exclusive per franchise'
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// WRITER TIERS
// ═══════════════════════════════════════════════════════════════════════════════

export const WRITER_TIERS = {
  novice: { name: 'Novice', minReviews: 0, minRating: 0, color: '#6b7280' },
  bronze: { name: 'Bronze', minReviews: 5, minRating: 4.0, color: '#cd7f32' },
  silver: { name: 'Silver', minReviews: 20, minRating: 4.2, color: '#c0c0c0' },
  gold: { name: 'Gold', minReviews: 50, minRating: 4.5, color: '#ffd700' },
  platinum: { name: 'Platinum', minReviews: 100, minRating: 4.8, color: '#e5e4e2' },
  diamond: { name: 'Diamond', minReviews: 250, minRating: 4.9, color: '#b9f2ff' }
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// COMMISSION CRUD
// ═══════════════════════════════════════════════════════════════════════════════

export const createCommission = async (
  clientId: string,
  commission: Omit<WritingCommission, 'id' | 'clientId' | 'status' | 'bids' | 'deliverables' | 'revisions' | 'createdAt' | 'updatedAt'>
): Promise<WritingCommission> => {
  if (!db) throw new Error('Database not connected');
  
  const payload = {
    clientId,
    status: 'open',
    bids: [],
    deliverables: [],
    revisions: 0,
    ...commission,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  const docRef = await addDoc(collection(db, 'writing_commissions'), payload);
  return { id: docRef.id, ...payload } as WritingCommission;
};

export const getCommissions = async (filters?: {
  status?: WritingCommission['status'];
  category?: WritingCategory;
  clientId?: string;
  writerId?: string;
}): Promise<WritingCommission[]> => {
  if (!db) return [];
  
  let q = query(
    collection(db, 'writing_commissions'),
    orderBy('createdAt', 'desc')
  );
  
  if (filters?.status) {
    q = query(q, where('status', '==', filters.status));
  }
  if (filters?.category) {
    q = query(q, where('category', '==', filters.category));
  }
  if (filters?.clientId) {
    q = query(q, where('clientId', '==', filters.clientId));
  }
  if (filters?.writerId) {
    q = query(q, where('writerId', '==', filters.writerId));
  }
  
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WritingCommission));
};

export const getCommissionById = async (id: string): Promise<WritingCommission> => {
  if (!db) throw new Error('Database not connected');
  const docSnap = await getDoc(doc(db, 'writing_commissions', id));
  if (!docSnap.exists()) throw new Error('Commission not found');
  return { id: docSnap.id, ...docSnap.data() } as WritingCommission;
};

// ═══════════════════════════════════════════════════════════════════════════════
// BIDDING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

export const submitBid = async (
  commissionId: string,
  writerId: string,
  bid: Omit<WritingBid, 'id' | 'writerId' | 'status' | 'createdAt'>
): Promise<WritingBid> => {
  if (!db) throw new Error('Database not connected');
  
  const commission = await getCommissionById(commissionId);
  if (commission.status !== 'open') {
    throw new Error('Commission is not open for bidding');
  }
  
  const bidData: WritingBid = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    writerId,
    ...bid,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  await updateDoc(doc(db, 'writing_commissions', commissionId), {
    bids: [...commission.bids, bidData],
    updatedAt: serverTimestamp()
  });
  
  return bidData;
};

export const acceptBid = async (
  commissionId: string,
  bidId: string
): Promise<WritingCommission> => {
  if (!db) throw new Error('Database not connected');
  
  const commission = await getCommissionById(commissionId);
  const bid = commission.bids.find(b => b.id === bidId);
  
  if (!bid) throw new Error('Bid not found');
  
  // Update all bids status
  const updatedBids = commission.bids.map(b => ({
    ...b,
    status: b.id === bidId ? 'accepted' : 'rejected' as const
  }));
  
  // 1. Update the commission
  await updateDoc(doc(db, 'writing_commissions', commissionId), {
    status: 'assigned',
    writerId: bid.writerId,
    bids: updatedBids,
    acceptedBidId: bidId,
    updatedAt: serverTimestamp()
  });
  
  // 2. Create the robust royalty contract (The "Global Ledger")
  await createRoyaltyContract(commissionId, bid);

  // 3. Optional: Create notification for the writer
  await addDoc(collection(db, 'notifications'), {
    userId: bid.writerId,
    type: 'bid_accepted',
    title: 'Bid Accepted!',
    message: `Your bid for "${commission.title}" has been accepted.`,
    link: `/commissions/${commissionId}`,
    read: false,
    createdAt: serverTimestamp()
  });
  
  return getCommissionById(commissionId);
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROYALTY CONTRACTS
// ═══════════════════════════════════════════════════════════════════════════════

export const createRoyaltyContract = async (
  commissionId: string,
  bid: WritingBid
): Promise<WritingRoyaltyContract> => {
  if (!db) throw new Error('Database not connected');
  
  const commission = await getCommissionById(commissionId);
  
  const contract: Omit<WritingRoyaltyContract, 'id'> = {
    commissionId,
    writerId: bid.writerId,
    clientId: commission.clientId,
    upfrontPayment: bid.price,
    royaltyPercentage: bid.royaltyPercentage,
    rights: {
      scope: 'exclusive_single_project', // Enforcing the "One Professional Use" rule
      territory: 'worldwide',
      duration: 'perpetual_for_this_game',
      modifications: 'client_can_modify_for_game_use_only',
      attribution: 'as_agreed'
    },
    usage: {
      gameRevenue: 0,
      royaltiesPaid: 0,
      active: true,
      lastStatusUpdate: new Date().toISOString()
    },
    status: 'active',
    createdAt: new Date().toISOString()
  };
  
  const docRef = await addDoc(collection(db, 'writing_royalty_contracts'), contract);
  return { id: docRef.id, ...contract };
};

export const getWriterRoyaltyContracts = async (writerId: string): Promise<WritingRoyaltyContract[]> => {
  if (!db) return [];
  
  const q = query(
    collection(db, 'writing_royalty_contracts'),
    where('writerId', '==', writerId),
    orderBy('createdAt', 'desc')
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WritingRoyaltyContract));
};

export const reportGameRevenue = async (
  contractId: string,
  gameRevenue: number,
  gameTitle?: string
): Promise<void> => {
  if (!db) throw new Error('Database not connected');
  
  const contract = await getDoc(doc(db, 'writing_royalty_contracts', contractId));
  if (!contract.exists()) throw new Error('Contract not found');
  
  const data = contract.data() as WritingRoyaltyContract;
  const royaltyAmount = gameRevenue * (data.royaltyPercentage / 100);
  
  await updateDoc(doc(db, 'writing_royalty_contracts', contractId), {
    'usage.gameRevenue': data.usage.gameRevenue + gameRevenue,
    'usage.royaltiesPaid': data.usage.royaltiesPaid + royaltyAmount,
    'usage.lastReported': new Date().toISOString(),
    ...(gameTitle && { 'usage.gameTitle': gameTitle })
  });
  
  // Create royalty payment record for the writer
  await addDoc(collection(db, 'writing_royalty_payments'), {
    contractId,
    writerId: data.writerId,
    amount: royaltyAmount,
    gameRevenue,
    percentage: data.royaltyPercentage,
    gameTitle: gameTitle || data.usage.gameTitle,
    status: 'pending',
    createdAt: serverTimestamp()
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// DELIVERY & REVIEW
// ═══════════════════════════════════════════════════════════════════════════════

export const submitDeliverable = async (
  commissionId: string,
  deliverable: Omit<WritingCommission['deliverables'][0], 'id' | 'status' | 'submittedAt'>
): Promise<WritingCommission> => {
  if (!db) throw new Error('Database not connected');
  
  const commission = await getCommissionById(commissionId);
  
  const newDeliverable = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...deliverable,
    status: 'pending_review' as const,
    submittedAt: new Date().toISOString()
  };
  
  await updateDoc(doc(db, 'writing_commissions', commissionId), {
    deliverables: [...commission.deliverables, newDeliverable],
    status: 'review',
    updatedAt: serverTimestamp()
  });
  
  return getCommissionById(commissionId);
};

export const requestRevision = async (
  commissionId: string,
  deliverableId: string,
  feedback: { text: string; changes: string[] }
): Promise<WritingCommission> => {
  if (!db) throw new Error('Database not connected');
  
  const commission = await getCommissionById(commissionId);
  
  if (commission.revisions >= commission.maxRevisions) {
    throw new Error('Maximum revisions reached');
  }
  
  const updatedDeliverables = commission.deliverables.map(d => 
    d.id === deliverableId
      ? {
          ...d,
          status: 'revision_requested' as const,
          revisionRequest: {
            feedback: feedback.text,
            specificChanges: feedback.changes,
            requestedAt: new Date().toISOString()
          }
        }
      : d
  );
  
  await updateDoc(doc(db, 'writing_commissions', commissionId), {
    deliverables: updatedDeliverables,
    status: 'in_progress',
    revisions: commission.revisions + 1,
    updatedAt: serverTimestamp()
  });
  
  return getCommissionById(commissionId);
};

export const approveDeliverable = async (
  commissionId: string
): Promise<WritingCommission> => {
  if (!db) throw new Error('Database not connected');
  
  await updateDoc(doc(db, 'writing_commissions', commissionId), {
    status: 'completed',
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  
  return getCommissionById(commissionId);
};

// ═══════════════════════════════════════════════════════════════════════════════
// WRITER STATS & DISCOVERY
// ═══════════════════════════════════════════════════════════════════════════════

export interface WriterStats {
  userId: string;
  displayName: string;
  tier: keyof typeof WRITER_TIERS;
  totalCommissions: number;
  completedCommissions: number;
  totalEarnings: number;
  ongoingRoyalties: number;
  averageRating: number;
  reviewCount: number;
  specialties: WritingCategory[];
}

export const getWriterStats = async (userId: string): Promise<WriterStats | null> => {
  if (!db) return null;
  
  // Get user data
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) return null;
  const user = userDoc.data() as User;
  
  // Get commissions
  const writerCommissions = await getCommissions({ writerId: userId });
  const completed = writerCommissions.filter(c => c.status === 'completed');
  
  // Get reviews
  const reviewsQuery = query(
    collection(db, 'writing_reviews'),
    where('writerId', '==', userId)
  );
  const reviewsSnap = await getDocs(reviewsQuery);
  const reviews = reviewsSnap.docs.map(d => d.data());
  
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
    : 0;
  
  // Get royalties
  const contracts = await getWriterRoyaltyContracts(userId);
  const totalRoyalties = contracts.reduce((sum, c) => sum + c.usage.royaltiesPaid, 0);
  
  // Calculate tier
  let tier: keyof typeof WRITER_TIERS = 'novice';
  for (const [tierName, tierData] of Object.entries(WRITER_TIERS)) {
    if (reviews.length >= tierData.minReviews && avgRating >= tierData.minRating) {
      tier = tierName as keyof typeof WRITER_TIERS;
    }
  }
  
  return {
    userId,
    displayName: user.username,
    tier,
    totalCommissions: writerCommissions.length,
    completedCommissions: completed.length,
    totalEarnings: completed.reduce((sum, c) => sum + (c.budgetMax || 0), 0) + totalRoyalties,
    ongoingRoyalties: totalRoyalties,
    averageRating: Math.round(avgRating * 10) / 10,
    reviewCount: reviews.length,
    specialties: [...new Set(writerCommissions.map(c => c.category))]
  };
};

export const searchWriters = async (filters?: {
  specialty?: WritingCategory;
  minRating?: number;
  tier?: keyof typeof WRITER_TIERS;
  availability?: 'available' | 'busy' | 'booked';
}): Promise<WriterStats[]> => {
  if (!db) return [];
  
  // Get all users with writer profiles
  const q = query(
    collection(db, 'users'),
    where('role', 'in', ['creator', 'admin'])
  );
  
  const snap = await getDocs(q);
  const writers: WriterStats[] = [];
  
  for (const doc of snap.docs) {
    const stats = await getWriterStats(doc.id);
    if (stats && stats.completedCommissions > 0) {
      writers.push(stats);
    }
  }
  
  // Apply filters
  let filtered = writers;
  
  if (filters?.specialty) {
    filtered = filtered.filter(w => w.specialties.includes(filters.specialty!));
  }
  if (filters?.minRating) {
    filtered = filtered.filter(w => w.averageRating >= filters.minRating!);
  }
  if (filters?.tier) {
    filtered = filtered.filter(w => w.tier === filters.tier);
  }
  
  // Sort by rating + review count
  filtered.sort((a, b) => {
    const scoreA = (a.averageRating * 0.6) + (a.reviewCount * 0.01);
    const scoreB = (b.averageRating * 0.6) + (b.reviewCount * 0.01);
    return scoreB - scoreA;
  });
  
  return filtered;
};

// ═══════════════════════════════════════════════════════════════════════════════
// REVIEWS
// ═══════════════════════════════════════════════════════════════════════════════

export interface WritingReview {
  id: string;
  commissionId: string;
  clientId: string;
  writerId: string;
  rating: number;
  categories: {
    communication: number;
    quality: number;
    timeliness: number;
    professionalism: number;
  };
  title: string;
  text: string;
  wouldRecommend: boolean;
  isPublic: boolean;
  createdAt: string;
}

export const submitReview = async (
  commissionId: string,
  review: Omit<WritingReview, 'id' | 'commissionId' | 'createdAt'>
): Promise<WritingReview> => {
  if (!db) throw new Error('Database not connected');
  
  const payload = {
    commissionId,
    ...review,
    createdAt: new Date().toISOString()
  };
  
  const docRef = await addDoc(collection(db, 'writing_reviews'), payload);
  return { id: docRef.id, ...payload };
};

export const getWriterReviews = async (writerId: string): Promise<WritingReview[]> => {
  if (!db) return [];
  
  const q = query(
    collection(db, 'writing_reviews'),
    where('writerId', '==', writerId),
    where('isPublic', '==', true),
    orderBy('createdAt', 'desc')
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WritingReview));
};
