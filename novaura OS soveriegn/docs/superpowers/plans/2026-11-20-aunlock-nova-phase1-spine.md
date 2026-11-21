# Aunlock Nova — Phase 1a (Software Spine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The refurbisher-suite software spine — a catalog of devices and jobs, the provenance/authorization gate, the 3-job/10-day retention, sanitization-certificate generation, and the gated terminal command that opens a tabbed window — all pure JS/React, fully testable, with native device I/O injected (stubbed here, real in Phase 1b).

**Architecture:** A JS catalog store over new Dexie v25 tables holds devices, jobs, provenance and certs. A controller runs the job lifecycle (intake → authorize → recover → sanitize → close), enforcing the authorization gate and the retention policy, with the hardware layer (`native`) injected so the whole spine is tested without a device. A hidden app entry + a terminal `aunlock` command open a thin tabbed window over the controller.

**Tech Stack:** React/Vite + Dexie 4.4 (version 25), node:test (`--experimental-test-module-mocks`), `@noble/hashes` (already present) for the cert hash.

**Spec:** `docs/superpowers/specs/2026-11-19-aunlock-nova-design.md`

All paths are relative to `novaura OS soveriegn/`.

## Global Constraints

- **Sovereign only.** Never edit `NovAura-WebOS/`. Never touch `tauri.conf.json`'s version by hand.
- **Hard anti-goal, every task: no lock circumvention.** The spine never bypasses a lock. Recover and sanitize only run on a job that has recorded **authorization**; a locked device without authorization cannot proceed. "Recovery" reads owner-authorized/unencrypted media only (enforced by the gate + the injected native in Phase 1b).
- **Retention:** recovered data and jobs are kept for at most **10 days** and only the **3 most recent jobs**; a 4th job or the 10-day expiry purges the oldest job and all its rows + staged bytes.
- **Dexie:** add database version **25** (24 is the current max); never blank an existing version.
- **Tooling:** write commit messages to a file with bash `printf` then `git commit -F <file>` (PowerShell adds a BOM); stage only the files named in each task, because Gemini edits the tree in parallel.
- **This is Phase 1a (spine).** Native device I/O — USB enumeration, drive mount/recover, the NIST 800-88 wipe, the LAN recovery stick — is **Phase 1b** and is injected here as the `native` interface. The revive/distro-center and standalone-window delivery are later phases.

## Review Focus

1. **A job with no recorded authorization** must be refused at recover and at sanitize — the gate is the whole safety story. Pinned in Task 6.
2. **A 4th job, or a job older than 10 days,** must purge the oldest job AND its devices/provenance/certs/recovered rows and staged bytes — no orphan rows, nothing kept past policy. Pinned in Task 2.
3. **A device the model cannot classify** (unknown kind or unknown lock-state) is recorded as `unknown` and never auto-advances. Pinned in Task 3.
4. **A sanitization certificate** must be tamper-evident (a content hash) and must name the method, device serial, operator, and the authorization it relied on. Pinned in Task 5.
5. **The `aunlock` entry is gated** — hidden from the app launcher (`hidden: true`), opened only by the terminal command. Verified by construction and the Task 7 `vite build` (the registry is a React module, not cleanly unit-testable); the `describeJobs` path is unit-tested.

---

### Task 1: Data model and catalog store

**Files:**
- Modify: `src/database/sovereignDatabase.js` — add version 25 and five tables + handles.
- Create: `src/services/aunlock/catalog.js`
- Create: `tests/aunlock/fakeTable.js` (reuse the shape of `tests/sentinel/fakeTable.js`), `tests/aunlock/catalog.test.mjs`

**Interfaces:**
- Produces: `createCatalog({ jobs, devices, provenance, certs, recovered }) -> catalog` with:
  `createJob({ now }) -> job` (id `job_<ts>_<rand>`, status `'intake'`, createdAt), `getJob(id)`, `listJobs()`,
  `putDevice(device)`, `listDevices(jobId)`, `putProvenance(p)` (keyed by jobId), `getProvenance(jobId)`,
  `putCert(cert)`, `listCerts(jobId)`, `putRecovered(entry)`, `listRecovered(jobId)`,
  `deleteJobCascade(jobId)` (removes the job and every devices/provenance/certs/recovered row for it).
  A `job` is `{ id, status, createdAt, closedAt }`.

- [ ] **Step 1: Write the failing tests** in `catalog.test.mjs` (fake tables): `a job round-trips and lists`, `devices/provenance/certs/recovered attach to a job and read back by jobId`, `deleteJobCascade removes the job and all of its attached rows`.
- [ ] **Step 2: Run** `node --experimental-test-module-mocks --test tests/aunlock/catalog.test.mjs`. Expected: ERR_MODULE_NOT_FOUND.
- [ ] **Step 3: Implement** the five tables — `aunlock_jobs: 'id, status, createdAt, closedAt'`, `aunlock_devices: 'id, jobId, kind, serial, updatedAt'`, `aunlock_provenance: 'jobId'`, `aunlock_certs: 'id, jobId, createdAt'`, `aunlock_recovered: '[jobId+path], jobId'` — in a `this.version(25).stores({...})` block, add the table handles, and implement `catalog.js`.
- [ ] **Step 4: Run** the test, then `npm test`. Expected: pass, suite green after the version bump.
- [ ] **Step 5: Commit** `feat(aunlock): catalog tables and store`.

---

### Task 2: Retention (3 jobs / 10 days)

**Files:**
- Create: `src/services/aunlock/retention.js`
- Test: `tests/aunlock/retention.test.mjs`

**Interfaces:**
- Produces: `jobsToPurge(jobs, { now = Date.now, maxJobs = 3, ttlMs = 864e5 * 10 }) -> jobId[]` — returns the ids of jobs to remove: any job older than `ttlMs` (by `createdAt`), plus, once that is applied, the oldest jobs beyond `maxJobs`. Order of the returned ids is oldest-first.

- [ ] **Step 1: Write the failing tests:** `a job older than 10 days is purged`, `with four jobs the oldest is purged and three remain`, `expiry and the 3-job cap combine without double-listing an id`.
- [ ] **Step 2: Run it.** Expected: ERR_MODULE_NOT_FOUND.
- [ ] **Step 3: Implement** — pure; sort by createdAt, mark expired, then trim to `maxJobs`, return the union oldest-first with no duplicates.
- [ ] **Step 4: Run it, then `npm test`.** Expected: pass.
- [ ] **Step 5: Commit** `feat(aunlock): 3-job / 10-day retention`.

---

### Task 3: Device model

**Files:**
- Create: `src/services/aunlock/deviceModel.js`
- Test: `tests/aunlock/deviceModel.test.mjs`

**Interfaces:**
- Produces: `deviceRecord({ jobId, id, raw }) -> device` where `raw` is the native specs blob (`{ kind?, model?, serial?, ram?, cpu?, storage?, battery?, lock? }`) and `device` is `{ id, jobId, kind, model, serial, specs, lockState, updatedAt }`.
  `kind` ∈ `'laptop'|'phone'|'drive'|'unknown'`; `lockState` ∈ `'none'|'user'|'bios'|'account'|'encrypted'|'unknown'`. Anything unrecognised becomes `'unknown'`, never guessed.

- [ ] **Step 1: Write the failing tests:** `a laptop with a BIOS lock is classified laptop/bios`, `an account-locked phone is phone/account`, `an unrecognised kind or lock is recorded as unknown, not guessed`, `specs are carried through verbatim`.
- [ ] **Step 2: Run it.** Expected: ERR_MODULE_NOT_FOUND.
- [ ] **Step 3: Implement** — map known values, default to `'unknown'`.
- [ ] **Step 4: Run it, then `npm test`.** Expected: pass.
- [ ] **Step 5: Commit** `feat(aunlock): device record model`.

---

### Task 4: Provenance & the authorization gate

**Files:**
- Create: `src/services/aunlock/authorization.js`
- Test: `tests/aunlock/authorization.test.mjs`

**Interfaces:**
- Produces: `provenanceRecord({ jobId, source, authorization, who, operator, now }) -> provenance` (`{ jobId, source, authorization, who, operator, at }`); `canProceed(provenance) -> { ok: boolean, reason?: string }` — `ok` only when `provenance` exists and `authorization` is a non-empty string (a receipt, decommission manifest, or "owner present: <name>"). No authorization → `{ ok: false, reason }`.

- [ ] **Step 1: Write the failing tests:** `a provenance record with an authorization proceeds`, `no provenance is refused`, `an empty or whitespace authorization is refused`.
- [ ] **Step 2: Run it.** Expected: ERR_MODULE_NOT_FOUND.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run it, then `npm test`.** Expected: pass.
- [ ] **Step 5: Commit** `feat(aunlock): provenance and authorization gate`.

---

### Task 5: Sanitization method + certificate

**Files:**
- Create: `src/services/aunlock/sanitizationCert.js`
- Test: `tests/aunlock/sanitizationCert.test.mjs`

**Interfaces:**
- Consumes: `sha256` from `@noble/hashes/sha2.js` and `bytesToHex` from `@noble/hashes/utils.js` (already dependencies).
- Produces: `sanitizationMethodFor(device) -> 'clear'|'purge'` (NIST 800-88: flash/SSD → `'purge'`, magnetic/unknown → `'clear'`); `buildCert({ job, device, provenance, method, startedAt, finishedAt, operator, now }) -> cert` — `cert` is `{ id, jobId, device: {serial, model, kind}, method, startedAt, finishedAt, operator, authorization, standard: 'NIST SP 800-88 Rev.1', createdAt, hash }` where `hash` is the hex sha256 of the canonical cert body (every field except `hash`).

- [ ] **Step 1: Write the failing tests:** `an SSD gets purge and a hard drive gets clear`, `a cert names method, device serial, operator and the authorization`, `the hash covers the body so a changed field is detectable` (build, flip `method`, recompute → different hash), `the standard line is NIST SP 800-88 Rev.1`.
- [ ] **Step 2: Run it.** Expected: ERR_MODULE_NOT_FOUND.
- [ ] **Step 3: Implement** — canonical body = JSON of sorted fields minus `hash`.
- [ ] **Step 4: Run it, then `npm test`.** Expected: pass.
- [ ] **Step 5: Commit** `feat(aunlock): sanitization method and certificate`.

---

### Task 6: Job controller (lifecycle, gate + retention enforced)

**Files:**
- Create: `src/services/aunlock/controller.js`
- Test: `tests/aunlock/controller.test.mjs`

**Interfaces:**
- Consumes: the catalog (1), `jobsToPurge` (2), `deviceRecord` (3), `provenanceRecord`/`canProceed` (4), `sanitizationMethodFor`/`buildCert` (5), and an injected `native` — `{ enumerate() -> raw, recover(device) -> manifest, wipe(device, method) -> { ok, startedAt, finishedAt } }` (the fake in tests; the real Tauri layer in Phase 1b).
- Produces: `createController({ catalog, native, now = Date.now, operator }) -> controller` with `newJob()`, `intakeDevice(jobId)` (calls `native.enumerate`, stores the device record), `authorize(jobId, { source, authorization, who })`, `recover(jobId)` (gate-checked; calls `native.recover`, stores the manifest, sets status `recovered`), `sanitize(jobId)` (gate-checked; picks the method, calls `native.wipe`, builds+stores the cert, status `done`), `closeJob(jobId)`, and `listJobs()`. On `newJob`, retention runs: `jobsToPurge` → `deleteJobCascade` for each.

- [ ] **Step 1: Write the failing tests** (fake catalog tables + fake native): `newJob past the cap purges the oldest job and its rows`, `recover is refused on a job with no authorization and stores nothing`, `an authorized job recovers and stores a manifest`, `sanitize is refused without authorization`, `an authorized sanitize wipes, stores a signed-off cert, and sets the job done`, `recover/sanitize on a locked device with no authorization are both refused` (Review Focus 1).
- [ ] **Step 2: Run it.** Expected: ERR_MODULE_NOT_FOUND.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run it, then `npm test`.** Expected: pass.
- [ ] **Step 5: Commit** `feat(aunlock): job controller with gate and retention`.

---

### Task 7: Gated terminal command + tabbed window

**Files:**
- Create: `src/components/windows/AunlockWindow.jsx`
- Modify: `src/config/appRegistry.js` — a hidden `aunlock` entry; `src/components/windows/TerminalWindow.jsx` — an `aunlock` command.
- Test: `tests/aunlock/window.test.mjs` (a jsdom-free render check of the panel model) — follow the thin-view pattern of `tests/additions/panelModel.test.mjs`: extract the view state into a `panelModel.js` pure function and test that, not React.

**Interfaces:**
- Create: `src/services/aunlock/panelModel.js` — `describeJobs(jobs) -> { tabs }` (up to 3 tabs, each `{ id, title, status }`, newest first). `AunlockWindow.jsx` is a thin view over the controller + `describeJobs`.
- Consumes: `kernel.wm.openWindow('aunlock')` (the existing open mechanism).

- [ ] **Step 1: Write the failing tests** in `window.test.mjs`: `describeJobs shows at most 3 tabs, newest first, each with its status`, `an empty catalog yields no tabs`.
- [ ] **Step 2: Run it.** Expected: ERR_MODULE_NOT_FOUND.
- [ ] **Step 3: Implement** `panelModel.js`; add the hidden `aunlock` app entry (`hidden: true`, `component: AunlockWindow`) in `appRegistry.js`; add an `aunlock` case to the TerminalWindow `switch` that calls `kernel?.wm?.openWindow('aunlock')`; write `AunlockWindow.jsx` as a thin tabbed view over the controller.
- [ ] **Step 4: Run** the test, then `npm test`, then `npx vite build`. Expected: pass and a clean build.
- [ ] **Step 5: Commit** `feat(aunlock): gated terminal command and tabbed window`.

---

**Next plan (Phase 1b):** the native device I/O — Rust `aunlock_rules.rs` + `aunlock.rs` (USB enumeration, drive mount/recover, the NIST 800-88 wipe), Cargo deps, the LAN recovery stick, and a gated live check (like Sentinel's Task 9) — replacing the injected `native` with the real implementation.
