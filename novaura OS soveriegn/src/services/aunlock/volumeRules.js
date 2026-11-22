// volumeRules.js — which volumes Aunlock may recover from. Mirrors the Rust
// `volume_is_recoverable`: deny-by-default, so a volume with missing or unrecognised fields is
// never treated as recoverable. Encrypted volumes are the hard boundary (reclaim only).

const RECOVERABLE_FS = ['NTFS', 'EXFAT', 'FAT32', 'FAT'];

export function isRecoverableVolume(v) {
  return Boolean(
    v &&
      v.encrypted === false &&
      v.readable === true &&
      RECOVERABLE_FS.includes(String(v.fsType ?? '').trim().toUpperCase()),
  );
}
