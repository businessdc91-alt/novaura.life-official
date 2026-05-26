/**
 * NovAura — Firebase Storage Asset Uploader
 *
 * Uploads built client binaries to Firebase Storage so the
 * /download and /staff pages can serve real download URLs.
 *
 * Usage:
 *   node upload-assets.js
 *   node upload-assets.js --dry-run   (shows what would be uploaded, no writes)
 *
 * Requires: firebase-admin (already in NovAura-WebOS/functions/node_modules)
 * Auth:     Uses your existing `firebase login` credentials via ADC,
 *           OR place a service account key at: ./service-account.json
 */

const path = require('path');
const fs = require('fs');

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = __dirname;

// ── Firebase Admin bootstrap ──────────────────────────────────────────────────
// Reuse the admin SDK already installed in functions/
process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';

let admin;
try {
  admin = require(path.join(ROOT, 'NovAura-WebOS/functions/node_modules/firebase-admin'));
} catch (e) {
  console.error('firebase-admin not found. Run: cd NovAura-WebOS/functions && npm install');
  process.exit(1);
}

// Auth: prefer service-account.json in repo root, fall back to ADC
const SA_PATH = path.join(ROOT, 'service-account.json');
let credential;
if (fs.existsSync(SA_PATH)) {
  credential = admin.credential.cert(require(SA_PATH));
  console.log('🔑 Auth: service-account.json');
} else {
  credential = admin.credential.applicationDefault();
  console.log('🔑 Auth: Application Default Credentials (firebase login)');
}

admin.initializeApp({
  credential,
  storageBucket: 'novaura-life.appspot.com',
});

const bucket = admin.storage().bucket();

// ── File manifest ─────────────────────────────────────────────────────────────
// localPath: absolute path on this machine
// storagePath: destination in Firebase Storage
// contentType: MIME type for the download
const ASSETS = [
  // ── Desktop (Tauri) ────────────────────────────────────────────────────────
  {
    label: 'Desktop — Windows installer',
    localPath: path.join(ROOT, 'Novaura-Desktop/src-tauri/target/release/bundle/nsis/NovAura_*_x64-setup.exe'),
    localPathFallback: path.join(ROOT, 'Novaura-Desktop/src-tauri/target/release/bundle/msi/NovAura_*.msi'),
    storagePath: 'downloads/desktop/novaura-setup.exe',
    contentType: 'application/octet-stream',
  },
  {
    label: 'Desktop — macOS dmg',
    localPath: path.join(ROOT, 'Novaura-Desktop/src-tauri/target/release/bundle/dmg/NovAura_*.dmg'),
    storagePath: 'downloads/desktop/novaura.dmg',
    contentType: 'application/octet-stream',
  },
  {
    label: 'Desktop — Linux AppImage',
    localPath: path.join(ROOT, 'Novaura-Desktop/src-tauri/target/release/bundle/appimage/novaura_*.AppImage'),
    storagePath: 'downloads/desktop/novaura.AppImage',
    contentType: 'application/octet-stream',
  },

  // ── Staff Ops (Tauri) ──────────────────────────────────────────────────────
  {
    label: 'Ops — Windows installer',
    localPath: path.join(ROOT, 'Novaura-Ops/src-tauri/target/release/bundle/nsis/NovAura Ops_*_x64-setup.exe'),
    localPathFallback: path.join(ROOT, 'Novaura-Ops/src-tauri/target/release/bundle/msi/NovAura Ops_*.msi'),
    storagePath: 'downloads/staff/novaura-ops-setup.exe',
    contentType: 'application/octet-stream',
  },

  // ── VS Code Extension ──────────────────────────────────────────────────────
  {
    label: 'VS Code extension (.vsix)',
    localPath: path.join(ROOT, 'NovAura-Coding-Partner/*.vsix'),
    storagePath: 'downloads/vscode/novaura-coding-partner.vsix',
    contentType: 'application/zip',
  },

  // ── Android APK ───────────────────────────────────────────────────────────
  // Add path once Android build is available
  // {
  //   label: 'Android APK',
  //   localPath: path.join(ROOT, 'NovAura-Mobile/android/app/build/outputs/apk/release/app-release.apk'),
  //   storagePath: 'downloads/mobile/novaura.apk',
  //   contentType: 'application/vnd.android.package-archive',
  // },
];

// ── Glob resolver (handles wildcard paths) ────────────────────────────────────
function resolveGlob(pattern) {
  const dir = path.dirname(pattern);
  const basePat = path.basename(pattern);
  if (!basePat.includes('*')) {
    return fs.existsSync(pattern) ? pattern : null;
  }
  if (!fs.existsSync(dir)) return null;
  const regex = new RegExp('^' + basePat.replace(/\*/g, '.*') + '$');
  const matches = fs.readdirSync(dir).filter(f => regex.test(f));
  if (matches.length === 0) return null;
  // Pick newest if multiple matches
  return path.join(dir, matches.sort().pop());
}

// ── Upload ────────────────────────────────────────────────────────────────────
async function uploadFile(asset) {
  let resolved = resolveGlob(asset.localPath);
  if (!resolved && asset.localPathFallback) {
    resolved = resolveGlob(asset.localPathFallback);
  }

  if (!resolved) {
    console.log(`  ⏭  SKIP  ${asset.label} — file not found`);
    console.log(`         Expected: ${asset.localPath}`);
    return false;
  }

  const size = (fs.statSync(resolved).size / 1024 / 1024).toFixed(1);
  console.log(`  ↑  ${asset.label}`);
  console.log(`     From: ${resolved} (${size} MB)`);
  console.log(`     To:   gs://novaura-life.appspot.com/${asset.storagePath}`);

  if (DRY_RUN) {
    console.log('     [dry-run — skipping write]');
    return true;
  }

  await bucket.upload(resolved, {
    destination: asset.storagePath,
    metadata: {
      contentType: asset.contentType,
      cacheControl: 'public, max-age=3600',
    },
  });

  console.log(`     ✅ Done`);
  return true;
}

async function main() {
  console.log('\n════════════════════════════════════════════');
  console.log('  NovAura — Firebase Storage Uploader');
  if (DRY_RUN) console.log('  MODE: DRY RUN — no files will be written');
  console.log('════════════════════════════════════════════\n');

  let uploaded = 0;
  let skipped = 0;

  for (const asset of ASSETS) {
    const ok = await uploadFile(asset);
    if (ok) uploaded++; else skipped++;
    console.log('');
  }

  console.log('════════════════════════════════════════════');
  console.log(`  Uploaded: ${uploaded}  |  Skipped (not built yet): ${skipped}`);
  console.log('  Download URLs will be live at novaura.life/download');
  console.log('════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('\n❌ Upload failed:', err.message);
  if (err.message.includes('credential')) {
    console.error('   Run: firebase login  — then try again');
    console.error('   Or place a service-account.json in the repo root');
  }
  process.exit(1);
});