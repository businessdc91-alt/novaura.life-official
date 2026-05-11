import {
  collection, doc, addDoc, updateDoc, onSnapshot,
  query, orderBy, where, Timestamp, serverTimestamp, arrayUnion,
} from 'firebase/firestore';
import { db, auth } from './firebase';

export type TicketStatus = 'new' | 'open' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'urgent' | 'high' | 'normal' | 'low';
export type TicketType = 'bug' | 'billing' | 'account' | 'feature' | 'general';

export interface TicketReply {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  isStaff: boolean;
  content: string;
  createdAt: Timestamp;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userPhoto?: string;
  subject: string;
  message: string;
  type: TicketType;
  status: TicketStatus;
  priority: TicketPriority;
  assignedTo?: string;
  assignedName?: string;
  replies: TicketReply[];
  seen: boolean;           // false = ops hasn't opened it yet → blink
  createdAt: Timestamp;
  updatedAt: Timestamp;
  resolvedAt?: Timestamp;
}

export const TICKET_STATUS_CONFIG: Record<TicketStatus, { label: string; color: string }> = {
  new:      { label: 'New',      color: '#ff0080' },
  open:     { label: 'Open',     color: '#00f0ff' },
  pending:  { label: 'Pending',  color: '#f59e0b' },
  resolved: { label: 'Resolved', color: '#22c55e' },
  closed:   { label: 'Closed',   color: '#64748b' },
};

export const TICKET_PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: '#ff0080' },
  high:   { label: 'High',   color: '#f97316' },
  normal: { label: 'Normal', color: '#00f0ff' },
  low:    { label: 'Low',    color: '#64748b' },
};

export const TICKET_TYPE_CONFIG: Record<TicketType, { label: string }> = {
  bug:     { label: 'Bug / Error' },
  billing: { label: 'Billing' },
  account: { label: 'Account' },
  feature: { label: 'Feature Request' },
  general: { label: 'General' },
};

// ── subscribe (ops) ──────────────────────────────────────────────────

export function subscribeTickets(
  statusFilter: TicketStatus | null,
  cb: (tickets: SupportTicket[]) => void,
) {
  const q = statusFilter
    ? query(collection(db, 'support_tickets'), where('status', '==', statusFilter), orderBy('createdAt', 'desc'))
    : query(collection(db, 'support_tickets'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SupportTicket))
  );
}

export function subscribeNewTicketCount(cb: (count: number) => void) {
  return onSnapshot(
    query(collection(db, 'support_tickets'), where('seen', '==', false)),
    snap => cb(snap.size),
  );
}

// ── staff actions ────────────────────────────────────────────────────

export async function markSeen(ticketId: string) {
  await updateDoc(doc(db, 'support_tickets', ticketId), { seen: true });
}

export async function updateTicketStatus(ticketId: string, status: TicketStatus) {
  const updates: any = { status, updatedAt: serverTimestamp() };
  if (status === 'resolved' || status === 'closed') updates.resolvedAt = serverTimestamp();
  await updateDoc(doc(db, 'support_tickets', ticketId), updates);
}

export async function updateTicketPriority(ticketId: string, priority: TicketPriority) {
  await updateDoc(doc(db, 'support_tickets', ticketId), { priority, updatedAt: serverTimestamp() });
}

export async function assignTicket(ticketId: string) {
  const user = auth.currentUser;
  if (!user) return;
  await updateDoc(doc(db, 'support_tickets', ticketId), {
    assignedTo: user.uid,
    assignedName: user.displayName || user.email,
    status: 'open',
    updatedAt: serverTimestamp(),
  });
}

export async function replyToTicket(ticketId: string, content: string) {
  const user = auth.currentUser;
  if (!user) return;
  const reply: TicketReply = {
    id: crypto.randomUUID(),
    authorId: user.uid,
    authorName: user.displayName || user.email || 'Staff',
    authorPhoto: user.photoURL || undefined,
    isStaff: true,
    content,
    createdAt: Timestamp.now(),
  };
  await updateDoc(doc(db, 'support_tickets', ticketId), {
    replies: arrayUnion(reply),
    status: 'pending',
    updatedAt: serverTimestamp(),
    seen: true,
  });
}

// ── submit from platform (novaura.life) ─────────────────────────────

export async function submitTicket(payload: {
  userId: string;
  userEmail: string;
  userName: string;
  userPhoto?: string;
  subject: string;
  message: string;
  type: TicketType;
}) {
  return addDoc(collection(db, 'support_tickets'), {
    ...payload,
    status: 'new',
    priority: 'normal',
    replies: [],
    seen: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
