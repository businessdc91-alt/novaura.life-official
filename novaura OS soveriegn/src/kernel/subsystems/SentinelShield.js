/**
 * NovAura Sovereign OS — Sentinel Shield Subsystem
 * Platform security, tamper-evident hash-chained audit telemetry, and fail-closed access boundary governance.
 * Protects local filesystem, command prompts, cloud egress, and private database.
 */

import { db } from '../../database/sovereignDatabase.js';

export const GENESIS_HASH = '0'.repeat(64);

export const HIGH_RISK_CAPABILITIES = new Set([
  'terminal:exec',
  'fs:delete_system',
  'cloud:egress',
  'firmware:reboot',
  'enclave:export',
]);

/**
 * Deterministic canonical JSON serialization with sorted object keys.
 */
export function canonicalStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(item => (item === undefined ? 'null' : canonicalStringify(item))).join(',') + ']';
  }
  const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
  return '{' + keys.map(k => `${JSON.stringify(k)}:${canonicalStringify(value[k])}`).join(',') + '}';
}

/**
 * Compute SHA-256 hash chaining prevHash -> current entry fields.
 */
export async function computeAuditHash(prevHash, entry) {
  const material = canonicalStringify({
    seq: entry.seq,
    id: entry.id,
    timestamp: entry.timestamp,
    eventType: entry.eventType,
    source: entry.source,
    severity: entry.severity,
    payload: entry.payload ?? {},
    prevHash,
  });
  const bytes = new TextEncoder().encode(material);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function escapeCsvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  // Neutralize spreadsheet formula injection (CSV/DDE)
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

class SentinelShield {
  constructor({ auditTable } = {}) {
    this._kernel = null;
    this._auditTable = auditTable || db.sentinel_audit;
    this._permissionGrants = new Map(); // e.g. 'fs:write:path' -> true
    this._eventHistory = [];
    this._policies = {
      highRiskMode: 'prompt', // 'prompt' | 'deny' | 'allow'
      readAutoAllow: true,
    };
    this._approvalHandler = null;
    this._lastHash = GENESIS_HASH;
    this._lastSeq = 0;
    this._logQueue = Promise.resolve();
  }

  init(kernel) {
    this._kernel = kernel;

    kernel?.ipc?.on('security:request_permission', async ({ capability, target, reason, _requestId }) => {
      const allowed = await this.checkPermission(capability, target, reason);
      kernel.ipc.reply('security:request_permission', _requestId, { allowed });
    });

    kernel?.ipc?.on('sentinel:permission_changed', (updatedPolicies) => {
      this.setPolicy(updatedPolicies);
      this.logEvent('policy_updated', 'operator', 'info', updatedPolicies);
    });
  }

  async boot() {
    try {
      const all = await this._auditTable.toArray();
      const sortedDesc = [...all].sort((a, b) => (b.seq || b.timestamp || 0) - (a.seq || a.timestamp || 0));
      this._eventHistory = sortedDesc.slice(0, 200);

      const chained = all
        .filter(r => typeof r.seq === 'number' && typeof r.hash === 'string')
        .sort((a, b) => a.seq - b.seq);
      if (chained.length > 0) {
        const tip = chained[chained.length - 1];
        this._lastSeq = tip.seq;
        this._lastHash = tip.hash;
      } else {
        this._lastSeq = 0;
        this._lastHash = GENESIS_HASH;
      }
    } catch {}
  }

  setApprovalHandler(handler) {
    this._approvalHandler = typeof handler === 'function' ? handler : null;
  }

  setPolicy(updates = {}) {
    if (!updates || typeof updates !== 'object') return this._policies;
    const next = { ...this._policies };
    if (updates.highRiskMode && ['prompt', 'deny', 'allow'].includes(updates.highRiskMode)) {
      next.highRiskMode = updates.highRiskMode;
    }
    if (typeof updates.readAutoAllow === 'boolean') {
      next.readAutoAllow = updates.readAutoAllow;
    }
    this._policies = next;
    return this._policies;
  }

  getPolicies() {
    return { ...this._policies };
  }

  revokeGrant(capability, target = '') {
    this._permissionGrants.delete(`${capability}:${target}`);
  }

  /**
   * Check or request capability permission with fail-closed enforcement on high-risk operations.
   */
  async checkPermission(capability, target = '', reason = '', options = {}) {
    const permKey = `${capability}:${target}`;
    if (this._permissionGrants.get(permKey) === true) {
      return true;
    }

    // Default safe policy: read operations inside workspace are auto-granted when enabled
    if (this._policies.readAutoAllow && (capability.startsWith('fs:read') || capability === 'db:read')) {
      return true;
    }

    this._kernel?.ipc?.emit('security:approval_needed', {
      capability,
      target,
      reason,
      timestamp: Date.now(),
    });

    const isHighRisk =
      HIGH_RISK_CAPABILITIES.has(capability) ||
      capability.startsWith('terminal:') ||
      capability.startsWith('firmware:');

    if (isHighRisk) {
      if (this._policies.highRiskMode === 'deny') {
        await this.logEvent('permission_denied', 'sentinel', 'warning', {
          capability,
          target,
          reason,
          policy: 'deny',
        });
        return false;
      }

      if (this._policies.highRiskMode === 'prompt') {
        if (typeof this._approvalHandler !== 'function') {
          await this.logEvent('permission_denied', 'sentinel', 'warning', {
            capability,
            target,
            reason,
            policy: 'no_approval_handler',
          });
          return false;
        }

        let approved = false;
        try {
          approved = Boolean(await this._approvalHandler({ capability, target, reason, options }));
        } catch {
          approved = false;
        }

        if (!approved) {
          await this.logEvent('permission_denied', 'operator', 'warning', {
            capability,
            target,
            reason,
            approvedByHandler: false,
          });
          return false;
        }

        if (options.remember !== false) {
          this._permissionGrants.set(permKey, true);
        }
        await this.logEvent('permission_granted', 'operator', 'info', {
          capability,
          target,
          reason,
          approvedByHandler: true,
        });
        return true;
      }

      // highRiskMode === 'allow'
      this._permissionGrants.set(permKey, true);
      await this.logEvent('permission_granted', 'operator', 'info', {
        capability,
        target,
        reason,
        policy: 'allow',
      });
      return true;
    }

    // Standard non-high-risk capability grant with full audit logging
    this._permissionGrants.set(permKey, true);
    await this.logEvent('permission_granted', 'operator', 'info', { capability, target, reason });
    return true;
  }

  /**
   * Append a tamper-evident hash-chained security event serialized via internal queue.
   */
  logEvent(eventType, source = 'system', severity = 'info', payload = {}) {
    const run = this._logQueue.then(async () => {
      const seq = this._lastSeq + 1;
      const prevHash = this._lastHash || GENESIS_HASH;
      const timestamp = Date.now();
      const id = 'sec_' + timestamp + '_' + Math.random().toString(36).substring(2, 6);

      const baseEvent = {
        id,
        seq,
        eventType,
        source,
        severity,
        payload: payload ?? {},
        timestamp,
        prevHash,
      };
      const hash = await computeAuditHash(prevHash, baseEvent);
      const event = { ...baseEvent, hash };

      this._lastSeq = seq;
      this._lastHash = hash;

      this._eventHistory.unshift(event);
      if (this._eventHistory.length > 200) this._eventHistory.pop();

      try {
        await this._auditTable.put(event);
      } catch {}

      this._kernel?.ipc?.emit('security:event', event);
      return event;
    });

    this._logQueue = run.catch(() => {});
    return run;
  }

  getAuditLogs(limit = 50) {
    return this._eventHistory.slice(0, limit);
  }

  /**
   * Verify SHA-256 prevHash -> hash integrity across all chained audit entries.
   */
  async verifyAuditChain(entriesOverride = null) {
    let entries = entriesOverride;
    if (!Array.isArray(entries)) {
      try {
        entries = await this._auditTable.toArray();
      } catch {
        entries = [...this._eventHistory];
      }
    }

    const chained = [];
    let legacyUnchained = 0;
    for (const entry of entries) {
      if (entry && typeof entry.hash === 'string' && typeof entry.seq === 'number') {
        chained.push(entry);
      } else if (entry) {
        legacyUnchained++;
      }
    }

    chained.sort((a, b) => a.seq - b.seq);

    if (chained.length === 0) {
      return {
        valid: true,
        checked: 0,
        legacyUnchained,
        tipHash: GENESIS_HASH,
        lastSeq: 0,
        brokenAt: null,
      };
    }

    for (let i = 0; i < chained.length; i++) {
      const entry = chained[i];
      if (typeof entry.prevHash !== 'string' || !/^[0-9a-f]{64}$/.test(entry.prevHash)) {
        return {
          valid: false,
          checked: i + 1,
          legacyUnchained,
          tipHash: entry.hash || GENESIS_HASH,
          lastSeq: entry.seq,
          brokenAt: { id: entry.id, seq: entry.seq, reason: 'invalid_prev_hash_format' },
        };
      }

      if (i === 0) {
        if (entry.seq === 1 && entry.prevHash !== GENESIS_HASH) {
          return {
            valid: false,
            checked: 1,
            legacyUnchained,
            tipHash: entry.hash,
            lastSeq: entry.seq,
            brokenAt: { id: entry.id, seq: entry.seq, reason: 'genesis_prev_hash_mismatch' },
          };
        }
      } else {
        const prev = chained[i - 1];
        if (entry.seq !== prev.seq + 1) {
          return {
            valid: false,
            checked: i + 1,
            legacyUnchained,
            tipHash: entry.hash,
            lastSeq: entry.seq,
            brokenAt: { id: entry.id, seq: entry.seq, reason: 'sequence_gap_or_duplicate' },
          };
        }
        if (entry.prevHash !== prev.hash) {
          return {
            valid: false,
            checked: i + 1,
            legacyUnchained,
            tipHash: entry.hash,
            lastSeq: entry.seq,
            brokenAt: { id: entry.id, seq: entry.seq, reason: 'prev_hash_mismatch' },
          };
        }
      }

      const expectedHash = await computeAuditHash(entry.prevHash, entry);
      if (expectedHash !== entry.hash) {
        return {
          valid: false,
          checked: i + 1,
          legacyUnchained,
          tipHash: entry.hash,
          lastSeq: entry.seq,
          brokenAt: { id: entry.id, seq: entry.seq, reason: 'hash_mismatch' },
        };
      }
    }

    const tip = chained[chained.length - 1];
    return {
      valid: true,
      checked: chained.length,
      legacyUnchained,
      tipHash: tip.hash,
      lastSeq: tip.seq,
      brokenAt: null,
    };
  }

  /**
   * Export audit logs with chain integrity verification metadata in JSON or formula-safe CSV format.
   */
  async exportAuditLogs(format = 'json') {
    await this._logQueue;
    let rows;
    try {
      rows = await this._auditTable.toArray();
    } catch {
      rows = [...this._eventHistory];
    }

    rows = [...rows].sort((a, b) => (a.seq ?? a.timestamp ?? 0) - (b.seq ?? b.timestamp ?? 0));
    const integrity = await this.verifyAuditChain(rows);

    if (String(format).toLowerCase() === 'csv') {
      const header = ['seq', 'timestamp', 'isoTime', 'id', 'severity', 'source', 'eventType', 'prevHash', 'hash', 'payload'];
      const lines = [header.join(',')];
      for (const row of rows) {
        const ts = Number(row.timestamp) || 0;
        const iso = ts ? new Date(ts).toISOString() : '';
        const payloadStr = canonicalStringify(row.payload ?? {});
        lines.push([
          escapeCsvCell(row.seq ?? ''),
          escapeCsvCell(ts),
          escapeCsvCell(iso),
          escapeCsvCell(row.id ?? ''),
          escapeCsvCell(row.severity ?? ''),
          escapeCsvCell(row.source ?? ''),
          escapeCsvCell(row.eventType ?? ''),
          escapeCsvCell(row.prevHash ?? ''),
          escapeCsvCell(row.hash ?? ''),
          escapeCsvCell(payloadStr),
        ].join(','));
      }
      return lines.join('\n');
    }

    return JSON.stringify(
      {
        schema: 'novaura.sentinel.audit.v2',
        exportedAt: new Date().toISOString(),
        integrity,
        count: rows.length,
        entries: rows,
      },
      null,
      2
    );
  }
}

export default SentinelShield;
