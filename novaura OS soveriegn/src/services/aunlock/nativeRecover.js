// nativeRecover.js — the JS half of Aunlock's drive-recovery bridge. A thin wrapper over the
// `aunlock_*` Tauri commands (health, volume resolution, directory listing, file recovery,
// purge). Outside the Sovereign desktop app there is no drive to read, so every method throws
// rather than returning an empty or mock result.

const OFF_DESKTOP = 'Drive recovery runs in the Sovereign desktop app.';

/**
 * createNativeRecover({ invoke, isTauri }) -> { readHealth, resolveVolumes, listDir,
 * recoverFiles, purgeRecovered }. recoverFiles returns the native RecoverOutcome unchanged.
 */
export function createNativeRecover({ invoke, isTauri } = {}) {
  const call = async (command, args) => {
    if (typeof isTauri !== 'function' || !isTauri()) throw new Error(OFF_DESKTOP);
    return invoke(command, args);
  };
  const deviceArgs = (device = {}) => ({
    serial: device?.serial ?? null,
    sizeBytes: device?.sizeBytes ?? null,
  });
  return {
    readHealth: (device) => call('aunlock_read_health', deviceArgs(device)),
    resolveVolumes: (device) => call('aunlock_resolve_volumes', deviceArgs(device)),
    listDir: (driveLetter, subpath) => call('aunlock_list_dir', { driveLetter, subpath }),
    recoverFiles: (jobId, driveLetter, selection) =>
      call('aunlock_recover_files', { jobId, driveLetter, selection }),
    purgeRecovered: (jobId) => call('aunlock_purge_recovered', { jobId }),
  };
}
