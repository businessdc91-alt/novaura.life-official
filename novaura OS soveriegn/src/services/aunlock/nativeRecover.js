// nativeRecover.js — the JS half of Aunlock's drive-recovery bridge. A thin wrapper over the
// `aunlock_*` Tauri commands (health, volume resolution, directory listing, file recovery,
// verify, purge, staged-job listing). Commands that read a volume carry the device's
// serial/sizeBytes so the native side can bind the drive letter to THAT device. Outside the
// Sovereign desktop app there is no drive to read, so every method throws rather than
// returning an empty or mock result.

const OFF_DESKTOP = 'Drive recovery runs in the Sovereign desktop app.';

/**
 * createNativeRecover({ invoke, isTauri }) -> { readHealth, resolveVolumes, listDir,
 * recoverFiles, verifyRecovered, purgeRecovered, listStagedJobs }. recoverFiles returns the
 * native RecoverOutcome unchanged.
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
    listDir: (device, driveLetter, subpath) =>
      call('aunlock_list_dir', { ...deviceArgs(device), driveLetter, subpath }),
    recoverFiles: (jobId, device, driveLetter, selection) =>
      call('aunlock_recover_files', { jobId, ...deviceArgs(device), driveLetter, selection }),
    /** Only the staged row's metadata crosses the bridge — never contents. */
    verifyRecovered: (jobId, row = {}) =>
      call('aunlock_verify_recovered', { jobId, stagedRef: row?.stagedRef, size: row?.size, checksum: row?.checksum }),
    purgeRecovered: (jobId) => call('aunlock_purge_recovered', { jobId }),
    listStagedJobs: () => call('aunlock_list_staged_jobs', {}),
  };
}
