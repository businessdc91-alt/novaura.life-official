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

const rand = () => Math.random().toString(36).slice(2, 8);

export function createController({ catalog, native, now = Date.now, operator = 'operator' }) {
  const primaryDevice = async (jobId) => (await catalog.listDevices(jobId))[0] ?? null;
  const setStatus = async (jobId, status, extra = {}) => {
    const job = await catalog.getJob(jobId);
    if (job) await catalog.putJob({ ...job, status, ...extra });
  };
  const gate = async (jobId) => canProceed(await catalog.getProvenance(jobId));

  return {
    async newJob() {
      const job = await catalog.createJob({ now });
      for (const id of jobsToPurge(await catalog.listJobs(), { now })) await catalog.deleteJobCascade(id);
      return job;
    },

    async intakeDevice(jobId) {
      const raw = await native.enumerate();
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

/** The one controller over the OS catalog. The native layer is the Phase 1a placeholder until
 * Phase 1b swaps in the real USB/drive/wipe implementation. */
export function getController() {
  if (!shared) shared = createController({ catalog: getCatalog(), native: placeholderNative });
  return shared;
}
