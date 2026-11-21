// repairOrchestrator.js — 3-Agent (Cybeni / Aura / Nova) Automated Repair Orchestrator,
// Opt-In Source-Attached Staged Patch + Test/Build Gate + Snapshot Rollback,
// Cybeni User-App Auto-Patcher, and Secret-Redacted Encrypted Upstream Distro Proposals.

import { db } from '../../database/sovereignDatabase.js';
import { scanAndRedactOutboundSecrets } from '../security/complianceService.js';
import { isTauriApp, popOutApp } from '../popoutWindows.js';
import { applyRuntimeHotfix, rollbackRuntimeHotfix } from './flightRecorder.js';

export const REPAIR_AGENTS = [
  { id: 'council', label: 'Full 3-Agent Council (Cybeni + Aura + Nova)', role: 'Deep diagnosis + UX intent + Security audit' },
  { id: 'cybeni', label: 'Cybeni (Lead Engineer)', role: 'Stack traces, broken handlers, code patches & test gates' },
  { id: 'aura', label: 'Aura (UX & Intent Specialist)', role: 'Broken flows, confusing UI, layout & workflow alignment' },
  { id: 'nova', label: 'Nova (Security & Stability Architect)', role: 'Blast-radius guardrails, daemon health & safe rollback' },
];

// JS mirror of src-tauri/src/repair_rules.rs protected security boundaries (keep in sync)
const PROTECTED_PATH_FRAGMENTS = [
  'sentinel',
  'aunlock',
  'credentialenclave',
  'complianceservice',
  'securitycompliance',
  'sovereignauth',
  // auth / identity / trust core (precise fragments — bare "auth"/"mesh"/"crypto" would wrongly
  // block feature files like AICoAuthorPanel, MeshWaterBackground, or the crypto price tracker)
  'interappsecuritybroker',
  'authsubsystem',
  'decentralizedauth',
  'founderauth',
  'novaauth',
  'meshcrypto',
  'trustedauthorities',
  'license',
  'cloud.rs',
  'password.rs',
  'preview.rs',
  'main.rs',
  'lib.rs',
  'profiles.rs',
  'betafeedback.js',
  'sovereignmesh.js',
  '.env',
  '.git',
];

const ALLOWED_TOP_DIRS = new Set(['src', 'tests', 'public']);

/** Validate whether a relative file path is allowed for automated source patching. */
export function validateRepairPathJs(relPath) {
  const raw = String(relPath || '').trim().replace(/\\/g, '/');
  if (!raw) return { ok: false, reason: 'Empty relative path.' };
  if (raw.startsWith('/') || raw.includes(':') || raw.includes('..')) {
    return { ok: false, reason: 'Absolute path or parent traversal rejected.' };
  }
  const parts = raw.split('/').filter(Boolean);
  if (parts.length < 2 || !ALLOWED_TOP_DIRS.has(parts[0])) {
    return { ok: false, reason: `Path "${raw}" is outside allowed directories (src/, tests/, public/).` };
  }
  if (parts.some(p => p.startsWith('.'))) {
    return { ok: false, reason: `Hidden segment in "${raw}" is blocked.` };
  }
  const lower = raw.toLowerCase();
  for (const frag of PROTECTED_PATH_FRAGMENTS) {
    if (lower.includes(frag)) {
      return { ok: false, reason: `Security boundary: "${raw}" matches protected module "${frag}".` };
    }
  }
  return { ok: true, normalized: parts.join('/') };
}

/** Partition AI-suggested code edits into safe allowed edits vs security-rejected edits. */
export function filterSafeCodeEdits(edits = []) {
  const allowed = [];
  const rejected = [];
  for (const edit of Array.isArray(edits) ? edits : []) {
    const check = validateRepairPathJs(edit?.relPath || edit?.rel_path);
    if (!check.ok) {
      rejected.push({ ...edit, reason: check.reason });
      continue;
    }
    if (!edit?.target || typeof edit.target !== 'string') {
      rejected.push({ ...edit, reason: 'Missing exact target snippet.' });
      continue;
    }
    allowed.push({
      relPath: check.normalized,
      target: edit.target,
      replacement: String(edit.replacement ?? ''),
      rationale: String(edit.rationale || 'Targeted repair edit').slice(0, 240),
    });
  }
  return { allowed, rejected };
}

/** Launch the Repair Studio detached in its own native pop-out window (Tauri) or desktop window (web). */
export async function launchRepairPopout(props = {}) {
  if (isTauriApp()) {
    try {
      return await popOutApp('sovereign_repair', {
        props,
        title: 'Sovereign Auto-Repair Studio (Cybeni · Aura · Nova)',
        size: { width: 1080, height: 720 },
      });
    } catch {
      // Fallback to in-desktop window if popout creation is blocked
    }
  }
  if (typeof window !== 'undefined') {
    const payload = { ...props, openId: `rep_${Date.now().toString(36)}` };
    window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: { appId: 'sovereign_repair', props: payload, toggle: false } }));
    window.dispatchEvent(new CustomEvent('novaura:app_context', { detail: { appId: 'sovereign_repair', props: payload } }));
  }
  return 'in-desktop';
}

/**
 * Deterministic diagnostic planner (runs cleanly even with zero LLM loaded) + optional
 * 3-Agent LLM reasoning via `chatFn` (Ollama / LM Studio / Built-in AI / BYOK Cloud).
 */
export async function analyzeAndPlanRepair({
  description = '',
  agent = 'council',
  targetApp = 'desktop',
  crashEvent = null,
  diagnosticSnapshot = null,
  sourceFilePath = '',
  sourceContent = '',
  chatFn = null,
} = {}) {
  const issues = diagnosticSnapshot?.issues || [];
  const corrupted = diagnosticSnapshot?.corruptedStorage || [];
  const engines = diagnosticSnapshot?.engines || {};

  // Build deterministic Tier-1 runtime actions from live telemetry
  const deterministicActions = [];
  if (corrupted.length > 0) {
    deterministicActions.push({
      kind: 'storage_sanitize',
      title: `Backup & repair ${corrupted.length} corrupted localStorage key(s)`,
      targetApp,
      payload: { keys: corrupted.map(c => c.key) },
    });
  }
  if (issues.some(i => i.kind === 'crashed_window' || i.kind === 'offscreen_window') || crashEvent) {
    deterministicActions.push({
      kind: 'window_recover',
      title: `Recover & recenter "${targetApp}" window cleanly`,
      targetApp,
      payload: {},
    });
  }
  if (engines.comfy === 'offline' && /image|comfy|music|video|render/i.test(description)) {
    deterministicActions.push({
      kind: 'engine_reconnect',
      title: 'Reset ComfyUI endpoint cache & trigger fresh local engine probe',
      targetApp,
      payload: { resetEndpoint: true },
    });
  }

  const fallbackPlan = {
    source: 'deterministic-introspector',
    agent,
    rootCause:
      crashEvent?.message ||
      issues[0]?.detail ||
      `User-reported issue in ${targetApp}: ${String(description || 'Unspecified glitch').slice(0, 220)}`,
    confidence: deterministicActions.length > 0 ? 0.78 : 0.62,
    strategy: sourceContent ? 'source_patch' : deterministicActions.length > 0 ? 'runtime_hotfix' : 'upstream_proposal',
    agentReviews: {
      cybeni: crashEvent?.stack
        ? `Captured runtime stack trace in ${targetApp}. Ready to stage a minimal code fix if source checkout is attached, or package exact reproduction telemetry.`
        : `Inspected ${issues.length} live environment signals across DOM, storage, and local engines.`,
      aura: `Prioritizing immediate user recovery in "${targetApp}" while preserving user data and asking for human confirmation before finalizing.`,
      nova: `Verified all suggested actions obey Sovereign's immutable security boundary (zero touches to Sentinel, Auth, Enclave, or Cloud egress).`,
    },
    runtimeActions: deterministicActions,
    codeEdits: [],
    rejectedEdits: [],
    humanCheckSteps: [
      `Re-open or interact with "${targetApp}" and trigger the button, link, or flow that previously failed.`,
      'Confirm there are no red error banners, blank panels, or stuck controls.',
      'Click "Confirm Fix Worked" below to keep the fix and dispatch a secret-redacted patch suggestion to the main distro (or "Roll Back" to restore immediately).',
    ],
    upstreamRecommendation: `[${targetApp}] ${crashEvent?.message || description.slice(0, 200) || 'Environment anomaly'} — recommended permanent guard & regression test in main Sovereign distro.`,
  };

  if (typeof chatFn !== 'function') return fallbackPlan;

  try {
    const prompt = [
      `You are the Sovereign OS Self-Repair Council (Cybeni = code/stack engineer, Aura = UX/intent specialist, Nova = security/stability gatekeeper). Active lead: ${agent}.`,
      `User Report (Target App: ${targetApp}): "${String(description || '').slice(0, 1200)}"`,
      crashEvent ? `Captured Crash: ${crashEvent.message}\nStack: ${String(crashEvent.stack || '').slice(0, 900)}` : '',
      `Live Introspection (Health ${diagnosticSnapshot?.healthScore ?? 'N/A'}/100):`,
      issues.length ? issues.slice(0, 10).map(i => `- [${i.severity}] ${i.kind}: ${i.detail}`).join('\n') : '- No DOM/storage anomalies flagged automatically.',
      sourceFilePath && sourceContent
        ? `\nATTACHED SOURCE FILE (${sourceFilePath}):\n${sourceContent.slice(0, 6000)}`
        : '',
      '',
      'Return ONLY valid JSON with this exact shape (no markdown fences):',
      '{"rootCause":"clear root cause","confidence":0.86,"strategy":"runtime_hotfix|source_patch|upstream_proposal","agentReviews":{"cybeni":"...","aura":"...","nova":"..."},"runtimeActions":[{"kind":"storage_sanitize|window_recover|css_hotfix|link_redirect|engine_reconnect","title":"...","payload":{}}],"codeEdits":[{"relPath":"src/...","target":"exact existing snippet","replacement":"fixed snippet","rationale":"why"}],"humanCheckSteps":["step 1","step 2"],"upstreamRecommendation":"concise patch summary for the main Sovereign distro maintainer"}',
    ].filter(Boolean).join('\n');

    const raw = await chatFn([
      { role: 'system', content: 'Return strictly valid JSON only. Never propose edits to sentinel, aunlock, credentialEnclave, complianceService, sovereignAuth, or cloud.rs.' },
      { role: 'user', content: prompt },
    ]);

    const match = String(raw || '').match(/\{[\s\S]*\}/);
    if (!match) return fallbackPlan;
    const parsed = JSON.parse(match[0]);
    const { allowed, rejected } = filterSafeCodeEdits(parsed.codeEdits || []);

    const validRuntimeKinds = new Set(['storage_sanitize', 'window_recover', 'css_hotfix', 'link_redirect', 'engine_reconnect']);
    const aiRuntimeActions = (Array.isArray(parsed.runtimeActions) ? parsed.runtimeActions : [])
      .filter(a => a && validRuntimeKinds.has(a.kind))
      .map(a => ({
        kind: a.kind,
        title: String(a.title || a.kind).slice(0, 120),
        targetApp,
        payload: a.payload && typeof a.payload === 'object' ? a.payload : {},
      }));

    return {
      ...fallbackPlan,
      source: 'ai-council',
      rootCause: String(parsed.rootCause || fallbackPlan.rootCause),
      confidence: Math.max(0.1, Math.min(0.99, Number(parsed.confidence) || fallbackPlan.confidence)),
      strategy: allowed.length > 0 ? 'source_patch' : (aiRuntimeActions.length > 0 ? 'runtime_hotfix' : (parsed.strategy || fallbackPlan.strategy)),
      agentReviews: {
        cybeni: String(parsed.agentReviews?.cybeni || fallbackPlan.agentReviews.cybeni),
        aura: String(parsed.agentReviews?.aura || fallbackPlan.agentReviews.aura),
        nova: rejected.length > 0
          ? `${String(parsed.agentReviews?.nova || '')} [Nova blocked ${rejected.length} edit(s) touching protected security files.]`.trim()
          : String(parsed.agentReviews?.nova || fallbackPlan.agentReviews.nova),
      },
      runtimeActions: aiRuntimeActions.length > 0 ? aiRuntimeActions : deterministicActions,
      codeEdits: allowed,
      rejectedEdits: rejected,
      humanCheckSteps: Array.isArray(parsed.humanCheckSteps) && parsed.humanCheckSteps.length
        ? parsed.humanCheckSteps.map(String).slice(0, 5)
        : fallbackPlan.humanCheckSteps,
      upstreamRecommendation: String(parsed.upstreamRecommendation || fallbackPlan.upstreamRecommendation),
    };
  } catch {
    return fallbackPlan;
  }
}

// ── SOURCE-ATTACHED STAGED PATCH, AUTOMATED GATE & ROLLBACK (TIER 2) ─────────

export async function readSourceFileNative(repoRoot, relPath) {
  const check = validateRepairPathJs(relPath);
  if (!check.ok) throw new Error(check.reason);
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke('repair_read_source', { repoRoot, relPath: check.normalized });
}

/**
 * Apply staged code edits inside an opt-in local Sovereign repo, immediately run
 * automated verification gates (`oxlint` + `npm_test` + `vite_build`), and
 * AUTOMATICALLY ROLL BACK the snapshot if ANY verification gate fails!
 */
export async function executeSourcePatchWithGate({
  repoRoot,
  sessionId,
  edits,
  verifySteps = ['oxlint', 'npm_test'],
  invokeFn = null,
  onStatus,
}) {
  const { allowed, rejected } = filterSafeCodeEdits(edits);
  if (rejected.length > 0) {
    throw new Error(`Security boundary blocked ${rejected.length} edit(s): ${rejected[0].reason}`);
  }
  if (!allowed.length) {
    throw new Error('No valid source edits to stage.');
  }

  const runInvoke = invokeFn || (await import('@tauri-apps/api/core')).invoke;
  const snapshotId = `snap_${String(sessionId || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '')}`.slice(0, 48);

  onStatus?.('Creating pre-patch snapshot & staging source edits…');
  const staged = await runInvoke('repair_apply_staged_patch', {
    repoRoot,
    snapshotId,
    edits: allowed.map(e => ({
      rel_path: e.relPath,
      target: e.target,
      replacement: e.replacement,
    })),
  });

  onStatus?.(`Running hard verification gate (${verifySteps.join(' → ')})…`);
  const verification = await runInvoke('repair_run_verification', {
    repoRoot,
    steps: verifySteps,
    changedFiles: staged.modified_files || allowed.map(e => e.relPath),
  });

  if (!verification?.passed) {
    onStatus?.('Verification gate failed — automatically rolling back pre-patch snapshot…');
    await runInvoke('repair_rollback_snapshot', { repoRoot, snapshotId });
    return {
      ok: false,
      autoRolledBack: true,
      snapshotId,
      modifiedFiles: staged.modified_files || [],
      verification,
    };
  }

  return {
    ok: true,
    autoRolledBack: false,
    snapshotId,
    modifiedFiles: staged.modified_files || [],
    verification,
  };
}

export async function rollbackSourcePatch({ repoRoot, snapshotId, invokeFn = null }) {
  const runInvoke = invokeFn || (await import('@tauri-apps/api/core')).invoke;
  return runInvoke('repair_rollback_snapshot', { repoRoot, snapshotId });
}

export async function triggerInstallerRebuild({ repoRoot, humanConfirmed = false, invokeFn = null }) {
  if (!humanConfirmed) {
    throw new Error('Human confirmation is required before rebuilding the desktop installer.');
  }
  const runInvoke = invokeFn || (await import('@tauri-apps/api/core')).invoke;
  return runInvoke('repair_run_verification', {
    repoRoot,
    steps: ['tauri_build'],
    changedFiles: [],
  });
}

// ── SESSION PERSISTENCE & ENCRYPTED UPSTREAM FOUNDER PROPOSALS (TIER 3) ──────

export async function saveRepairSession(session) {
  const record = {
    id: session.id || `rep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    status: session.status || 'diagnosed',
    agent: session.agent || 'council',
    targetKind: session.targetKind || 'os_window',
    targetRef: session.targetRef || 'desktop',
    description: session.description || '',
    plan: session.plan || null,
    appliedHotfixIds: session.appliedHotfixIds || [],
    snapshotId: session.snapshotId || null,
    verification: session.verification || null,
    humanConfirmed: session.humanConfirmed ?? null,
    humanNotes: session.humanNotes || '',
    upstreamClientId: session.upstreamClientId || null,
    createdAt: session.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  try {
    await db.repair_sessions.put(record);
  } catch {}
  return record;
}

export async function listRepairSessions() {
  try {
    return (await db.repair_sessions.toArray()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch {
    return [];
  }
}

/** Apply all Tier-1 runtime actions in a repair plan cleanly and track IDs for 1-click rollback. */
export async function applyPlannedRuntimeActions(actions = []) {
  const applied = [];
  for (const act of actions) {
    const rec = await applyRuntimeHotfix(act);
    applied.push(rec);
  }
  return applied;
}

export async function rollbackSessionHotfixes(hotfixIds = []) {
  for (const id of hotfixIds) {
    await rollbackRuntimeHotfix(id);
  }
}

/**
 * Redact all secrets and send an End-to-End Encrypted Upstream Main-Distro Repair Proposal
 * directly to the Founder Profile over the Sovereign Mesh (via betaFeedbackService).
 */
export async function dispatchUpstreamRepairProposal(
  session,
  { humanConfirmed = false, humanNotes = '', submitFn = null } = {}
) {
  const rawBody = [
    `[SOVEREIGN AUTO-REPAIR UPSTREAM PROPOSAL]`,
    `Target App: ${session.targetRef || 'desktop'}`,
    `Lead Agent: ${session.agent || 'council'}`,
    `Human Verification: ${humanConfirmed ? 'CONFIRMED WORKING' : 'UNCONFIRMED / WORKAROUND REPORT'}`,
    humanNotes ? `Human Tester Notes: ${humanNotes}` : '',
    `User Report: ${session.description || ''}`,
    `Root Cause: ${session.plan?.rootCause || 'Unknown'}`,
    `Main Distro Recommendation: ${session.plan?.upstreamRecommendation || ''}`,
    session.plan?.codeEdits?.length
      ? `Proposed Code Edits (${session.plan.codeEdits.length} file(s)):\n${session.plan.codeEdits
          .map(e => `--- ${e.relPath} (${e.rationale})\n- TARGET: ${e.target.slice(0, 240)}\n+ REPLACE: ${e.replacement.slice(0, 240)}`)
          .join('\n')}`
      : 'Applied Tier-1 Runtime Actions: ' + (session.appliedHotfixIds?.length || 0),
  ]
    .filter(Boolean)
    .join('\n\n');

  // Mandatory SOC 2 secret redaction before leaving the user's node
  const redacted = scanAndRedactOutboundSecrets([{ role: 'user', content: rawBody }]);
  const safeDescription = redacted.messages[0]?.content || rawBody;
  const safeTitle = `[AUTO-REPAIR] ${session.targetRef || 'OS'}: ${String(session.plan?.rootCause || session.description || 'Fix proposal').slice(0, 110)}`;

  const systemInfo = {
    os: typeof navigator !== 'undefined' ? navigator.platform : 'node',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'node',
  };

  const deliver = submitFn || (await import('../betaFeedbackService.js')).submitBetaFeedback;
  const delivery = await deliver({
    title: safeTitle,
    description: safeDescription,
    category: 'auto_repair_proposal',
    severity: humanConfirmed ? 'medium' : 'high',
    systemInfo,
  });

  const proposal = {
    id: `prop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    clientId: delivery?.clientId || `prop_${Date.now()}`,
    direction: 'outbound',
    status: delivery?.queued ? 'queued_to_founder_mesh' : 'saved_local',
    severity: humanConfirmed ? 'verified_fix' : 'needs_distro_fix',
    title: safeTitle,
    summary: safeDescription,
    redactedSecretsCount: redacted.redactedCount || 0,
    targetApp: session.targetRef || 'desktop',
    codeEdits: session.plan?.codeEdits || [],
    humanConfirmed: Boolean(humanConfirmed),
    createdAt: Date.now(),
  };

  try {
    await db.repair_proposals.put(proposal);
  } catch {}

  return { proposal, delivery, redactedCount: redacted.redactedCount || 0 };
}

/**
 * Load both local outbound repair proposals and any received `[AUTO-REPAIR]` reports
 * decrypted in `db.node_feedback` on the Founder's profile node for Main Distro Triage.
 */
export async function loadUpstreamProposals() {
  const proposals = [];
  try {
    const local = await db.repair_proposals.toArray();
    proposals.push(...local);
  } catch {}
  try {
    const feedback = await db.node_feedback.toArray();
    for (const fb of feedback) {
      if (fb.category === 'auto_repair_proposal' || String(fb.title || '').startsWith('[AUTO-REPAIR]')) {
        if (!proposals.some(p => p.clientId === fb.clientId)) {
          proposals.push({
            id: `fb_${fb.id || fb.clientId}`,
            clientId: fb.clientId,
            direction: fb.receivedAt ? 'inbound_from_user' : 'outbound',
            status: fb.synced ? 'delivered_confirmed' : (fb.deliveryStatus || 'queued'),
            severity: fb.severity || 'medium',
            title: fb.title,
            summary: fb.description,
            targetApp: 'sovereign',
            createdAt: Date.parse(fb.createdAt || '') || Date.now(),
          });
        }
      }
    }
  } catch {}
  return proposals.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
