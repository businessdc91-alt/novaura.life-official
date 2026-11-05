// Template bundles: building, signing, tamper checks, acceptances, and keeping secrets out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ed25519 } from '@noble/curves/ed25519.js';
import { bytesToHex } from '../../src/services/web/novaNames.js';
import { compressZip, readZip, listZipEntries, readZipEntry } from '../../src/services/zipService.js';
import {
  manifestProblem, isSafeTemplatePath, verifyManifest, signManifestText, signAcceptance, verifyAcceptance, acceptanceId,
  partFor, royaltySummary, royaltyClause, renderPrototypeNotice, MANIFEST_ENTRY, SIGNATURE_ENTRY, FILES_PREFIX,
} from '../../src/services/templates/novaTemplates.js';
import { scanText, redactText, isSecretFileName, detectLicenseText, headerLicense } from '../../src/services/templates/secretScan.js';
import { buildTemplate, checkBundle } from '../../scripts/lib/templateBuilder.mjs';

// Key-shaped strings are assembled here so none sits in the repository whole.
const FAKE_GOOGLE = ['AI', 'za', 'Sy', 'Q7x'.repeat(11), 'Zk'].join('');
const FAKE_SK = ['sk', '-proj-', 'a1B2c3D4e5'.repeat(3)].join('');
const keyPair = () => {
  const secret = ed25519.utils.randomSecretKey();
  return { secret: bytesToHex(secret), pub: bytesToHex(ed25519.getPublicKey(secret)) };
};
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'novatemplate-'));
const write = (root, rel, content) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), content);
};

function sampleProject() {
  const root = tmp();
  write(root, 'README.md', '# Demo\n');
  write(root, 'src/app.js', `const config = {\n  geminiKey: "${FAKE_GOOGLE}",\n  title: "Demo",\n};\nexport default config;\n`);
  write(root, 'src/SecretsPanel.jsx', 'export default function SecretsPanel() { return null; }\n');
  write(root, '.env', `OPENAI_API_KEY=${FAKE_SK}\n`);
  write(root, 'config/secrets.json', '{"token":"never-read"}');
  write(root, 'vendor/tiny/LICENSE', 'MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy...');
  write(root, 'vendor/tiny/index.js', 'export const tiny = 1;\n');
  write(root, 'node_modules/dep/index.js', 'module.exports = 1;\n');
  write(root, 'cards/hero.tres', '[ext_resource path="res://art/hero.png"]\n');
  return root;
}

const baseConfig = (source) => ({
  id: 'demo-template', version: '0.1.0-prealpha', title: 'Demo template', kind: 'code', stage: 'pre-alpha prototype', source,
  summary: 'A demo.', works: ['It opens.'], unfinished: ['Most of it.'], notIncluded: ['Art.'], requirements: ['Node'], openWith: 'Open it.',
});

test('paths that could escape the folder or break on Windows are refused', () => {
  for (const ok of ['a.txt', 'src/App.jsx', 'assets/1. Pack/Button 1.png']) assert.ok(isSafeTemplatePath(ok), ok);
  for (const bad of ['', '/abs', '../up', 'a/../b', 'a\\b', 'C:/x', 'a:b', 'con', 'aux.txt', 'dir/LPT1.log', 'dot.', 'space ', 'a//b']) {
    assert.ok(!isSafeTemplatePath(bad), bad);
  }
});

test('a dry run finds keys, skips secret files unopened, skips dependencies, and finds third-party licenses', async () => {
  const report = await buildTemplate(baseConfig(sampleProject()), { dryRun: true });
  assert.deepEqual(report.findings.map(f => `${f.path}:${f.line}:${f.kind}`), ['src/app.js:2:Google API key']);
  assert.deepEqual(report.secretNamed.sort(), ['.env', 'config/secrets.json']);
  assert.ok(!report.largest.some(f => f.path.startsWith('node_modules/')));
  assert.ok(report.largest.some(f => f.path === 'src/SecretsPanel.jsx'), 'source files named like secrets are code and are kept');
  assert.deepEqual(report.parts.map(p => [p.path, p.license]), [['vendor/tiny/', 'MIT']]);
});

test('a build refuses keys unless they are redacted, then signs and self-checks', async () => {
  const project = sampleProject();
  const { secret, pub } = keyPair();
  const outDir = tmp();
  await assert.rejects(buildTemplate(baseConfig(project), { secretHex: secret, outDir }), /key\(s\) or password\(s\)/);

  const built = await buildTemplate(baseConfig(project), { secretHex: secret, outDir, redact: true, receiptsTo: '0x' + pub, authorities: { test: { pubkeyHex: pub, status: 'ACTIVE' } } });
  assert.equal(built.official, true);
  assert.equal(built.manifest.receiptsTo, `did:nova:${pub}`);
  const entries = await readZip(fs.readFileSync(built.out));
  const names = entries.map(e => e.path);
  assert.ok(names.includes(MANIFEST_ENTRY) && names.includes(SIGNATURE_ENTRY));
  assert.ok(names.includes('files/LICENSE-NOVAURA-TEMPLATE.md') && names.includes('files/PROTOTYPE-NOTICE.md'));
  assert.ok(!names.some(n => n.endsWith('.env') || n.includes('secrets.json') || n.includes('node_modules')));
  const app = new TextDecoder().decode(entries.find(e => e.path === 'files/src/app.js').bytes);
  assert.ok(!app.includes(FAKE_GOOGLE) && app.includes('YOUR_GOOGLE_API_KEY'));
  const license = new TextDecoder().decode(entries.find(e => e.path === 'files/LICENSE-NOVAURA-TEMPLATE.md').bytes);
  assert.match(license, /\| Royalty rate \| 10% of Gross Revenue \|/);
  assert.ok(!license.includes('{{'), 'every placeholder in the license is filled');
  const notice = new TextDecoder().decode(entries.find(e => e.path === 'files/PROTOTYPE-NOTICE.md').bytes);
  assert.match(notice, /PRE-ALPHA PROTOTYPE/);
  assert.match(notice, /vendor\/tiny\/` — MIT/);
});

test('a changed file or a changed manifest is caught', async () => {
  const { secret } = keyPair();
  const built = await buildTemplate(baseConfig(sampleProject()), { secretHex: secret, outDir: tmp(), redact: true });
  const entries = await readZip(fs.readFileSync(built.out));
  const rezip = async (edit) => {
    const file = path.join(tmp(), 'x.novatemplate');
    fs.writeFileSync(file, await compressZip(entries.map(e => ({ path: e.path, bytes: edit(e) }))));
    return checkBundle(file, {});
  };
  assert.equal((await rezip(e => e.bytes)).ok, true);
  const changedFile = await rezip(e => (e.path === 'files/vendor/tiny/index.js' ? new TextEncoder().encode('export const tiny = 2;\n') : e.bytes));
  assert.deepEqual(changedFile.problems, ['vendor/tiny/index.js does not match its hash.']);
  const changedManifest = await rezip(e => (e.path === MANIFEST_ENTRY ? new TextEncoder().encode(new TextDecoder().decode(e.bytes).replace('"percent": 10', '"percent": 0')) : e.bytes));
  assert.equal(changedManifest.ok, false);
  assert.match(changedManifest.problems[0], /signature does not match/);
});

test('manifest checks: unsafe paths, case-only duplicates, files under files, a license not in the list', () => {
  const { secret, pub } = keyPair();
  const file = (p) => ({ path: p, size: 1, sha256: 'a'.repeat(64) });
  const m = {
    format: 'novatemplate/1', id: 'x-template', version: '1.0.0', title: 'X', summary: '', kind: 'code', stage: 'pre-alpha prototype',
    works: [], unfinished: [], notIncluded: [], requirements: [], openWith: '', publisher: { name: 'Me', pub }, receiptsTo: '',
    license: { id: 'NovAura-Template-1.0', file: 'L.md', sha256: 'a'.repeat(64), royalty: { percent: 10, basis: 'gross revenue', thresholdUsd: 0 } },
    notice: { file: 'N.md', sha256: 'a'.repeat(64) }, parts: [], files: [file('L.md'), file('N.md'), file('src/a.js')], createdAt: new Date().toISOString(),
  };
  assert.equal(manifestProblem(m), '');
  assert.match(manifestProblem({ ...m, files: [...m.files, file('../evil')] }), /Unsafe file path/);
  assert.match(manifestProblem({ ...m, files: [...m.files, file('SRC/A.js')] }), /listed twice/);
  assert.match(manifestProblem({ ...m, files: [...m.files, file('src/a.js/b')] }), /under a file/);
  assert.match(manifestProblem({ ...m, license: { ...m.license, sha256: 'b'.repeat(64) } }), /license file is missing/);
  const text = JSON.stringify(m);
  assert.equal(verifyManifest(text, signManifestText(text, secret)).ok, true);
  assert.equal(verifyManifest(text, signManifestText(text, keyPair().secret)).ok, false, 'signed by someone other than the named publisher');
});

test('acceptances are signed by the person installing and cannot be altered', () => {
  const { secret, pub } = keyPair();
  const manifest = { id: 'demo-template', version: '0.1.0', title: 'Demo', license: { id: 'NovAura-Template-1.0', sha256: 'c'.repeat(64) }, publisher: { pub: 'd'.repeat(64) }, receiptsTo: `did:nova:${'d'.repeat(64)}` };
  const a = signAcceptance({ manifest, manifestSha256: 'e'.repeat(64), use: 'commercial' }, secret);
  assert.equal(a.acceptor, pub);
  const ok = verifyAcceptance(JSON.parse(JSON.stringify(a)));
  assert.equal(ok.ok, true);
  assert.equal(acceptanceId(ok.acceptance), `demo-template@0.1.0:${a.nonce}`);
  assert.equal(verifyAcceptance({ ...a, use: 'personal' }).ok, false);
  assert.equal(verifyAcceptance({ ...a, at: Date.now() + 3600_000 }).ok, false);
  assert.throws(() => signAcceptance({ manifest, manifestSha256: 'e'.repeat(64), use: 'resale' }, secret), /Choose how/);
});

test('the scanner catches real secrets and leaves ordinary code alone', () => {
  const kinds = (src) => scanText(src).map(f => f.kind);
  assert.deepEqual(kinds(`const k = "${FAKE_GOOGLE}";`), ['Google API key']);
  assert.deepEqual(kinds(`apiKey: '${FAKE_SK}'`), ['API key (sk-)']);
  assert.deepEqual(kinds('// User Credentials: Key=0612199142, Pass=Kool3r!'), ['credential in a comment', 'credential in a comment']);
  assert.deepEqual(kinds('if (gateCode !== "<letmein>") return;'), ['hard-coded credential check']);
  assert.deepEqual(kinds("const STAFF_GATE_CODE = '<letmein>';"), ['access code or password in code']);
  assert.deepEqual(kinds('const db = `postgres://admin:hunter22@db.host:5432/app`;'), ['password in a URL']);
  assert.deepEqual(kinds('admin: "owner@realmail.net"'), ['email address']);
  const pem = `-----BEGIN PRIVATE KEY-----\n${'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC'.repeat(4)}\n-----END PRIVATE KEY-----`;
  assert.deepEqual(kinds(pem), ['private key block']);
  // Not secrets:
  for (const fine of [
    "if (error.code === 'auth/wrong-password') {}",
    "if (e.key === 'Escape') close();",
    "if (e.key === 'novaura_theme' && e.newValue) {}",
    "const STORAGE_KEY = 'novaura-settings-v2';",
    "password: 'Password',",
    'var header = isPrivate ? "-----BEGIN PRIVATE KEY-----" : "x";',
    'const url = `postgres://user:${cfg.password}@host/db`;',
    'contact: "someone@example.com"',
    'const licenseKey = `NOVA-${crypto.randomBytes(4).toString("hex")}`;',
    'pwd: "/home/user",',
  ]) assert.deepEqual(kinds(fine), [], fine);
});

test('redaction swaps only the secret, so the code keeps its shape', () => {
  const src = `const a = "${FAKE_GOOGLE}"; // keep\nconst b = 1;\n`;
  const { text, findings } = redactText(src);
  assert.equal(text, 'const a = "YOUR_GOOGLE_API_KEY"; // keep\nconst b = 1;\n');
  assert.deepEqual(findings, [{ kind: 'Google API key', line: 1 }]);
});

test('secret files are recognised by name, examples and source files are not', () => {
  for (const s of ['.env', '.env.production', 'client_secret_123.json', 'service-account.json', 'id_rsa', 'key.pem', 'auth_export.json', 'MASTER_KEY_1.md', 'api-key-registry.json', 'founder_license.json', 'data.sqlite']) {
    assert.ok(isSecretFileName(s), s);
  }
  for (const s of ['.env.example', 'README.md', 'src/SecretsWindow.jsx', 'services/secretService.ts', 'Core/AuraLicensing.cs']) assert.ok(!isSecretFileName(s), s);
});

test('license texts and file headers are recognised', () => {
  assert.equal(detectLicenseText('MIT License\n\nPermission is hereby granted, free of charge, to any person'), 'MIT');
  assert.equal(detectLicenseText('GNU GENERAL PUBLIC LICENSE\n Version 3, 29 June 2007'), 'GPL-3.0');
  assert.equal(detectLicenseText('Apache License\nVersion 2.0, January 2004'), 'Apache-2.0');
  assert.equal(headerLicense('// SPDX-License-Identifier: GPL-2.0-only\nint x;'), 'GPL-2.0');
  assert.equal(headerLicense('// my own code\n'), null);
});

test('a copyleft project license stops the build until the config says which parts it covers', async () => {
  const root = sampleProject();
  write(root, 'LICENSE', 'GNU GENERAL PUBLIC LICENSE\n Version 3, 29 June 2007');
  await assert.rejects(buildTemplate(baseConfig(root), { dryRun: true }), /GPL-3\.0.*cannot carry a royalty/s);
  const report = await buildTemplate({ ...baseConfig(root), rootLicense: 'GPL-3.0', parts: [{ path: 'src/', license: 'GPL-3.0', note: 'engine' }] }, { dryRun: true });
  assert.deepEqual(report.parts.map(p => p.path), ['LICENSE', 'src/', 'vendor/tiny/']);
  assert.match(report.warnings.join(' '), /GPL-3\.0 is copyleft/);
});

test('config replacements must match, and placeholders fill files the template leaves out', async () => {
  const root = sampleProject();
  const config = {
    ...baseConfig(root),
    replace: [{ path: 'src/app.js', pattern: 'title: "Demo"', with: 'title: "Template"' }],
    placeholders: [{ pattern: 'res://(art/[^"]+\\.png)', in: ['cards/'], files: { png: 'templates/assets/placeholder-card.png' } }],
  };
  const report = await buildTemplate(config, { dryRun: true, redact: true });
  assert.deepEqual(report.placeholders, [{ note: config.placeholders[0].pattern, count: 1 }]);
  assert.ok(report.largest.some(f => f.path === 'art/hero.png'));
  await assert.rejects(buildTemplate({ ...config, replace: [{ path: 'src/app.js', pattern: 'nothing-like-this' }] }, { dryRun: true }), /matched nothing/);
});

test('parts, royalty wording and the notice', () => {
  const m = { parts: [{ path: 'Scripts/', license: 'GPL-3.0' }, { path: 'Scripts/AI/x.gd', license: 'MIT' }] };
  assert.equal(partFor(m, 'Scripts/Game.gd').license, 'GPL-3.0');
  assert.equal(partFor(m, 'Scripts/AI/x.gd').license, 'MIT');
  assert.equal(partFor(m, 'Resources/card.tres'), null);
  const license = { royalty: { percent: 10, basis: 'gross revenue', thresholdUsd: 0 } };
  assert.equal(royaltySummary(license), '10% of gross revenue from commercial use. Free for learning, personal and non-commercial use.');
  assert.equal(royaltyClause({ royalty: { ...license.royalty, thresholdUsd: 50000 } }), 'the 10% royalty on gross revenue from commercial use above the first $50,000 per product');
  const notice = renderPrototypeNotice({ title: 'T', version: '1', stage: 'pre-alpha prototype', works: [], unfinished: [] }, { royalty: license.royalty });
  assert.match(notice, /^# Read this first: PRE-ALPHA PROTOTYPE/);
  assert.match(notice, /not as a finished product/);
});

test('a Blob is read one entry at a time', async () => {
  const zip = await compressZip([{ path: 'a.txt', content: 'hello '.repeat(200) }, { path: 'dir/b.bin', bytes: new Uint8Array([1, 2, 3]) }]);
  const blob = new Blob([zip]);
  const entries = await listZipEntries(blob);
  assert.deepEqual(entries.map(e => e.path), ['a.txt', 'dir/b.bin']);
  assert.equal(new TextDecoder().decode(await readZipEntry(blob, entries[0])), 'hello '.repeat(200));
  assert.deepEqual([...await readZipEntry(blob, entries[1])], [1, 2, 3]);
  assert.ok(FILES_PREFIX === 'files/');
});
