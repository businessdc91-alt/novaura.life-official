import {
  collection, doc, updateDoc, onSnapshot, query,
  orderBy, where, Timestamp,
} from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, rtdb, auth } from './firebase';

// ── Types ──────────────────────────────────────────────────────────────

export type AlertSeverity = 'info' | 'warn' | 'critical';
export type AlertType =
  | 'support_ticket'
  | 'stalled_task'
  | 'pattern_detected'
  | 'manual'
  | 'self_report';

export interface NovaAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  summary: string;
  details?: string;
  suggestedResponse?: string;
  sourceId?: string;
  sourceType?: 'ticket' | 'task' | 'code' | 'log';
  tags: string[];
  acknowledged: boolean;
  acknowledgedBy?: string;
  requestedBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface NovaStatus {
  isActive: boolean;
  lastCheck: number;
  currentFocus: string;
  unacknowledgedAlerts: number;
}

export const SEVERITY_CONFIG: Record<AlertSeverity, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)'   },
  warn:     { label: 'Warning',  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)'  },
  info:     { label: 'Info',     color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.25)'  },
};

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  support_ticket:   'Support',
  stalled_task:     'Task Stall',
  pattern_detected: 'Pattern',
  manual:           'Investigation',
  self_report:      'Self-Report',
};

// ── Subscriptions ──────────────────────────────────────────────────────

export function subscribeNovaAlerts(
  filter: 'all' | 'unacknowledged' | 'critical',
  cb: (alerts: NovaAlert[]) => void,
) {
  const base = collection(db, 'nova_alerts');
  let q;
  if (filter === 'unacknowledged') {
    q = query(base, where('acknowledged', '==', false), orderBy('createdAt', 'desc'));
  } else if (filter === 'critical') {
    q = query(base, where('severity', '==', 'critical'), orderBy('createdAt', 'desc'));
  } else {
    q = query(base, orderBy('createdAt', 'desc'));
  }
  return onSnapshot(q, snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }) as NovaAlert))
  );
}

export function subscribeUnacknowledgedCount(cb: (count: number) => void) {
  return onSnapshot(
    query(collection(db, 'nova_alerts'), where('acknowledged', '==', false)),
    snap => cb(snap.size)
  );
}

export function subscribeNovaStatus(cb: (status: NovaStatus | null) => void) {
  return onValue(ref(rtdb, 'nova_status'), snap =>
    cb(snap.exists() ? snap.val() as NovaStatus : null)
  );
}

// ── Actions ────────────────────────────────────────────────────────────

export async function acknowledgeAlert(alertId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  await updateDoc(doc(db, 'nova_alerts', alertId), {
    acknowledged: true,
    acknowledgedBy: user.uid,
    updatedAt: Timestamp.now(),
  });
}

export async function investigateSource(
  sourceId: string,
  sourceType: 'ticket' | 'task',
  question: string,
): Promise<{ alertId: string; analysis: string; recommendedActions: string[]; urgency: string }> {
  const fn = httpsCallable(getFunctions(), 'novaInvestigate');
  const user = auth.currentUser;
  const result = await fn({ sourceId, sourceType, question, requestedBy: user?.uid });
  return result.data as { alertId: string; analysis: string; recommendedActions: string[]; urgency: string };
}

export async function ringStaffMember(uid: string, alertId: string, message: string): Promise<void> {
  const fn = httpsCallable(getFunctions(), 'novaRingStaff');
  await fn({ uid, alertId, message });
}
