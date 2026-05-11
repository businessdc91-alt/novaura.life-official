import {
  ref, set, remove, onValue, onDisconnect, serverTimestamp as rtdbTimestamp,
} from 'firebase/database';
import {
  collection, doc, getDoc, setDoc, getDocs, addDoc,
  onSnapshot, query, orderBy, where, Timestamp, updateDoc,
} from 'firebase/firestore';
import { rtdb, db, auth } from './firebase';

// ── Extension management ─────────────────────────────────────────────

export interface PhoneExtension {
  uid: string;
  extension: string;
  displayName: string;
  email: string;
  photoURL?: string;
  isOwner?: boolean;
}

const OWNER_EMAILS = ['lostitonce420@gmail.com', 'dillan.copeland@novaura.xyz', 'business.dc91@gmail.com'];

export async function getOrAssignExtension(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const myRef = doc(db, 'ops_extensions', user.uid);
  const snap = await getDoc(myRef);
  if (snap.exists()) return snap.data().extension as string;

  // Owner always gets 100
  if (OWNER_EMAILS.includes((user.email || '').toLowerCase())) {
    await setDoc(myRef, {
      uid: user.uid,
      extension: '100',
      displayName: user.displayName || user.email,
      email: user.email,
      photoURL: user.photoURL || null,
      isOwner: true,
    });
    return '100';
  }

  // Find next available starting at 101
  const allSnap = await getDocs(collection(db, 'ops_extensions'));
  const taken = new Set(allSnap.docs.map(d => d.data().extension as string));
  let next = 101;
  while (taken.has(String(next))) next++;

  await setDoc(myRef, {
    uid: user.uid,
    extension: String(next),
    displayName: user.displayName || user.email,
    email: user.email,
    photoURL: user.photoURL || null,
    isOwner: false,
  });
  return String(next);
}

export function subscribeExtensions(cb: (exts: PhoneExtension[]) => void) {
  return onSnapshot(collection(db, 'ops_extensions'), snap =>
    cb(snap.docs.map(d => d.data() as PhoneExtension).sort((a, b) => +a.extension - +b.extension))
  );
}

export async function findExtension(ext: string): Promise<PhoneExtension | null> {
  const snap = await getDocs(query(collection(db, 'ops_extensions'), where('extension', '==', ext)));
  if (snap.empty) return null;
  return snap.docs[0].data() as PhoneExtension;
}

// ── Call state (Firebase RTDB) ───────────────────────────────────────

export interface IncomingCall {
  callId: string;
  callerId: string;
  callerName: string;
  callerExt: string;
  callerPhoto?: string;
  roomId: string;
  timestamp: number;
}

export interface ActiveCallState {
  callId: string;
  remoteUid: string;
  remoteName: string;
  remoteExt: string;
  remotePhoto?: string;
  direction: 'outbound' | 'inbound';
  startedAt: number;
}

let _activeCall: ActiveCallState | null = null;
export const getActiveCall = () => _activeCall;

export async function dialExtension(targetExt: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const target = await findExtension(targetExt);
  if (!target) throw new Error(`Extension ${targetExt} not found`);

  const myExt = await getOrAssignExtension();
  const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const roomId = callId;

  const callData: IncomingCall = {
    callId,
    callerId: user.uid,
    callerName: user.displayName || user.email || 'Staff',
    callerExt: myExt,
    callerPhoto: user.photoURL || undefined,
    roomId,
    timestamp: Date.now(),
  };

  // Write to callee's incoming call slot
  const callRef = ref(rtdb, `phone_incoming/${target.uid}`);
  await set(callRef, callData);

  // Auto-clear if callee disconnects before answering
  onDisconnect(ref(rtdb, `phone_active/${callId}`)).remove();

  _activeCall = {
    callId,
    remoteUid: target.uid,
    remoteName: target.displayName,
    remoteExt: target.extension,
    remotePhoto: target.photoURL,
    direction: 'outbound',
    startedAt: Date.now(),
  };

  // Log the attempt
  await logCall({
    callId,
    callerId: user.uid,
    callerExt: myExt,
    calleeId: target.uid,
    calleeExt: target.extension,
    status: 'dialing',
    startedAt: Timestamp.now(),
  });

  return callId;
}

export async function acceptCall(incoming: IncomingCall): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  // Mark active in RTDB so both sides know it's live
  await set(ref(rtdb, `phone_active/${incoming.callId}`), {
    callId: incoming.callId,
    participants: [incoming.callerId, user.uid],
    startedAt: Date.now(),
  });

  // Clear the incoming ring
  await remove(ref(rtdb, `phone_incoming/${user.uid}`));

  _activeCall = {
    callId: incoming.callId,
    remoteUid: incoming.callerId,
    remoteName: incoming.callerName,
    remoteExt: incoming.callerExt,
    remotePhoto: incoming.callerPhoto,
    direction: 'inbound',
    startedAt: Date.now(),
  };

  await updateCallLog(incoming.callId, { status: 'active' });
}

export async function declineCall(incoming: IncomingCall): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  await remove(ref(rtdb, `phone_incoming/${user.uid}`));
  // Notify caller of decline
  await set(ref(rtdb, `phone_declined/${incoming.callId}`), { declinedAt: Date.now() });
  await updateCallLog(incoming.callId, { status: 'declined', endedAt: Timestamp.now() });
}

export async function endCall(callId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const call = _activeCall;
  _activeCall = null;

  if (call) {
    const mins = Math.round((Date.now() - call.startedAt) / 60000);
    await updateCallLog(callId, {
      status: 'completed',
      endedAt: Timestamp.now(),
      durationMinutes: mins,
    });
  }

  await remove(ref(rtdb, `phone_active/${callId}`));
  await remove(ref(rtdb, `phone_incoming/${user.uid}`));
  // Also clear callee's incoming in case they haven't answered yet
  if (call?.remoteUid) {
    await remove(ref(rtdb, `phone_incoming/${call.remoteUid}`));
  }
}

// ── Subscriptions ────────────────────────────────────────────────────

export function subscribeIncomingCalls(cb: (call: IncomingCall | null) => void) {
  const user = auth.currentUser;
  if (!user) { cb(null); return () => {}; }
  const r = ref(rtdb, `phone_incoming/${user.uid}`);
  return onValue(r, snap => cb(snap.exists() ? snap.val() as IncomingCall : null));
}

export function subscribeCallDeclined(callId: string, cb: () => void) {
  const r = ref(rtdb, `phone_declined/${callId}`);
  return onValue(r, snap => { if (snap.exists()) cb(); });
}

export function subscribeCallAccepted(callId: string, cb: () => void) {
  const r = ref(rtdb, `phone_active/${callId}`);
  return onValue(r, snap => { if (snap.exists()) cb(); });
}

// ── Call log (Firestore) ─────────────────────────────────────────────

export interface CallLogEntry {
  id?: string;
  callId: string;
  callerId: string;
  callerExt: string;
  calleeId: string;
  calleeExt: string;
  status: 'dialing' | 'active' | 'completed' | 'declined' | 'missed';
  startedAt: Timestamp;
  endedAt?: Timestamp;
  durationMinutes?: number;
}

async function logCall(entry: Omit<CallLogEntry, 'id'>) {
  await addDoc(collection(db, 'ops_call_log'), entry);
}

async function updateCallLog(callId: string, updates: Partial<CallLogEntry>) {
  const snap = await getDocs(query(collection(db, 'ops_call_log'), where('callId', '==', callId)));
  if (!snap.empty) await updateDoc(snap.docs[0].ref, updates as any);
}

export function subscribeMyCallLog(cb: (log: CallLogEntry[]) => void) {
  const user = auth.currentUser;
  if (!user) return () => {};
  return onSnapshot(
    query(
      collection(db, 'ops_call_log'),
      where('callerId', '==', user.uid),
      orderBy('startedAt', 'desc'),
    ),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }) as CallLogEntry))
  );
}

// ── Ring tone (Web Audio API) ────────────────────────────────────────

export function startRingTone(): () => void {
  let running = true;
  let ctx: AudioContext | null = null;

  const ring = () => {
    if (!running) return;
    try {
      const c = new AudioContext();
      ctx = c;
      const g = c.createGain();
      g.gain.value = 0.08;
      g.connect(c.destination);
      [440, 480].forEach(freq => {
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(g);
        osc.start();
        osc.stop(c.currentTime + 1.2);
      });
      setTimeout(() => { c.close(); ctx = null; if (running) setTimeout(ring, 1800); }, 1300);
    } catch {}
  };

  ring();
  return () => { running = false; ctx?.close(); };
}
