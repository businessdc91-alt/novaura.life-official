// targetStore.js — the Sentinel Probe's record of owner-verified targets, probe runs,
// and their redacted findings. Kept in the probe_targets / probe_runs / probe_findings
// tables (database v23). A target id is tgt_<kind>_<ref>, so re-registering the same
// owned asset updates its row instead of adding a duplicate.
//
// Only redacted data is written here (see redaction.js); a run's raw observations live
// in its working folder and are wiped once the redacted report is stored.

import { db } from '../../database/sovereignDatabase.js';

export const targetId = (kind, ref) => `tgt_${kind}_${ref}`;

export function createTargetStore({ targets, runs, findings }) {
  return {
    /** Upsert an owned target by kind+ref; returns the stored record. */
    async registerTarget({ kind, ref, name, isStaging = false }) {
      const target = { id: targetId(kind, ref), kind, ref, name, isStaging, updatedAt: Date.now() };
      await targets.put(target);
      return target;
    },

    async listTargets() {
      return targets.toArray();
    },

    async getTarget(id) {
      return (await targets.get(id)) ?? null;
    },

    async recordRun(run) {
      await runs.put(run);
    },

    /** Store a run's findings, each keyed by [runId+id]. */
    async recordFindings(runId, list) {
      await findings.bulkPut((list || []).map((f) => ({ ...f, runId })));
    },

    async listRuns() {
      return runs.toArray();
    },

    async listFindings(runId) {
      return findings.where('runId').equals(runId).toArray();
    },
  };
}

let shared = null;

/** The one store over the OS database's probe_* tables. */
export function getTargetStore() {
  if (!shared) {
    shared = createTargetStore({ targets: db.probe_targets, runs: db.probe_runs, findings: db.probe_findings });
  }
  return shared;
}
