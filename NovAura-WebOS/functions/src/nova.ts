/**
 * Nova Autonomous Agent
 * Monitors support tickets, task health, and platform signals.
 * Writes to nova_alerts + rings staff via RTDB phone_incoming when needed.
 */

import { admin } from './init';
import { getGeminiClient } from './lib/gemini';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

const db = admin.firestore();
const rtdb = admin.database();

// ── Helpers ────────────────────────────────────────────────────────────

async function getOwnerUids(): Promise<string[]> {
  const snap = await db.collection('ops_extensions').where('isOwner', '==', true).get();
  return snap.docs.map(d => d.data().uid as string);
}

async function ringStaff(uid: string, alertId: string, message: string): Promise<void> {
  await rtdb.ref(`phone_incoming/${uid}`).set({
    callId: `nova_${Date.now()}`,
    callerId: 'nova_ai',
    callerName: 'Nova AI',
    callerExt: '000',
    callerPhoto: null,
    roomId: `nova_alert_${alertId}`,
    timestamp: Date.now(),
    novaAlertId: alertId,
    novaMessage: message,
  });
}

async function ringOwners(alertId: string, message: string): Promise<void> {
  const uids = await getOwnerUids();
  await Promise.all(uids.map(uid => ringStaff(uid, alertId, message)));
}

async function createAlert(data: {
  type: string;
  severity: string;
  title: string;
  summary: string;
  details?: string;
  suggestedResponse?: string;
  sourceId?: string;
  sourceType?: string;
  tags?: string[];
  requestedBy?: string;
}): Promise<string> {
  const ref = db.collection('nova_alerts').doc();
  await ref.set({
    id: ref.id,
    ...data,
    tags: data.tags || [],
    acknowledged: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

// ── Ticket Analysis ────────────────────────────────────────────────────

export const onSupportTicketCreated = onDocumentCreated(
  { document: 'support_tickets/{ticketId}', memory: '256MiB', timeoutSeconds: 60 },
  async (event) => {
    const ticket = event.data?.data();
    if (!ticket) return;

    try {
      const ai = getGeminiClient();
      const result = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
          role: 'user',
          parts: [{
            text: `You are Nova, the autonomous AI operations agent for NovAura. Analyze this customer support ticket and return JSON only — no markdown, no explanation.

Ticket:
Type: ${ticket.type}
Subject: ${ticket.subject}
Message: ${ticket.message}
User: ${ticket.userName} (${ticket.userEmail})

Return ONLY this JSON:
{
  "severity": "info",
  "summary": "1-2 sentence analysis of the issue",
  "suggestedResponse": "ready-to-send customer reply",
  "shouldCallStaff": false,
  "callReason": "",
  "tags": ["tag1"]
}

Severity rules:
- "critical": security breach, data loss, billing fraud, service completely down, legal threat
- "warn": billing confusion, access locked out, repeated same complaint, angry/threatening user
- "info": general questions, feature requests, how-to

Only set shouldCallStaff=true for critical severity.`,
          }]
        }],
      });

      const raw = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON from Nova');

      const analysis = JSON.parse(match[0]);

      const alertId = await createAlert({
        type: 'support_ticket',
        severity: analysis.severity,
        title: `Ticket: ${ticket.subject}`,
        summary: analysis.summary,
        suggestedResponse: analysis.suggestedResponse,
        sourceId: event.params.ticketId,
        sourceType: 'ticket',
        tags: analysis.tags || [],
      });

      // Stamp ticket with Nova's analysis
      await event.data!.ref.update({
        novaAnalysis: analysis.summary,
        novaSuggestedResponse: analysis.suggestedResponse,
        novaAlertId: alertId,
        ...(analysis.severity !== 'info' && {
          priority: analysis.severity === 'critical' ? 'urgent' : 'high',
        }),
      });

      // Ring owners for critical issues
      if (analysis.severity === 'critical' && analysis.shouldCallStaff) {
        await ringOwners(alertId, analysis.callReason || `Critical support ticket: "${ticket.subject}"`);
      }

      await rtdb.ref('nova_status').update({
        lastCheck: Date.now(),
        currentFocus: `Analyzed ticket: ${ticket.subject}`,
      });

    } catch (e) {
      console.error('[Nova] ticket analysis error:', e);
    }
  }
);

// ── Scheduled Monitor ──────────────────────────────────────────────────

export const novaScheduledMonitor = onSchedule(
  { schedule: 'every 15 minutes', memory: '256MiB', timeoutSeconds: 120 },
  async () => {
    const now = Date.now();

    try {
      // Stalled tasks: in_progress with no update in 3 days
      const staleMs = now - 3 * 24 * 60 * 60 * 1000;
      const stalledSnap = await db.collection('ops_tasks')
        .where('status', '==', 'in_progress')
        .where('updatedAt', '<', admin.firestore.Timestamp.fromMillis(staleMs))
        .limit(10)
        .get();

      if (stalledSnap.size > 0) {
        const titles = stalledSnap.docs.map(d => `"${d.data().title}"`).join(', ');
        await createAlert({
          type: 'stalled_task',
          severity: 'warn',
          title: `${stalledSnap.size} task(s) stalled 3+ days`,
          summary: `The following in-progress tasks have had no updates in over 3 days: ${titles}.`,
          sourceType: 'task',
          tags: ['stalled'],
        });
      }

      // Urgent tickets unresponded for 2+ hours
      const urgentCutoff = admin.firestore.Timestamp.fromMillis(now - 2 * 60 * 60 * 1000);
      const urgentSnap = await db.collection('support_tickets')
        .where('status', '==', 'new')
        .where('priority', 'in', ['urgent', 'high'])
        .where('createdAt', '<', urgentCutoff)
        .limit(5)
        .get();

      for (const doc of urgentSnap.docs) {
        const t = doc.data();
        const alertId = await createAlert({
          type: 'support_ticket',
          severity: 'critical',
          title: `Urgent ticket unresponded 2h+: "${t.subject}"`,
          summary: `High-priority ticket from ${t.userName} has had no staff response for over 2 hours.`,
          sourceId: doc.id,
          sourceType: 'ticket',
          tags: ['urgent', 'unresponded'],
        });
        await ringOwners(alertId, `Urgent ticket "${t.subject}" waiting 2+ hours for response`);
      }

      // Update status
      const unackCount = (
        await db.collection('nova_alerts').where('acknowledged', '==', false).count().get()
      ).data().count;

      await rtdb.ref('nova_status').set({
        isActive: true,
        lastCheck: now,
        currentFocus: stalledSnap.size > 0 || urgentSnap.size > 0
          ? 'Issues detected — alerts posted'
          : 'All clear — no issues found',
        unacknowledgedAlerts: unackCount,
      });

    } catch (e) {
      console.error('[Nova] scheduled monitor error:', e);
      await rtdb.ref('nova_status').update({ lastCheck: now, currentFocus: 'Monitor error — check logs' });
    }
  }
);

// ── On-Demand Investigation ─────────────────────────────────────────────

export const novaInvestigate = onCall(
  { memory: '512MiB', timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');

    const { sourceId, sourceType, question } = request.data;

    let context = '';
    try {
      if (sourceType === 'ticket') {
        const snap = await db.collection('support_tickets').doc(sourceId).get();
        const t = snap.data() || {};
        context = `Support ticket\nSubject: ${t.subject}\nMessage: ${t.message}\nUser: ${t.userName} (${t.userEmail})\nStatus: ${t.status}\nType: ${t.type}`;
      } else if (sourceType === 'task') {
        const snap = await db.collection('ops_tasks').doc(sourceId).get();
        const t = snap.data() || {};
        context = `Task\nTitle: ${t.title}\nDescription: ${t.description}\nStatus: ${t.status}\nPriority: ${t.priority}\nCategory: ${t.category}`;
      }
    } catch {}

    const ai = getGeminiClient();
    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{
        role: 'user',
        parts: [{
          text: `You are Nova, the autonomous AI operations agent for NovAura platform.

${context ? `Context:\n${context}\n\n` : ''}Staff question: ${question || 'Provide a full analysis and recommended next steps.'}

Respond as Nova — thorough, direct, and actionable. Include specific next steps.`,
        }]
      }],
    });

    const analysis = result.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to generate analysis.';

    const alertId = await createAlert({
      type: 'manual',
      severity: 'info',
      title: question ? question.slice(0, 80) : `Investigation: ${sourceType} ${sourceId}`,
      summary: analysis.slice(0, 300),
      details: analysis,
      sourceId,
      sourceType,
      requestedBy: request.auth.uid,
      tags: ['investigation'],
    });

    return { alertId, analysis };
  }
);

// ── Ring Specific Staff ─────────────────────────────────────────────────

export const novaRingStaff = onCall(
  { memory: '128MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');

    const { uid, alertId, message } = request.data;
    if (!uid || !alertId || !message) throw new HttpsError('invalid-argument', 'Missing fields');

    await ringStaff(uid, alertId, message);
    return { success: true };
  }
);
