/**
 * betaFeedbackService.js — delivers beta bug reports to the NovAura team.
 *
 * Reports are always written to the local `node_feedback` table first, then
 * posted to the beta feedback endpoint. Reports that fail to send stay queued
 * (synced: false) and are retried by syncPendingFeedback().
 *
 * Only the report text and basic OS info are sent. No node ID, license, keys,
 * or user data leave the machine.
 */

import { db } from '../database/sovereignDatabase.js';

// Direct Firebase Hosting address, so delivery does not depend on the custom domain.
export const FEEDBACK_ENDPOINT =
  import.meta.env.VITE_SOVEREIGN_FEEDBACK_URL ||
  'https://novaura-life-8df2f.web.app/api/beta-feedback/submit';

const REQUEST_TIMEOUT_MS = 15000;

async function getAppVersion() {
  try {
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      const { getVersion } = await import('@tauri-apps/api/app');
      return await getVersion();
    }
  } catch {}
  return 'web-preview';
}

function newClientId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `fb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function postReport(record) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(FEEDBACK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        clientId: record.clientId,
        title: record.title,
        description: record.description,
        category: record.category,
        severity: record.severity,
        appVersion: record.appVersion,
        environment: {
          os: record.systemInfo?.os,
          arch: record.systemInfo?.arch,
          cpuCores: record.systemInfo?.cpu,
          userAgent: record.systemInfo?.userAgent,
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Server responded ${res.status}${text ? `: ${text.slice(0, 120)}` : ''}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Save a report locally and try to send it.
 * @returns {Promise<{ sent: boolean, error?: string }>}
 */
export async function submitBetaFeedback({ title, description, category, severity, systemInfo }) {
  const record = {
    clientId: newClientId(),
    title: title.trim(),
    description: (description || '').trim(),
    category,
    severity,
    systemInfo,
    appVersion: await getAppVersion(),
    createdAt: new Date().toISOString(),
    synced: false,
  };
  const localId = await db.node_feedback.add(record);

  try {
    const result = await postReport(record);
    await db.node_feedback.update(localId, { synced: true, remoteId: result?.id || null, syncedAt: new Date().toISOString() });
    return { sent: true };
  } catch (err) {
    const message = err?.name === 'AbortError' ? 'Request timed out' : (err?.message || 'Network error');
    await db.node_feedback.update(localId, { lastError: message });
    return { sent: false, error: message };
  }
}

/**
 * Retry every queued report. Safe to call repeatedly; the server de-duplicates by clientId.
 * @returns {Promise<{ sent: number, pending: number }>}
 */
export async function syncPendingFeedback() {
  let sent = 0;
  let pending = 0;
  const queued = await db.node_feedback.filter((r) => r.synced === false && !!r.clientId).toArray();
  for (const record of queued) {
    try {
      const result = await postReport(record);
      await db.node_feedback.update(record.id, { synced: true, remoteId: result?.id || null, syncedAt: new Date().toISOString(), lastError: null });
      sent += 1;
    } catch (err) {
      await db.node_feedback.update(record.id, { lastError: err?.message || 'Network error' });
      pending += 1;
    }
  }
  return { sent, pending };
}

export async function countPendingFeedback() {
  try {
    return await db.node_feedback.filter((r) => r.synced === false && !!r.clientId).count();
  } catch {
    return 0;
  }
}
