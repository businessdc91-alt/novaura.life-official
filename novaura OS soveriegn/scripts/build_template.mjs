#!/usr/bin/env node
/**
 * build_template.mjs — Make a signed NovAura template bundle (.novatemplate).
 *
 *   node scripts/build_template.mjs <config.json> [--dry-run] [--redact] [--receipts-to <node key>] [--out <dir>]
 *   node scripts/build_template.mjs templates/originals/aetherium-tcg.json --dry-run
 *
 * --dry-run       list what would be packed, any keys found, and the parts with their own licenses
 * --redact        pack placeholders where keys were found (the source folder is not changed)
 * --receipts-to   the node that receives license acceptances (its key is in Nova Registry > Operator)
 * --out           where to write the bundle (default: template-bundles/)
 *
 * Signed with the NovAura authority key (NOVAURA_AUTHORITY_PRIVKEY_HEX or
 * ~/.novaura/sovereign_authority_key.json), so the Template Library shows it
 * as a NovAura Original. Keys are never printed, only where they were found.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRUSTED_AUTHORITIES } from '../src/config/trustedAuthorities.js';
import { buildTemplate } from './lib/templateBuilder.mjs';
import { loadAuthorityKey } from './lib/authorityKey.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const configPath = args.find((a, i) => !a.startsWith('--') && !['--receipts-to', '--out'].includes(args[i - 1]));
if (!configPath) {
  console.log('Usage: node scripts/build_template.mjs <config.json> [--dry-run] [--redact] [--receipts-to <node key>] [--out <dir>]');
  process.exit(1);
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

function printReport(r) {
  console.log(`\nFiles: ${r.files} (${mb(r.bytes)})`);
  for (const [dir, n] of Object.entries(r.byTopDir).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${mb(n).padStart(9)}  ${dir}`);
  console.log('Largest files:');
  for (const f of r.largest) console.log(`  ${mb(f.bytes).padStart(9)}  ${f.path}`);
  if (r.secretNamed.length) {
    console.log(`\nSkipped unopened (named like secrets or private data): ${r.secretNamed.length}`);
    for (const p of r.secretNamed) console.log(`  ${p}`);
  }
  if (r.skipped.length) {
    console.log(`\nSkipped: ${r.skipped.length}`);
    for (const s of r.skipped.slice(0, 30)) console.log(`  ${s.path} (${s.reason})`);
  }
  if (r.findings.length) {
    console.log(`\nKeys or passwords found (values not shown): ${r.findings.length}`);
    for (const f of r.findings) console.log(`  ${f.path}:${f.line}  ${f.kind}`);
  }
  if (r.redacted.length) {
    console.log(`\nReplaced with placeholders in the bundle (values not shown): ${r.redacted.length}`);
    for (const f of r.redacted) console.log(`  ${f.path}:${f.line}  ${f.kind}`);
  }
  for (const x of r.replaced) console.log(`Replaced per the config: ${x.path} (${x.count}x, ${x.note})`);
  for (const x of r.placeholders) console.log(`Placeholders added: ${x.count} (${x.note})`);
  console.log(`\nParts with their own licenses: ${r.parts.length}`);
  for (const p of r.parts) console.log(`  ${p.path}  ${p.license}${p.note ? `  (${p.note})` : ''}`);
  for (const w of r.warnings) console.log(`Note: ${w}`);
}

try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const dryRun = flag('--dry-run');
  const key = dryRun ? null : loadAuthorityKey();
  const report = await buildTemplate(config, {
    secretHex: key?.secret,
    receiptsTo: value('--receipts-to'),
    outDir: path.resolve(value('--out') || path.join(ROOT, 'template-bundles')),
    redact: flag('--redact'),
    dryRun,
    authorities: TRUSTED_AUTHORITIES,
  });
  console.log(`\n${config.title} ${config.version}${dryRun ? ' (dry run, nothing written)' : ''}`);
  printReport(report);
  if (!dryRun) {
    console.log(`\nBuilt ${report.out} (${mb(report.bundleBytes)})`);
    console.log(`Signed by ${key.kid}${report.official ? ' (NovAura Original)' : ''}. Acceptances go to ${report.manifest.receiptsTo || 'nobody yet: pass --receipts-to <your node key> to receive them'}.`);
  }
} catch (err) {
  if (err.report) printReport(err.report);
  console.error(`\nError: ${err.message}`);
  process.exit(1);
}
