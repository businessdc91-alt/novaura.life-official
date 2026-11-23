// controller.js — the Aunlock Nova job lifecycle: intake -> authorize -> recover -> sanitize ->
// close. It enforces the two safety rules the suite exists for:
//   - the AUTHORIZATION GATE: recover and sanitize refuse any job with no recorded authorization
//     (never a lock bypass — a device you can't account for cannot be worked on);
//   - RETENTION: creating a job purges jobs past the 10-day / 3-job window and all their rows.
// The hardware layer is injected as `native` ({ enumerate, readHealth, resolveVolumes, listDir,
// recoverFiles, purgeRecovered, wipe }) — the fake in tests, the real Tauri bridge in the app.

import { jobsToPurge } from './retention.js';
import { deviceRecord } from './deviceModel.js';
import { provenanceRecord, canProceed } from './authorization.js';
import { sanitizationMethodFor, buildCert } from './sanitizationCert.js';
import { getCatalog } from './catalog.js';
import { placeholderNative } from './native.js';
import { createNativeDevices } from './nativeDevices.js';
import { createNativeRecover } from './nativeRecover.js';
import { isRecoverableVolume } from './volumeRules.js';
import { scanAndRedactOutboundSecrets } from '../security/complianceService.js';

const rand = () => Math.random().toString(36).slice(2, 8);

const NO_DEVICE = 'No device on this job to work on.';
const ENCRYPTED_REASON =
  'This device is encrypted. Aunlock never recovers from encrypted storage — reclaim it (sanitize and reuse) instead.';
const NO_RECOVERABLE =
  'No recoverable volume was found. Encrypted or unreadable volumes cannot be recovered — reclaim the device instead.';

// Native error text can echo paths or secrets; it is redacted before it reaches a reason.
const safeReason = (e) =>
  scanAndRedactOutboundSecrets([{ content: String(e?.message ?? e ?? 'Native call failed.') }]).messages[0].content;

export function createController({ catalog, native, now = Date.now, operator = 'operator' }) {
  const primaryDevice = async (jobId) => (await catalog.listDevices(jobId))[0] ?? null;
  const setStatus = async (jobId, status, extra = {}) => {
    const job = await catalog.getJob(jobId);
    if (job) await catalog.putJob({ ...job, status, ...extra });
  };
  const gate = async (jobId) => canProceed(await catalog.getProvenance(jobId));
  // An explicitly named volume is checked against the resolved layout before anything reads it:
  // the device-level lock state cannot see one suspended/unlocked BitLocker volume on a disk that
  // is otherwise clear. Fails closed — an unknown letter or a layout read error is a refusal.
  const recoverableLetter = async (device, driveLetter) => {
    let volumes;
    try {
      volumes = await native.resolveVolumes(device);
    } catch (e) {
      return { ok: false, reason: safeReason(e) };
    }
    const want = String(driveLetter ?? '').trim().toUpperCase();
    const v = want
      ? (Array.isArray(volumes) ? volumes : []).find((x) => String(x?.driveLetter ?? '').trim().toUpperCase() === want)
      : null;
    if (!v || !isRecoverableVolume(v)) return { ok: false, reason: NO_RECOVERABLE };
    return { ok: true, letter: v.driveLetter };
  };
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

    /** Drive health. Hardware metadata like identification — no authorization needed. */
    async readHealth(jobId) {
      const device = await primaryDevice(jobId);
      if (!device) return { ok: false, reason: NO_DEVICE };
      try {
        return { ok: true, health: await native.readHealth(device) };
      } catch (e) {
        return { ok: false, reason: safeReason(e) };
      }
    },

    /** Volume layout (including non-recoverable ones, so the UI can show a reclaim note). No
     * authorization needed — layout metadata — but an encrypted device is refused. */
    async listVolumes(jobId) {
      const device = await primaryDevice(jobId);
      if (!device) return { ok: false, reason: NO_DEVICE };
      if (device.lockState === 'encrypted') return { ok: false, reason: ENCRYPTED_REASON };
      try {
        return { ok: true, volumes: await native.resolveVolumes(device) };
      } catch (e) {
        return { ok: false, reason: safeReason(e) };
      }
    },

    /** List a directory on a volume. File names are the owner's data, so authorization is required. */
    async browse(jobId, { driveLetter, subpath = '' } = {}) {
      const g = await gate(jobId);
      if (!g.ok) return { ok: false, reason: g.reason };
      const device = await primaryDevice(jobId);
      if (!device) return { ok: false, reason: NO_DEVICE };
      if (device.lockState === 'encrypted') return { ok: false, reason: ENCRYPTED_REASON };
      const checked = await recoverableLetter(device, driveLetter);
      if (!checked.ok) return { ok: false, reason: checked.reason };
      try {
        return { ok: true, entries: await native.listDir(checked.letter, subpath) };
      } catch (e) {
        return { ok: false, reason: safeReason(e) };
      }
    },

    /** Recover files into staging. Only metadata rows (path, size, stagedRef, sourceType,
     * checksum) reach the catalog — never contents. */
    async recover(jobId, { driveLetter = null, selection = { preset: true } } = {}) {
      const g = await gate(jobId);
      if (!g.ok) return { ok: false, reason: g.reason };
      const device = await primaryDevice(jobId);
      if (!device) return { ok: false, reason: NO_DEVICE };
      if (device.lockState === 'encrypted') return { ok: false, reason: ENCRYPTED_REASON };

      let letters;
      if (driveLetter) {
        const checked = await recoverableLetter(device, driveLetter);
        if (!checked.ok) return { ok: false, reason: checked.reason };
        letters = [checked.letter];
      } else {
        try {
          letters = (await native.resolveVolumes(device)).filter(isRecoverableVolume).map((v) => v.driveLetter);
        } catch (e) {
          return { ok: false, reason: safeReason(e) };
        }
      }
      if (!letters.length) return { ok: false, reason: NO_RECOVERABLE };

      const manifest = [];
      const skipped = [];
      let complete = true;
      let stopReason = null;
      let failures = 0;
      for (const letter of letters) {
        let outcome;
        try {
          outcome = await native.recoverFiles(jobId, letter, selection);
        } catch (e) {
          failures += 1;
          complete = false;
          skipped.push({ path: `${letter}:\\`, reason: safeReason(e) });
          continue;
        }
        for (const entry of outcome?.entries ?? []) {
          // Only metadata leaves this loop — the same five fields go to the catalog and the caller.
          const { path, size, stagedRef, sourceType, checksum } = entry;
          const row = { path, size, stagedRef, sourceType, checksum };
          await catalog.putRecovered({ jobId, ...row });
          manifest.push(row);
        }
        skipped.push(...(outcome?.skipped ?? []));
        if (!outcome?.complete) complete = false;
        stopReason = stopReason ?? outcome?.stopReason ?? null;
      }
      if (failures === letters.length && !manifest.length) {
        return { ok: false, reason: skipped[0]?.reason ?? 'Recovery failed.' };
      }
      await setStatus(jobId, 'recovered', {
        recoverComplete: complete,
        recoverSkippedCount: skipped.length,
        recoverStopReason: stopReason,
      });
      return { ok: true, manifest, skipped, complete, stopReason };
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

/** The one controller over the OS catalog. `enumerate` is the read-only device bridge and the
 * recovery methods are the drive-recovery bridge; `wipe` stays a placeholder until its own slice. */
export function getController() {
  if (!shared) {
    const devices = createNativeDevices({ invoke: tauriInvoke, isTauri });
    const recovery = createNativeRecover({ invoke: tauriInvoke, isTauri });
    const native = {
      enumerate: () => devices.enumerate(),
      readHealth: recovery.readHealth,
      resolveVolumes: recovery.resolveVolumes,
      listDir: recovery.listDir,
      recoverFiles: recovery.recoverFiles,
      purgeRecovered: recovery.purgeRecovered,
      wipe: placeholderNative.wipe,
    };
    shared = createController({ catalog: getCatalog(), native });
  }
  return shared;
}
