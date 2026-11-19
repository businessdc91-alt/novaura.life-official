// probe.js — the Sentinel Probe orchestrator for the safety foundation. runProbe wires the
// whole loop together and proves it with a trivial echo check, while enforcing every wall:
//
//   1. Ownership gate   — resolveTarget; a target that isn't proven owned is refused here.
//   2. Scope token      — mint, then verify our OWN token; if it does not verify, refuse.
//   3. Working folder    — a fresh folder under workRoot holds the run's raw observations.
//   4. Runner            — start (inject the fake in tests, the no-egress sandbox in real use);
//                          a start failure ends the run FAILED and stores no findings.
//   5. Echo              — send one echo command, read the observation.
//   6. Redact            — only the served status and header names go into the finding, and
//                          redactFinding is the fail-closed backstop before anything is stored.
//   7. Persist + wipe    — write probe_runs/probe_findings (redacted only), then WIPE the
//                          working folder so no raw observation is left at rest.

import { resolveTarget } from './ownership.js';
import { mintScopeToken, verifyScopeToken } from './scopeToken.js';
import { redactFinding } from './redaction.js';
import { getTargetStore } from './targetStore.js';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const makeRunId = (now) => `run_${now()}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * runProbe({ kind, name, slug, mode = 'safe' }, { runner, now = Date.now, workRoot })
 *   -> { ok: true, runId, findings } | { ok: false, reason, runId? }
 */
export async function runProbe({ kind, name, slug, mode = 'safe' } = {}, { runner, now = Date.now, workRoot } = {}) {
  const store = getTargetStore();

  // 1. Ownership gate — refuse anything not proven owned. Nothing is stored for a refusal.
  const resolved = await resolveTarget({ kind, name, slug });
  if (!resolved.ok) return { ok: false, reason: resolved.reason };
  const target = resolved.target;

  // isStaging is a property of the target (set at registration/attestation), never derived
  // from the run mode — otherwise probing a production target in deep mode would wrongly
  // mark it staging and a future Deep-mode gate would trust that.
  await store.registerTarget({ kind: target.kind, ref: target.ref, name: target.name, isStaging: target.isStaging === true });

  // 2. Scope token — mint then verify our own; refuse if it does not verify.
  const token = mintScopeToken(target, mode, { now });
  const check = verifyScopeToken(token, { now, seenNonces: new Set() });
  if (!check.ok) return { ok: false, reason: `Scope token did not verify: ${check.reason}` };

  // 3. Working folder under workRoot.
  const runId = makeRunId(now);
  const runDir = join(workRoot, runId);
  const ioDir = join(runDir, 'io');
  await mkdir(ioDir, { recursive: true });

  const startedAt = now();

  // 4. Start the runner. A start failure ends the run FAILED, stores no findings, wipes.
  let session;
  try {
    session = await runner.start({ token, contentFiles: target.content.files, ioDir });
  } catch (err) {
    await store.recordRun({ id: runId, targetId: target.id, mode, status: 'failed', startedAt, finishedAt: now() });
    await rm(runDir, { recursive: true, force: true });
    return { ok: false, reason: `Sandbox failed to start: ${err.message}`, runId };
  }

  try {
    try {
      // 5. Echo.
      const n = await session.channel.send({ op: 'echo' });
      const obs = await session.channel.waitObservation(n, { timeoutMs: 30000, pollMs: 300 });

      // 6. Build the finding from ONLY safe fields, then redact (fail-closed backstop).
      const finding = redactFinding({
        id: 'f_echo',
        checkId: 'echo',
        severity: 'info',
        vector: 'GET / on sandbox loopback',
        fix: 'Informational: the sandbox served the target copy and answered on loopback.',
        reproduce: 'Serve the target copy inside the sandbox and GET /.',
        proof: { status: obs.status, headerNames: obs.headers, servedPaths: obs.servedPaths },
      });

      // 7. Persist redacted data.
      await store.recordRun({ id: runId, targetId: target.id, mode, status: 'complete', startedAt, finishedAt: now() });
      await store.recordFindings(runId, [finding]);
      return { ok: true, runId, findings: [{ ...finding, runId }] };
    } catch (err) {
      // A mid-run failure (timeout, send/observe error) ends the run FAILED with a clear
      // reason and no fabricated findings — never an unhandled throw out of runProbe.
      await store.recordRun({ id: runId, targetId: target.id, mode, status: 'failed', startedAt, finishedAt: now() });
      return { ok: false, reason: `Probe run failed: ${err.message}`, runId };
    }
  } finally {
    // The wipe must happen even if stopping the runner fails, so no raw observation is left
    // at rest. stop() is best-effort; the wipe is not.
    try { await runner.stop(session); } catch { /* best effort */ }
    await rm(runDir, { recursive: true, force: true });
  }
}
