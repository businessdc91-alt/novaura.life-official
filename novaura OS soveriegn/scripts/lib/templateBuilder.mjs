// templateBuilder.mjs — Builds a signed .novatemplate bundle from a project folder.
//
// Only what the config includes is packed. Files named like secrets are skipped
// without being opened; every other text file is scanned, and a bundle with a
// key or password in it is refused (or, with `redact`, packed with a
// placeholder in its place). LICENSE files found inside the project become
// parts that keep their own license. The result is checked with the same code
// the Template Library uses before it is reported as built.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { crc32, listZipEntries, readZipEntry } from '../../src/services/zipService.js';
import {
  BUNDLE_FORMAT, BUNDLE_EXT, MANIFEST_ENTRY, SIGNATURE_ENTRY, FILES_PREFIX, LICENSE_FILE, NOTICE_FILE, LICENSE_ID,
  MAX_FILES, MAX_TOTAL_BYTES, isSafeTemplatePath, manifestProblem, signManifestText, verifyManifest, verifyFileHash,
  renderPrototypeNotice, sha256Hex,
} from '../../src/services/templates/novaTemplates.js';
import {
  isSkippedDir, isSecretFileName, scanText, redactText, isProbablyText, LICENSE_FILE_RE, detectLicenseText, headerLicense, isCopyleft,
} from '../../src/services/templates/secretScan.js';
import { cleanPubHex, bytesToHex, hexToBytes } from '../../src/services/web/novaNames.js';
import { ed25519 } from '@noble/curves/ed25519.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const LICENSE_SOURCE = path.resolve(HERE, '../../templates/LICENSE-NOVAURA-TEMPLATE-1.0.md');

const MAX_FILE_BYTES = 1024 ** 3;
const SCAN_LIMIT = 8 * 1024 ** 2;
const STORE_RE = /\.(png|jpe?g|webp|gif|avif|mp3|ogg|opus|m4a|aac|flac|mp4|webm|mkv|mov|zip|gz|tgz|7z|rar|xz|bz2|woff2?|pdf|jar|apk|nupkg|gguf|safetensors|ctex|stex)$/i;
const SOURCE_RE = /\.(js|jsx|mjs|cjs|ts|tsx|cs|py|gd|rs|go|java|kt|c|cc|cpp|h|hpp|swift|php|rb|lua|gdshader|shader|xaml|vue|svelte)$/i;
const DEFAULT_ROYALTY = { percent: 10, basis: 'gross revenue', thresholdUsd: 0 };

// Rules: '' (everything), 'dir/' (a folder), 'file' (an exact path), '*.ext' (files at the top
// level), '**/*.ext' (anywhere), '**/name/' (a folder name anywhere), '**/name' (a file name anywhere).
function ruleHits(rel, rule) {
  if (rule === '' || rule === '*') return true;
  if (rule.startsWith('**/')) {
    const rest = rule.slice(3);
    if (rest.startsWith('*.')) return rel.toLowerCase().endsWith(rest.slice(1).toLowerCase());
    const name = rest.replace(/\/$/, '');
    return rest.endsWith('/') ? rel.split('/').slice(0, -1).includes(name) : rel.split('/').pop() === name;
  }
  if (rule.startsWith('*.')) return !rel.includes('/') && rel.toLowerCase().endsWith(rule.slice(1).toLowerCase());
  if (rule.endsWith('/')) return rel.startsWith(rule);
  return rel === rule;
}

const dirMayHold = (rel, include) => include.some(r => r === '' || r === '*' || r.startsWith('**/') || `${rel}/`.startsWith(r) || r.startsWith(`${rel}/`));
const dirExcluded = (rel, exclude) => exclude.some(r => r.endsWith('/') && (r.startsWith('**/') ? `${rel}/`.split('/').includes(r.slice(3, -1)) : `${rel}/`.startsWith(r)));

function fillLicense(text, { licensor, royalty, contact }) {
  const exempt = royalty.thresholdUsd > 0 ? `The first $${royalty.thresholdUsd.toLocaleString('en-US')} of Gross Revenue from each Derived Product` : 'None';
  return text.replaceAll('{{LICENSOR}}', licensor).replaceAll('{{ROYALTY_PERCENT}}', String(royalty.percent))
    .replaceAll('{{EXEMPT}}', exempt).replaceAll('{{CONTACT}}', contact);
}

class ZipWriter {
  constructor(file, date) {
    this.fd = fs.openSync(file, 'w');
    this.offset = 0;
    this.central = [];
    this.time = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xffff;
    this.day = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;
  }

  add(name, data, store = false) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    let packed = data;
    let method = 0;
    if (!store && data.length > 64) {
      const d = zlib.deflateRawSync(data, { level: 9 });
      if (d.length < data.length) { packed = d; method = 8; }
    }
    if (this.offset + 30 + nameBuf.length + packed.length > 0xfffffff0) throw new Error('The bundle would pass 4 GB, which needs ZIP64 (not supported).');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(method, 8);
    local.writeUInt16LE(this.time, 10); local.writeUInt16LE(this.day, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    fs.writeSync(this.fd, local); fs.writeSync(this.fd, nameBuf); fs.writeSync(this.fd, packed);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(method, 10);
    c.writeUInt16LE(this.time, 12); c.writeUInt16LE(this.day, 14); c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(packed.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nameBuf.length, 28); c.writeUInt32LE(this.offset, 42);
    this.central.push(c, nameBuf);
    this.offset += 30 + nameBuf.length + packed.length;
  }

  finish() {
    const count = this.central.length / 2;
    if (count > 0xfffe) throw new Error('Too many files for a ZIP without ZIP64.');
    const dir = Buffer.concat(this.central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10);
    end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(this.offset, 16);
    fs.writeSync(this.fd, dir); fs.writeSync(this.fd, end);
    fs.closeSync(this.fd);
  }
}

/** Open a bundle with the Template Library's own checks: { ok, manifest, official, problems }. */
export async function checkBundle(file, authorities) {
  const blob = await fs.openAsBlob(file);
  const entries = await listZipEntries(blob);
  const byPath = new Map(entries.map(e => [e.path, e]));
  const text = async (p) => new TextDecoder().decode(await readZipEntry(blob, byPath.get(p)));
  if (!byPath.has(MANIFEST_ENTRY) || !byPath.has(SIGNATURE_ENTRY)) return { ok: false, problems: ['The manifest or signature is missing.'] };
  const v = verifyManifest(await text(MANIFEST_ENTRY), await text(SIGNATURE_ENTRY), { authorities });
  if (!v.ok) return { ok: false, problems: [v.reason] };
  const problems = [];
  for (const f of v.manifest.files) {
    const e = byPath.get(FILES_PREFIX + f.path);
    if (!e || !(await verifyFileHash(f, await readZipEntry(blob, e)))) problems.push(`${f.path} does not match its hash.`);
  }
  return { ok: !problems.length, manifest: v.manifest, official: v.official, problems };
}

/**
 * Build (or with dryRun, only survey) a template.
 * config: { id, version, title, kind, stage, source, include, exclude, summary, works, unfinished,
 *           notIncluded, requirements, openWith, parts, rootLicense, royalty, licensor, contact, publisherName }
 * opts:   { secretHex, receiptsTo, outDir, redact, dryRun, authorities, now }
 */
export async function buildTemplate(config, opts = {}) {
  const { secretHex, outDir, redact = false, dryRun = false, authorities = {}, now = new Date() } = opts;
  const source = path.resolve(config.source);
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) throw new Error(`The source folder does not exist: ${source}`);
  const include = config.include?.length ? config.include : [''];
  const exclude = config.exclude || [];
  const royalty = { ...DEFAULT_ROYALTY, ...(config.royalty || {}) };
  const report = { files: 0, bytes: 0, secretNamed: [], findings: [], redacted: [], replaced: [], placeholders: [], skipped: [], parts: [], largest: [], byTopDir: {}, warnings: [] };

  // 1. Collect files.
  const picked = [];
  const stack = [''];
  while (stack.length) {
    const relDir = stack.pop();
    for (const ent of fs.readdirSync(path.join(source, relDir), { withFileTypes: true })) {
      const rel = relDir ? `${relDir}/${ent.name}` : ent.name;
      if (ent.isSymbolicLink()) { report.skipped.push({ path: rel, reason: 'link' }); continue; }
      if (ent.isDirectory()) {
        if (isSkippedDir(ent.name) || dirExcluded(rel, exclude) || !dirMayHold(rel, include)) continue;
        stack.push(rel);
      } else if (ent.isFile() && include.some(r => ruleHits(rel, r)) && !exclude.some(r => ruleHits(rel, r))) {
        picked.push(rel);
      }
    }
  }
  picked.sort();

  // 2. Read, scan and classify.
  const files = [];
  const licenseFiles = [];
  const headerParts = [];
  for (const rel of picked) {
    if (rel === LICENSE_FILE || rel === NOTICE_FILE || rel === MANIFEST_ENTRY) { report.skipped.push({ path: rel, reason: 'replaced by the bundle’s own copy' }); continue; }
    if (isSecretFileName(rel)) { report.secretNamed.push(rel); continue; }
    if (!isSafeTemplatePath(rel)) { report.skipped.push({ path: rel, reason: 'file name is not portable' }); continue; }
    const abs = path.join(source, ...rel.split('/'));
    const size = fs.statSync(abs).size;
    if (size > MAX_FILE_BYTES) { report.skipped.push({ path: rel, reason: 'larger than 1 GB' }); continue; }
    let bytes = fs.readFileSync(abs);
    if (bytes.length <= SCAN_LIMIT && isProbablyText(bytes)) {
      // latin1 keeps one character per byte, so offsets are byte offsets and redaction leaves every other byte as it was.
      let text = bytes.toString('latin1');
      // The config's own replacements first (things a pattern cannot know, like a password in a comment).
      for (const r of (config.replace || []).filter(r => r.path === rel)) {
        const re = new RegExp(r.pattern, 'g');
        const hits = text.match(re)?.length || 0;
        // A replacement that finds nothing means the config no longer matches the project: stop rather than ship unscrubbed.
        if (!hits) throw new Error(`The replacement for ${rel} (${r.note || r.pattern}) matched nothing; update the config.`);
        text = text.replace(re, r.with ?? '');
        bytes = Buffer.from(text, 'latin1');
        report.replaced.push({ path: rel, count: hits, note: r.note || r.pattern });
      }
      const found = scanText(text);
      if (found.length) {
        if (redact) {
          bytes = Buffer.from(redactText(text).text, 'latin1');
          report.redacted.push(...found.map(f => ({ path: rel, line: f.line, kind: f.kind })));
        } else {
          report.findings.push(...found.map(f => ({ path: rel, line: f.line, kind: f.kind })));
        }
      }
      const name = rel.split('/').pop();
      if (LICENSE_FILE_RE.test(name)) licenseFiles.push({ dir: rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/') + 1) : '', file: rel, id: detectLicenseText(text) });
      else if (SOURCE_RE.test(rel)) {
        const h = headerLicense(text);
        if (h) headerParts.push({ path: rel, license: h, note: 'The file header names this license.' });
      }
    }
    files.push({ path: rel, bytes });
  }

  // 2b. Placeholders where the project refers to files the template leaves out (art kept back, for one).
  for (const rule of config.placeholders || []) {
    // `files` maps an extension to its placeholder (engines pick the decoder by extension).
    const images = Object.fromEntries(Object.entries(rule.files || {}).map(([ext, file]) => [ext.toLowerCase(), fs.readFileSync(path.resolve(HERE, '../..', file))]));
    const re = new RegExp(rule.pattern, 'g');
    const have = new Set(files.map(f => f.path.toLowerCase()));
    let added = 0;
    for (const f of files.filter(x => (rule.in || ['']).some(p => x.path.startsWith(p)) && isProbablyText(x.bytes))) {
      for (const m of f.bytes.toString('utf8').matchAll(re)) {
        const rel = m[1];
        const image = images[rel.split('.').pop().toLowerCase()];
        if (!image || !isSafeTemplatePath(rel) || have.has(rel.toLowerCase())) continue;
        have.add(rel.toLowerCase());
        files.push({ path: rel, bytes: image });
        added++;
      }
    }
    if (!added) throw new Error(`The placeholder rule (${rule.note || rule.pattern}) added nothing; update the config.`);
    report.placeholders.push({ note: rule.note || rule.pattern, count: added });
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  // 3. Parts that keep their own licenses.
  const parts = new Map();
  for (const lf of licenseFiles) {
    if (lf.dir === '') {
      if (lf.id === 'NovAura-Template') continue;
      if (config.rootLicense !== lf.id) {
        throw new Error(`${lf.file} says this project is under ${lf.id}. ${isCopyleft(lf.id) ? 'Code under a copyleft license cannot carry a royalty. ' : ''}Set "rootLicense": "${lf.id}" in the config and list the parts it covers under "parts" (the royalty then applies only to what is left), or remove that license from the project if it is yours to remove.`);
      }
      parts.set(lf.file, { path: lf.file, license: lf.id, note: 'The project’s original license.' });
    } else {
      parts.set(lf.dir, { path: lf.dir, license: lf.id, note: `This folder has its own ${lf.file.split('/').pop()}.` });
    }
  }
  for (const h of headerParts) if (![...parts.values()].some(p => p.path.endsWith('/') && h.path.startsWith(p.path))) parts.set(h.path, h);
  for (const p of config.parts || []) parts.set(p.path, { path: p.path, license: p.license, note: p.note || '' });
  report.parts = [...parts.values()].filter(p => files.some(f => (p.path.endsWith('/') ? f.path.startsWith(p.path) : f.path === p.path)))
    .sort((a, b) => a.path.localeCompare(b.path));
  const copyleft = new Map();
  for (const p of report.parts) if (isCopyleft(p.license)) copyleft.set(p.license, [...(copyleft.get(p.license) || []), p.path]);
  for (const [id, paths] of copyleft) report.warnings.push(`${id} is copyleft. It covers ${paths.join(', ')}; that code, and code derived from it, stays ${id} with no royalty.`);

  // 4. Survey numbers.
  for (const f of files) {
    report.files++;
    report.bytes += f.bytes.length;
    const top = f.path.includes('/') ? f.path.split('/')[0] + '/' : '(root files)';
    report.byTopDir[top] = (report.byTopDir[top] || 0) + f.bytes.length;
  }
  report.largest = [...files].sort((a, b) => b.bytes.length - a.bytes.length).slice(0, 12).map(f => ({ path: f.path, bytes: f.bytes.length }));
  if (report.files > MAX_FILES - 2) throw new Error(`Too many files (${report.files}); the limit is ${MAX_FILES - 2}.`);
  if (report.bytes > MAX_TOTAL_BYTES) throw new Error(`Too large (${(report.bytes / 1e9).toFixed(2)} GB); the limit is ${(MAX_TOTAL_BYTES / 1e9).toFixed(1)} GB.`);
  if (dryRun) return report;
  if (report.findings.length) {
    const err = new Error(`Found ${report.findings.length} key(s) or password(s). Remove them from the project, or build with --redact to pack placeholders instead (rotate the real keys either way).`);
    err.report = report;
    throw err;
  }

  // 5. The license, the notice and the manifest.
  if (!/^[0-9a-f]{64}$/.test(secretHex || '')) throw new Error('A signing key is needed to build.');
  const licenseText = fillLicense(fs.readFileSync(LICENSE_SOURCE, 'utf8'), {
    licensor: config.licensor || 'Dillan Copeland (NovAura)', royalty, contact: config.contact || 'business.dc91@gmail.com',
  });
  const meta = {
    id: config.id, version: config.version, title: config.title, kind: config.kind || 'code', stage: config.stage || 'pre-alpha prototype',
    summary: config.summary || '', works: config.works || [], unfinished: config.unfinished || [], notIncluded: config.notIncluded || [],
    requirements: config.requirements || [], openWith: config.openWith || '',
  };
  const noticeText = renderPrototypeNotice(meta, { royalty, parts: report.parts });
  const all = [
    { path: LICENSE_FILE, bytes: Buffer.from(licenseText, 'utf8') },
    { path: NOTICE_FILE, bytes: Buffer.from(noticeText, 'utf8') },
    ...files,
  ];
  const listed = [];
  for (const f of all) listed.push({ path: f.path, size: f.bytes.length, sha256: await sha256Hex(f.bytes) });
  const pub = bytesToHex(ed25519.getPublicKey(hexToBytes(secretHex)));
  const receiptsTo = opts.receiptsTo ? `did:nova:${cleanPubHex(opts.receiptsTo) || ''}` : '';
  if (opts.receiptsTo && receiptsTo === 'did:nova:') throw new Error('--receipts-to must be a node public key (64 hex characters) or did:nova:<key>.');
  const manifest = {
    format: BUNDLE_FORMAT,
    ...meta,
    publisher: { name: config.publisherName || 'Dillan Copeland (NovAura)', pub },
    receiptsTo,
    license: { id: LICENSE_ID, file: LICENSE_FILE, sha256: listed[0].sha256, royalty },
    notice: { file: NOTICE_FILE, sha256: listed[1].sha256 },
    parts: report.parts,
    files: listed,
    createdAt: now.toISOString(),
  };
  const problem = manifestProblem(manifest);
  if (problem) throw new Error(`The manifest would be invalid: ${problem}`);
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  const sig = signManifestText(manifestText, secretHex);

  // 6. Write and re-check.
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${config.id}-${config.version}${BUNDLE_EXT}`);
  const zip = new ZipWriter(out, now);
  zip.add(MANIFEST_ENTRY, Buffer.from(manifestText, 'utf8'));
  zip.add(SIGNATURE_ENTRY, Buffer.from(sig, 'utf8'), true);
  for (const f of all) zip.add(FILES_PREFIX + f.path, f.bytes, STORE_RE.test(f.path));
  zip.finish();
  const check = await checkBundle(out, authorities);
  if (!check.ok) throw new Error(`The bundle failed its own check: ${check.problems.slice(0, 3).join(' ')}`);
  return { ...report, out, bundleBytes: fs.statSync(out).size, manifest, official: check.official };
}
