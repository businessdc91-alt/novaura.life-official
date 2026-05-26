/**
 * Nova Autonomous Agent — Genkit-powered
 * All Genkit/Google AI imports are fully lazy (require inside getAi()) to avoid
 * Firebase CLI deploy analysis timeouts caused by plugin initialization at module load.
 */

import { z } from 'zod';
import { admin } from './init';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

// ── Zod output schemas ─────────────────────────────────────────────────────

const TicketAnalysisSchema = z.object({
  severity:          z.enum(['info', 'warn', 'critical']).describe('Issue severity'),
  summary:           z.string().describe('1-2 sentence analysis'),
  suggestedResponse: z.string().describe('Ready-to-send customer reply'),
  shouldCallStaff:   z.boolean().describe('Ring on-call owner immediately'),
  callReason:        z.string().describe('Why staff is being called'),
  tags:              z.array(z.string()).describe('Category tags'),
});

const InvestigationOutputSchema = z.object({
  analysis:           z.string().describe('Full Nova analysis'),
  recommendedActions: z.array(z.string()).describe('Specific next steps'),
  urgency:            z.enum(['low', 'medium', 'high']).describe('Attention urgency'),
});

// ── Fully lazy Genkit instance — nothing runs at module load time ──────────

let _ai: any = null;
function getAi() {
  if (!_ai) {
    // Dynamic requires prevent any Genkit/plugin code from running during
    // Firebase CLI's deploy-time module analysis (which times out at 10s).
    const { genkit } = require('genkit');
    const { googleAI } = require('@genkit-ai/google-genai');
    _ai = genkit({
      plugins: [googleAI({ apiKey: process.env.GEMINI_API_KEY })],
    });
  }
  return _ai;
}

// ── AI reasoning functions ─────────────────────────────────────────────────

async function analyzeTicket(ticket: {
  type: string; subject: string; message: string; userName: string; userEmail: string;
}): Promise<z.infer<typeof TicketAnalysisSchema>> {
  const { output } = await getAi().generate({
    model: 'googleai/gemini-2.0-flash',
    output: { schema: TicketAnalysisSchema },
    prompt: `You are Nova, the autonomous AI operations agent for NovAura platform. Analyze this customer support ticket.

Type: ${ticket.type}
Subject: ${ticket.subject}
Message: ${ticket.message}
User: ${ticket.userName} (${ticket.userEmail})

Severity rules:
- "critical": security breach, data loss, billing fraud, service down, legal threat
- "warn": billing confusion, access locked out, angry/threatening user, repeated issue
- "info": general questions, feature requests, how-to

Set shouldCallStaff=true only for critical severity.`,
  });
  return output!;
}

async function investigateContext(context: string, question: string): Promise<z.infer<typeof InvestigationOutputSchema>> {
  const { output } = await getAi().generate({
    model: 'googleai/gemini-2.0-flash',
    output: { schema: InvestigationOutputSchema },
    prompt: `You are Nova, the autonomous AI operations agent for NovAura platform.

${context ? `Context:\n${context}\n\n` : ''}Staff question: ${question || 'Provide a full analysis and recommended next steps.'}

Be thorough, direct, and actionable. Include specific next steps.`,
  });
  return output!;
}

// ── Custom tools ───────────────────────────────────────────────────────────

const db = admin.firestore();
const rtdb = () => admin.database();

async function getOwnerUids(): Promise<string[]> {
  const snap = await db.collection('ops_extensions').where('isOwner', '==', true).get();
  return snap.docs.map(d => d.data().uid as string);
}

async function ringStaff(uid: string, alertId: string, message: string): Promise<void> {
  await rtdb().ref(`phone_incoming/${uid}`).set({
    callId:      `nova_${Date.now()}`,
    callerId:    'nova_ai',
    callerName:  'Nova AI',
    callerExt:   '000',
    callerPhoto: null,
    roomId:      `nova_alert_${alertId}`,
    timestamp:   Date.now(),
    novaAlertId: alertId,
    novaMessage: message,
  });
}

async function ringOwners(alertId: string, message: string): Promise<void> {
  const uids = await getOwnerUids();
  await Promise.all(uids.map(uid => ringStaff(uid, alertId, message)));
}

async function createAlert(data: {
  type:               string;
  severity:           string;
  title:              string;
  summary:            string;
  details?:           string;
  suggestedResponse?: string;
  sourceId?:          string;
  sourceType?:        string;
  tags?:              string[];
  requestedBy?:       string;
}): Promise<string> {
  const ref = db.collection('nova_alerts').doc();
  await ref.set({
    id: ref.id,
    ...data,
    tags:         data.tags || [],
    acknowledged: false,
    createdAt:    admin.firestore.FieldValue.serverTimestamp(),
    updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

// ── Firebase trigger: new support ticket ──────────────────────────────────

export const onSupportTicketCreated = onDocumentCreated(
  { document: 'support_tickets/{ticketId}', memory: '256MiB', timeoutSeconds: 60 },
  async (event) => {
    const ticket = event.data?.data();
    if (!ticket) return;

    try {
      const analysis = await analyzeTicket({
        type:      ticket.type      || '',
        subject:   ticket.subject   || '',
        message:   ticket.message   || '',
        userName:  ticket.userName  || '',
        userEmail: ticket.userEmail || '',
      });

      const alertId = await createAlert({
        type:              'support_ticket',
        severity:          analysis.severity,
        title:             `Ticket: ${ticket.subject}`,
        summary:           analysis.summary,
        suggestedResponse: analysis.suggestedResponse,
        sourceId:          event.params.ticketId,
        sourceType:        'ticket',
        tags:              analysis.tags,
      });

      await event.data!.ref.update({
        novaAnalysis:          analysis.summary,
        novaSuggestedResponse: analysis.suggestedResponse,
        novaAlertId:           alertId,
        ...(analysis.severity !== 'info' && {
          priority: analysis.severity === 'critical' ? 'urgent' : 'high',
        }),
      });

      if (analysis.severity === 'critical' && analysis.shouldCallStaff) {
        await ringOwners(alertId, analysis.callReason || `Critical ticket: "${ticket.subject}"`);
      }

      await rtdb().ref('nova_status').update({
        lastCheck:    Date.now(),
        currentFocus: `Analyzed ticket: ${ticket.subject}`,
      });

    } catch (e) {
      console.error('[Nova] ticket analysis error:', e);
    }
  },
);

// ── Scheduled monitor (no AI calls) ───────────────────────────────────────

export const novaScheduledMonitor = onSchedule(
  { schedule: 'every 15 minutes', memory: '256MiB', timeoutSeconds: 120 },
  async () => {
    const now = Date.now();

    try {
      const staleMs = now - 3 * 24 * 60 * 60 * 1000;
      const stalledSnap = await db.collection('ops_tasks')
        .where('status', '==', 'in_progress')
        .where('updatedAt', '<', admin.firestore.Timestamp.fromMillis(staleMs))
        .limit(10)
        .get();

      if (stalledSnap.size > 0) {
        const titles = stalledSnap.docs.map(d => `"${d.data().title}"`).join(', ');
        await createAlert({
          type:       'stalled_task',
          severity:   'warn',
          title:      `${stalledSnap.size} task(s) stalled 3+ days`,
          summary:    `In-progress tasks with no updates for 3+ days: ${titles}.`,
          sourceType: 'task',
          tags:       ['stalled'],
        });
      }

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
          type:       'support_ticket',
          severity:   'critical',
          title:      `Urgent ticket unresponded 2h+: "${t.subject}"`,
          summary:    `High-priority ticket from ${t.userName} has had no staff response for 2+ hours.`,
          sourceId:   doc.id,
          sourceType: 'ticket',
          tags:       ['urgent', 'unresponded'],
        });
        await ringOwners(alertId, `Urgent ticket "${t.subject}" waiting 2+ hours`);
      }

      const unackCount = (
        await db.collection('nova_alerts').where('acknowledged', '==', false).count().get()
      ).data().count;

      await rtdb().ref('nova_status').set({
        isActive:             true,
        lastCheck:            now,
        currentFocus:         stalledSnap.size > 0 || urgentSnap.size > 0
          ? 'Issues detected — alerts posted'
          : 'All clear — no issues found',
        unacknowledgedAlerts: unackCount,
      });

    } catch (e) {
      console.error('[Nova] scheduled monitor error:', e);
      await rtdb().ref('nova_status').update({ lastCheck: now, currentFocus: 'Monitor error — check logs' });
    }
  },
);

// ── On-demand investigation ────────────────────────────────────────────────

export const novaInvestigate = onCall(
  { memory: '512MiB', timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');

    const { sourceId, sourceType, question, requestedBy } = request.data;

    let context = '';
    if (sourceId && sourceType) {
      try {
        if (sourceType === 'ticket') {
          const snap = await db.collection('support_tickets').doc(sourceId).get();
          const t = snap.data() || {};
          context = `Support ticket\nSubject: ${t.subject}\nMessage: ${t.message}\nUser: ${t.userName} (${t.userEmail})\nStatus: ${t.status}`;
        } else if (sourceType === 'task') {
          const snap = await db.collection('ops_tasks').doc(sourceId).get();
          const t = snap.data() || {};
          context = `Task\nTitle: ${t.title}\nDescription: ${t.description}\nStatus: ${t.status}\nPriority: ${t.priority}\nCategory: ${t.category}`;
        }
      } catch {}
    }

    const result = await investigateContext(context, question || '');

    const alertId = await createAlert({
      type:        'manual',
      severity:    'info',
      title:       (question || '').slice(0, 80) || `Investigation: ${sourceType} ${sourceId}`,
      summary:     result.analysis.slice(0, 300),
      details:     result.analysis,
      sourceId,
      sourceType,
      requestedBy: requestedBy || request.auth.uid,
      tags:        ['investigation'],
    });

    return {
      alertId,
      analysis:           result.analysis,
      recommendedActions: result.recommendedActions,
      urgency:            result.urgency,
    };
  },
);

// ── Nova Call — platform-native calling, routes via RTDB ─────────────────
// Future: any user → any user via Nova numbers, no carrier required.

export const novaCall = onCall(
  { memory: '256MiB', timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    const { uid, alertId, message } = request.data;
    if (!uid || !alertId || !message) throw new HttpsError('invalid-argument', 'Missing fields');
    await ringStaff(uid, alertId, message);
    return { success: true };
  },
);
