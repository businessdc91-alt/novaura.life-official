// retention.js — the refurbisher suite keeps recovered data and jobs for at most 10 days and
// only for the 3 most recent jobs. jobsToPurge decides which jobs to drop: anything past the
// TTL, plus — once the expired ones are set aside — the oldest jobs beyond the cap. The result
// is oldest-first with no duplicates, so the caller cascades a delete over each.

export const TEN_DAYS_MS = 864e5 * 10;

/**
 * jobsToPurge(jobs, { now = Date.now, maxJobs = 3, ttlMs = 10 days }) -> jobId[]
 * jobs: [{ id, createdAt, ... }]. Returned ids are oldest-first, deduped.
 */
export function jobsToPurge(jobs, { now = Date.now, maxJobs = 3, ttlMs = TEN_DAYS_MS } = {}) {
  const t = now();
  const sorted = [...jobs].sort((a, b) => a.createdAt - b.createdAt); // oldest first
  const purge = new Set();
  for (const j of sorted) {
    if (t - j.createdAt > ttlMs) purge.add(j.id);
  }
  const remaining = sorted.filter((j) => !purge.has(j.id));
  for (let i = 0; i < remaining.length - maxJobs; i++) purge.add(remaining[i].id);
  return sorted.filter((j) => purge.has(j.id)).map((j) => j.id);
}
