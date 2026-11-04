// hfGguf.js — Read a Hugging Face repo's file list as the model choices llama.cpp can run.
// Pure, so it is tested on real repo listings (tests/engines/hfGguf.test.mjs).

const SPLIT = /-(\d{5})-of-(\d{5})\.gguf$/i;
// Speculative-decoding helpers (multi-token prediction, DFlash, draft models): not chat models on their own.
const HELPER = /(^|\/)(mtp|dflash|draft)([-_./]|$)/i;
const QUANT = /(?:^|[-_.])((?:UD-)?I?Q\d(?:_[A-Z0-9]+)*|BF16|F16|F32|MXFP4(?:_MOE)?)(?=[-_.]|\.gguf$)/i;

/** "unsloth/Qwen3.6-27B-GGUF" + "Q4_K_M" -> "Qwen3.6-27B-Q4_K_M" (a folder name the server can use). */
export function hfModelName(repo, quant) {
  const base = String(repo).split('/').pop().replace(/[-_.]?GGUF$/i, '');
  return `${base}${quant ? `-${quant}` : ''}`.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[.-]+/, '').slice(0, 80) || 'model';
}

/**
 * Hugging Face tree entries -> { quants: [{ quant, files, bytes }], vision: [file] }, smallest first.
 * Split models (…-00001-of-00003.gguf) are one choice, offered only when every part is present.
 * Each file is { path, bytes, sha256 } with Hugging Face's LFS hash.
 */
export function groupGgufFiles(tree) {
  const ggufs = (Array.isArray(tree) ? tree : [])
    .filter(f => f?.type === 'file' && /\.gguf$/i.test(f.path) && f.lfs?.oid && !HELPER.test(f.path))
    .map(f => ({ path: f.path, bytes: f.lfs.size || f.size, sha256: f.lfs.oid }));
  const vision = ggufs.filter(f => /^mmproj/i.test(f.path.split('/').pop()));
  const groups = new Map();
  for (const f of ggufs) {
    if (vision.includes(f)) continue;
    const key = f.path.replace(SPLIT, '.gguf');
    const name = key.split('/').pop();
    const quant = (QUANT.exec(name)?.[1] || name.replace(/\.gguf$/i, '')).toUpperCase();
    const g = groups.get(key) || { quant, files: [], bytes: 0 };
    g.files.push(f);
    g.bytes += f.bytes;
    groups.set(key, g);
  }
  const quants = [...groups.values()]
    .map(g => ({ ...g, files: g.files.sort((a, b) => a.path.localeCompare(b.path)) }))
    .filter(g => !SPLIT.test(g.files[0].path) || g.files.length === Number(SPLIT.exec(g.files[0].path)[2]))
    .sort((a, b) => a.bytes - b.bytes);
  return { quants, vision: vision.sort((a, b) => a.bytes - b.bytes) };
}
