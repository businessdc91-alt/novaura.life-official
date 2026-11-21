# NovAura Sovereign OS — Security & SOC 2 Compliance Architecture

**Scope:** `novaura OS soveriegn` desktop runtime (React 19 UI + NovaKernel + Tauri v2 Rust backend)  
**Target Standard:** AICPA SOC 2 Trust Services Criteria (Security CC1–CC9, Availability A1, Processing Integrity PI1, Confidentiality C1, Privacy P1–P8)

---

## 1. System Boundary & Data Residency Model

NovAura Sovereign OS is built as a **local-first, user-hosted desktop environment**:

- **Primary Database:** `Dexie` (`NovauraSovereignPrivateCloud`) in IndexedDB (`src/database/sovereignDatabase.js`).
- **Native Encrypted Disk Mirror:** Atomic temp-write + rename snapshot (`sovereign_db_snapshot.json`) sealed with **Windows DPAPI** (`VAULT_DPAPI_PREFIX`) inside the active profile's `vault/` folder (`src-tauri/src/lib.rs`).
- **Cryptographic Keyring:** AES-256-GCM records in `db.enclave_records`, keyed from an operator passphrase via **PBKDF2-HMAC-SHA256 (600,000 rounds)** with a random 16-byte per-vault salt (`src/services/credentialEnclaveService.js`).
- **Zero Default Cloud Dependency:** Core OS productivity, local databases, and local LLM/diffusion engines (Ollama, LM Studio, Built-in llama.cpp/GGUF, ComfyUI) operate strictly on localhost without external network egress.
- **External Network Contacts (Opt-In / Disclosed):**
  - Bring-Your-Own-Key (BYOK) cloud AI providers strictly routed through allowlisted HTTPS hosts in `src-tauri/src/cloud.rs` (`HOSTS` + `bedrock_host`).
  - Operator-triggered HuggingFace GGUF / ComfyUI model downloads.
  - Configurable WebRTC mesh signaling relay for P2P encrypted packets.
  - Ed25519-signed release update checks (`@tauri-apps/plugin-updater`).

---

## 2. Control Mapping Across SOC 2 Trust Services Criteria

### CC6.1 — Logical Access Controls & Key Lifecycles
- **Zero-Knowledge Key Enclave (`src/services/credentialEnclaveService.js`, `src/components/windows/CredentialEnclaveWindow.jsx`):**
  - Enforces manual operator passphrase entry (zero hardcoded or default passphrases in UI).
  - Automatically migrates legacy plaintext `localStorage` SSH (`novaura_ssh_keys`) and TOTP (`novaura_totp_accounts`) stores into AES-256-GCM encrypted `db.enclave_records` upon unlock, deleting plaintext copies only after ciphertext commit succeeds.
  - Clears volatile `_sessionKey` and component React state on manual lock, window visibility expiry (`visibilitychange`), or configurable inactivity auto-lock timeout (`idleTimeoutMs`, default 15 minutes).
  - Automatic 30-second clipboard zero-wipe (`copyToClipboardWithAutoWipe`).
- **Capability Permission Gate (`src/kernel/subsystems/SentinelShield.js`):**
  - High-risk capabilities (`terminal:exec`, `fs:delete_system`, `cloud:egress`, `firmware:reboot`, `enclave:export`, `terminal:*`, `firmware:*`) require an explicit registered approval handler and **fail closed** (`return false`) when unprompted or denied.

### CC6.6 — System Boundaries, Isolation & Transport Hardening
- **Native Cloud Egress Conduit (`src-tauri/src/cloud.rs`):**
  - Enforces `https://` only (`--proto =https`), zero redirects (`--max-redirs 0`), exact host allowlist (`HOSTS` + `bedrock-runtime.<region>.amazonaws.com`), body size caps (`MAX_REQUEST_BYTES` 32 MB / `MAX_REPLY_BYTES` 24 MB), `@file` body prefix rejection, and stdin curl config passing so bearer/API keys never leak via process arguments or disk files.
  - Rejects security-sensitive request override headers (`FORBIDDEN_HEADERS`: `host`, `cookie`, `set-cookie`, `transfer-encoding`, `content-length`, `proxy-authorization`, `proxy-connection`, `connection`, `upgrade`, `te`, `forwarded`, `x-forwarded-for`, `x-forwarded-host`, `expect`).
  - Exposes kernel-level **Air-Gap Egress Lock** (`CLOUD_AIRGAP_ENABLED` `AtomicBool`, `cloud_set_airgap`, `cloud_get_airgap`) enforced prior to transport execution.
- **Origin-Isolated Subapp & Game Sandboxes (`src-tauri/src/preview.rs`, `tests/additions/`):**
  - Preview and addition hosts execute under origin isolation and locked-down CSP boundaries; inter-app IPC is scoped by `InterAppSecurityBroker` (`src/kernel/InterAppSecurityBroker.js`).
- **Path Traversal Prevention (`src-tauri/src/lib.rs`, `src-tauri/src/native_build.rs`):**
  - Strict vault filename sanitization (`sanitize_vault_filename`) rejects empty strings, leading dots, and `..` traversal; sync root resolution rejects system/startup/.ssh folders even before creation (`resolve_safe_sync_root`).

### CC6.7 — Encryption at Rest & Authenticated P2P Identity
- **Storage Encryption:** AES-256-GCM at application credential enclave layer + Windows DPAPI (`dpapi::protect`) for disk mirror snapshots (`seal_vault_payload`).
- **Mail & Mesh Verification (`src/components/windows/mail/MailListPane.jsx`, `MailReadingPane.jsx`, `src/services/meshInboundLimits.js`):**
  - Validates Ed25519 `did:nova:<64-hex>` cryptographic identity badges vs unsigned/unverified sender warnings, alongside token-bucket inbound flood rate limiting (`meshInboundLimits.js`).

### CC7.2 — Tamper-Evident Audit Logging & Monitoring
- **SHA-256 Hash-Chained Audit Ledger (`src/kernel/subsystems/SentinelShield.js`):**
  - Every `logEvent()` entry carries monotonically increasing `seq`, `prevHash` (rooted at `GENESIS_HASH`), and deterministic canonical JSON SHA-256 `hash`, serialized via an internal queue to prevent chain forks.
  - `verifyAuditChain()` validates sequence continuity, `prevHash` linkage, and recomputes every SHA-256 digest to surface tampering immediately.
  - `exportAuditLogs('json' | 'csv')` exports full compliance bundles with embedded integrity verification and spreadsheet formula-injection sanitization (`escapeCsvCell`).

### C1.1 — Confidentiality & Outbound Cloud Prompt Secret Guard
- **Automatic Prompt Redaction (`src/services/security/complianceService.js`, `src/services/cloudProviders.js`, `src/kernel/subsystems/AISubsystem.js`):**
  - Scans outbound cloud LLM messages prior to transport for PEM private keys, `NOVA1` tokens, Stripe live keys, OpenAI/Anthropic keys (`sk-...`), Google Gemini keys (`AIza...`), GitHub PATs (`ghp_...`/`github_pat_...`), AWS access keys (`AKIA`/`ASIA`), Slack tokens (`xox...`), and Bearer JWTs.
  - Replaces matched secrets with typed placeholders (`[REDACTED:<TYPE>]`) and records non-secret telemetry (`cloud_secret_redacted`) in SentinelShield.
  - Strict **Air-Gapped Local-Only AI Lock** disables all BYOK cloud routing in both JS (`cloudProviders.js`, `AISubsystem.js`) and Rust (`cloud.rs`).

### P4.1 — Privacy, User Control & Cryptographic Erasure
- **Interactive Operator Controls (`src/components/windows/settings/SecurityCompliancePanel.jsx`):**
  - Provides live control status verification, policy switches, full endpoint disclosure, audit exports, and **Cryptographic Factory Wipe** (`executeCryptographicWipe()`).
- **Verified Disk Mirror Disposal (`purge_vault_state` in `src-tauri/src/lib.rs`, `resetDatabaseToFactory` in `sovereignDatabase.js`):**
  - Overwrites `sovereign_db_snapshot.json` (and `.tmp`) with zeros, flushes/syncs to storage, unlinks the file, clears IndexedDB, clears Web Storage, and zeroes volatile session keys.

---

## 3. Threat Boundaries & Intentional Operator Tradeoffs

1. **Custom OpenAI-Compatible Endpoint (`byok` provider):** When an operator explicitly enters a self-hosted `byok_endpoint` URL (e.g., private vLLM or LAN server), requests execute via `fetch()` rather than `cloud_ai_request` so custom URLs are not constrained to the fixed Rust provider list; toggling **Air-Gapped Local-Only AI Lock** blocks custom BYOK requests as well.
2. **Legacy Pre-Hardening Records:** Historical audit rows written before hash-chaining are counted as `legacyUnchained` by `verifyAuditChain()` rather than breaking chain verification, while all newly emitted events form a continuous SHA-256 chain.

---

## 4. Organizational & Type I / Type II Audit Readiness Checklist

For teams packaging NovAura Sovereign OS as a commercial/enterprise SOC 2 Type II offering:

- [ ] Maintain signed release provenance (GitHub Actions OIDC + code-signing certificate + Ed25519 Tauri updater keys stored in HSM/KMS).
- [ ] Enforce branch protection, mandatory PR code review, and CI execution of `npm test`, `oxlint`, `cargo test`, and Sentinel probe regression suites before every tagged release.
- [ ] Publish formal customer-facing Privacy Policy, Subprocessor Registry (for any hosted Sovereign Relay / update CDN), Vulnerability Disclosure Policy (`SECURITY.md`), and Incident Response Runbook.
- [ ] Retain periodic CPA-verified quarterly access reviews for operator signing infrastructure (if Sovereign Cloud Relay nodes are operated centrally).

