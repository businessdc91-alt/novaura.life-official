// catalog.js — Aunlock Nova's record of devices, jobs, provenance/authorization, sanitization
// certs, and recovered-file manifests, over the aunlock_* tables (database v25). A job is one
// device intake; recovered data and jobs are kept at most 10 days and only for the 3 most recent
// jobs (see retention.js, applied by the controller). Only the owner's own, authorized data is
// ever recorded here — the tool never circumvents a lock.

import { db } from '../../database/sovereignDatabase.js';

const rand = () => Math.random().toString(36).slice(2, 8);

export function createCatalog({ jobs, devices, provenance, certs, recovered }) {
  return {
    async createJob({ now = Date.now } = {}) {
      const t = now();
      const job = { id: `job_${t}_${rand()}`, status: 'intake', createdAt: t, closedAt: null };
      await jobs.put(job);
      return job;
    },
    async getJob(id) {
      return (await jobs.get(id)) ?? null;
    },
    async listJobs() {
      return jobs.toArray();
    },

    async putDevice(device) {
      await devices.put(device);
    },
    async listDevices(jobId) {
      return devices.where('jobId').equals(jobId).toArray();
    },

    async putProvenance(p) {
      await provenance.put(p);
    },
    async getProvenance(jobId) {
      return (await provenance.get(jobId)) ?? null;
    },

    async putCert(cert) {
      await certs.put(cert);
    },
    async listCerts(jobId) {
      return certs.where('jobId').equals(jobId).toArray();
    },

    async putRecovered(entry) {
      await recovered.put(entry);
    },
    async listRecovered(jobId) {
      return recovered.where('jobId').equals(jobId).toArray();
    },

    /** Remove a job and every row attached to it (devices, provenance, certs, recovered). */
    async deleteJobCascade(jobId) {
      for (const d of await devices.where('jobId').equals(jobId).toArray()) await devices.delete(d.id);
      for (const c of await certs.where('jobId').equals(jobId).toArray()) await certs.delete(c.id);
      for (const r of await recovered.where('jobId').equals(jobId).toArray()) await recovered.delete([r.jobId, r.path]);
      await provenance.delete(jobId);
      await jobs.delete(jobId);
    },
  };
}

let shared = null;

/** The one catalog over the OS database's aunlock_* tables. */
export function getCatalog() {
  if (!shared) {
    shared = createCatalog({
      jobs: db.aunlock_jobs,
      devices: db.aunlock_devices,
      provenance: db.aunlock_provenance,
      certs: db.aunlock_certs,
      recovered: db.aunlock_recovered,
    });
  }
  return shared;
}
