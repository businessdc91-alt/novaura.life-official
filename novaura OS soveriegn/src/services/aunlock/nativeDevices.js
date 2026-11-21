// nativeDevices.js — the JS half of Aunlock's read-only device bridge (Phase 1b-A). It calls the
// `aunlock_enumerate_devices` Tauri command and returns raw blobs in the exact shape
// `deviceModel.deviceRecord` consumes, carrying the safety flags (systemDisk, removable, bus)
// through. Read-only: it only asks the native layer what is connected; it never writes a device
// or bypasses a lock. Outside the Sovereign desktop app there is no hardware to read.

/**
 * Map one native DeviceSpec to a deviceModel raw blob. `systemDisk` is passed through unchanged
 * (not defaulted) so a blob that never classified it stays non-`false` and the controller's
 * deny-by-default refusal catches it.
 */
function toRaw(spec = {}) {
  return {
    kind: spec.kind,
    model: spec.model ?? null,
    serial: spec.serial ?? null,
    ram: spec.ram ?? null,
    cpu: spec.cpu ?? null,
    storage: spec.storage ?? null,
    battery: spec.battery ?? null,
    lock: spec.lock,
    bus: spec.bus ?? null,
    removable: spec.removable ?? false,
    systemDisk: spec.systemDisk,
    sizeBytes: spec.sizeBytes ?? null,
    nativeId: spec.id ?? null,
  };
}

/**
 * createNativeDevices({ invoke, isTauri }) -> { enumerate() }
 * enumerate(): [] off-desktop? no — it *throws* off-desktop (there is no hardware to read);
 * returns the mapped raw blob list in the app; a rejected invoke propagates so the caller can
 * tell a real failure from an empty result.
 */
export function createNativeDevices({ invoke, isTauri } = {}) {
  return {
    async enumerate() {
      if (typeof isTauri !== 'function' || !isTauri()) {
        throw new Error('Device detection runs in the Sovereign desktop app.');
      }
      const list = await invoke('aunlock_enumerate_devices');
      return (Array.isArray(list) ? list : []).map(toRaw);
    },
  };
}
