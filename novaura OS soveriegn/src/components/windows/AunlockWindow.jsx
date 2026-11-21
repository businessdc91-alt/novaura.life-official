// AunlockWindow — the refurbisher suite's tabbed panel, a thin view over the aunlock controller.
// Phase 1a: create jobs, record provenance/authorization, and walk the lifecycle. Device
// detection, recovery and sanitization connect in the hardware phase (Phase 1b); until then they
// report that. No lock is ever bypassed — a job with no recorded authorization cannot be
// recovered or sanitized (enforced in the controller).

import { useEffect, useState } from 'react';
import { getController } from '../../services/aunlock/controller.js';
import { describeJobs } from '../../services/aunlock/panelModel.js';

export default function AunlockWindow() {
  const controller = getController();
  const [jobs, setJobs] = useState([]);
  const [active, setActive] = useState(null);
  const [notice, setNotice] = useState('');

  async function refresh() {
    const list = await controller.listJobs();
    setJobs(list);
    setActive((cur) => cur || (list.length ? list[list.length - 1].id : null));
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const { tabs } = describeJobs(jobs);

  async function run(fn, label) {
    try {
      const r = await fn();
      setNotice(r && r.ok === false ? r.reason : `${label} ✓`);
    } catch (e) {
      setNotice(e.message);
    }
    await refresh();
  }

  return (
    <div className="p-4 text-sm text-white h-full overflow-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">Aunlock Nova — Refurbisher Suite</h2>
        <button className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500"
          onClick={() => run(() => controller.newJob(), 'New job')}>+ New job</button>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {tabs.length === 0 && <span className="opacity-60">No jobs yet — start one.</span>}
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActive(t.id)}
            className={`px-3 py-1 rounded ${active === t.id ? 'bg-amber-700' : 'bg-white/10 hover:bg-white/20'}`}>
            {t.title} · {t.status}
          </button>
        ))}
      </div>

      {active && <JobPanel controller={controller} jobId={active} onChange={refresh} setNotice={setNotice} />}
      {notice && <p className="mt-3 text-amber-300">{notice}</p>}

      <p className="mt-6 text-xs opacity-50">
        Device detection, recovery and sanitization connect in the hardware phase. A device with
        no recorded authorization cannot be recovered or sanitized — this tool never bypasses a lock.
      </p>
    </div>
  );
}

function JobPanel({ controller, jobId, onChange, setNotice }) {
  const [auth, setAuth] = useState('');

  async function act(fn, label) {
    try {
      const r = await fn();
      setNotice(r && r.ok === false ? r.reason : `${label} ✓`);
    } catch (e) {
      setNotice(e.message);
    }
    await onChange();
  }

  return (
    <div className="rounded border border-white/10 p-3 space-y-2">
      <div className="flex gap-2">
        <input value={auth} onChange={(e) => setAuth(e.target.value)}
          placeholder="Authorization — receipt, decommission manifest, or owner present"
          className="flex-1 bg-black/30 rounded px-2 py-1 outline-none" />
        <button className="px-3 py-1 rounded bg-white/10 hover:bg-white/20"
          onClick={() => act(() => controller.authorize(jobId, { authorization: auth }), 'Authorization recorded')}>
          Record authorization
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="px-3 py-1 rounded bg-white/10 hover:bg-white/20"
          onClick={() => act(() => controller.intakeDevice(jobId), 'Device identified')}>Connect / identify device</button>
        <button className="px-3 py-1 rounded bg-white/10 hover:bg-white/20"
          onClick={() => act(() => controller.recover(jobId), 'Recovered')}>Recover files</button>
        <button className="px-3 py-1 rounded bg-white/10 hover:bg-white/20"
          onClick={() => act(() => controller.sanitize(jobId), 'Sanitized')}>Sanitize + certificate</button>
      </div>
    </div>
  );
}
