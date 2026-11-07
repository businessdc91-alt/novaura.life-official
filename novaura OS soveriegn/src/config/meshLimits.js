// meshLimits.js — How much one mesh packet carries. The relay (relay/src/main.rs)
// and the native mesh (src-tauri/src/mesh.rs) read packets up to 16 MB. Anything
// bigger (files, projects, media) travels as a series of chunk packets, with no
// limit on the total.

export const MESH_PACKET_BYTES = 16 * 1024 * 1024;

/** What a single packet's payload may use, leaving room for the envelope (ids, names, signature). */
export const MESH_PAYLOAD_BYTES = MESH_PACKET_BYTES - 256 * 1024;

/** Readable size: "820 KB", "14.2 MB", "3.1 GB". */
export function formatBytes(bytes) {
  const n = Math.max(0, Number(bytes) || 0);
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
