// native.js — Phase 1a placeholder for the hardware layer. The real USB enumeration, drive
// mount/recovery, and NIST 800-88 wipe arrive in Phase 1b (Rust/Tauri + the LAN recovery stick)
// and replace this module. Until then, device operations report that the hardware phase is
// pending — the catalog, jobs, provenance/authorization gate, and certificate logic all work.

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
