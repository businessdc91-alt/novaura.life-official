import {
  collection, doc, addDoc, updateDoc, getDocs, onSnapshot,
  query, orderBy, where, Timestamp, serverTimestamp, getDoc, setDoc,
} from 'firebase/firestore';
import { db, auth } from './firebase';

export interface TimeEntry {
  id: string;
  uid: string;
  displayName: string;
  photoURL?: string;
  clockIn: Timestamp;
  clockOut?: Timestamp;
  durationMinutes?: number;
  date: string;       // YYYY-MM-DD local date of clock-in
  note?: string;
  auto: boolean;      // true = auto-clocked on login
}

export interface StaffHours {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: string;
  isEquity: boolean;
  equityBonus?: number;  // bonus % on top of back-pay rate
  totalMinutes: number;
  currentSessionStart?: Timestamp;
  isClocked: boolean;
}

// ── helpers ──────────────────────────────────────────────────────────

function localDateStr(ts?: Date): string {
  const d = ts || new Date();
  return d.toISOString().slice(0, 10);
}

function minutesBetween(a: Timestamp, b: Timestamp): number {
  return Math.round((b.toMillis() - a.toMillis()) / 60000);
}

// ── clock in ─────────────────────────────────────────────────────────

export async function clockIn(auto = false): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  // Check if already clocked in (open session without clockOut)
  const openQ = query(
    collection(db, 'ops_time_logs'),
    where('uid', '==', user.uid),
    where('clockOut', '==', null),
  );
  const openSnap = await getDocs(openQ);
  if (!openSnap.empty) return openSnap.docs[0].id; // already in

  const now = Timestamp.now();
  const entry: Omit<TimeEntry, 'id'> = {
    uid: user.uid,
    displayName: user.displayName || user.email || 'Staff',
    photoURL: user.photoURL || undefined,
    clockIn: now,
    clockOut: undefined as any,
    date: localDateStr(),
    auto,
  };

  const ref = await addDoc(collection(db, 'ops_time_logs'), entry);

  // Update staff summary
  await updateStaffSummary(user.uid, { currentSessionStart: now, isClocked: true });

  return ref.id;
}

// ── clock out ────────────────────────────────────────────────────────

export async function clockOut(note?: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const openQ = query(
    collection(db, 'ops_time_logs'),
    where('uid', '==', user.uid),
    where('clockOut', '==', null),
  );
  const openSnap = await getDocs(openQ);
  if (openSnap.empty) return;

  const entryDoc = openSnap.docs[0];
  const entry = entryDoc.data() as TimeEntry;
  const now = Timestamp.now();
  const mins = minutesBetween(entry.clockIn, now);

  await updateDoc(doc(db, 'ops_time_logs', entryDoc.id), {
    clockOut: now,
    durationMinutes: mins,
    note: note || null,
  });

  // Add to total on staff summary
  const summaryRef = doc(db, 'ops_hours', user.uid);
  const summarySnap = await getDoc(summaryRef);
  const prev = summarySnap.exists() ? (summarySnap.data().totalMinutes || 0) : 0;
  await updateStaffSummary(user.uid, {
    totalMinutes: prev + mins,
    currentSessionStart: null,
    isClocked: false,
  });
}

// ── helpers for summary ──────────────────────────────────────────────

async function updateStaffSummary(uid: string, updates: Partial<StaffHours>) {
  const ref = doc(db, 'ops_hours', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, updates as any);
  } else {
    const user = auth.currentUser;
    await setDoc(ref, {
      uid,
      displayName: user?.displayName || user?.email || 'Staff',
      email: user?.email || '',
      photoURL: user?.photoURL || null,
      role: 'staff',
      isEquity: false,
      totalMinutes: 0,
      isClocked: false,
      ...updates,
    });
  }
}

// ── subscriptions ────────────────────────────────────────────────────

export function subscribeAllStaffHours(cb: (hours: StaffHours[]) => void) {
  return onSnapshot(collection(db, 'ops_hours'), snap =>
    cb(snap.docs.map(d => d.data() as StaffHours))
  );
}

export function subscribeTimeLogs(uid: string | null, cb: (logs: TimeEntry[]) => void) {
  const q = uid
    ? query(collection(db, 'ops_time_logs'), where('uid', '==', uid), orderBy('clockIn', 'desc'))
    : query(collection(db, 'ops_time_logs'), orderBy('clockIn', 'desc'));
  return onSnapshot(q, snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }) as TimeEntry))
  );
}

export function subscribeMyClockStatus(cb: (isClocked: boolean, sessionStart: Timestamp | null) => void) {
  const user = auth.currentUser;
  if (!user) { cb(false, null); return () => {}; }
  return onSnapshot(doc(db, 'ops_hours', user.uid), snap => {
    if (!snap.exists()) { cb(false, null); return; }
    const d = snap.data();
    cb(!!d.isClocked, d.currentSessionStart || null);
  });
}

// ── admin: set equity flag ───────────────────────────────────────────

export async function setEquityFlag(uid: string, isEquity: boolean, bonusPct?: number) {
  const ref = doc(db, 'ops_hours', uid);
  await updateDoc(ref, {
    isEquity,
    equityBonus: bonusPct ?? null,
  });
}

// ── format helpers (used by UI) ──────────────────────────────────────

export function fmtMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function fmtHoursDecimal(mins: number): string {
  return (mins / 60).toFixed(2) + 'h';
}
