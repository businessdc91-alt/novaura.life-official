# Sentinel Probe — Safety Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The safety foundation for Sentinel Probe — the ownership gate, single-use scope token, the no-egress Windows Sandbox runner with its file control channel, fail-closed redaction, and the report data model — proven end to end by a trivial echo check. No real attack checks, host AI planner, or UI yet.

**Architecture:** An owned target is resolved and verified in code, minted into a single-use scope token. The runner copies the target's content into a throwaway Windows Sandbox that has no network egress, serves the copy on sandbox loopback, and runs an executor that answers commands over a mapped-folder channel. Findings are redacted (fail-closed) before anything is stored in new Dexie tables. The echo check proves the whole loop without any attack capability existing yet.

**Tech Stack:** React/Vite + Tauri 2 (Rust), Dexie 4.4 (version 23), `@noble/curves/ed25519.js` (already a dependency), Windows Sandbox (`.wsb` + PowerShell), node:test (`--experimental-test-module-mocks`), Rust pure tests (`npm run tauri:test`).

**Spec:** `docs/superpowers/specs/2026-11-18-sentinel-probe-design.md`

All paths are relative to `novaura OS soveriegn/`. Commands run from there.

## Global Constraints

- **Sovereign only.** Never edit `NovAura-WebOS/`. Never touch `tauri.conf.json`'s version by hand.
- **Ownership is proven before any run.** A mesh target is accepted only when its registry record's owner is the local node key (`novaRegistry.nameStatus(name).state === 'yours'`); a project only when it is in `listProjects()`. Third-party and unverified targets are refused.
- **No network egress from the VM.** The sandbox firewall denies all outbound; the target is a copy served on sandbox loopback. The VM reaches neither the host nor the internet.
- **Redaction is fail-closed.** If a value can't be shown non-sensitive, it is redacted. Redaction runs before any finding is written to the database.
- **No silent isolation downgrade.** If Windows Sandbox is unavailable, the run fails loudly; it never falls back to weaker isolation.
- **Data at rest is redacted.** `probe_runs` / `probe_findings` hold only redacted data; the run's working folder (raw observations) is wiped after the redacted report is collected.
- **Dexie:** add database version 23 (it is 22 today); never blank an existing version.
- **Tooling:** Rust tests only via `npm run tauri:test` (testable Rust goes in Tauri-free `*_rules.rs` included by `src-tauri/pure-tests`); write commit messages to a file with bash `printf` then `git commit -F <file>` (PowerShell adds a BOM); stage only the files named in each task, because Gemini edits the tree in parallel.

## Review Focus

1. **A mesh name owned by another key** must be refused, not probed — ownership is the whole point. Pinned in Task 2.
2. **A forged, expired, or cross-target scope token** must be rejected by verification, so a bug in a caller can't widen scope. Pinned in Task 3.
3. **A value of unknown shape in a finding** must be redacted, not passed through — fail-closed is what keeps data from leaking. Pinned in Task 4.
4. **The working folder with raw observations** must be wiped after a run, so nothing unredacted is left at rest. Pinned in Task 8.
5. **The sandbox failing to start** must end the run with a clear error and persist nothing — no silent downgrade. Pinned in Task 8.

---

### Task 1: Data model and target store

**Files:**
- Modify: `src/database/sovereignDatabase.js` — add version 23 and the three tables + table handles.
- Create: `src/services/sentinel/targetStore.js`
- Create: `tests/sentinel/fakeTable.js` (reuse the shape of `tests/additions/fakeTable.js`: `get`, `put`, `where(idx).equals(x).toArray()`), `tests/sentinel/targetStore.test.mjs`

**Interfaces:**
- Produces: `registerTarget({ kind, ref, name, isStaging = false }) -> target` (id `tgt_<kind>_<ref>`), `listTargets() -> target[]`, `getTarget(id) -> target | null`, `recordRun(run)`, `recordFindings(runId, findings)`, `listRuns()`, `listFindings(runId)`. A `target` is `{ id, kind: 'mesh'|'project', ref, name, isStaging, updatedAt }`.

- [ ] **Step 1: Write the failing tests** in `targetStore.test.mjs` (mock `sovereignDatabase.js` with fake tables): `a target round-trips by id`, `registering the same kind+ref twice updates rather than duplicates`, `a run and its findings are stored and read back`.
- [ ] **Step 2: Run** `node --experimental-test-module-mocks --test tests/sentinel/targetStore.test.mjs`. Expected: ERR_MODULE_NOT_FOUND.
- [ ] **Step 3: Implement** the three tables — `probe_targets: 'id, kind, ref, isStaging, updatedAt'`, `probe_runs: 'id, targetId, mode, status, startedAt, finishedAt'`, `probe_findings: '[runId+id], runId, severity'` — in a `this.version(23).stores({...})` block, add the table handles, and implement `targetStore.js`.
- [ ] **Step 4: Run** the test, then `npm test`. Expected: pass, suite green after the version bump.
- [ ] **Step 5: Commit** `feat(sentinel): probe tables and target store`.

---

### Task 2: Ownership gate

**Files:**
- Create: `src/services/sentinel/ownership.js`
- Test: `tests/sentinel/ownership.test.mjs`

**Interfaces:**
- Consumes: `novaRegistry.nameStatus(raw)` (returns `{ state }`, `'yours'` when owned), `novaRegistry.listMyNames()`, `projectStore.listProjects()`, `projectStore.loadProjectFiles(slug)`.
- Produces: `resolveTarget({ kind, name, slug }) -> { ok: true, target } | { ok: false, reason }`. On success, `target` is `{ id, kind, ref, name, content: { files } }` where `content.files` is the servable copy (from `loadProjectFiles` for a project; for a mesh target, the matching `hosted_sites` content). It never returns content for a target it did not verify as owned.

- [ ] **Step 1: Write the failing tests** (mock `novaRegistry.js` and `projectStore.js`): `an owned mesh name resolves with its content`, `a mesh name owned by another key is refused` (`nameStatus` → `'registered'`), `an unknown mesh name is refused`, `an existing project resolves with its files`, `a non-existent project is refused`, `an unknown kind is refused`.
- [ ] **Step 2: Run it.** Expected: ERR_MODULE_NOT_FOUND.
- [ ] **Step 3: Implement.** For `mesh`, require `nameStatus(name).state === 'yours'` and load the hosted-site content; for `project`, require the slug in `listProjects()` and load its files. Any other case returns `{ ok: false, reason }`.
- [ ] **Step 4: Run it, then `npm test`.** Expected: pass.
- [ ] **Step 5: Commit** `feat(sentinel): ownership gate for mesh and project targets`.

---

### Task 3: Scope token

**Files:**
- Create: `src/services/sentinel/scopeToken.js`
- Test: `tests/sentinel/scopeToken.test.mjs`

**Interfaces:**
- Consumes: `getLocalIdentity()` (`{ publicKey, secretKeyHex }`), `ed25519` from `@noble/curves/ed25519.js`.
- Produces:
  - `canonicalScope({ targetId, mode, nonce, exp }) -> string` (a fixed field order joined by `|`); the sandbox loopback the executor is pinned to is a constant, not part of the token.
  - `mintScopeToken(target, mode, { now = Date.now, ttlMs = 600000 }) -> token` — `token` is `{ targetId, mode, nonce, exp, pub, sig }`, `sig` an ed25519 signature over `canonicalScope` with the node secret, `nonce` 16 random bytes hex;
  - `verifyScopeToken(token, { now = Date.now, seenNonces }) -> { ok, targetId?, mode?, reason? }` — rejects a bad signature, `exp <= now`, a `pub` that is not the local node key, or a `nonce` already in `seenNonces` (then adds it).

- [ ] **Step 1: Write the failing tests:** `a freshly minted token verifies and carries its mode`, `a token with a flipped signature byte is rejected`, `an expired token is rejected`, `a token whose targetId was changed after signing is rejected`, `a token signed by a different key is rejected`, `a nonce already seen is rejected the second time`.
- [ ] **Step 2: Run it.** Expected: ERR_MODULE_NOT_FOUND.
- [ ] **Step 3: Implement** using the existing ed25519 (hex helpers like `novaNames.hexToBytes`/`bytesToHex`).
- [ ] **Step 4: Run it, then `npm test`.** Expected: pass.
- [ ] **Step 5: Commit** `feat(sentinel): single-use signed scope tokens`.

---

### Task 4: Redaction

**Files:**
- Create: `src/services/sentinel/redaction.js`
- Test: `tests/sentinel/redaction.test.mjs`

**Interfaces:**
- Produces:
  - `redactValue(value) -> redacted` — strings matching a secret/PII shape (hex ≥ 32, bearer/JWT, long base64, email, anything key-like) become `'[redacted]'`; objects/arrays recurse; a value whose shape it cannot classify as safe becomes `'[redacted]'` plus a non-sensitive descriptor via `shapeOf`. Safe scalars kept: small integers, booleans, short enum-like strings (header names, HTTP methods, status text).
  - `shapeOf(value) -> string` — e.g. `'object: 14 fields'`, `'string: 2048 chars'`, `'array: 30 items'`.
  - `redactFinding(finding) -> finding` — redacts `proof` and `where`, leaves `vector`, `severity`, `checkId`, `fix`, `reproduce` (which are authored by the planner, not copied from the target).

- [ ] **Step 1: Write the failing tests:** `a hex key, a bearer token, a JWT and a long base64 blob are all redacted`, `an email and a record body are redacted`, `a response body nested in proof is replaced with its shape`, `an object of unknown shape is redacted, not passed through`, `status codes, header names and the fix text survive`, `redactFinding leaves vector and fix but strips proof`.
- [ ] **Step 2: Run it.** Expected: ERR_MODULE_NOT_FOUND.
- [ ] **Step 3: Implement**, fail-closed: the default for an unclassified value is to redact.
- [ ] **Step 4: Run it, then `npm test`.** Expected: pass.
- [ ] **Step 5: Commit** `feat(sentinel): fail-closed redaction`.

---

### Task 5: Sandbox runner rules (Rust, pure) and the in-sandbox scripts

**Files:**
- Create: `src-tauri/src/sentinel_runner_rules.rs`; Modify: `src-tauri/pure-tests/src/lib.rs`
- Create: `src/services/sentinel/toolkit/startup.ps1`, `src/services/sentinel/toolkit/executor.ps1` (static scripts copied into the sandbox; their behavior is proven in Task 9's live check, not in CI)

**Interfaces:**
- Produces (pure Rust):
  - `pub fn wsb_config(in_dir: &str, io_dir: &str) -> String` — a `.wsb` that maps `in_dir` read-only and `io_dir` read-write into fixed sandbox paths and sets a `LogonCommand` that runs `startup.ps1` from the mapped `in` folder;
  - `pub fn validate_run_dir(path: &str) -> Result<(), String>` — the working dir must be absolute, contain no `..`, and sit under the OS temp area;
  - `pub fn channel_name(kind: &str, n: u32) -> String` and `pub fn parse_channel_name(name: &str) -> Option<(String, u32)>` — `cmd-<n>.json` / `obs-<n>.json`.
- `startup.ps1`: set Windows Firewall outbound default to **Block** with no allow rules, start a loopback static server over the mapped target-content folder, then launch `executor.ps1`.
- `executor.ps1`: poll the mapped `io` folder for `cmd-<n>.json`, run the one command the foundation supports (`echo`: `Invoke-WebRequest` the loopback root, capture status + response headers), write `obs-<n>.json`.

- [ ] **Step 1: Write the failing pure tests** in `sentinel_runner_rules.rs` `#[cfg(test)]`: `the wsb maps both folders and runs startup`, `a run dir with .. is refused`, `an absolute temp run dir is accepted`, `channel names round-trip and a foreign name is rejected`.
- [ ] **Step 2: Run** `npm run tauri:test`. Expected: it does not compile.
- [ ] **Step 3: Implement** the rules; add `#[path = "../../src/sentinel_runner_rules.rs"] pub mod sentinel_runner_rules;` to pure-tests; write the two PowerShell scripts.
- [ ] **Step 4: Run** `npm run tauri:test` and `npm run tauri:check`. Expected: pure tests pass, check clean.
- [ ] **Step 5: Commit** `feat(sentinel): sandbox runner rules and in-sandbox scripts`.

---

### Task 6: File control channel (host side)

**Files:**
- Create: `src/services/sentinel/channel.js`
- Test: `tests/sentinel/channel.test.mjs` (uses a real temp dir under the OS temp area)

**Interfaces:**
- Consumes: `channel_name` semantics from Task 5 (`cmd-<n>.json` / `obs-<n>.json`).
- Produces: `createChannel(ioDir) -> { send(command) -> n, waitObservation(n, { timeoutMs, pollMs }) -> observation, close() }`. `send` writes the next `cmd-<n>.json` and returns `n`; `waitObservation` polls for `obs-<n>.json`, parses it, and resolves (or rejects on timeout).

- [ ] **Step 1: Write the failing tests:** `a command is written and its matching observation is read back`, `observations are matched to their own command number`, `waiting past the timeout rejects`.
- [ ] **Step 2: Run it.** Expected: ERR_MODULE_NOT_FOUND.
- [ ] **Step 3: Implement** over `node:fs/promises` with a temp dir; the test simulates the executor by writing `obs-<n>.json`.
- [ ] **Step 4: Run it, then `npm test`.** Expected: pass.
- [ ] **Step 5: Commit** `feat(sentinel): file control channel`.

---

### Task 7: ProbeRunner interface, fake runner, and the Windows Sandbox runner

**Files:**
- Create: `src/services/sentinel/runner/probeRunner.js` (the interface + `createFakeRunner`), `src/services/sentinel/runner/windowsSandboxRunner.js`
- Create: `src-tauri/src/sentinel_runner.rs`; Modify: `src-tauri/src/lib.rs` (register commands)
- Test: `tests/sentinel/fakeRunner.test.mjs`

**Interfaces:**
- Consumes: the channel (Task 6), the runner rules commands (Task 5).
- Produces: a runner is `{ start({ token, contentFiles, ioDir }) -> session, stop(session) -> void }` where `session` exposes a `createChannel`-compatible channel. `createFakeRunner()` runs an in-process executor that serves `contentFiles` and answers an `echo` command with `{ status: 200, headers: {...}, servedPaths: [...] }`. `windowsSandboxRunner` writes the content + scripts into `in/`, invokes `sentinel_sandbox_start(inDir, ioDir)` (Tauri), and `stop` invokes `sentinel_sandbox_stop(session)`.
- Produces (Tauri commands, thin): `sentinel_sandbox_start(in_dir, io_dir) -> session_id`, `sentinel_sandbox_stop(session_id)`. They refuse if Windows Sandbox (`WindowsSandbox.exe`) is absent, returning an error the caller surfaces.

- [ ] **Step 1: Write the failing test:** `the fake runner serves content and answers an echo command` — start with two files, send `echo`, assert the observation's status and that the served paths include `index.html`.
- [ ] **Step 2: Run it.** Expected: ERR_MODULE_NOT_FOUND.
- [ ] **Step 3: Implement** the interface, the fake runner, the thin Windows Sandbox runner, and the Tauri commands (registered in `lib.rs`). The real sandbox path is exercised only in Task 9.
- [ ] **Step 4: Run** the test, `npm test`, and `npm run tauri:check`. Expected: pass and clean.
- [ ] **Step 5: Commit** `feat(sentinel): probe runner interface and Windows Sandbox runner`.

---

### Task 8: Orchestrator — runProbe end to end (fake runner)

**Files:**
- Create: `src/services/sentinel/probe.js`
- Test: `tests/sentinel/probe.test.mjs`

**Interfaces:**
- Consumes: `resolveTarget` (2), `mintScopeToken`/`verifyScopeToken` (3), `redactFinding` (4), the target store (1), a runner (7, injected — the fake in tests).
- Produces: `runProbe({ kind, name, slug, mode = 'safe' }, { runner, now, workRoot }) -> { ok, runId?, findings?, reason? }`. It: resolves and verifies the target; mints and then verifies the scope token (refusing its own token if verification fails); makes a run working folder under `workRoot`; starts the runner with the content and token; sends the echo command; reads the observation; assembles one informational finding (`checkId: 'echo'`, the served status and header names as `proof`); **redacts** it; writes `probe_runs` + `probe_findings`; stops the runner; **wipes the working folder**; returns the redacted finding. A refusal from the gate returns `{ ok: false, reason }` and writes no findings. A runner that throws on `start` ends the run `status: 'failed'` with no findings and the working folder wiped.

- [ ] **Step 1: Write the failing tests** (fake runner + fake tables): `a third-party target is refused and nothing is stored`, `an owned target runs the echo and stores one redacted finding`, `the stored finding carries no raw body — only shapes and safe scalars`, `the working folder is wiped after the run`, `a runner that fails to start ends the run failed with nothing stored and the folder wiped`.
- [ ] **Step 2: Run it.** Expected: ERR_MODULE_NOT_FOUND.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run it, then `npm test`.** Expected: pass.
- [ ] **Step 5: Commit** `feat(sentinel): runProbe orchestrator with the echo check`.

---

### Task 9: Live check in the real sandbox, and docs — GATED

**Stop and ask the owner first.** This enables the Windows Sandbox optional feature if it is off (owner confirms), builds, and runs the real `windowsSandboxRunner` against a copy of one owned local project.

- [ ] **Step 1: Confirm Windows Sandbox is available** (`WindowsSandbox.exe`); if not, surface how to enable it and stop until the owner does.
- [ ] **Step 2:** From a dev build or the installed app over CDP, call `runProbe` with the real `windowsSandboxRunner` against an owned project. Confirm: the sandbox starts, serves the copy, the echo observation returns over the channel, an attempt to reach the internet from inside the sandbox is blocked (no egress), the sandbox tears down, the working folder is wiped, and `probe_findings` holds only redacted data.
- [ ] **Step 3: Docs:** a `MASTER_AUDIT_TODO.md` entry; the spec's status line ("foundation built"); a `project_sentinel_probe` memory note.
- [ ] **Step 4: Final verification:** `npm test`, `npm run tauri:test`, `npm run tauri:check`, `npx vite build` — all green.
- [ ] **Step 5: Commit** `docs(sentinel): safety foundation built`.
