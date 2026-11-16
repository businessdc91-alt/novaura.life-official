/**
 * NovAura Platform — messageService.ts
 *
 * Unified messaging layer with real-time Firestore subscriptions.
 * All DMs and chat rooms use onSnapshot so messages sent from the
 * WebOS SocialNetworkWindow appear instantly in the Platform MessagesPage
 * and vice versa — no polling, no page-reload required.
 *
 * Firestore schema (shared with WebOS socialService.js):
 *   social_dm_threads/{threadId}                     — thread metadata
 *   social_dm_threads/{threadId}/messages/{msgId}    — individual messages
 *   social_chat_rooms/{roomId}/messages/{msgId}      — public room messages
 */

import type { Message, Conversation } from '@/types';
import { db, isFirebaseConfigured } from '../config/firebase';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { kernelStorage } from '@/kernel/kernelStorage.js';

// ── Constants ──────────────────────────────────────────────────────────────────

const COLLECTIONS = {
  dmThreads: 'social_dm_threads',
  chatRooms: 'social_chat_rooms',
};

const STORAGE_KEYS = {
  messages:      'novaura_messages',
  conversations: 'novaura_conversations',
};

// Chat room IDs that the platform exposes
export const PLATFORM_ROOMS = [
  { id: 'ROOM_CREATORS', name: 'Creators Hub',    role: 'creator', description: 'Exclusive space for creative pros' },
  { id: 'ROOM_DEVS',     name: 'Dev Sanctuary',   role: 'admin',   description: 'Behind-the-scenes engineering talk' },
  { id: 'general',       name: 'General',          role: null,      description: 'Hang out and chat' },
  { id: 'art',           name: 'Art & Design',     role: null,      description: 'Creative corner' },
  { id: 'gaming',        name: 'Gaming',           role: null,      description: 'Game on' },
  { id: 'music',         name: 'Music',            role: null,      description: 'Beats & tracks' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Deterministic thread ID shared between Platform and WebOS */
function buildThreadId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

function nowISO(): string {
  return new Date().toISOString();
}

function timestampToISO(value: any): string {
  if (!value) return nowISO();
  // Firestore Timestamp
  if (typeof value?.toMillis === 'function') return new Date(value.toMillis()).toISOString();
  // Unix ms number
  if (typeof value === 'number') return new Date(value).toISOString();
  return String(value);
}

/** Map a raw Firestore DM doc → typed Message */
function firestoreDMToMessage(docSnap: any, threadId: string): Message {
  const d = docSnap.data();
  return {
    id:          docSnap.id,
    senderId:    d.senderId || 'unknown',
    recipientId: d.recipientId || threadId,
    type:        d.type || 'text',
    content:     d.content || d.text || '',
    status:      d.read ? 'read' : 'sent',
    createdAt:   timestampToISO(d.createdAt),
    readAt:      d.readAt ? timestampToISO(d.readAt) : undefined,
  };
}

/** Map a raw Firestore room message doc → typed Message */
function firestoreRoomToMessage(docSnap: any, roomId: string): Message {
  const d = docSnap.data();
  return {
    id:          docSnap.id,
    senderId:    d.authorId || d.senderId || 'unknown',
    recipientId: roomId,
    type:        'text',
    content:     d.content || d.text || '',
    status:      'sent',
    createdAt:   timestampToISO(d.createdAt),
  };
}

// ── Offline localStorage fallback ──────────────────────────────────────────────

export const initializeMessageStorage = (): void => {
  if (!kernelStorage.getItem(STORAGE_KEYS.messages)) {
    kernelStorage.setItem(STORAGE_KEYS.messages, JSON.stringify([]));
  }
  if (!kernelStorage.getItem(STORAGE_KEYS.conversations)) {
    kernelStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify([]));
  }
};

const getAllLocalMessages = (): Message[] => {
  try {
    const data = kernelStorage.getItem(STORAGE_KEYS.messages);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveLocalMessages = (messages: Message[]): void => {
  kernelStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(messages));
};

const upsertLocalMessage = (msg: Message): void => {
  const messages = getAllLocalMessages();
  const idx = messages.findIndex(m => m.id === msg.id);
  if (idx >= 0) {
    messages[idx] = msg;
  } else {
    messages.push(msg);
  }
  saveLocalMessages(messages);
};

// ── Real-time subscriptions ────────────────────────────────────────────────────

/**
 * Subscribe to all DM threads for the current user.
 * Calls `onThreads(conversations)` whenever any thread changes.
 * Returns an unsubscribe function.
 */
export const subscribeToDMThreads = (
  userId: string,
  onThreads: (conversations: Conversation[]) => void
): Unsubscribe => {
  if (!isFirebaseConfigured || !db) {
    // Offline: derive from localStorage once
    onThreads(getUserConversationsLocal(userId));
    return () => {};
  }

  const q = query(
    collection(db, COLLECTIONS.dmThreads),
    where('participants', 'array-contains', userId),
    orderBy('lastAt', 'desc'),
    limit(100)
  );

  return onSnapshot(q, async (snapshot) => {
    const conversations: Conversation[] = await Promise.all(
      snapshot.docs.map(async (threadDoc) => {
        const data = threadDoc.data();
        const participants: string[] = data.participants || [];
        const otherUserId = participants.find(p => p !== userId) || '';

        // Fetch the other user's profile from Firestore `users` collection
        let otherUser: any = { id: otherUserId, username: otherUserId };
        if (otherUserId) {
          try {
            const userSnap = await getDoc(doc(db!, 'users', otherUserId));
            if (userSnap.exists()) {
              otherUser = { id: userSnap.id, ...userSnap.data() };
            }
          } catch {
            // fallback to ID
          }
        }

        const lastMessageContent = data.lastMessage || '';
        const lastAt = timestampToISO(data.lastAt);

        const lastMessage: Message = {
          id:          `thread_preview_${threadDoc.id}`,
          senderId:    '',
          recipientId: userId,
          type:        'text',
          content:     lastMessageContent,
          status:      'sent',
          createdAt:   lastAt,
        };

        return {
          id:           threadDoc.id,
          participants: [userId, otherUserId],
          lastMessage,
          otherUser,
          unreadCount:  data.unreadCount?.[userId] || 0,
          updatedAt:    lastAt,
        } as Conversation & { otherUser: any };
      })
    );

    onThreads(conversations);
  }, (error) => {
    console.error('[messageService] DM thread subscription error:', error);
    onThreads(getUserConversationsLocal(userId));
  });
};

/**
 * Subscribe to real-time messages in a specific DM conversation.
 * Returns an unsubscribe function.
 */
export const subscribeToDMMessages = (
  currentUserId: string,
  otherUserId: string,
  onMessages: (messages: Message[]) => void
): Unsubscribe => {
  if (!isFirebaseConfigured || !db) {
    onMessages(getMessagesBetween(currentUserId, otherUserId));
    return () => {};
  }

  const threadId = buildThreadId(currentUserId, otherUserId);
  const q = query(
    collection(db, COLLECTIONS.dmThreads, threadId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(200)
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(d => firestoreDMToMessage(d, threadId));
    // Keep local cache in sync
    messages.forEach(upsertLocalMessage);
    onMessages(messages);
  }, (error) => {
    console.error('[messageService] DM message subscription error:', error);
    onMessages(getMessagesBetween(currentUserId, otherUserId));
  });
};

/**
 * Subscribe to real-time messages in a public chat room.
 * Shared collection path with WebOS socialService.js.
 * Returns an unsubscribe function.
 */
export const subscribeToRoomMessages = (
  roomId: string,
  onMessages: (messages: Message[]) => void
): Unsubscribe => {
  if (!isFirebaseConfigured || !db) {
    onMessages(getRoomMessages(roomId));
    return () => {};
  }

  const q = query(
    collection(db, COLLECTIONS.chatRooms, roomId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(200)
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(d => firestoreRoomToMessage(d, roomId));
    messages.forEach(upsertLocalMessage);
    onMessages(messages);
  }, (error) => {
    console.error('[messageService] Room subscription error:', error);
    onMessages(getRoomMessages(roomId));
  });
};

// ── Send functions ─────────────────────────────────────────────────────────────

/**
 * Send a DM. Writes to Firestore (shared with WebOS) and local cache.
 */
export const sendMessage = (
  senderId: string,
  recipientId: string,
  content: string,
  type: Message['type'] = 'text',
  contractData?: Message['contractData']
): Message => {
  const newMessage: Message = {
    id:          `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    senderId,
    recipientId,
    type,
    content,
    contractData,
    status:      'sent',
    createdAt:   nowISO(),
  };

  // Optimistic local save
  upsertLocalMessage(newMessage);

  if (isFirebaseConfigured && db) {
    const threadId = buildThreadId(senderId, recipientId);
    // Write message doc
    addDoc(collection(db, COLLECTIONS.dmThreads, threadId, 'messages'), {
      senderId,
      recipientId,
      content,
      text:      content,   // WebOS reads 'text'
      type,
      read:      false,
      createdAt: serverTimestamp(),
    }).catch(e => console.warn('[messageService] sendMessage write failed:', e));

    // Update thread metadata — supports unread count per user
    setDoc(
      doc(db, COLLECTIONS.dmThreads, threadId),
      {
        participants:           [senderId, recipientId],
        lastMessage:            content,
        lastAt:                 serverTimestamp(),
        [`unreadCount.${recipientId}`]: 1,
      },
      { merge: true }
    ).catch(e => console.warn('[messageService] thread metadata update failed:', e));
  }

  return newMessage;
};

/**
 * Send a message to a public chat room.
 * Shared Firestore path with WebOS socialService.js sendChatMessage().
 */
export const sendRoomMessage = (
  senderId: string,
  roomId: string,
  content: string
): Message => {
  const newMessage: Message = {
    id:          `msg_room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    senderId,
    recipientId: roomId,
    type:        'text',
    content,
    status:      'sent',
    createdAt:   nowISO(),
  };

  upsertLocalMessage(newMessage);

  if (isFirebaseConfigured && db) {
    addDoc(collection(db, COLLECTIONS.chatRooms, roomId, 'messages'), {
      authorId:    senderId,
      senderId,
      text:        content,   // WebOS reads 'text'
      content,
      createdAt:   serverTimestamp(),
    }).catch(e => console.warn('[messageService] sendRoomMessage write failed:', e));
  }

  return newMessage;
};

// ── Mark as read ───────────────────────────────────────────────────────────────

export const markMessagesAsRead = async (
  currentUserId: string,
  otherUserId: string
): Promise<void> => {
  // Update local cache
  const messages = getAllLocalMessages();
  let updated = false;
  messages.forEach(m => {
    if (m.recipientId === currentUserId && m.senderId === otherUserId && m.status !== 'read') {
      m.status = 'read';
      m.readAt = nowISO();
      updated = true;
    }
  });
  if (updated) saveLocalMessages(messages);

  // Clear unread counter in Firestore thread doc
  if (isFirebaseConfigured && db) {
    const threadId = buildThreadId(currentUserId, otherUserId);
    try {
      await updateDoc(doc(db, COLLECTIONS.dmThreads, threadId), {
        [`unreadCount.${currentUserId}`]: 0,
      });
    } catch {
      // Thread may not exist yet — harmless
    }
  }
};

// ── One-shot reads (offline fallback) ─────────────────────────────────────────

export const getMessagesBetween = (userId1: string, userId2: string): Message[] => {
  const messages = getAllLocalMessages();
  return messages
    .filter(
      m =>
        (m.senderId === userId1 && m.recipientId === userId2) ||
        (m.senderId === userId2 && m.recipientId === userId1)
    )
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

export const getRoomMessages = (roomId: string): Message[] => {
  return getAllLocalMessages()
    .filter(m => m.recipientId === roomId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

const getUserConversationsLocal = (userId: string): Conversation[] => {
  const messages = getAllLocalMessages();
  const map = new Map<string, Conversation>();

  messages.forEach(message => {
    if (message.senderId === userId || message.recipientId === userId) {
      const otherId = message.senderId === userId ? message.recipientId : message.senderId;
      if (otherId.startsWith('ROOM_') || otherId === userId) return;

      const existing = map.get(otherId);
      if (!existing) {
        map.set(otherId, {
          id:           `conv_${userId}_${otherId}`,
          participants: [userId, otherId],
          lastMessage:  message,
          unreadCount:  message.recipientId === userId && message.status !== 'read' ? 1 : 0,
          updatedAt:    message.createdAt,
        });
      } else {
        if (new Date(message.createdAt) > new Date(existing.updatedAt)) {
          existing.lastMessage = message;
          existing.updatedAt   = message.createdAt;
        }
        if (message.recipientId === userId && message.status !== 'read') {
          existing.unreadCount++;
        }
      }
    }
  });

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
};

export const getUserConversations = getUserConversationsLocal;

export const getUnreadCount = (userId: string): number => {
  return getAllLocalMessages().filter(
    m => m.recipientId === userId && m.status !== 'read'
  ).length;
};

// ── System / platform messages ─────────────────────────────────────────────────

export const sendSystemMessage = (recipientId: string, content: string): Message =>
  sendMessage('system', recipientId, content, 'system');

export const sendSystemMessageToAll = async (content: string): Promise<void> => {
  if (!db) return;
  const usersSnapshot = await getDocs(collection(db, 'users'));
  usersSnapshot.docs.forEach(userDoc => sendMessage('system', userDoc.id, content, 'system'));
};

export const addOwnerAsContact = (newUserId: string): void => {
  sendMessage(
    'owner_dillan',
    newUserId,
    `Welcome to NovAura! I'm Dillan, the founder. If you ever need anything, just reach out. Happy creating!`,
    'text'
  );
};

export const deleteMessage = (messageId: string): void => {
  const filtered = getAllLocalMessages().filter(m => m.id !== messageId);
  saveLocalMessages(filtered);
};
