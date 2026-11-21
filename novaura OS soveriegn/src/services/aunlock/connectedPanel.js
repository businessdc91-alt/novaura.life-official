// connectedPanel.js — the pure view model behind Aunlock's "Scan for devices" list. It turns the
// bridge's raw device blobs into display rows and decides which are selectable for intake.
// Deny-by-default: a row is selectable ONLY when its systemDisk is an explicit `false`, so the
// host's own system disk (or any device that never classified the flag) can't be picked.

function humanSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  const gb = bytes / 1e9;
  return gb >= 1000 ? `${(gb / 1000).toFixed(1)} TB` : `${Math.round(gb)} GB`;
}

/**
 * describeConnectedDevices(list) -> { rows }
 * row: { id, label, sub, selectable, systemDisk, raw }
 *   selectable is true only when systemDisk === false (deny-by-default).
 *   An empty/absent list yields { rows: [] } — the empty-state marker.
 */
export function describeConnectedDevices(list = []) {
  const rows = (Array.isArray(list) ? list : []).map((d = {}) => {
    const label = d.model || d.serial || d.nativeId || 'Unknown device';
    const capacity = d.storage || humanSize(d.sizeBytes);
    const sub = [d.kind, d.bus, capacity].filter(Boolean).join(' · ');
    return {
      id: d.nativeId ?? d.serial ?? label,
      label,
      sub,
      selectable: d.systemDisk === false,
      systemDisk: d.systemDisk,
      raw: d,
    };
  });
  return { rows };
}
