import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, limit, serverTimestamp,
  getDocs, setDoc, getDoc, where, Timestamp
} from 'firebase/firestore';
import { db, auth } from './firebase';

export interface ChatMessage {
  id: string;
  channelId: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL?: string;
  content: string;
  type: 'text' | 'code' | 'file' | 'system';
  codeLanguage?: string;
  fileURL?: string;
  fileName?: string;
  mentions: string[];
  reactions: Record<string, string[]>;
  replyTo?: string;
  edited: boolean;
  createdAt: Timestamp;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  type: 'general' | 'dev' | 'ops' | 'private' | 'announcements';
  members: string[];
  createdBy: string;
  createdAt: Timestamp;
  lastMessage?: string;
  lastMessageAt?: Timestamp;
  pinned?: boolean;
}

export interface UserPresence {
  userId: string;
  displayName: string;
  photoURL?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: Timestamp;
  role: 'owner' | 'admin' | 'dev' | 'staff';
}

// Default channels seeded on first run
const DEFAULT_CHANNELS: Omit<Channel, 'id' | 'createdAt'>[] = [
  { name: 'general', description: 'Team-wide updates and announcements', type: 'general', members: [], createdBy: 'system', pinned: true },
  { name: 'dev-ops', description: 'Deployments, builds, infra', type: 'dev', members: [], createdBy: 'system', pinned: true },
  { name: 'code-review', description: 'PRs, fixes, and code discussion', type: 'dev', members: [], createdBy: 'system' },
  { name: 'ai-research', description: 'AI model experiments and integrations', type: 'dev', members: [], createdBy: 'system' },
  { name: 'product', description: 'Features, roadmap, and UX', type: 'ops', members: [], createdBy: 'system' },
  { name: 'incidents', description: 'Live incident tracking and resolution', type: 'ops', members: [], createdBy: 'system' },
];

export async function seedChannels() {
  const snap = await getDocs(collection(db, 'ops_channels'));
  if (snap.empty) {
    for (const ch of DEFAULT_CHANNELS) {
      await addDoc(collection(db, 'ops_channels'), { ...ch, createdAt: serverTimestamp() });
    }
  }
}

export function subscribeToChannels(cb: (channels: Channel[]) => void) {
  return onSnapshot(
    query(collection(db, 'ops_channels'), orderBy('pinned', 'desc'), orderBy('name')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Channel))
  );
}

export function subscribeToMessages(channelId: string, cb: (msgs: ChatMessage[]) => void) {
  return onSnapshot(
    query(
      collection(db, 'ops_channels', channelId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(200)
    ),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }) as ChatMessage))
  );
}

export async function sendMessage(
  channelId: string,
  content: string,
  type: ChatMessage['type'] = 'text',
  extra: Partial<ChatMessage> = {}
) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const msg = {
    channelId,
    userId: user.uid,
    userDisplayName: user.displayName || user.email || 'Team Member',
    userPhotoURL: user.photoURL || null,
    content,
    type,
    mentions: extractMentions(content),
    reactions: {},
    edited: false,
    createdAt: serverTimestamp(),
    ...extra,
  };
  const ref = await addDoc(collection(db, 'ops_channels', channelId, 'messages'), msg);
  // Update channel last message
  await updateDoc(doc(db, 'ops_channels', channelId), {
    lastMessage: content.slice(0, 80),
    lastMessageAt: serverTimestamp(),
  });
  return ref.id;
}

export async function addReaction(channelId: string, messageId: string, emoji: string) {
  const user = auth.currentUser;
  if (!user) return;
  const ref = doc(db, 'ops_channels', channelId, 'messages', messageId);
  const snap = await getDoc(ref);
  const reactions = snap.data()?.reactions || {};
  const users: string[] = reactions[emoji] || [];
  const idx = users.indexOf(user.uid);
  if (idx >= 0) users.splice(idx, 1); else users.push(user.uid);
  if (users.length === 0) delete reactions[emoji]; else reactions[emoji] = users;
  await updateDoc(ref, { reactions });
}

export async function setUserPresence(status: UserPresence['status']) {
  const user = auth.currentUser;
  if (!user) return;
  await setDoc(doc(db, 'ops_presence', user.uid), {
    userId: user.uid,
    displayName: user.displayName || user.email,
    photoURL: user.photoURL,
    status,
    lastSeen: serverTimestamp(),
  }, { merge: true });
}

export function subscribeToPresence(cb: (users: UserPresence[]) => void) {
  return onSnapshot(
    query(collection(db, 'ops_presence'), where('status', 'in', ['online', 'away', 'busy'])),
    snap => cb(snap.docs.map(d => d.data() as UserPresence))
  );
}

function extractMentions(content: string): string[] {
  const matches = content.match(/@(\w+)/g);
  return matches ? matches.map(m => m.slice(1)) : [];
}
