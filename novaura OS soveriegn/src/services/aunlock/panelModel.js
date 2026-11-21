// panelModel.js — the view state for the Aunlock window's tab strip. Up to 3 job tabs (matching
// the 3-job retention window), newest first, each with its status. Pure, so the view stays thin.

export function describeJobs(jobs = []) {
  const tabs = [...jobs]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3)
    .map((j) => ({ id: j.id, title: titleFor(j), status: j.status }));
  return { tabs };
}

function titleFor(job) {
  const suffix = String(job.id).replace(/^job_\d+_/, '');
  return `Job ${suffix || job.id}`;
}
