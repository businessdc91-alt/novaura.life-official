// AunlockRecoveryPanel — the recovery view inside an Aunlock job tab: drive health, the volumes on
// the intaken device (a volume that can't be recovered says why and stays disabled), a folder
// browser with checkbox selection, one-click "recover user files", recover-selected, the outcome of
// the last run (partial results and the skip list), and the staged results.
//
// A thin view. The decisions live elsewhere and are tested there: the controller enforces the
// authorization gate and refuses encrypted devices/volumes; recoveryPanel.js shapes what is shown
// and builds the paths the native layer accepts. Nothing here ever reads file contents.

import { useEffect, useState } from 'react';
import { Folder } from 'lucide-react';
import {
  describeHealth,
  describeVolumes,
  describeDirEntries,
  describeStaged,
  describeOutcome,
  subpathOf,
  volumePath,
} from '../../services/aunlock/recoveryPanel.js';

const TONE = {
  ok: 'border-emerald-500/40 bg-emerald-900/20 text-emerald-200',
  warn: 'border-amber-500/40 bg-amber-900/20 text-amber-200',
  fail: 'border-red-500/40 bg-red-900/20 text-red-200',
  unknown: 'border-white/10 bg-white/5 text-white/70',
};

const btn = (enabled, accent = false) =>
  `px-2 py-0.5 rounded text-xs ${
    enabled
      ? accent ? 'bg-amber-600 hover:bg-amber-500' : 'bg-white/10 hover:bg-white/20'
      : 'bg-white/5 opacity-40 cursor-not-allowed'
  }`;

export default function AunlockRecoveryPanel({ controller, jobId, setNotice, onChange, refreshKey }) {
  const [health, setHealth] = useState(null);
  const [volumes, setVolumes] = useState(null); // null = not loaded yet
  const [volumesError, setVolumesError] = useState('');
  const [active, setActive] = useState(null); // drive letter being browsed
  const [segments, setSegments] = useState([]); // folder path inside the active volume
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState(() => new Set()); // absolute paths on the active volume
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [staged, setStaged] = useState(() => describeStaged([]));

  async function loadStaged() {
    try {
      setStaged(describeStaged(await controller.listRecovered(jobId)));
    } catch {
      /* keep the last list */
    }
  }

  async function loadDevice() {
    const h = await controller.readHealth(jobId);
    setHealth(h.ok ? describeHealth(h.health) : { tone: 'unknown', label: h.reason });
    const v = await controller.listVolumes(jobId);
    if (v.ok) {
      setVolumes(describeVolumes(v.volumes).rows);
      setVolumesError('');
    } else {
      setVolumes([]);
      setVolumesError(v.reason);
    }
  }

  useEffect(() => {
    setActive(null);
    setSegments([]);
    setEntries([]);
    setSelected(new Set());
    setOutcome(null);
    loadDevice().catch((e) => setNotice(e.message));
    loadStaged();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, refreshKey]);

  async function openFolder(letter, segs) {
    setBusy(true);
    try {
      const r = await controller.browse(jobId, { driveLetter: letter, subpath: subpathOf(segs) });
      if (!r.ok) {
        setNotice(r.reason);
        return;
      }
      if (letter !== active) setSelected(new Set()); // a recovery runs against one volume at a time
      setActive(letter);
      setSegments(segs);
      setEntries(describeDirEntries(r.entries).rows);
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }

  function toggle(path) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  async function runRecover(opts, label) {
    setBusy(true);
    setOutcome(null);
    setNotice(`${label}…`);
    try {
      const r = await controller.recover(jobId, opts);
      const o = describeOutcome(r);
      setOutcome(o);
      setNotice(o.label);
      if (r?.ok) setSelected(new Set());
    } catch (e) {
      const o = describeOutcome({ ok: false, reason: e.message });
      setOutcome(o);
      setNotice(o.label);
    } finally {
      setBusy(false);
      await loadStaged();
      await onChange();
    }
  }

  const anyRecoverable = Boolean(volumes?.some((v) => v.recoverable));

  return (
    <div className="rounded border border-white/10 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Recovery</h3>
        <button
          disabled={busy || !anyRecoverable}
          className={btn(!busy && anyRecoverable, true)}
          onClick={() => runRecover({}, 'Recovering user files from every recoverable volume')}>
          Recover user files (all volumes)
        </button>
      </div>

      {health && (
        <div className={`rounded border px-2 py-1 text-xs ${TONE[health.tone] ?? TONE.unknown}`}>
          Drive health: {health.label}
        </div>
      )}

      {volumesError && <p className="text-xs text-amber-300">{volumesError}</p>}
      {volumes && volumes.length === 0 && !volumesError && (
        <p className="text-xs opacity-60">No volumes found on this device.</p>
      )}
      {volumes && volumes.length > 0 && (
        <ul className="space-y-1">
          {volumes.map((row, i) => (
            <li key={row.driveLetter ?? `vol-${i}`} className="rounded bg-black/20 px-2 py-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">
                  <span className="font-medium">{row.label}</span>
                  {row.sub && <span className="opacity-60"> · {row.sub}</span>}
                </span>
                <span className="flex shrink-0 gap-1">
                  <button
                    disabled={!row.recoverable || busy}
                    className={btn(row.recoverable && !busy)}
                    onClick={() => openFolder(row.driveLetter, [])}>
                    Browse
                  </button>
                  <button
                    disabled={!row.recoverable || busy}
                    className={btn(row.recoverable && !busy)}
                    onClick={() =>
                      runRecover(
                        { driveLetter: row.driveLetter, selection: { preset: true, paths: [] } },
                        `Recovering user files from ${row.driveLetter}:`,
                      )
                    }>
                    Recover user files
                  </button>
                </span>
              </div>
              {row.reason && <p className="mt-1 text-xs text-amber-300">{row.reason}</p>}
            </li>
          ))}
        </ul>
      )}

      {active && (
        <div className="space-y-1 rounded border border-white/10 p-2">
          <div className="flex items-center gap-2 text-xs">
            <button
              disabled={busy || segments.length === 0}
              className={btn(!busy && segments.length > 0)}
              onClick={() => openFolder(active, segments.slice(0, -1))}>
              Up
            </button>
            <span className="truncate font-mono">{volumePath(active, segments)}</span>
            <button
              disabled={busy || selected.size === 0}
              className={`ml-auto ${btn(!busy && selected.size > 0, true)}`}
              onClick={() =>
                runRecover(
                  { driveLetter: active, selection: { preset: false, paths: [...selected] } },
                  `Recovering ${selected.size} selected item${selected.size === 1 ? '' : 's'}`,
                )
              }>
              Recover selected ({selected.size})
            </button>
          </div>
          {entries.length === 0 ? (
            <p className="text-xs opacity-60">This folder is empty.</p>
          ) : (
            <ul className="max-h-64 overflow-auto text-xs">
              {entries.map((e) => {
                const path = volumePath(active, [...segments, e.name]);
                return (
                  <li key={path} className="flex items-center gap-2 py-0.5">
                    <input
                      type="checkbox"
                      checked={selected.has(path)}
                      disabled={busy}
                      onChange={() => toggle(path)}
                      aria-label={`Select ${e.name}`}
                    />
                    {e.isDir ? (
                      <button
                        className="flex items-center gap-1 text-left hover:underline"
                        disabled={busy}
                        onClick={() => openFolder(active, [...segments, e.name])}>
                        <Folder className="h-3 w-3" /> {e.name}
                      </button>
                    ) : (
                      <span className="truncate">{e.name}</span>
                    )}
                    {e.humanSize && <span className="ml-auto opacity-60">{e.humanSize}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {busy && <p className="text-xs opacity-70">Working… a large drive can take a while.</p>}

      {outcome && (
        <div className={`rounded border px-2 py-1 text-xs ${TONE[outcome.tone] ?? TONE.unknown}`}>
          <p>{outcome.label}</p>
          {outcome.skipped.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer">Skipped ({outcome.skipped.length})</summary>
              <ul className="mt-1 max-h-40 overflow-auto">
                {outcome.skipped.map((s, i) => (
                  <li key={`${s.path}-${i}`}>
                    <span className="font-mono">{s.path}</span> — {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div>
        <p className="text-xs opacity-70">
          Staged (encrypted at rest): {staged.rows.length} file{staged.rows.length === 1 ? '' : 's'}
          {staged.totalLabel ? ` · ${staged.totalLabel}` : ''}
        </p>
        {staged.rows.length > 0 && (
          <ul className="max-h-48 overflow-auto font-mono text-xs">
            {staged.rows.map((r, i) => (
              <li key={r.stagedRef ?? `${r.path}-${i}`} className="flex gap-2">
                <span className="truncate">{r.path}</span>
                <span className="ml-auto opacity-60">{r.humanSize}</span>
                <span className="opacity-40" title={r.checksum ?? ''}>
                  {r.checksum ? r.checksum.slice(0, 8) : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
