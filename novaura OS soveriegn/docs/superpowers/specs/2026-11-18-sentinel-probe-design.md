# Sentinel Probe — AI security-probing agent for owned assets — Design

**Status:** drafted 2026-11-18, awaiting owner review. Decisions from the brainstorming session are recorded in the last section. Nothing is built yet.

## What this is

Sentinel Probe lets the owner point an AI-driven scanner at one of **their own** assets and get back a prioritized, fix-oriented security report. It is a defensive tool — "find my weaknesses before someone else does, and tell me how to close them." It is part of Sovereign (never NovAura-WebOS).

The owner picks a verified target, chooses how aggressive the probe may be, and runs it. An AI agent plans and runs a battery of non-destructive checks, then returns findings that say **how it got in and how to fix it** — with the actual sensitive data it saw redacted out.

The three things that separate this from an intrusion tool are built as walls in code, not promises:

1. **It only ever runs against assets whose ownership is proven.** Unverified or third-party targets are refused before any probe fires.
2. **It is non-destructive and rate-limited.** No denial-of-service, no data-wrecking.
3. **The stored and shared report is redacted.** It carries the vector and the remediation, never the secrets, PII, or record bodies the probe exposed.

## Who it's for and what success looks like

The asset owner (Dillan first; later, any Sovereign user testing their own sites and apps). Success: the probe finds a real, reproducible weakness in an owned asset, explains the vector and the fix, leaks none of the underlying data into anything stored or shared, and **cannot be aimed at anything the owner does not control.**

## Non-goals for v1

- No external domains yet (they arrive once v1 is hardened; their ownership proof — a DNS-TXT challenge — must be airtight first).
- No arbitrary third-party CLI exploitation frameworks bundled in. v1 ships a curated, auditable check library.
- No offensive capability that works against targets the owner has not proven they own. This is the one capability the tool must never have.
- No continuous/scheduled probing, no Hyper-V runner, no multi-host crawling (all "Later").

## Trust boundaries (the core of the design)

There are two separate safety goals, and conflating them is the usual mistake. This design keeps them apart:

- **Contain the attacker.** The probe generates and launches attack-shaped traffic. That execution runs inside a **throwaway VM** (Windows Sandbox for v1) with **no network egress at all** — the firewall denies every outbound connection, so the VM can reach neither the host nor the internet. The target is not reached remotely: a **copy of the target's servable content is placed inside the VM and served on its own loopback**, so the attacker and the target copy both live in the disposable VM. (This also resolves a problem with reaching the target "remotely": mesh and local-project targets are served by the owner's own host, so letting the VM reach them would mean letting it reach the host — exactly what isolation must prevent. Serving a copy inside removes that path. External domains, which genuinely are remote, are deferred to a later phase and the runner that handles them.) If the target copy responds maliciously, or a probe misbehaves, the blast radius is a VM that is destroyed at the end of the run. The sandbox protects the host **from the target and from the agent's own actions.**

- **Protect the artifact.** To find bugs, the AI has to see the target's responses, which may contain sensitive data. That reasoning runs on **trusted compute** — the owner's local model (LM Studio / built-in AI) or the owner's own cloud key — so the data stays within the owner's own trust boundary. Before any finding is persisted to the database, shown in a shareable view, or exported, a **redaction pass** strips the sensitive data. Redaction protects **what gets stored and shared**, which is what "without exposing what it found" means.

So the flow of data is entirely within the owner's trust: the owner's host copies the owned target's content into the VM → the disposable VM serves it and probes it → raw observations come back to the owner's host brain (local/own-key AI) over a filesystem channel → redacted report. The sandbox is the executor; the host is the brain; redaction gates the output; the ownership gate is the wall around the whole thing.

### Why the brain is on the host, not in the sandbox

The sandbox has no network egress. Putting the model inside would mean either loading a model into a disposable VM on every run (impractical) or opening a network path out of the VM for the AI (which would defeat the no-egress wall). Instead, the sandbox holds only the "hands" (the probe executor and the served target copy). The host holds the "brain" (the planner + the owner's model). They talk over a **file-based control channel** on a mapped folder — the only path in or out of the VM is that shared folder on the owner's own disk; no network path is opened at all.

## Architecture

Five units, each with a clear job and interface.

### 1. Ownership gate and scope token — `src/services/sentinel/ownership.js`

Turns a requested target into an authorized, single-target scope — or refuses.

- `resolveTarget(request) -> { ok, target?, reason? }` where `request` is `{ kind: 'mesh' | 'project', name | slug }`.
  - **mesh:** look up `db.domain_records.get(name)`; accept only if the record is live (`recordIsLive`), verifies (`verifyRecord`), and `record.owner === myNodePub` (the active identity's public key, as `sovereignMesh.js` derives `publisherPubkey`). The target URL comes from the matching `hosted_sites` entry.
  - **project:** accept if the slug is in `listProjects()`. A local Cybeni/Forge project is the owner's by construction; the probe runs against a built, served copy of it (see runner).
- `mintScopeToken(target, mode, { staging }) -> scopeToken` — a signed, single-use token naming exactly one target (its resolved host(s)/origin), one `mode` ('safe' | 'deep'), an expiry, and a nonce. Signed with the node key so the runner can verify it was issued by this gate, not forged by the agent.
- `verifyScopeToken(token) -> { ok, target?, mode? }` — the runner calls this; **no valid token, no run.**

The token is the wall. The agent never chooses a target; it receives a scope it cannot widen.

### 2. Probe runner — `src/services/sentinel/runner/` + `src-tauri`

Isolation is swappable behind one interface so Hyper-V can replace Windows Sandbox later without touching the agent.

- `ProbeRunner` interface: `start(scopeToken, plan) -> session`, `send(session, command) -> void`, `receive(session) -> observation | null`, `stop(session) -> void`, `collectReport(session) -> redactedReport`.
- **v1 implementation — Windows Sandbox** (`windowsSandboxRunner`, driven from a Tauri command):
  - Generates a `.wsb` config that maps two folders: `in/` (read-only in the sandbox: the target's content copy, the probe toolkit, the startup script, the scope token, the run mode) and `io/` (read-write: the file-based control channel and the observations/report out).
  - A startup script inside the sandbox: (a) sets Windows Firewall to **default-deny all outbound** — no network egress at all; (b) serves the target content copy on a sandbox-local loopback address; (c) launches the in-sandbox executor, which probes that loopback.
  - Because the target is a copy inside the VM and the host↔VM channel is the mapped folder, the VM needs no network path to anything. The executor's HTTP client is additionally pinned to the sandbox-loopback target, so even inside the VM it refuses any other host.
  - The sandbox is disposable — it resets completely when it closes, so nothing from the probe persists except what was written to `io/` (and the host wipes the working folder after collecting the redacted report).
  - Teardown destroys the sandbox; a **Stop** control destroys it immediately mid-run.
- Requires the Windows Sandbox optional feature; if it is unavailable the runner **fails loudly** and the UI explains how to enable it. It never silently downgrades to a weaker isolation.

### 3. Probe agent and check library — `src/services/sentinel/agent.js`, `src/services/sentinel/checks/`

- **Host-side planner** (`createProbeAgent({ chat, runner, scopeToken, mode })`): an iterative loop — plan a check → send it to the executor → read the observation → reason → next check — within the mode's limits and a per-run time/request budget. `chat` is the owner's local model or own cloud key (never the decentralized network for this tool).
- **In-sandbox executor** (`toolkit/executor.mjs`): receives a command (which check, which parameters), runs that check against the target with a rate-limited HTTP client, writes the raw observation back over the control channel.
- **Check library** — a curated, auditable set for v1, each a small module `{ id, name, severity, applies(target), run(ctx) }`:
  - security headers / CSP / cookie flags / TLS configuration;
  - exposed paths and secrets (common config/backup/`.git`/`.env` exposure);
  - reflected injection markers (XSS/SQLi probes that detect reflection/error signatures without executing destructive payloads);
  - authentication and session checks (weak session handling, missing auth on sensitive routes);
  - access control / IDOR (sequential-id probing to detect missing authorization);
  - SSRF canary.
  - The AI reasons about which to run and interprets results in the app's specific context; the checks themselves are fixed code, so the probe's behavior is reviewable.

### 4. Redaction and report — `src/services/sentinel/redaction.js`, `src/services/sentinel/report.js`

- A finding is `{ id, checkId, vector, severity, where, reproduce, fix, proof }`. The **host planner** assembles findings from the raw observations it reasoned over — the executor never produces findings, it only streams observations.
- `redactFinding(finding) -> finding` strips sensitive data from `proof` and `where`: secrets/tokens/keys, PII patterns, and response bodies, replaced with `[redacted]` plus a non-sensitive shape (e.g. "a different user's order record, 14 fields"). **Fail-closed:** if it cannot be sure a value is non-sensitive, it redacts it.
- Redaction runs on the host **before any finding is written to the database**, and again before any export or share. Raw observations live only in the sandbox's mapped working folder (on the owner's disk, within the owner's trust boundary) and in the host planner's memory during the run; the orchestrator **wipes the working folder** once it has collected the redacted report, so nothing unredacted is left at rest.
- The report is the ranked list of redacted findings plus run metadata, written to `probe_runs` / `probe_findings` and rendered in the UI.

### 5. UI — `src/components/windows/SentinelProbeWindow.jsx`

A Sovereign app:
- Pick a verified target (a list drawn from the ownership gate — only assets that pass).
- Choose **Safe** or **Deep**. Deep forces the owner to select a target flagged as staging and to confirm an attestation ("this is a staging/throwaway copy, not production"); the gate refuses Deep against any target not flagged `isStaging`.
- Run, with live progress and a **Stop** button (immediate sandbox teardown).
- Read findings ranked by severity; mark each fixed; re-run to confirm.
- Each run and its redacted findings are listed; a run can be exported as a redacted report.

## Run modes

- **Safe (active, non-destructive):** maps the app and sends crafted probes — injection markers, auth-bypass and IDOR attempts, SSRF canaries — but nothing that writes, deletes, or floods. Non-destructive by construction; the check library contains no state-changing operations.
- **Deep (state-changing, staging only):** additionally exercises write/delete endpoints, but only against a target the owner has registered as staging and attested to. The gate refuses Deep against a production target. This is how the owner tests the destructive edges safely.

## Data model (new tables, Dexie version 23)

- `probe_targets: 'id, kind, ref, isStaging, updatedAt'` — registered targets (mesh name or project slug), with the staging flag. Ownership is re-checked at run time, not trusted from this row.
- `probe_runs: 'id, targetId, mode, status, startedAt, finishedAt'` — one row per run.
- `probe_findings: '[runId+id], runId, severity'` — redacted findings.
- `sentinel_audit` (existing) gets an event per run: started, finished, refused (with the reason), stopped.

These hold only redacted data, so they are safe to include in backups.

## Data flow

1. Owner picks a target and mode in the UI.
2. The ownership gate resolves and verifies it, re-checking ownership live, and mints a single-use scope token (Deep also checks the staging flag + attestation).
3. The host copies the target's servable content into the run's `in/` folder; the runner starts a throwaway sandbox with the content copy, the toolkit, the token, and the mode; the firewall denies all outbound and the content copy is served on sandbox loopback.
4. The host planner and the in-sandbox executor run the plan loop over the mapped control channel; the executor probes only the sandbox-local target copy and streams raw observations back.
5. The host planner assembles findings and redacts them before any are written to the database.
6. The report is stored (redacted) and shown; the sandbox is destroyed and its working folder wiped.

## Safety properties (each one testable)

- **No scope token, no run.** The runner refuses to start without a gate-signed token, and the token names exactly one target and mode.
- **Ownership is re-verified at run time** from `domain_records`/`listProjects()`, not trusted from `probe_targets`.
- **No network egress.** The sandbox's firewall denies all outbound — it reaches neither the host nor the internet. The target is a copy served on sandbox loopback; the executor's HTTP client is pinned to that loopback and refuses any other host.
- **Deep mode needs a staging target + attestation;** it refuses production.
- **Non-destructive in Safe mode** by construction — no state-changing check exists in the Safe set.
- **Rate-limited** per run, with a time budget and an immediate Stop.
- **Fail-closed redaction** before any persistence, export, or share.
- **Full audit trail** in `sentinel_audit`, including every refusal and its reason.
- **No silent isolation downgrade** — if the sandbox can't start, the run fails and says why.

## Error handling

- Target unreachable → the run ends with a clear status, no findings fabricated.
- Ownership verification fails → refused, logged, nothing starts.
- Sandbox unavailable/won't start → fail loudly with setup guidance; never downgrade isolation.
- Agent finds nothing → a clean "no findings" report, not an error.
- Redaction uncertain → redact (fail closed).
- Target returns hostile/oversized responses → the executor caps response size and time; the sandbox contains any fallout.

## Testing

- **Ownership gate:** an owned mesh name and an owned project pass; a name owned by another key, an unverified name, an expired record, and a non-existent project are each refused.
- **Scope token:** a forged or widened token is rejected by the runner; a token for target A cannot probe target B.
- **Redaction:** seeded secrets, API keys, and PII placed in synthetic findings never appear in the stored/exported output; fail-closed on an unknown-shape value.
- **A deliberately vulnerable, owned test app** (served locally, flagged as a test target) the probe is run against headlessly: it must find the seeded bugs (an IDOR, a missing security header, an exposed `.env`) and report vectors + fixes with the planted secret redacted.
- **Runner lifecycle:** starts scoped, the off-target HTTP request is refused, the session tears down, and nothing from the run persists outside the redacted report.
- **Mode boundary:** Deep refuses a non-staging target; the Safe check set contains no state-changing operation.

Rust-testable logic (scope-token signing/verification, host allowlisting) goes in `*_rules.rs` files per the project's `tauri:test` setup. JS uses `node:test`; the headless probe-vs-test-app run uses the existing `scripts/browser-test.mjs` harness where it fits, or a dedicated headless runner.

## Build order

The pieces are sequenced so each lands safe and testable:

1. Ownership gate + scope token + `probe_targets` (the wall, first).
2. `ProbeRunner` interface + Windows Sandbox runner + the file control channel + deny-all-outbound firewall + serving the target copy on sandbox loopback (isolation, with a trivial echo check to prove the loop).
3. Redaction + report + the data model (so nothing unredacted is ever stored, before real checks exist).
4. The check library (Safe set first) + the host agent loop.
5. UI + Deep mode + the staging attestation.
6. The deliberately-vulnerable test app + the end-to-end headless test, then a live run against one of your own mesh sites.

Whether this is one implementation plan or a few sequential ones (the gate; the runner; the agent + checks + redaction; the UI) is a decision for the planning stage — the safety-critical parts (gate, runner, redaction) may deserve their own plan and review each.

## Later

- **Hyper-V runner** — a real private virtual switch and a firewall allowlist, for the case where the target must be reached live rather than copied in; drops into `ProbeRunner`.
- **External domains** — a DNS-TXT ownership challenge, and (since a live external site can't be copied into the VM) the target-only-egress runner above, once the gate and the rest are hardened. This is the one case that needs real outbound from the VM, which is why it waits.
- **A larger check library** and optional vetted CLI tools (better suited to the Hyper-V/container runner).
- **Scheduled / continuous probing** and diffing findings between runs.
- **Probing your own Additions** — the opaque-origin app sandbox and this probe share a threat model.

## Owner decisions (from brainstorming, 2026-11-18)

1. **Isolation:** a throwaway VM. v1 realizes it with **Windows Sandbox** (built-in, disposable) running with **no network egress** — the target is copied in and served on sandbox loopback, so the VM reaches neither host nor internet; **Hyper-V** (for live remote targets, with hard network isolation) drops into the same runner interface later.
2. **Aggressiveness:** selectable per run — **Safe** (active, non-destructive) and **Deep** (state-changing, staging only).
3. **AI location:** the owner's **local model**, with the owner's **own cloud key** as an opt-in. Never the decentralized inference network for this tool.
4. **First targets:** **mesh/hosted sites and Cybeni/Forge projects** in v1; **external domains** after v1 is fully tested and hardened.
5. **Hard line (not negotiable):** ownership is proven in code before any probe runs; third-party and unverified targets are refused.
