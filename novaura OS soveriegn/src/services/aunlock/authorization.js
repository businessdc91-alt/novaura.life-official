// authorization.js — the provenance record and the hard authorization gate. The refurbisher
// suite never circumvents a lock; the one thing that lets a device be recovered or sanitized is
// RECORDED AUTHORIZATION — a receipt, a decommission manifest, or the owner present. A job with
// no non-empty authorization cannot proceed. This gate is the spine of the tool's safety.

/**
 * provenanceRecord({ jobId, source, authorization, who, operator, now }) -> provenance
 * provenance: { jobId, source, authorization, who, operator, at }
 */
export function provenanceRecord({ jobId, source = null, authorization = '', who = null, operator = null, now = Date.now } = {}) {
  return { jobId, source, authorization, who, operator, at: now() };
}

/**
 * canProceed(provenance) -> { ok: true } | { ok: false, reason }
 * ok only when provenance exists and its authorization is a non-empty string.
 */
export function canProceed(provenance) {
  if (!provenance || typeof provenance.authorization !== 'string' || provenance.authorization.trim() === '') {
    return {
      ok: false,
      reason: 'This job has no recorded authorization. Record where the device came from and the authority to work on it (receipt, decommission manifest, or owner present) before recovering or sanitizing.',
    };
  }
  return { ok: true };
}
