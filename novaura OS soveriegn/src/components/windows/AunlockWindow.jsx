// AunlockWindow — the refurbisher suite's tabbed panel, a thin view over the aunlock controller:
// create jobs, record provenance/authorization, scan + intake a device, recover the owner's files
// (AunlockRecoveryPanel), sanitize, discard. No lock is ever bypassed — a job with no recorded
// authorization cannot be browsed, recovered or sanitized, and encrypted storage is refused
// (all enforced in the controller).

import { useEffect, useState } from 'react';
import { getController } from '../../services/aunlock/controller.js';
import { describeJobs } from '../../services/aunlock/panelModel.js';
import { describeConnectedDevices } from '../../services/aunlock/connectedPanel.js';
import AunlockRecoveryPanel from './AunlockRecoveryPanel.jsx';

export default function AunlockWindow() {
  const controller = getController();
  const [jobs, setJobs] = useState([]);
  const [active, setActive] = useState(null);
  const [notice, setNotice] = useState('');

  async function refresh() {
    await controller.sweepRetention(); // honour the 10-day TTL on open, not only on new jobs
    const list = await controller.listJobs();
    setJobs(list);
    setActive((cur) => (cur && list.some((j) => j.id === cur) ? cur : (list.length ? list[list.length - 1].id : null)));
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

      {/* keyed by job: switching tabs remounts the panel, so nothing in flight for one job can land
          in another job's view (health, browse results, staged list, the authorization text) */}
      {active && <JobPanel key={active} controller={controller} jobId={active} onChange={refresh} setNotice={setNotice} />}
      {notice && <p className="mt-3 text-amber-300">{notice}</p>}

      <p className="mt-6 text-xs opacity-50">
        Recovery reads the owner's unencrypted drives only and never writes to them; encrypted
        storage is refused and routed to reclaim. A device with no recorded authorization cannot be
        browsed, recovered or sanitized — this tool never bypasses a lock. Sanitization connects in
        its own slice.
      </p>
    </div>
  );
}

function JobPanel({ controller, jobId, onChange, setNotice }) {
  const [auth, setAuth] = useState('');
  const [devices, setDevices] = useState(null); // null = not scanned yet
  const [rev, setRev] = useState(0); // bumps after any action so the recovery view reloads

  async function act(fn, label) {
    try {
      const r = await fn();
      setNotice(r && r.ok === false ? r.reason : `${label} ✓`);
    } catch (e) {
      setNotice(e.message);
    }
    await onChange();
    setRev((n) => n + 1);
  }

  async function scan() {
    try {
      const list = await controller.listConnectedDevices();
      const { rows } = describeConnectedDevices(list);
      setDevices(rows);
      setNotice(`Found ${rows.length} connected device${rows.length === 1 ? '' : 's'}`);
    } catch (e) {
      setDevices([]);
      setNotice(e.message);
    }
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
          onClick={scan}>Scan for devices</button>
        <button className="px-3 py-1 rounded bg-white/10 hover:bg-white/20"
          onClick={() => act(() => controller.sanitize(jobId), 'Sanitized')}>Sanitize + certificate</button>
        <button className="px-3 py-1 rounded bg-red-900/60 hover:bg-red-800/60"
          onClick={() => act(() => controller.discardJob(jobId), 'Job data discarded')}>Discard job + data</button>
      </div>

      {devices && devices.length === 0 && (
        <p className="text-xs opacity-60">No device detected — connect one over USB and scan again.</p>
      )}
      {devices && devices.length > 0 && (
        <ul className="space-y-1">
          {devices.map((row) => (
            <li key={row.id} className="flex items-center justify-between rounded bg-black/20 px-2 py-1">
              <span className="truncate">
                <span className="font-medium">{row.label}</span>
                {row.sub && <span className="opacity-60"> · {row.sub}</span>}
                {!row.selectable && <span className="ml-2 text-amber-400">this PC — not an intake target</span>}
              </span>
              <button
                disabled={!row.selectable}
                className={`ml-2 px-2 py-0.5 rounded text-xs ${row.selectable ? 'bg-amber-600 hover:bg-amber-500' : 'bg-white/5 opacity-40 cursor-not-allowed'}`}
                onClick={() => row.selectable && act(() => controller.intakeDevice(jobId, row.raw), 'Device intaken')}>
                Intake
              </button>
            </li>
          ))}
        </ul>
      )}

      <AunlockRecoveryPanel controller={controller} jobId={jobId} setNotice={setNotice}
        onChange={onChange} refreshKey={rev} />
    </div>
  );
}
