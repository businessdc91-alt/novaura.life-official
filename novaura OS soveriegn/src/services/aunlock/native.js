// native.js — placeholders for the hardware layer.
//
// Phase 1b-A replaced ENUMERATION with the real read-only bridge: getController() now wires
// `nativeDevices.js` for `enumerate`, so the placeholder enumerate below is no longer used (kept
// only as a safe fallback). Drive mount/recovery and the NIST 800-88 wipe are still ahead (their
// own Phase 1b slices), so `recover`/`wipe` keep reporting that the hardware phase is pending —
// the catalog, jobs, provenance/authorization gate, and certificate logic all work.

export const placeholderNative = {
  async enumerate() {
    throw new Error('Device detection connects in the hardware phase (Phase 1b).');
  },
  async recover() {
    throw new Error('File recovery connects in the hardware phase (Phase 1b).');
  },
  async wipe() {
    throw new Error('Sanitization connects in the hardware phase (Phase 1b).');
  },
};
