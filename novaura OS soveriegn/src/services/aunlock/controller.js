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
const UNVERIFIED =
  "No recoverable volume was found: this drive's encryption status could not be verified, so it is refused. Run Sovereign as administrator so BitLocker status can be read — this alone is no reason to reclaim the drive.";
const PURGE_PENDING =
  'Recovered files could not be deleted yet — the job is kept and the delete will be retried.';
const BEING_DELETED =
  'This job is being deleted (its recovered files are queued for deletion) — start a new job to recover again.';
const DISCARDED_DURING =
  'This job was discarded while the recovery ran — nothing from the run was kept, and its staged files are being deleted.';

// Native error text can echo paths or secrets; it is redacted before it reaches a reason.
const safeReason = (e) =>
  scanAndRedactOutboundSecrets([{ content: String(e?.message ?? e ?? 'Native call failed.') }]).messages[0].content;
// Redact many native strings in one pass (skip/link reasons, the stop reason).
const redactAll = (strings) =>
  scanAndRedactOutboundSecrets(strings.map((s) => ({ content: String(s ?? '') }))).messages.map((m) => m.content);
// The staging-folder name for a job id (mirrors the native job_key).
const stagingKey = (id) => String(id ?? '').replace(/[^A-Za-z0-9_]/g, '_') || '_';

export function createController({ catalog, native, now = Date.now, operator = 'operator' }) {
  const primaryDevice = async (jobId) => (await catalog.listDevices(jobId))[0] ?? null;
  // 'purge-pending' is sticky: once a job is queued for deletion nothing moves it back to a working
  // state (that would quietly undo a client's delete request and stop the retries).
  const setStatus = async (jobId, status, extra = {}) => {
    const job = await catalog.getJob(jobId);
    if (!job) return;
    if (job.status === 'purge-pending' && status !== 'purge-pending') return;
    await catalog.putJob({ ...job, status, ...extra });
  };
  const isBeingDeleted = async (jobId) => (await catalog.getJob(jobId))?.status === 'purge-pending';
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
  // Staged files are deleted BEFORE the rows that point at them. If the files cannot be confirmed
  // deleted, the job is kept (status 'purge-pending', rows intact) so the next sweep retries —
  // dropping the rows first would leave encrypted client data on disk that nothing records.
  const purgeJob = async (jobId) => {
    let failure = null;
    try {
      if ((await native.purgeRecovered(jobId)) !== true) failure = 'The staged files were not confirmed deleted.';
    } catch (e) {
      failure = safeReason(e);
    }
    if (failure === null) {
      await catalog.deleteJobCascade(jobId);
      return { ok: true };
    }
    await setStatus(jobId, 'purge-pending', { purgeError: failure });
    return { ok: false, reason: `${PURGE_PENDING} ${failure}` };
  };
  // Retention: everything past the 10-day / 3-job window, plus any job still waiting on a purge.
  // Then reconcile the disk with the catalog: any staged job folder the catalog no longer knows
  // (a crash, a lost database, a delete that raced a run) is purged — client data never lingers
  // just because nothing records it. Best effort; a failure is retried on the next sweep.
  const sweep = async () => {
    const jobs = await catalog.listJobs();
    const ids = new Set(jobsToPurge(jobs, { now }));
    for (const j of jobs) if (j.status === 'purge-pending') ids.add(j.id);
    for (const id of ids) await purgeJob(id);

    let staged = [];
    try {
      staged = await native.listStagedJobs();
    } catch {
      staged = [];
    }
    if (!Array.isArray(staged) || staged.length === 0) return;
    const known = new Set((await catalog.listJobs()).map((j) => stagingKey(j.id)));
    for (const id of staged) {
      if (typeof id !== 'string' || id === '' || known.has(id)) continue;
      try {
        await native.purgeRecovered(id);
      } catch {
        /* retried next sweep */
      }
    }
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
     * is returned). The staged files go first; if they can't be deleted yet the job is kept as
     * 'purge-pending' and the delete is retried on the next sweep. */
    async discardJob(jobId) {
      return purgeJob(jobId);
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

    /** List a directory on a volume. File names are the owner's data, so authorization is required.
     * The native side binds the letter to THIS device and refuses any volume that is not a
     * recoverable, non-system volume of it (one PowerShell call per listing). */
    async browse(jobId, { driveLetter, subpath = '' } = {}) {
      const g = await gate(jobId);
      if (!g.ok) return { ok: false, reason: g.reason };
      if (await isBeingDeleted(jobId)) return { ok: false, reason: BEING_DELETED };
      const device = await primaryDevice(jobId);
      if (!device) return { ok: false, reason: NO_DEVICE };
      if (device.lockState === 'encrypted') return { ok: false, reason: ENCRYPTED_REASON };
      try {
        return { ok: true, entries: await native.listDir(device, driveLetter, subpath) };
      } catch (e) {
        return { ok: false, reason: safeReason(e) };
      }
    },

    /** Recover files into staging. Only metadata rows (path, size, stagedRef, sourceType,
     * checksum) reach the catalog — never contents. The native side binds each letter to THIS
     * device and refuses a second concurrent run on the job. */
    async recover(jobId, { driveLetter = null, selection = { preset: true } } = {}) {
      const g = await gate(jobId);
      if (!g.ok) return { ok: false, reason: g.reason };
      if (await isBeingDeleted(jobId)) return { ok: false, reason: BEING_DELETED };
      const device = await primaryDevice(jobId);
      if (!device) return { ok: false, reason: NO_DEVICE };
      if (device.lockState === 'encrypted') return { ok: false, reason: ENCRYPTED_REASON };

      let letters;
      if (driveLetter) {
        const checked = await recoverableLetter(device, driveLetter);
        if (!checked.ok) return { ok: false, reason: checked.reason };
        letters = [checked.letter];
      } else {
        let volumes;
        try {
          volumes = await native.resolveVolumes(device);
        } catch (e) {
          return { ok: false, reason: safeReason(e) };
        }
        const list = Array.isArray(volumes) ? volumes : [];
        letters = list.filter(isRecoverableVolume).map((v) => v.driveLetter);
        if (!letters.length) {
          // Unverifiable encryption is not evidence of encryption: say so, don't send it to reclaim.
          const unverified = list.some((v) => v?.encrypted !== true && v?.encryptionKnown === false);
          return { ok: false, reason: unverified ? UNVERIFIED : NO_RECOVERABLE };
        }
      }

      const manifest = [];
      const skipped = [];
      const links = [];
      let complete = true;
      let stopReason = null;
      let failures = 0;
      for (const letter of letters) {
        let outcome;
        try {
          outcome = await native.recoverFiles(jobId, device, letter, selection);
        } catch (e) {
          failures += 1;
          complete = false;
          skipped.push({ path: `${letter}:\\`, reason: safeReason(e) });
          continue;
        }
        // The job may have been discarded (or swept) while this run was going. Its rows are not
        // written, and its staged bytes are deleted again — never left behind unrecorded.
        const live = await catalog.getJob(jobId);
        if (!live) {
          try {
            await native.purgeRecovered(jobId);
          } catch {
            /* the sweep's orphan reconciliation retries */
          }
          return { ok: false, reason: DISCARDED_DURING };
        }
        if (live.status === 'purge-pending') return { ok: false, reason: DISCARDED_DURING };

        for (const entry of outcome?.entries ?? []) {
          // Only metadata leaves this loop — the same five fields go to the catalog and the caller.
          const { path, size, stagedRef, sourceType, checksum } = entry;
          const row = { path, size, stagedRef, sourceType, checksum };
          await catalog.putRecovered({ jobId, ...row });
          manifest.push(row);
        }
        const outSkipped = Array.isArray(outcome?.skipped) ? outcome.skipped : [];
        const outLinks = Array.isArray(outcome?.links) ? outcome.links : [];
        const reasons = redactAll([
          ...outSkipped.map((s) => s?.reason),
          ...outLinks.map((s) => s?.reason),
          outcome?.stopReason ?? '',
        ]);
        outSkipped.forEach((s, i) => skipped.push({ path: String(s?.path ?? ''), reason: reasons[i] }));
        outLinks.forEach((s, i) => links.push({ path: String(s?.path ?? ''), reason: reasons[outSkipped.length + i] }));
        if (!outcome?.complete) complete = false;
        const stop = outcome?.stopReason ? reasons[reasons.length - 1] : null;
        stopReason = stopReason ?? stop;
      }
      if (failures === letters.length && !manifest.length) {
        return { ok: false, reason: skipped[0]?.reason ?? 'Recovery failed.' };
      }
      await setStatus(jobId, 'recovered', {
        recoverComplete: complete,
        recoverSkippedCount: skipped.length,
        recoverStopReason: stopReason,
      });
      return { ok: true, manifest, skipped, links, complete, stopReason };
    },

    /** Check a staged copy decrypts to exactly the recorded size and checksum. Uses the catalog's
     * own row (not caller-supplied values); the owner's data, so authorization is required. */
    async verifyRecovered(jobId, stagedRef) {
      const g = await gate(jobId);
      if (!g.ok) return { ok: false, reason: g.reason };
      if (await isBeingDeleted(jobId)) return { ok: false, reason: BEING_DELETED };
      const row = (await catalog.listRecovered(jobId)).find((r) => r.stagedRef === stagedRef);
      if (!row) return { ok: false, reason: 'No staged file with that reference on this job.' };
      try {
        const verified = await native.verifyRecovered(jobId, row);
        return { ok: true, verified: verified === true };
      } catch (e) {
        return { ok: false, reason: safeReason(e) };
      }
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

    /** The staged-file rows for a job — metadata only (path, size, stagedRef, sourceType, checksum). */
    listRecovered(jobId) {
      return catalog.listRecovered(jobId);
    },
  };
}

let shared = null;

const isTauri = () => typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
const tauriInvoke = async (cmd, args) => {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke(cmd, args);
};

/** Off the desktop app nothing can have been staged to disk (recovery only runs natively), so a
 * purge there is trivially complete; in the app it is the native delete. Keeps browser/dev runs
 * from stranding jobs as 'purge-pending'. */
export function stagedBytesPurger({ purgeRecovered, isTauri } = {}) {
  return (jobId) =>
    typeof isTauri === 'function' && isTauri() ? purgeRecovered(jobId) : Promise.resolve(true);
}

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
      verifyRecovered: recovery.verifyRecovered,
      listStagedJobs: recovery.listStagedJobs,
      purgeRecovered: stagedBytesPurger({ purgeRecovered: recovery.purgeRecovered, isTauri }),
      wipe: placeholderNative.wipe,
    };
    shared = createController({ catalog: getCatalog(), native });
  }
  return shared;
}
