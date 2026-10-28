/**
 * betaFeedbackService.js — delivers beta bug reports to the NovAura team over
 * the Sovereign mesh. No cloud endpoint is involved.
 *
 * Flow:
 *  1. The report is saved to the local `node_feedback` table (synced: false).
 *  2. It is encrypted to the feedback inbox public key with a one-time key, so
 *     the report is not linked to the tester's mail identity, and queued in the
 *     mesh store-and-forward outbox addressed to the team node.
 *  3. The outbox delivers it directly (LAN) or through the relay tunnel as soon
 *     as the team node is seen online.
 *  4. The team node replies with a receipt signed by the inbox key; only then is
 *     the report marked delivered (handled in sovereignMesh.js).
 *
 * Reports that have left the outbox but were never confirmed are re-queued by
 * syncPendingFeedback(); the inbox de-duplicates by clientId.
 */

import { ed25519 } from '@noble/curves/ed25519.js';
import { db } from '../database/sovereignDatabase.js';
import {
  encryptMailPayload,
  queueOutboxPacket,
  flushOutboxForPeer,
  getPhysicalMeshStatus,
} from './sovereignMesh.js';
import { FEEDBACK_NODE_ID, FEEDBACK_INBOX_PUBKEY } from '../config/betaFeedback.js';

const MAX_DESCRIPTION_CHARS = 8000;
// Re-send an unconfirmed report at most this often.
const RESEND_AFTER_MS = 10 * 60 * 1000;

const toHex = (bytes) => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

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

async function buildFeedbackPayload(record) {
  const oneTimeSecret = ed25519.utils.randomSecretKey();
  const oneTimePub = ed25519.getPublicKey(oneTimeSecret);
  const envelope = await encryptMailPayload(FEEDBACK_INBOX_PUBKEY, toHex(oneTimeSecret), {
    title: record.title,
    description: record.description,
    category: record.category,
    severity: record.severity,
    appVersion: record.appVersion,
    createdAt: record.createdAt,
    environment: {
      os: record.systemInfo?.os,
      arch: record.systemInfo?.arch,
      cpuCores: record.systemInfo?.cpu,
      userAgent: record.systemInfo?.userAgent,
    },
  });

  // The receipt is routed back to this node's mesh ID, which the relay roster
  // already shares with the room.
  let replyNode = null;
  try {
    replyNode = (await getPhysicalMeshStatus())?.node_id || null;
  } catch {}

  return {
    feedback: {
      clientId: record.clientId,
      ...envelope,
      senderPub: '0x' + toHex(oneTimePub),
      replyNode,
    },
  };
}

async function enqueue(record) {
  const payload = await buildFeedbackPayload(record);
  const outboxItem = await queueOutboxPacket(FEEDBACK_NODE_ID, 'MESH_BETA_FEEDBACK', payload);
  await db.node_feedback.update(record.id, {
    outboxId: outboxItem.id,
    lastQueuedAt: new Date().toISOString(),
    deliveryStatus: 'queued',
    lastError: null,
  });
}

/**
 * Save a report locally and queue it for encrypted mesh delivery.
 * @returns {Promise<{ queued: boolean, error?: string }>}
 */
export async function submitBetaFeedback({ title, description, category, severity, systemInfo }) {
  const record = {
    clientId: newClientId(),
    title: title.trim().slice(0, 200),
    description: (description || '').trim().slice(0, MAX_DESCRIPTION_CHARS),
    category,
    severity,
    systemInfo,
    appVersion: await getAppVersion(),
    createdAt: new Date().toISOString(),
    synced: false,
    deliveryStatus: 'saved',
  };
  record.id = await db.node_feedback.add(record);

  try {
    await enqueue(record);
    return { queued: true };
  } catch (err) {
    const message = err?.message || 'Could not queue the report';
    await db.node_feedback.update(record.id, { lastError: message });
    return { queued: false, error: message };
  }
}

/**
 * Re-queue reports the team node has not confirmed, then try to flush the
 * outbox in case the team node is already connected.
 * @returns {Promise<{ pending: number, teamOnline: boolean }>}
 */
export async function syncPendingFeedback() {
  const unconfirmed = await db.node_feedback.filter((r) => r.synced === false && !!r.clientId).toArray();
  const now = Date.now();

  for (const record of unconfirmed) {
    let stillQueued = false;
    if (record.outboxId) {
      const item = await db.mesh_outbox.get(record.outboxId).catch(() => null);
      stillQueued = item?.status === 'queued';
    }
    const lastQueued = record.lastQueuedAt ? Date.parse(record.lastQueuedAt) : 0;
    if (!stillQueued && now - lastQueued > RESEND_AFTER_MS) {
      try {
        await enqueue(record);
      } catch (err) {
        await db.node_feedback.update(record.id, { lastError: err?.message || 'Could not queue the report' });
      }
    }
  }

  // Only push when the team node is actually reachable; the relay drops frames
  // for offline nodes, and a blind send would retire the outbox item early.
  const teamOnline = await isTeamNodeOnline();
  if (teamOnline) await flushOutboxForPeer(FEEDBACK_NODE_ID);

  return { pending: await countPendingFeedback(), teamOnline };
}

export async function isTeamNodeOnline() {
  try {
    const status = await getPhysicalMeshStatus();
    return (status?.peers || []).some((p) => p.id === FEEDBACK_NODE_ID);
  } catch {
    return false;
  }
}

export async function countPendingFeedback() {
  try {
    return await db.node_feedback.filter((r) => r.synced === false && !!r.clientId).count();
  } catch {
    return 0;
  }
}
