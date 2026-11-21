import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import SentinelShield, {
  GENESIS_HASH,
  canonicalStringify,
  computeAuditHash,
} from '../../src/kernel/subsystems/SentinelShield.js';
import {
  DEFAULT_SECURITY_POLICY,
  getSecurityPolicy,
  setSecurityPolicyLocal,
  scanAndRedactOutboundSecrets,
  evaluateSoc2Controls,
} from '../../src/services/security/complianceService.js';
import { providerChat } from '../../src/services/cloudProviders.js';
import CredentialEnclaveService, {
  LEGACY_SSH_STORAGE_KEY,
  LEGACY_TOTP_STORAGE_KEY,
} from '../../src/services/credentialEnclaveService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../..');

function createMemoryAuditTable() {
  const map = new Map();
  return {
    async put(rec) {
      map.set(rec.id, structuredClone(rec));
    },
    async toArray() {
      return Array.from(map.values()).map(v => structuredClone(v));
    },
    _rawMap: map,
  };
}

function createMemoryRecordsStore() {
  const map = new Map();
  return {
    async get(id) {
      return map.has(id) ? structuredClone(map.get(id)) : undefined;
    },
    async put(rec) {
      map.set(rec.id, structuredClone(rec));
    },
    async delete(id) {
      map.delete(id);
    },
    async toArray() {
      return Array.from(map.values()).map(v => structuredClone(v));
    },
  };
}

function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      map.set(k, String(v));
    },
    removeItem(k) {
      map.delete(k);
    },
  };
}

// ── 1. SentinelShield Hash Chain, Tamper Detection, Export & Fail-Closed Gate ──

test('SentinelShield maintains tamper-evident SHA-256 hash chain across concurrent events and detects mutation', async () => {
  const auditTable = createMemoryAuditTable();
  const shield = new SentinelShield({ auditTable });

  // Fire concurrent events to verify serialized queue prevents chain forks
  await Promise.all([
    shield.logEvent('boot_started', 'kernel', 'info', { phase: 1 }),
    shield.logEvent('enclave_unlocked', 'operator', 'info', { idleMin: 15 }),
    shield.logEvent('cloud_egress_blocked', 'ai_subsystem', 'warning', { provider: 'openai' }),
  ]);

  const check1 = await shield.verifyAuditChain();
  assert.equal(check1.valid, true);
  assert.equal(check1.checked, 3);
  assert.equal(check1.lastSeq, 3);
  assert.equal(check1.brokenAt, null);

  // Boot a second instance from persisted table and continue chaining
  const shield2 = new SentinelShield({ auditTable });
  await shield2.boot();
  await shield2.logEvent('policy_updated', 'operator', 'info', { airGappedAiOnly: true });

  const check2 = await shield2.verifyAuditChain();
  assert.equal(check2.valid, true);
  assert.equal(check2.checked, 4);
  assert.equal(check2.lastSeq, 4);

  // Tamper with seq 2 payload directly in storage
  const allRows = await auditTable.toArray();
  const row2 = allRows.find(r => r.seq === 2);
  row2.payload = { idleMin: 9999 };
  await auditTable.put(row2);

  const tampered = await shield2.verifyAuditChain();
  assert.equal(tampered.valid, false);
  assert.equal(tampered.brokenAt?.seq, 2);
  assert.equal(tampered.brokenAt?.reason, 'hash_mismatch');
});

test('SentinelShield verifyAuditChain counts legacy unchained rows without failing valid chained suffix', async () => {
  const auditTable = createMemoryAuditTable();
  await auditTable.put({ id: 'legacy_1', eventType: 'old_log', source: 'boot', severity: 'info', payload: {}, timestamp: 1000 });

  const shield = new SentinelShield({ auditTable });
  await shield.boot();
  const e1 = await shield.logEvent('new_log', 'operator', 'info', { ok: true });
  assert.equal(e1.prevHash, GENESIS_HASH);
  assert.equal(e1.seq, 1);
  assert.equal(await computeAuditHash(GENESIS_HASH, e1), e1.hash);

  const verification = await shield.verifyAuditChain();
  assert.equal(verification.valid, true);
  assert.equal(verification.legacyUnchained, 1);
  assert.equal(verification.checked, 1);
});

test('SentinelShield exportAuditLogs supports JSON v2 integrity envelope and CSV formula-injection escaping', async () => {
  const auditTable = createMemoryAuditTable();
  const shield = new SentinelShield({ auditTable });
  await shield.logEvent('=HYPERLINK("http://evil")', '+cmd', 'info', { note: '@SUM(A1:A2)' });

  const jsonExport = JSON.parse(await shield.exportAuditLogs('json'));
  assert.equal(jsonExport.schema, 'novaura.sentinel.audit.v2');
  assert.equal(jsonExport.integrity.valid, true);
  assert.equal(jsonExport.count, 1);

  const csvExport = await shield.exportAuditLogs('csv');
  const lines = csvExport.split('\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].startsWith('seq,timestamp,isoTime,id,severity,source,eventType,prevHash,hash,payload'));
  assert.ok(lines[1].includes("'+cmd"), 'leading + in source must be neutralized');
  assert.ok(lines[1].includes("'=HYPERLINK"), 'leading = in eventType must be neutralized');
  assert.equal(canonicalStringify({ b: 2, a: 1 }), '{"a":1,"b":2}');
});

test('SentinelShield checkPermission fails closed on high-risk capabilities and honors approval handler', async () => {
  const auditTable = createMemoryAuditTable();
  const shield = new SentinelShield({ auditTable });

  // Read operations remain allowed
  assert.equal(await shield.checkPermission('fs:read', '/workspace/foo.js'), true);

  // Without approval handler, all high-risk capabilities fail closed
  for (const cap of ['terminal:exec', 'fs:delete_system', 'cloud:egress', 'firmware:reboot']) {
    const allowed = await shield.checkPermission(cap, 'target-1', 'unit test');
    assert.equal(allowed, false, `${cap} must fail closed without approval handler`);
  }

  // Register approval handler that approves terminal:exec on safe target, denies reboot
  let promptCalls = 0;
  shield.setApprovalHandler(async ({ capability }) => {
    promptCalls++;
    return capability === 'terminal:exec';
  });

  assert.equal(await shield.checkPermission('terminal:exec', 'npm test', 'run tests'), true);
  // Cached grant avoids second prompt on same target
  assert.equal(await shield.checkPermission('terminal:exec', 'npm test', 'run tests'), true);
  assert.equal(promptCalls, 1);

  assert.equal(await shield.checkPermission('firmware:reboot', 'uefi', 'restart'), false);

  // Throw inside handler must fail closed
  shield.setApprovalHandler(async () => {
    throw new Error('UI closed');
  });
  assert.equal(await shield.checkPermission('cloud:egress', 'openai', 'chat'), false);
});

// ── 2. Outbound Cloud Secret Redaction, SOC 2 Evaluator & Air-Gap Lock ────────

test('scanAndRedactOutboundSecrets scrubs API keys, tokens, JWTs, and PEM blocks while keeping clean code', () => {
  const fakeOpenAi = 'sk-' + 'proj-' + 'AbCdEf1234567890GhIjKlMnOpQrStUv';
  const fakeAnthropic = 'sk-ant-' + 'api03-' + 'XyZ0987654321AbCdEfGhIjKlMnOpQr';
  const fakeGemini = 'AIza' + 'SyD1234567890abcdefghijklmnopqrstuv';
  const fakeGithub = 'ghp_' + 'A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8';
  const fakeAws = 'AKIA' + '1234567890ABCDEF';
  const fakeStripe = 'sk_live_' + '51AbCdEfGhIjKlMnOpQrStUvWx';
  const fakeSlack = 'xoxb-' + '1234567890-abcdefghi';
  const fakeNova = 'NOVA1.' + 'abcdef1234567890ABCD.' + 'sig9876543210zyxwvu';
  const fakeJwt = 'Bearer eyJ' + 'hbGciOiJIUzI1NiJ9.' + 'eyJzdWIiOiIxMjM0In0.' + 'signature1234567890';
  const fakePem = '-----BEGIN OPENSSH PRIVATE KEY-----\nAAAAb3BlbnNzaC1rZXktdjE=\n-----END OPENSSH PRIVATE KEY-----';

  const original = [
    {
      role: 'user',
      content: [
        'const port = 3000;',
        `openai=${fakeOpenAi}`,
        `claude=${fakeAnthropic}`,
        `gem=${fakeGemini}`,
        `gh=${fakeGithub}`,
        `aws=${fakeAws}`,
        `stripe=${fakeStripe}`,
        `slack=${fakeSlack}`,
        `nova=${fakeNova}`,
        `auth=${fakeJwt}`,
        fakePem,
      ].join('\n'),
    },
    {
      role: 'user',
      content: [{ type: 'text', text: `Inline secret ${fakeOpenAi} in structured content` }],
    },
  ];

  const snapshotBefore = JSON.stringify(original);
  const res = scanAndRedactOutboundSecrets(original);

  assert.equal(JSON.stringify(original), snapshotBefore, 'input array must not be mutated');
  assert.ok(res.redactedCount >= 11);

  const serializedOut = JSON.stringify(res.messages);
  for (const raw of [fakeOpenAi, fakeAnthropic, fakeGemini, fakeGithub, fakeAws, fakeStripe, fakeSlack, fakeNova, fakeJwt, 'AAAAb3BlbnNzaC1rZXktdjE=']) {
    assert.ok(!serializedOut.includes(raw), `redacted output still contained secret fragment: ${raw.slice(0, 12)}`);
  }
  assert.ok(serializedOut.includes('const port = 3000;'));
  assert.ok(serializedOut.includes('[REDACTED:PRIVATE_KEY]'));
  assert.ok(serializedOut.includes('[REDACTED:GEMINI_KEY]'));

  const serializedFindings = JSON.stringify(res.findings);
  assert.ok(!serializedFindings.includes(fakeOpenAi), 'findings telemetry must never include raw secret values');

  const clean = scanAndRedactOutboundSecrets([{ role: 'user', content: 'Explain PBKDF2-HMAC-SHA256 in Rust.' }]);
  assert.equal(clean.redactedCount, 0);
  assert.deepEqual(clean.findings, []);
});

test('evaluateSoc2Controls flags legacy plaintext (FAIL), chain tampering (FAIL), and scores hardened Tauri node 100%', () => {
  const fullPass = evaluateSoc2Controls({
    isTauri: true,
    policy: { ...DEFAULT_SECURITY_POLICY },
    enclaveStatus: { idleTimeoutMinutes: 15 },
    legacyPlaintext: { sshCount: 0, totpCount: 0, total: 0 },
    auditVerification: { valid: true, checked: 5, legacyUnchained: 0 },
  });
  assert.equal(fullPass.failed, 0);
  assert.equal(fullPass.warned, 0);
  assert.equal(fullPass.passed, 6);
  assert.equal(fullPass.scorePercent, 100);

  const degraded = evaluateSoc2Controls({
    isTauri: false,
    policy: { airGappedAiOnly: false, redactCloudSecrets: false, enclaveIdleMinutes: 0, requireHighRiskApproval: false },
    enclaveStatus: { idleTimeoutMinutes: 0 },
    legacyPlaintext: { sshCount: 1, totpCount: 1, total: 2 },
    auditVerification: { valid: false, checked: 3, brokenAt: { seq: 2, reason: 'hash_mismatch' } },
  });
  const byId = Object.fromEntries(degraded.controls.map(c => [c.id, c.status]));
  assert.equal(byId['CC6.7'], 'FAIL');
  assert.equal(byId['CC7.2'], 'FAIL');
  assert.equal(byId['C1.1'], 'WARN');
  assert.equal(byId['CC6.1'], 'WARN');
});

test('Air-Gap Local-Only AI Lock blocks providerChat immediately without attempting network transport', async () => {
  const prev = getSecurityPolicy();
  try {
    setSecurityPolicyLocal({ airGappedAiOnly: true });
    await assert.rejects(
      () => providerChat('openai', [{ role: 'user', content: 'hello' }], () => 'unused-test-key'),
      /Air-Gapped Local-Only AI/i,
    );
  } finally {
    setSecurityPolicyLocal(prev);
  }
});

// ── 3. CredentialEnclaveService Migration, Auto-Lock & Static Window Checks ────

test('CredentialEnclaveService migrates legacy plaintext SSH/TOTP keys into AES-256-GCM enclave and purges storage', async () => {
  const recordsStore = createMemoryRecordsStore();
  const storage = createMemoryStorage({
    [LEGACY_SSH_STORAGE_KEY]: JSON.stringify([
      { id: 'ssh_1', label: 'Legacy Ed25519', algorithm: 'Ed25519', publicKey: 'ssh-ed25519 AAAAC3Test', privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----\nSECRET_TEST_KEY\n-----END OPENSSH PRIVATE KEY-----', fingerprint: 'SHA256:test' },
    ]),
    [LEGACY_TOTP_STORAGE_KEY]: JSON.stringify([
      { id: 'totp_1', name: 'Prod Bastion', issuer: 'NovAura', secret: 'JBSWY3DPEHPK3PXP' },
    ]),
  });

  const enclave = new CredentialEnclaveService({ recordsStore, storage });
  assert.equal(enclave.hasLegacyPlaintextSecrets().total, 2);

  await enclave.unlock('Correct-Horse-Battery-Staple-2026!');
  assert.equal(enclave.isUnlocked(), true);

  // Plaintext keys must be wiped after migration on unlock
  assert.equal(storage.getItem(LEGACY_SSH_STORAGE_KEY), null);
  assert.equal(storage.getItem(LEGACY_TOTP_STORAGE_KEY), null);
  assert.equal(enclave.hasLegacyPlaintextSecrets().total, 0);

  // Encrypted records in store must not expose raw secrets in JSON form
  const rawRecords = await recordsStore.toArray();
  const serializedRecords = JSON.stringify(rawRecords);
  assert.ok(!serializedRecords.includes('SECRET_TEST_KEY'), 'encrypted store must never contain raw private key');
  assert.ok(!serializedRecords.includes('JBSWY3DPEHPK3PXP'), 'encrypted store must never contain raw TOTP seed');

  // Authorized decrypted reads recover original payloads
  const sshList = await enclave.listDecryptedByType('ssh_pgp');
  const totpList = await enclave.listDecryptedByType('totp');
  assert.equal(sshList.length, 1);
  assert.ok(sshList[0].privateKey.includes('SECRET_TEST_KEY'));
  assert.equal(totpList.length, 1);
  assert.equal(totpList[0].secret, 'JBSWY3DPEHPK3PXP');

  // Incorrect passphrase must be rejected
  enclave.lock('manual');
  await assert.rejects(() => enclave.unlock('wrong-passphrase'), /Incorrect passphrase/);
});

test('CredentialEnclaveService idle auto-lock wipes active session on inactivity timeout', async () => {
  const enclave = new CredentialEnclaveService({
    recordsStore: createMemoryRecordsStore(),
    storage: createMemoryStorage(),
  });
  await enclave.unlock('Auto-Lock-Passphrase-999!');
  enclave.setIdleTimeoutMs(40);
  assert.equal(enclave.isUnlocked(), true);

  await new Promise(resolve => setTimeout(resolve, 90));
  assert.equal(enclave.isUnlocked(), false);
  assert.equal(enclave.getStatus().lastLockReason, 'idle_timeout');
});

test('CredentialEnclaveWindow static security invariants hold', () => {
  const winPath = path.join(ROOT_DIR, 'src/components/windows/CredentialEnclaveWindow.jsx');
  const src = fs.readFileSync(winPath, 'utf8');
  assert.ok(!src.includes('novaura_sovereign_operator_2026'), 'hardcoded default passphrase must stay removed');
  assert.ok(!src.includes('Use Local Operator Default Key'), 'default passphrase button must stay removed');
  assert.ok(!src.includes('novaura_ssh_keys'), 'plaintext SSH localStorage persistence must stay removed');
  assert.ok(!src.includes('novaura_totp_accounts'), 'plaintext TOTP localStorage persistence must stay removed');
  assert.ok(src.includes('600,000 iterations'), 'lock screen must document 600,000 PBKDF2 iterations');
});

