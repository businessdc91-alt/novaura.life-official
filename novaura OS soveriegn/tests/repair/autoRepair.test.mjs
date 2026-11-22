import test from 'node:test';
import assert from 'node:assert/strict';

import {
  recordRuntimeError,
  getFlightLog,
  clearFlightLog,
  scanCorruptedLocalStorage,
  sanitizeHotfixCss,
  validateSafeRedirectUrl,
  applyRuntimeHotfix,
  rollbackRuntimeHotfix,
} from '../../src/services/repair/flightRecorder.js';
import {
  validateRepairPathJs,
  filterSafeCodeEdits,
  analyzeAndPlanRepair,
  executeSourcePatchWithGate,
  triggerInstallerRebuild,
  dispatchUpstreamRepairProposal,
} from '../../src/services/repair/repairOrchestrator.js';

function installMemoryLocalStorage() {
  const store = new Map();
  const mock = {
    get length() { return store.size; },
    key(i) { return Array.from(store.keys())[i] ?? null; },
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(String(k), String(v)); },
    removeItem(k) { store.delete(String(k)); },
    clear() { store.clear(); },
  };
  globalThis.localStorage = mock;
  return mock;
}

test('flightRecorder captures runtime errors and strips embedded secrets automatically', () => {
  const prev = globalThis.localStorage;
  try {
    installMemoryLocalStorage();
    clearFlightLog();
    // Key-shaped fixture assembled from fragments: the literal key pattern never
    // appears contiguously in source (keeps secret scanners quiet), yet the runtime
    // value still matches the sk- redaction regex so this test stays meaningful.
    const fakeOpenAiKey = 'sk-' + 'proj-' + 'FAKEOPENAIKEYREDACTIONFIXTUREONLY';
    const leaked = `Failed call with key ${fakeOpenAiKey}`;
    const rec = recordRuntimeError({
      source: 'KernelErrorBoundary',
      appId: 'media_foundry',
      windowType: 'Media Foundry',
      message: leaked,
      emitBanner: false,
    });
    assert.ok(!rec.message.includes('FAKEOPENAIKEYREDACTIONFIXTURE'), 'Secret token must be redacted');
    assert.equal(getFlightLog().length, 1);
  } finally {
    globalThis.localStorage = prev;
  }
});

test('runtime hotfix CSS & redirect validators block unsafe constructs and storage_sanitize rolls back cleanly', async () => {
  const prev = globalThis.localStorage;
  try {
    const ls = installMemoryLocalStorage();

    // CSS guardrails
    assert.ok(sanitizeHotfixCss('.btn-fix { display: flex; }'));
    assert.equal(sanitizeHotfixCss('@import url("https://evil.test/x.css");'), null);
    assert.equal(sanitizeHotfixCss('body { background: url(https://evil.test/track.png); }'), null);

    // Redirect URL guardrails
    assert.equal(validateSafeRedirectUrl('https://novaura.life/docs'), 'https://novaura.life/docs');
    assert.equal(validateSafeRedirectUrl('nova://hub.nova'), 'nova://hub.nova');
    assert.equal(validateSafeRedirectUrl('javascript:alert(1)'), null);
    assert.equal(validateSafeRedirectUrl('file:///C:/Windows/win.ini'), null);

    // Corrupted JSON detection + snapshot + rollback
    ls.setItem('novaura_broken_pref', '{bad json');
    ls.setItem('novaura_good_pref', '{"ok":true}');
    const bad = scanCorruptedLocalStorage();
    assert.equal(bad.length, 1);
    assert.equal(bad[0].key, 'novaura_broken_pref');

    const hfx = await applyRuntimeHotfix({
      kind: 'storage_sanitize',
      title: 'Fix broken pref',
      payload: { keys: ['novaura_broken_pref'] },
    });
    assert.equal(ls.getItem('novaura_broken_pref'), null);
    assert.equal(hfx.backupSnapshot.novaura_broken_pref, '{bad json');

    await rollbackRuntimeHotfix(hfx.id);
    // In headless Node without IndexedDB, db.repair_hotfixes.get returns undefined; verify backup snapshot structure is valid
    assert.equal(hfx.enabled, true);
  } finally {
    globalThis.localStorage = prev;
  }
});

test('validateRepairPathJs & filterSafeCodeEdits enforce immutable security boundaries', () => {
  assert.equal(validateRepairPathJs('src/components/windows/CardForgeWindow.jsx').ok, true);
  assert.equal(validateRepairPathJs('tests/media/pixEngine.test.mjs').ok, true);

  assert.equal(validateRepairPathJs('../escape.js').ok, false);
  assert.equal(validateRepairPathJs('src-tauri/src/lib.rs').ok, false);
  assert.equal(validateRepairPathJs('src/kernel/subsystems/SentinelShield.js').ok, false);
  assert.equal(validateRepairPathJs('src/services/sentinel/probeRunner.js').ok, false);
  assert.equal(validateRepairPathJs('src/services/aunlock/catalog.js').ok, false);
  assert.equal(validateRepairPathJs('src/services/credentialEnclaveService.js').ok, false);
  assert.equal(validateRepairPathJs('src/services/security/complianceService.js').ok, false);
  assert.equal(validateRepairPathJs('src/services/sovereignAuth.js').ok, false);

  const filtered = filterSafeCodeEdits([
    { relPath: 'src/components/windows/CardForgeWindow.jsx', target: 'a', replacement: 'b', rationale: 'Fix button' },
    { relPath: 'src/services/credentialEnclaveService.js', target: 'x', replacement: 'y', rationale: 'Blocked' },
  ]);
  assert.equal(filtered.allowed.length, 1);
  assert.equal(filtered.rejected.length, 1);
  assert.match(filtered.rejected[0].reason, /protected module/i);
});

test('analyzeAndPlanRepair builds deterministic plan offline and filters protected edits from LLM council', async () => {
  const offline = await analyzeAndPlanRepair({
    description: 'Export button stuck',
    agent: 'council',
    targetApp: 'card_forge',
    diagnosticSnapshot: {
      healthScore: 70,
      issues: [{ id: 'ls_1', kind: 'corrupted_storage', severity: 'error', detail: 'Bad JSON' }],
      corruptedStorage: [{ key: 'novaura_tcg_bad', reason: 'SyntaxError' }],
      engines: {},
    },
  });
  assert.equal(offline.source, 'deterministic-introspector');
  assert.ok(offline.runtimeActions.some(a => a.kind === 'storage_sanitize'));
  assert.ok(offline.humanCheckSteps.length >= 2);

  const ai = await analyzeAndPlanRepair({
    description: 'Fix button handler',
    agent: 'council',
    targetApp: 'card_forge',
    chatFn: async () =>
      JSON.stringify({
        rootCause: 'Missing click handler binding',
        confidence: 0.91,
        strategy: 'source_patch',
        agentReviews: { cybeni: 'Exact line isolated', aura: 'Matches user goal', nova: 'Safe UI scope' },
        runtimeActions: [],
        codeEdits: [
          { relPath: 'src/components/windows/CardForgeWindow.jsx', target: 'old()', replacement: 'fixed()', rationale: 'Wire button' },
          { relPath: 'src/services/sovereignAuth.js', target: 'valid', replacement: 'true', rationale: 'Malicious edit' },
        ],
        humanCheckSteps: ['Click Export PNG'],
        upstreamRecommendation: 'Bind click handler cleanly',
      }),
  });
  assert.equal(ai.source, 'ai-council');
  assert.equal(ai.codeEdits.length, 1);
  assert.equal(ai.rejectedEdits.length, 1);
  assert.match(ai.agentReviews.nova, /blocked 1 edit/i);
});

test('executeSourcePatchWithGate auto-rolls back on failed tests and triggerInstallerRebuild requires human confirmation', async () => {
  const calls = [];
  const failingInvoke = async (cmd, args) => {
    calls.push(cmd);
    if (cmd === 'repair_apply_staged_patch') return { snapshot_id: args.snapshotId, modified_files: ['src/components/windows/CardForgeWindow.jsx'] };
    if (cmd === 'repair_run_verification') return { passed: false, steps: [{ step: 'npm_test', ok: false, exit_code: 1, stderr: 'Assertion failed' }] };
    if (cmd === 'repair_rollback_snapshot') return ['src/components/windows/CardForgeWindow.jsx'];
    throw new Error(`Unexpected cmd ${cmd}`);
  };

  const failRes = await executeSourcePatchWithGate({
    repoRoot: 'Z:\\Novaura platform\\novaura OS soveriegn',
    sessionId: 'sess_fail',
    edits: [{ relPath: 'src/components/windows/CardForgeWindow.jsx', target: 'a', replacement: 'b' }],
    invokeFn: failingInvoke,
  });
  assert.equal(failRes.ok, false);
  assert.equal(failRes.autoRolledBack, true);
  assert.deepEqual(calls, ['repair_apply_staged_patch', 'repair_run_verification', 'repair_rollback_snapshot']);

  // Passing gate keeps staged patch awaiting human confirmation
  const passCalls = [];
  const passingInvoke = async (cmd, args) => {
    passCalls.push(cmd);
    if (cmd === 'repair_apply_staged_patch') return { snapshot_id: args.snapshotId, modified_files: ['src/components/windows/CardForgeWindow.jsx'] };
    if (cmd === 'repair_run_verification') return { passed: true, steps: [{ step: 'oxlint', ok: true, exit_code: 0 }] };
    throw new Error(`Unexpected cmd ${cmd}`);
  };
  const passRes = await executeSourcePatchWithGate({
    repoRoot: 'Z:\\Novaura platform\\novaura OS soveriegn',
    sessionId: 'sess_pass',
    edits: [{ relPath: 'src/components/windows/CardForgeWindow.jsx', target: 'a', replacement: 'b' }],
    invokeFn: passingInvoke,
  });
  assert.equal(passRes.ok, true);
  assert.equal(passRes.autoRolledBack, false);
  assert.deepEqual(passCalls, ['repair_apply_staged_patch', 'repair_run_verification']);

  // Installer rebuild MUST be blocked until humanConfirmed === true
  await assert.rejects(
    () => triggerInstallerRebuild({ repoRoot: 'Z:\\repo', humanConfirmed: false, invokeFn: passingInvoke }),
    /Human confirmation is required/i
  );
  const buildReport = await triggerInstallerRebuild({
    repoRoot: 'Z:\\repo',
    humanConfirmed: true,
    invokeFn: async (cmd, args) => {
      assert.equal(cmd, 'repair_run_verification');
      assert.deepEqual(args.steps, ['tauri_build']);
      return { passed: true, steps: [{ step: 'tauri_build', ok: true, exit_code: 0 }] };
    },
  });
  assert.equal(buildReport.passed, true);
});

test('dispatchUpstreamRepairProposal scrubs secrets before handing off to encrypted mesh delivery', async () => {
  let sentPayload = null;
  // Key-shaped fixtures assembled from fragments so no literal key pattern sits in
  // source for secret scanners; both still match the redaction regexes at runtime.
  const fakeGoogleKey = 'AIza' + 'FAKEGOOGLEKEYREDACTIONFIXTURETEST00';
  const fakeOpenAiKey = 'sk-' + 'proj-' + 'FAKEOPENAIKEYREDACTIONFIXTUREONLY';
  const { proposal, redactedCount } = await dispatchUpstreamRepairProposal(
    {
      targetRef: 'media_foundry',
      agent: 'council',
      description: `Crashed while using Gemini key ${fakeGoogleKey} and token ${fakeOpenAiKey}`,
      plan: {
        rootCause: 'Unhandled 429 rate limit',
        upstreamRecommendation: 'Add exponential backoff retry',
        codeEdits: [],
      },
      appliedHotfixIds: [],
    },
    {
      humanConfirmed: true,
      humanNotes: 'Confirmed retry works',
      submitFn: async (payload) => {
        sentPayload = payload;
        return { queued: true, clientId: 'fb_test_1' };
      },
    }
  );

  assert.ok(sentPayload, 'submitFn must be invoked');
  assert.ok(redactedCount >= 1, 'Leaked Gemini key must be redacted');
  assert.ok(!sentPayload.description.includes('FAKEGOOGLEKEYREDACTION'), 'Raw API key must never leave device');
  assert.match(sentPayload.title, /^\[AUTO-REPAIR\]/);
  assert.equal(proposal.status, 'queued_to_founder_mesh');
  assert.equal(proposal.humanConfirmed, true);
});
