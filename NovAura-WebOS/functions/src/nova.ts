/**
 * Nova Autonomous Agent — Genkit-powered
 * Firebase triggers + custom tools are preserved.
 * AI reasoning runs through Genkit flows for type safety, structured output,
 * and observability traces in the Firebase console.
 */

import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { onCallGenkit } from 'firebase-functions/https';
import { admin } from './init';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

// ── Genkit init ────────────────────────────────────────────────────────────

const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GEMINI_API_KEY })],
});

const db = admin.firestore();
const rtdb = admin.database();

// ── Output schemas ─────────────────────────────────────────────────────────

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

// ── Genkit flows (AI reasoning layer) ─────────────────────────────────────

const analyzeTicketFlow = ai.defineFlow(
  {
    name: 'analyzeTicket',
    inputSchema: z.object({
      type:      z.string(),
      subject:   z.string(),
      message:   z.string(),
      userName:  z.string(),
      userEmail: z.string(),
    }),
    outputSchema: TicketAnalysisSchema,
  },
  async (ticket) => {
    const { output } = await ai.generate({
      model: googleAI.model('gemini-2.0-flash'),
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
  },
);

const investigateContextFlow = ai.defineFlow(
  {
    name: 'investigateContext',
    inputSchema: z.object({
      context:  z.string().describe('Ticket or task data as formatted text'),
      question: z.string().describe('What staff wants Nova to investigate'),
    }),
    outputSchema: InvestigationOutputSchema,
  },
  async ({ context, question }) => {
    const { output } = await ai.generate({
      model: googleAI.model('gemini-2.0-flash'),
      output: { schema: InvestigationOutputSchema },
      prompt: `You are Nova, the autonomous AI operations agent for NovAura platform.

${context ? `Context:\n${context}\n\n` : ''}Staff question: ${question || 'Provide a full analysis and recommended next steps.'}

Be thorough, direct, and actionable. Include specific next steps.`,
    });
    return output!;
  },
);

// ── Custom tools (fully preserved) ────────────────────────────────────────

async function getOwnerUids(): Promise<string[]> {
  const snap = await db.collection('ops_extensions').where('isOwner', '==', true).get();
  return snap.docs.map(d => d.data().uid as string);
}

async function ringStaff(uid: string, alertId: string, message: string): Promise<void> {
  await rtdb.ref(`phone_incoming/${uid}`).set({
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
  type:              string;
  severity:          string;
  title:             string;
  summary:           string;
  details?:          string;
  suggestedResponse?: string;
  sourceId?:         string;
  sourceType?:       string;
  tags?:             string[];
  requestedBy?:      string;
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
      // Genkit flow handles AI call with structured output — no more regex JSON parsing
      const analysis = await analyzeTicketFlow({
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

      await rtdb.ref('nova_status').update({
        lastCheck:    Date.now(),
        currentFocus: `Analyzed ticket: ${ticket.subject}`,
      });

    } catch (e) {
      console.error('[Nova] ticket analysis error:', e);
    }
  },
);

// ── Firebase trigger: scheduled monitor (no AI, preserved as-is) ──────────

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
          type:       'stalled_task',
          severity:   'warn',
          title:      `${stalledSnap.size} task(s) stalled 3+ days`,
          summary:    `In-progress tasks with no updates for 3+ days: ${titles}.`,
          sourceType: 'task',
          tags:       ['stalled'],
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

      await rtdb.ref('nova_status').set({
        isActive:              true,
        lastCheck:             now,
        currentFocus:          stalledSnap.size > 0 || urgentSnap.size > 0
          ? 'Issues detected — alerts posted'
          : 'All clear — no issues found',
        unacknowledgedAlerts:  unackCount,
      });

    } catch (e) {
      console.error('[Nova] scheduled monitor error:', e);
      await rtdb.ref('nova_status').update({ lastCheck: now, currentFocus: 'Monitor error — check logs' });
    }
  },
);

// ── onCallGenkit: investigate (Genkit flow exposed as callable) ────────────

const novaInvestigateFlow = ai.defineFlow(
  {
    name: 'novaInvestigate',
    inputSchema: z.object({
      sourceId:    z.string().optional(),
      sourceType:  z.enum(['ticket', 'task']).optional(),
      question:    z.string(),
      requestedBy: z.string().optional(),
    }),
    outputSchema: z.object({
      alertId:            z.string(),
      analysis:           z.string(),
      recommendedActions: z.array(z.string()),
      urgency:            z.enum(['low', 'medium', 'high']),
    }),
  },
  async ({ sourceId, sourceType, question, requestedBy }) => {
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

    const result = await investigateContextFlow({ context, question });

    const alertId = await createAlert({
      type:        'manual',
      severity:    'info',
      title:       question.slice(0, 80) || `Investigation: ${sourceType} ${sourceId}`,
      summary:     result.analysis.slice(0, 300),
      details:     result.analysis,
      sourceId,
      sourceType,
      requestedBy,
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

// Auth policy: any authenticated staff member
export const novaInvestigate = onCallGenkit(
  { authPolicy: (auth: any) => !!auth },
  novaInvestigateFlow,
);

// ── Ring staff (preserved as regular onCall — no AI, stays lean) ──────────

export const novaRingStaff = onCall(
  { memory: '128MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
    const { uid, alertId, message } = request.data;
    if (!uid || !alertId || !message) throw new HttpsError('invalid-argument', 'Missing fields');
    await ringStaff(uid, alertId, message);
    return { success: true };
  },
);
