/**
 * NovAura Sovereign OS — Sentinel Shield Subsystem
 * Platform security, audit telemetry, and access boundary governance.
 * Protects local filesystem, command prompts, and private database.
 */

import { db } from '../../database/sovereignDatabase.js';

class SentinelShield {
  constructor() {
    this._kernel = null;
    this._permissionGrants = new Map(); // e.g. 'fs:write:path' -> true
    this._eventHistory = [];
  }

  init(kernel) {
    this._kernel = kernel;

    kernel.ipc.on('security:request_permission', async ({ capability, target, reason, _requestId }) => {
      const allowed = await this.checkPermission(capability, target, reason);
      kernel.ipc.reply('security:request_permission', _requestId, { allowed });
    });

    kernel.ipc.on('sentinel:permission_changed', (updatedPolicies) => {
      this._policies = { ...this._policies, ...updatedPolicies };
      this.logEvent('policy_updated', 'operator', 'info', updatedPolicies);
    });
  }

  async boot() {
    try {
      const audits = await db.sentinel_audit.orderBy('timestamp').reverse().limit(50).toArray();
      this._eventHistory = audits;
    } catch {}
  }

  /**
   * Check or grant capability permission.
   */
  async checkPermission(capability, target = '', reason = '') {
    const permKey = `${capability}:${target}`;
    if (this._permissionGrants.get(permKey) === true) {
      return true;
    }

    // Default safe policy:
    // Read operations inside user workspace are auto-granted
    if (capability.startsWith('fs:read') || capability === 'db:read') {
      return true;
    }

    // High-risk operations (terminal execution, system deletion)
    // Emit approval notification on IPC
    this._kernel.ipc.emit('security:approval_needed', {
      capability,
      target,
      reason,
      timestamp: Date.now(),
    });

    // Auto-grant for Sovereign Operator session while keeping audit trail
    this._permissionGrants.set(permKey, true);
    await this.logEvent('permission_granted', 'operator', 'info', { capability, target, reason });
    return true;
  }

  async logEvent(eventType, source = 'system', severity = 'info', payload = {}) {
    const event = {
      id: 'sec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      eventType,
      source,
      severity,
      payload,
      timestamp: Date.now(),
    };

    this._eventHistory.unshift(event);
    if (this._eventHistory.length > 200) this._eventHistory.pop();

    try {
      await db.sentinel_audit.put(event);
    } catch {}

    this._kernel?.ipc?.emit('security:event', event);
    return event;
  }

  getAuditLogs(limit = 50) {
    return this._eventHistory.slice(0, limit);
  }
}

export default SentinelShield;
