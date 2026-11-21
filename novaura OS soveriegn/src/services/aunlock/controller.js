// controller.js — the Aunlock Nova job lifecycle: intake -> authorize -> recover -> sanitize ->
// close. It enforces the two safety rules the suite exists for:
//   - the AUTHORIZATION GATE: recover and sanitize refuse any job with no recorded authorization
//     (never a lock bypass — a device you can't account for cannot be worked on);
//   - RETENTION: creating a job purges jobs past the 10-day / 3-job window and all their rows.
// The hardware layer is injected as `native` ({ enumerate, recover, wipe }) — the fake in tests,
// the real Tauri/USB layer in Phase 1b.

import { jobsToPurge } from './retention.js';
import { deviceRecord } from './deviceModel.js';
import { provenanceRecord, canProceed } from './authorization.js';
import { sanitizationMethodFor, buildCert } from './sanitizationCert.js';
import { getCatalog } from './catalog.js';
import { placeholderNative } from './native.js';
import { createNativeDevices } from './nativeDevices.js';

const rand = () => Math.random().toString(36).slice(2, 8);

export function createController({ catalog, native, now = Date.now, operator = 'operator' }) {
  const primaryDevice = async (jobId) => (await catalog.listDevices(jobId))[0] ?? null;
  const setStatus = async (jobId, status, extra = {}) => {
    const job = await catalog.getJob(jobId);
    if (job) await catalog.putJob({ ...job, status, ...extra });
  };
  const gate = async (jobId) => canProceed(await catalog.getProvenance(jobId));
  const sweep = async () => {
    for (const id of jobsToPurge(await catalog.listJobs(), { now })) await catalog.deleteJobCascade(id);
  };

  return {
    async newJob() {
      const job = await catalog.createJob({ now });
      await sweep();
      return job;
    },

    /** Drop jobs past the 10-day / 3-job window and all their data. Run on window open so the
     * TTL is honoured even when no new job is started. */
    async sweepRetention() {
      await sweep();
    },

    /** Manual purge: delete a job and all its recovered data on demand (a client asks, a device
     * is returned). */
    async discardJob(jobId) {
      await catalog.deleteJobCascade(jobId);
    },

    /** The connected devices the native bridge sees right now — a read-only list, nothing stored.
     * The window shows these so the operator picks which one to intake. */
    listConnectedDevices() {
      return native.enumerate();
    },

    /** Intake a device onto the job. With `raw` (a chosen blob from listConnectedDevices), intake
     * that one; without it, intake the first enumerated device (the Phase 1a path). The host's own
     * system disk is refused outright — deny-by-default: anything whose systemDisk is not an
     * explicit `false` is treated as a possible system disk and rejected, so the OS drive can never
     * become an intake/sanitize target. */
    async intakeDevice(jobId, raw) {
      if (raw === undefined) {
        const list = await native.enumerate();
        raw = Array.isArray(list) ? list[0] : list;
      }
      if (!raw) return { ok: false, reason: 'No device detected to intake.' };
      if (raw.systemDisk !== false) {
        return { ok: false, reason: "That is this computer's system disk — not an intake target." };
      }
      const device = deviceRecord({ jobId, id: `dev_${now()}_${rand()}`, raw });
      await catalog.putDevice(device);
      return device;
    },

    async authorize(jobId, { source, authorization, who } = {}) {
      const p = provenanceRecord({ jobId, source, authorization, who, operator, now });
      await catalog.putProvenance(p);
      return p;
    },

    async recover(jobId) {
      const g = await gate(jobId);
      if (!g.ok) return { ok: false, reason: g.reason };
      const device = await primaryDevice(jobId);
      if (!device) return { ok: false, reason: 'No device on this job to recover from.' };
      const manifest = await native.recover(device);
      for (const entry of manifest || []) await catalog.putRecovered({ jobId, path: entry.path, size: entry.size });
      await setStatus(jobId, 'recovered');
      return { ok: true, manifest };
    },

    async sanitize(jobId) {
      const g = await gate(jobId);
      if (!g.ok) return { ok: false, reason: g.reason };
      const device = await primaryDevice(jobId);
      if (!device) return { ok: false, reason: 'No device on this job to sanitize.' };
      const method = sanitizationMethodFor(device);
      const result = await native.wipe(device, method);
      if (!result?.ok) return { ok: false, reason: 'The wipe did not complete.' };
      const cert = buildCert({
        job: await catalog.getJob(jobId),
        device,
        provenance: await catalog.getProvenance(jobId),
        method,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        operator,
        now,
      });
      await catalog.putCert(cert);
      await setStatus(jobId, 'done');
      return { ok: true, cert };
    },

    async closeJob(jobId) {
      await setStatus(jobId, 'returned', { closedAt: now() });
    },

    listJobs() {
      return catalog.listJobs();
    },
  };
}

let shared = null;

const isTauri = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
const tauriInvoke = async (cmd, args) => {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke(cmd, args);
};

/** The one controller over the OS catalog. `enumerate` is the real read-only device bridge
 * (Phase 1b-A); recover and wipe remain Phase 1a placeholders until their own slices land. */
export function getController() {
  if (!shared) {
    const devices = createNativeDevices({ invoke: tauriInvoke, isTauri });
    const native = {
      enumerate: () => devices.enumerate(),
      recover: placeholderNative.recover,
      wipe: placeholderNative.wipe,
    };
    shared = createController({ catalog: getCatalog(), native });
  }
  return shared;
}
