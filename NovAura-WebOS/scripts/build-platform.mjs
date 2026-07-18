#!/usr/bin/env node
// Builds the platform SPA if its source is present.
// Cross-platform (Windows/macOS/Linux) replacement for `cd platform && npm run build`,
// with a loud skip when platform/ hasn't been vendored in yet.
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const platformDir = path.join(root, 'platform');
const pkg = path.join(platformDir, 'package.json');

if (!existsSync(pkg)) {
  console.warn('');
  console.warn('┌─────────────────────────────────────────────────────────────┐');
  console.warn('│  WARNING: platform/ has no package.json — SKIPPING build.   │');
  console.warn('│  The marketplace at /platform/** will NOT be deployed.      │');
  console.warn('│  See platform/README.md to restore the platform source.     │');
  console.warn('└─────────────────────────────────────────────────────────────┘');
  console.warn('');
  process.exit(0);
}

if (!existsSync(path.join(platformDir, 'node_modules'))) {
  console.log('[build-platform] Installing platform dependencies...');
  execSync('npm install', { cwd: platformDir, stdio: 'inherit' });
}

console.log('[build-platform] Building platform SPA...');
execSync('npm run build', { cwd: platformDir, stdio: 'inherit' });
console.log('[build-platform] Done.');
