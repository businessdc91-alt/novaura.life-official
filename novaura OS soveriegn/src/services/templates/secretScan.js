/**
 * secretScan.js — Keeps keys, passwords and private data out of template
 * bundles, and finds the parts of a project that carry their own license.
 *
 * Pure (no storage, no network). The bundle builder uses it before anything is
 * packed; findings name the file, line and kind of secret, never the value.
 */

// Folders that are never packed: caches, dependencies, build output, VCS.
const SKIP_DIRS = new Set([
  '.git', '.svn', '.hg', 'node_modules', '.godot', '.import', 'bin', 'obj', '.vs', '.vscode', '.idea',
  'dist', 'dist-ssr', 'target', '__pycache__', '.venv', 'venv', 'env', '.firebase', 'coverage', '.next',
  '.cache', '.parcel-cache', '.turbo', '.gradle', '.mono', 'packages', '.serena', '.claude',
]);

// File names that hold secrets or private data. They are skipped unopened.
const SECRET_NAME_RES = [
  /^\.env(\..+)?$/i,
  /secret/i,
  /credential/i,
  /service[-_]?account.*\.json$/i,
  /tokens?\.(json|txt)$/i,
  /\.(pem|key|pfx|p12|keystore|jks|der|crt|cer|kdbx|ppk|asc|gpg)$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /^\.(npmrc|pypirc|netrc|git-credentials|firebaserc)$/i,
  /licen[cs]e.*\.json$/i,
  /sovereign_authority_key/i,
  /node_certificate\.json$/i,
  /^auth_export/i,
  /master[-_]?key/i,
  /api[-_]?keys?([-_. ]|$)/i,
  /\.(sqlite3?|db|db-journal|ldb)$/i,
  /\.(log)$/i,
];
// Example files are packed (after a content scan): they are how a template says what to configure.
const EXAMPLE_NAME_RE = /\.(example|sample|template)$/i;

const basename = (p) => String(p).split('/').pop();

/** True for folders a template never contains. */
export function isSkippedDir(name) {
  return SKIP_DIRS.has(String(name).toLowerCase());
}

// Source files are code (a SecretsWindow.jsx or secretService.ts), so they are scanned for keys instead of skipped.
const SOURCE_FILE_RE = /\.(m?jsx?|cjs|tsx?|cs|py|gd|rs|go|java|kt|c|cc|cpp|h|hpp|swift|php|rb|lua|vue|svelte|xaml)$/i;

/** True for file names that hold secrets or private data; such files are never opened. */
export function isSecretFileName(relPath) {
  const name = basename(relPath);
  if (SOURCE_FILE_RE.test(name)) return false;
  if (EXAMPLE_NAME_RE.test(name) && !/\.(pem|key|pfx|p12)$/i.test(name.replace(EXAMPLE_NAME_RE, ''))) return false;
  return SECRET_NAME_RES.some(re => re.test(name));
}

// ── Content scan ────────────────────────────────────────────────────────────
// Each pattern marks the secret itself (group `v` when only part of the match is secret).

const SECRET_PATTERNS = [
  // A real key has a long base64 body (with real or JSON-escaped line breaks); a bare header string is not one.
  { kind: 'private key block', re: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----(?:[A-Za-z0-9+/=\s]|\\[nr]){100,}?-----END (?:[A-Z]+ )*PRIVATE KEY-----/g, placeholder: '-----PRIVATE KEY REMOVED-----' },
  { kind: 'Google API key', re: /AIza[0-9A-Za-z_-]{35,}/g, placeholder: 'YOUR_GOOGLE_API_KEY' },
  { kind: 'Google OAuth client secret', re: /GOCSPX-[0-9A-Za-z_-]{20,}/g, placeholder: 'YOUR_OAUTH_CLIENT_SECRET' },
  { kind: 'Google OAuth client ID', re: /\b\d{6,}-[0-9a-z]{20,}\.apps\.googleusercontent\.com\b/g, placeholder: 'YOUR_CLIENT_ID.apps.googleusercontent.com' },
  { kind: 'API key (sk-)', re: /\bsk-(?:proj-|ant-(?:api\d+-)?|or-v1-|svcacct-)?[A-Za-z0-9_-]{20,}/g, placeholder: 'YOUR_API_KEY' },
  { kind: 'Stripe key', re: /\b(?:sk|rk|pk)_(?:live|test)_[0-9A-Za-z]{16,}/g, placeholder: 'YOUR_STRIPE_KEY' },
  { kind: 'Stripe webhook secret', re: /\bwhsec_[0-9A-Za-z]{20,}/g, placeholder: 'YOUR_WEBHOOK_SECRET' },
  { kind: 'AWS access key', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, placeholder: 'YOUR_AWS_ACCESS_KEY' },
  { kind: 'GitHub token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/g, placeholder: 'YOUR_GITHUB_TOKEN' },
  { kind: 'Slack token', re: /\bxox[abprs]-[0-9A-Za-z-]{10,}/g, placeholder: 'YOUR_SLACK_TOKEN' },
  { kind: 'Hugging Face token', re: /\bhf_[A-Za-z0-9]{30,}\b/g, placeholder: 'YOUR_HF_TOKEN' },
  { kind: 'Groq key', re: /\bgsk_[A-Za-z0-9]{40,}\b/g, placeholder: 'YOUR_GROQ_KEY' },
  { kind: 'xAI key', re: /\bxai-[A-Za-z0-9]{40,}\b/g, placeholder: 'YOUR_XAI_KEY' },
  { kind: 'Replicate token', re: /\br8_[A-Za-z0-9]{30,}\b/g, placeholder: 'YOUR_REPLICATE_TOKEN' },
  { kind: 'NovAura license or certificate', re: /\bNOVA(?:1|REG1)\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, placeholder: 'YOUR_NOVA_LICENSE' },
  { kind: 'JSON web token', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, placeholder: 'YOUR_TOKEN' },
  { kind: 'password in a URL', re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/"'`]+:(?<v>[^\s:@/"'`]{4,})@/gi, placeholder: 'PASSWORD', check: (v) => !/^[$<{[%]|\$\{|^password$|YOUR_/i.test(v) },
  {
    kind: 'key or password in code',
    re: /\b[A-Za-z0-9_]*(?:key|secret|token|passw(?:or)?d|pwd|passphrase)[A-Za-z0-9_]*["']?\s*(?:[:=]|=>)\s*@?["'`](?<v>[^"'`\s]{12,})["'`]/gi,
    placeholder: 'YOUR_KEY_HERE',
    check: looksSecret,
  },
  {
    // Gate, access and invite codes, master keys and passwords are secrets at any length, also as an `||` fallback.
    kind: 'access code or password in code',
    re: /\b[A-Za-z0-9_]*(?:gate[_-]?code|access[_-]?code|invite[_-]?code|auth[_-]?code|master[_-]?key|passphrase|password|passwd)[A-Za-z0-9_]*["']?\s*(?:[:=]|=>)\s*(?:[^'"`\n;]*?\|\|\s*)?@?["'`](?<v>[^"'`\n]{4,})["'`]/gi,
    placeholder: 'YOUR_VALUE_HERE',
    // Plain words ('Password', 'Enter a password') are labels, not secrets.
    check: (v) => !PLACEHOLDER_RE.test(v) && !/YOUR_|_HERE$|\$\{/.test(v) && !NAME_LIKE_RE.test(v) && !/^[A-Za-z]+([ -][A-Za-z]+)*[.!:]?$/.test(v),
  },
  {
    // A literal compared against what someone typed is a built-in key, password or bypass.
    kind: 'hard-coded credential check',
    // The name has to end in the word (gateCode, adminKey, user.email, pass), so userTier or keyboardMode do not count.
    re: /\b(?<n>[A-Za-z0-9_.?]*(?:key|pass(?:word)?|pwd|phrase|code|email|username|login))\s*(?:===?|!==?|\.Equals\()\s*@?["'`](?<v>[^"'`\n]{4,})["'`]/gi,
    placeholder: 'YOUR_VALUE_HERE',
    // A bare e.key or err.code is usually a key name or error code ('Escape', 'auth/x'), so it needs a digit
    // or symbol; a compound name (gateCode, adminKey, password) is checked against any literal.
    check: (v, m) => (/^(key|code)$/i.test(m.groups.n.split(/[.?]/).pop())
      ? looksLikeCredential(v)
      : v.length >= 4 && !PLACEHOLDER_RE.test(v) && !/YOUR_|_HERE$|\$\{/.test(v) && !NAME_LIKE_RE.test(v)),
  },
  {
    // "Key=..., Pass=..." written into a comment.
    kind: 'credential in a comment',
    re: /(?<=(?:\/\/|#|\/\*|<!--|^[ \t]*\*)[^\n]*)\b(?:key|pass(?:word)?|pwd|pin|passphrase|license(?:[ _-]?key)?)\s*[:=]\s*(?<v>[^\s,;'"`]{6,})/gim,
    placeholder: 'REMOVED',
    // Prose like "PASS: Pre-compiled" is not a credential; a value with a digit or a symbol may be.
    check: (v) => looksLikeCredential(v) && (/[0-9]/.test(v) || /[^A-Za-z0-9\s._-]/.test(v)),
  },
  {
    kind: 'email address',
    re: /\b[A-Za-z0-9._%+-]+@(?!(?:example|test|localhost|domain|email|company|yourdomain|users\.noreply\.github)\.)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g,
    placeholder: 'you@example.com',
    check: (v) => !/^(noreply|no-reply|support|info|hello|contact|admin|user|name|someone|your)@/i.test(v) && !/\.(png|jpe?g|gif|svg|webp)$/i.test(v),
  },
  {
    kind: 'key or password in a config line',
    re: /^[ \t]*(?:export[ \t]+)?[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD)[A-Z0-9_]*[ \t]*=[ \t]*(?<v>[^\s#'"]{12,})/gm,
    placeholder: 'YOUR_KEY_HERE',
    check: looksSecret,
  },
];

// `<` only counts when a placeholder word follows (<your-key>, <api key>); "<word>" can be a real code.
const PLACEHOLDER_RE = /^(your|my|xxx|<\s*(your|my|insert|enter|api|key|token|secret|password|value|replace|paste|add)\b|\$\{|\$\(|\{\{|process\.env|import\.meta|env\.|example|changeme|placeholder|dummy|replace|insert|todo|none|null|undefined|redacted|enter|paste|sk-\.\.\.)/i;

// Lower-case names joined by - _ : . or / (storage keys, event names, error codes like auth/wrong-password).
const NAME_LIKE_RE = /^[a-z][a-z0-9]*([-_:./][a-z0-9]+)+$/;

/** Whether an assigned value looks like a real secret rather than a name, path or placeholder. */
function looksSecret(value) {
  const v = String(value);
  if (v.length < 12 || PLACEHOLDER_RE.test(v) || /YOUR_|_HERE$|\.\.\.|\$\{/i.test(v) || NAME_LIKE_RE.test(v)) return false;
  if (v.includes('://') || /^[./\\~]/.test(v) || /\.(js|ts|py|cs|json|txt|png|md|html|gd|tres|tscn)$/i.test(v)) return false;
  if (!/[0-9]/.test(v) || !/[A-Za-z]/.test(v)) return false;
  return new Set(v).size >= 10;
}

/** A short password, key or email in a comparison or comment: has a digit or symbol, and is not code or a placeholder. */
function looksLikeCredential(value) {
  const v = String(value);
  if (v.length < 4 || PLACEHOLDER_RE.test(v) || /YOUR_|_HERE$|\.\.\.|^REMOVED$|\$\{/i.test(v) || NAME_LIKE_RE.test(v)) return false;
  if (/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*[,;)]?$/.test(v) && !/[0-9]/.test(v)) return false; // an identifier
  if (/[([{}<>]|=>|\+\+/.test(v) || v.includes('://')) return false;
  return /[0-9]/.test(v) || /[^A-Za-z0-9\s]/.test(v);
}

/** Secrets in a text: [{ kind, line, start, end }] (offsets of the secret, never the value). */
export function scanText(text) {
  const src = String(text);
  const found = [];
  for (const p of SECRET_PATTERNS) {
    p.re.lastIndex = 0;
    let m;
    while ((m = p.re.exec(src))) {
      if (m[0].length === 0) { p.re.lastIndex++; continue; }
      const value = m.groups?.v ?? m[0];
      if (p.check && !p.check(value, m)) continue;
      const start = m.groups?.v != null ? m.index + m[0].lastIndexOf(value) : m.index;
      const end = start + value.length;
      if (found.some(f => start < f.end && end > f.start)) continue;
      found.push({ kind: p.kind, start, end, placeholder: p.placeholder });
    }
  }
  found.sort((a, b) => a.start - b.start);
  const lineAt = (offset) => src.slice(0, offset).split('\n').length;
  return found.map(f => ({ kind: f.kind, line: lineAt(f.start), start: f.start, end: f.end, placeholder: f.placeholder }));
}

/** The text with every secret replaced by a placeholder: { text, findings }. */
export function redactText(text) {
  const src = String(text);
  const findings = scanText(src);
  let out = '';
  let at = 0;
  for (const f of findings) {
    out += src.slice(at, f.start) + f.placeholder;
    at = f.end;
  }
  return { text: out + src.slice(at), findings: findings.map(({ kind, line }) => ({ kind, line })) };
}

/** Text unless it has NUL bytes in its first 8 KB. */
export function isProbablyText(bytes) {
  const n = Math.min(bytes.length, 8192);
  for (let i = 0; i < n; i++) if (bytes[i] === 0) return false;
  return true;
}

// ── Licenses inside a project ───────────────────────────────────────────────

export const LICENSE_FILE_RE = /^(licen[cs]e|copying|unlicense)([-_.][a-z0-9-]+)?(\.(md|txt|rst))?$/i;

/** Which license a LICENSE file (or a file header) states, as an SPDX-style id, or 'custom'. */
export function detectLicenseText(text) {
  const spdx = String(text).slice(0, 4000).match(/SPDX-License-Identifier:\s*([A-Za-z0-9.+-]+)/i);
  if (spdx) return spdx[1].replace(/-only$|-or-later$/i, '');
  const t = String(text).slice(0, 4000).toLowerCase().replace(/\s+/g, ' ');
  if (t.includes('novaura template license')) return 'NovAura-Template';
  if (t.includes('gnu affero general public license')) return 'AGPL-3.0';
  if (t.includes('gnu lesser general public license')) return t.includes('version 2.1') ? 'LGPL-2.1' : 'LGPL-3.0';
  if (t.includes('gnu general public license')) return t.includes('version 2') && !t.includes('version 3') ? 'GPL-2.0' : 'GPL-3.0';
  if (t.includes('mozilla public license')) return 'MPL-2.0';
  if (t.includes('apache license') && t.includes('2.0')) return 'Apache-2.0';
  if (t.includes('permission is hereby granted, free of charge')) return 'MIT';
  if (t.includes('redistribution and use in source and binary forms')) return t.includes('neither the name') ? 'BSD-3-Clause' : 'BSD-2-Clause';
  if (t.includes('permission to use, copy, modify, and/or distribute this software for any purpose')) return t.includes('above copyright notice') ? 'ISC' : '0BSD';
  if (t.includes('free and unencumbered software released into the public domain')) return 'Unlicense';
  if (t.includes('creative commons') || t.includes('cc0') || t.includes('cc-by')) {
    if (t.includes('cc0') || t.includes('public domain dedication')) return 'CC0-1.0';
    if (t.includes('noncommercial') || t.includes('non-commercial')) return 'CC-BY-NC-4.0';
    if (t.includes('sharealike') || t.includes('share-alike')) return 'CC-BY-SA-4.0';
    return 'CC-BY-4.0';
  }
  return 'custom';
}

/** A license named in a source file's header (SPDX tag or GPL boilerplate), or null. */
export function headerLicense(text) {
  const head = String(text).split('\n').slice(0, 40).join('\n');
  if (/spdx-license-identifier:/i.test(head) || /GNU (Affero |Lesser )?General Public License/i.test(head)) {
    const id = detectLicenseText(head);
    return id === 'custom' ? null : id;
  }
  return null;
}

/** Copyleft licenses: code under them cannot carry a royalty or extra conditions. */
export function isCopyleft(id) {
  return /^(A?GPL|LGPL|MPL|CC-BY-SA|EUPL|OSL)/i.test(String(id || ''));
}
