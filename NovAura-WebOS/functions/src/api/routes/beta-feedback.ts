/**
 * Sovereign OS beta feedback intake.
 *
 * POST /beta-feedback/submit
 *
 * Receives bug reports from the Novaura Sovereign OS desktop app (Tauri webview),
 * stores them in Firestore (`sovereign_beta_feedback`), and emails the owner a
 * plain-text summary. Mounted in app.ts ahead of the global CORS policy with its
 * own CORS rule, because the desktop webview origin is not a novaura.life origin.
 */

import { Router, Request, Response } from 'express';
import cors from 'cors';
import * as admin from 'firebase-admin';
import { emailService } from '../../services/emailService';

const router = Router();

// Tauri v2 webview origins (Windows/Linux use http(s)://tauri.localhost, macOS uses tauri://localhost)
const SOVEREIGN_ORIGINS = [
  'http://tauri.localhost',
  'https://tauri.localhost',
  'tauri://localhost',
  'http://localhost:5173',
];

router.use(cors({ origin: SOVEREIGN_ORIGINS, methods: ['POST', 'OPTIONS'], credentials: false }));

// Must match the options in the Sovereign app's beta feedback form.
const CATEGORIES = new Set(['ui', 'ai', 'mesh', 'storage', 'crypto_media', 'feature', 'other']);
const SEVERITIES = new Set(['low', 'moderate', 'high', 'blocker']);

// Best-effort per-instance rate limit: 10 reports per IP per 10 minutes.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

function cleanString(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

router.post('/submit', async (req: Request, res: Response) => {
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip || 'unknown';
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Too many reports. Please wait a few minutes.' });
  }

  const body = req.body || {};
  const title = cleanString(body.title, 200);
  const description = cleanString(body.description, 8000);
  const category = CATEGORIES.has(body.category) ? body.category : 'other';
  const severity = SEVERITIES.has(body.severity) ? body.severity : 'moderate';
  const clientId = cleanString(body.clientId, 80);
  const appVersion = cleanString(body.appVersion, 40);
  const nodeId = cleanString(body.nodeId, 80);

  if (!title) {
    return res.status(400).json({ error: 'A title is required.' });
  }

  // Keep only a small, known set of environment fields.
  const env = body.environment && typeof body.environment === 'object' ? body.environment : {};
  const environment = {
    os: cleanString(env.os, 40),
    arch: cleanString(env.arch, 40),
    cpuCores: Number.isFinite(env.cpuCores) ? Number(env.cpuCores) : null,
    userAgent: cleanString(env.userAgent, 300),
  };

  try {
    const db = admin.firestore();
    // clientId makes retries idempotent: the same report never lands twice.
    const docRef = clientId
      ? db.collection('sovereign_beta_feedback').doc(clientId.replace(/[^A-Za-z0-9_-]/g, ''))
      : db.collection('sovereign_beta_feedback').doc();

    await docRef.set({
      title,
      description,
      category,
      severity,
      appVersion,
      nodeId,
      environment,
      status: 'new',
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    try {
      await emailService.sendEmail({
        to: process.env.BETA_FEEDBACK_NOTIFY_EMAIL || 'business.dc91@gmail.com',
        subject: `[Sovereign Beta] ${severity.toUpperCase()} ${category}: ${title}`.slice(0, 180),
        category: 'alert',
        text: [
          `Title: ${title}`,
          `Severity: ${severity}`,
          `Category: ${category}`,
          `App version: ${appVersion || 'unknown'}`,
          `Node: ${nodeId || 'unknown'}`,
          `OS: ${environment.os} ${environment.arch}`,
          '',
          description || '(no description)',
          '',
          `Firestore: sovereign_beta_feedback/${docRef.id}`,
        ].join('\n'),
      });
    } catch (emailErr) {
      console.warn('[BetaFeedback] Notification email failed; report was saved:', emailErr);
    }

    return res.json({ success: true, id: docRef.id });
  } catch (error: any) {
    console.error('[BetaFeedback] Failed to store report:', error);
    return res.status(500).json({ error: 'Could not store report.' });
  }
});

export default router;
