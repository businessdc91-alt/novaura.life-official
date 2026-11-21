# Aunlock Nova — Phase 1b-A: Native Device Bridge (read-only enumeration) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder `native.enumerate()` with a real, read-only Windows device bridge that enumerates connected devices and reads their specs, so Aunlock's intake step detects actual hardware instead of throwing "arrives in Phase 1b."

**Architecture:** A new Rust module `aunlock_devices.rs` runs a read-only PowerShell CIM query and feeds its JSON into a pure, unit-tested `normalize_devices` function that returns `DeviceSpec` records (deny-by-default classification, a `system_disk` safety flag). A thin Tauri command exposes it. A JS bridge (`nativeDevices.js`) calls the command under the existing `isTauri()` guard and returns raw blobs in the exact shape `deviceModel.deviceRecord` already consumes. The controller gains a device picker — `enumerate()` returns a list, the operator chooses which to intake — while every Phase 1a safety gate stays intact. The actual hardware read is the only line not covered by CI; it is proven by a gated live check like Sentinel's Task 9.

**Tech Stack:** Rust (`serde`, `serde_json`, `std::process::Command` → Windows PowerShell), Tauri 2 command (`#[tauri::command]`, registered in `generate_handler!`), React/JS bridge, `node:test`.

**Spec:** `novaura OS soveriegn/docs/superpowers/specs/2026-11-19-aunlock-nova-design.md` (Build phasing module 1 — "Device pipeline"; "Rust command layer: enumerate USB devices and read specs").

## Global Constraints

- **Sovereign only.** All work in `novaura OS soveriegn/`. Never edit `NovAura-WebOS/`.
- **Read-only, no lock interaction.** The bridge never writes to, mounts-for-write, repartitions, or modifies a connected device, and never reads, strips, or tests a lock/credential. It reports specs only. Recovery and sanitization are later slices.
- **Deny-by-default classification stays in `deviceModel`.** An unrecognised `kind` → `'unknown'`; an unrecognised `lock` → `'unknown'`. The bridge supplies raw hints; it never forces a device past classification.
- **No new heavy crates.** Use `serde_json` over PowerShell CIM output, matching the existing `llm.rs` / `engines.rs` process-exec pattern. (A native-crate route — `sysinfo`/`nusb` — is the documented alternative if the PowerShell path proves inadequate during the live check; switching is a ruling, not a silent change.)
- **Windows is the v1 native target.** Non-Windows and non-Tauri (browser) return an empty list or a clean desktop-only error — never a crash, never a hang.
- **TDD throughout.** Every pure function and every bridge branch has a test watched failing first. The one uncoverable line — the real hardware read — is proven by the gated live check in Task 6, not asserted in CI.
- **Retention / authorization gates unchanged.** This slice adds detection only; it must not weaken the authorization gate, the 3-job/10-day retention, or the terminal-only launcher gating.

## Review Focus

1. **No device connected** → `enumerate()` returns `[]` and the UI shows "no device detected," not an error or a spinner that never resolves. *(Task 3 test: empty CIM result → `[]`; Task 5 test: empty list → empty-state copy.)*
2. **Malformed / partial / single-object CIM JSON** (missing serial, null fields, PowerShell emits a bare object instead of an array for one device) → `normalize_devices` yields deny-by-default records and never panics. *(Task 1 tests: missing-fields fixture, single-object fixture, empty-string/garbage fixture.)*
3. **Non-Windows / non-Tauri** (running in a browser or on Linux) → the bridge returns `[]` or throws the desktop-only message cleanly; the rest of the app keeps working. *(Task 3 test: `isTauri:false` branch.)*
4. **The operator's own system/boot disk appears in the list** → it carries `systemDisk: true` and the UI marks it and refuses it as an intake target, so the host OS drive can never be mistaken for a client device (critical before recover/sanitize slices exist). *(Task 1 test: boot-disk fixture → `system_disk true`; Task 4 test: intake of a `systemDisk` blob is refused; Task 5 test: system disk shown disabled.)*
5. **PowerShell missing, blocked by policy, or erroring** → `aunlock_enumerate_devices` surfaces a clean `Result::Err` / rejected promise with a readable reason, not a hang or a silent empty list that hides a real failure. *(Task 2: command returns `Result`; Task 3 test: rejected `invoke` → surfaced error distinct from the empty-list case.)*

---

### Task 1: `normalize_devices` + `DeviceSpec` (pure Rust normalization)

**Files:**
- Create: `novaura OS soveriegn/src-tauri/src/aunlock_devices.rs`
- Modify: `novaura OS soveriegn/src-tauri/src/lib.rs` (add `pub mod aunlock_devices;` near the other `pub mod` lines, e.g. after `pub mod sentinel_runner;`)
- Test: inline `#[cfg(test)] mod tests` in `aunlock_devices.rs`; fixtures as string literals in the test module

**Interfaces:**
- Produces:
  - `pub struct DeviceSpec { pub id: String, pub kind: String, pub model: Option<String>, pub serial: Option<String>, pub ram: Option<String>, pub cpu: Option<String>, pub storage: Option<String>, pub battery: Option<String>, pub lock: String, pub bus: Option<String>, pub removable: bool, pub system_disk: bool, pub size_bytes: Option<u64> }` — `#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]`, `#[serde(rename_all = "camelCase")]` so the JS side reads `systemDisk`, `sizeBytes`.
  - `pub fn normalize_devices(cim_json: &str) -> Vec<DeviceSpec>` — parses the PowerShell CIM payload (see Task 2 for its exact shape), tolerates a bare object or an array, maps each entry to a `DeviceSpec`. Classification is deny-by-default: `kind` resolves to one of `laptop|phone|drive` only on a recognised signal, else `"unknown"`; `lock` resolves to `none|encrypted` only on a clear BitLocker/encryption signal, else `"unknown"`. `system_disk` is `true` when the entry is flagged bootable/OS/fixed-system. A fixture that cannot be parsed at all returns `vec![]`.

- [ ] **Step 1: Write the failing tests**

```rust
// one fixed data disk, USB adapter
#[test]
fn maps_a_usb_data_drive() {
    let v = normalize_devices(DISK_USB_FIXTURE);
    assert_eq!(v.len(), 1);
    assert_eq!(v[0].kind, "drive");
    assert_eq!(v[0].serial.as_deref(), Some("WD-ABC123"));
    assert_eq!(v[0].removable, true);
    assert_eq!(v[0].system_disk, false);
}

// the host OS/boot disk must be flagged
#[test]
fn flags_the_system_boot_disk() {
    let v = normalize_devices(DISK_SYSTEM_FIXTURE);
    assert_eq!(v[0].system_disk, true);
}

// PowerShell emits a bare object (not an array) for a single device
#[test]
fn tolerates_a_single_object_payload() {
    let v = normalize_devices(SINGLE_OBJECT_FIXTURE);
    assert_eq!(v.len(), 1);
}

// missing/null fields never panic and stay deny-by-default
#[test]
fn missing_fields_are_deny_by_default() {
    let v = normalize_devices(PARTIAL_FIXTURE);
    assert_eq!(v[0].kind, "unknown");
    assert_eq!(v[0].lock, "unknown");
    assert_eq!(v[0].serial, None);
}

// a BitLocker-protected volume reports an encrypted lock hint
#[test]
fn reports_encrypted_lock_when_bitlocker_on() {
    let v = normalize_devices(BITLOCKER_FIXTURE);
    assert_eq!(v[0].lock, "encrypted");
}

#[test]
fn garbage_returns_empty() {
    assert_eq!(normalize_devices("not json").len(), 0);
    assert_eq!(normalize_devices("").len(), 0);
}

#[test]
fn empty_array_returns_empty() {
    assert_eq!(normalize_devices("[]").len(), 0);
}
```

Write the five fixtures as `const` string literals matching the Task 2 query's `ConvertTo-Json` output (disk entries with `Model`, `SerialNumber`, `Size`, `BusType`, `MediaType`/`RemovableMedia`, an `IsBoot`/`IsSystem` flag, and an `Encrypted` flag).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run tauri:test -- aunlock_devices` (from `novaura OS soveriegn/`)
Expected: FAIL — `normalize_devices` / `DeviceSpec` not found.

- [ ] **Step 3: Implement `DeviceSpec` and `normalize_devices` in `aunlock_devices.rs`**

Parse with `serde_json::from_str::<serde_json::Value>`; if it's an object wrap it in a one-element array, if it's an array iterate, else return empty. Map each object field-by-field; resolve `kind`/`lock`/`system_disk`/`removable` with small helper fns that encode the deny-by-default rules. No I/O in this function.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run tauri:test -- aunlock_devices`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add "novaura OS soveriegn/src-tauri/src/aunlock_devices.rs" "novaura OS soveriegn/src-tauri/src/lib.rs"
git commit -m "feat(aunlock): read-only device-spec normalization (Phase 1b-A)"
```

---

### Task 2: `aunlock_enumerate_devices` Tauri command (the thin hardware shell)

**Files:**
- Modify: `novaura OS soveriegn/src-tauri/src/aunlock_devices.rs` (add the command + the query constant)
- Modify: `novaura OS soveriegn/src-tauri/src/lib.rs` (register `aunlock_devices::aunlock_enumerate_devices` in the `generate_handler!` list)

**Interfaces:**
- Consumes: `normalize_devices` (Task 1).
- Produces: `#[tauri::command] pub async fn aunlock_enumerate_devices() -> Result<Vec<DeviceSpec>, String>` — on Windows, runs the read-only PowerShell CIM query (a single `const AUNLOCK_CIM_QUERY: &str`), captures stdout, returns `normalize_devices(&stdout)`; on a spawn/exec failure returns `Err(reason)`; on non-Windows returns `Ok(vec![])`.

- [ ] **Step 1: Write the failing test**

The command's body is I/O (spawns PowerShell) and is verified by the Task 6 live check, not CI. The CI-testable unit here is query **shape**, so the logic stays in the tested `normalize_devices`:

```rust
#[test]
fn cim_query_is_read_only() {
    // Guard against a future edit introducing a mutating cmdlet into the query.
    let q = AUNLOCK_CIM_QUERY;
    for banned in ["Clear-Disk", "Format-", "Remove-", "Set-Disk", "Initialize-Disk",
                   "Clear-Content", "Set-Partition", "Reset-", "-Wipe"] {
        assert!(!q.contains(banned), "query must stay read-only; found {banned}");
    }
    assert!(q.contains("Get-") && q.contains("ConvertTo-Json"));
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run tauri:test -- aunlock_devices`
Expected: FAIL — `AUNLOCK_CIM_QUERY` not defined.

- [ ] **Step 3: Implement the command and query**

`AUNLOCK_CIM_QUERY`: a read-only pipeline over `Get-CimInstance`/`Get-Disk`/`Get-PhysicalDisk` (+ `Get-CimInstance Win32_Battery`, `Win32_Processor`, `Win32_PhysicalMemory` for laptop specs, and a BitLocker status read) projected to the field names Task 1's fixtures expect and piped to `ConvertTo-Json -Depth 4 -Compress`. Spawn via `std::process::Command::new("powershell")` with `-NoProfile -NonInteractive -Command`, mirroring the existing process-exec modules. Register the command in `lib.rs`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run tauri:test -- aunlock_devices`
Expected: PASS. Then `npm run tauri:check` (from `novaura OS soveriegn/`) → compiles clean.

- [ ] **Step 5: Commit**

```bash
git add "novaura OS soveriegn/src-tauri/src/aunlock_devices.rs" "novaura OS soveriegn/src-tauri/src/lib.rs"
git commit -m "feat(aunlock): read-only enumerate_devices Tauri command (Phase 1b-A)"
```

---

### Task 3: `nativeDevices.js` — the JS bridge

**Files:**
- Create: `novaura OS soveriegn/src/services/aunlock/nativeDevices.js`
- Test: `novaura OS soveriegn/tests/aunlock/nativeDevices.test.mjs`

**Interfaces:**
- Consumes: `invoke('aunlock_enumerate_devices')` → `DeviceSpec[]` (camelCase JSON).
- Produces:
  - `export function createNativeDevices({ invoke, isTauri })` → `{ async enumerate() }`.
  - `enumerate()`: when `isTauri()` is false → `throw new Error('Device detection runs in the Sovereign desktop app.')`; when true → `const list = await invoke('aunlock_enumerate_devices')` and return `list.map(toRaw)` where `toRaw(spec)` yields the `deviceModel.deviceRecord` raw shape plus carried safety flags: `{ kind, model, serial, ram, cpu, storage, battery, lock, bus, removable, systemDisk, sizeBytes, nativeId: spec.id }`.
  - A rejected `invoke` propagates (the caller distinguishes it from the empty-list case).

- [ ] **Step 1: Write the failing tests**

```js
test('enumerate maps native specs to deviceModel raw blobs', async () => {
  const invoke = async () => ([{ id:'n1', kind:'drive', model:'WD', serial:'S1',
    storage:'500GB', lock:'none', removable:true, systemDisk:false }]);
  const nd = createNativeDevices({ invoke, isTauri: () => true });
  const raw = await nd.enumerate();
  assert.equal(raw.length, 1);
  assert.equal(raw[0].kind, 'drive');
  assert.equal(raw[0].systemDisk, false);
  assert.equal(raw[0].nativeId, 'n1');
});

test('no devices → empty array, not an error', async () => {
  const nd = createNativeDevices({ invoke: async () => [], isTauri: () => true });
  assert.deepEqual(await nd.enumerate(), []);
});

test('outside the desktop app it refuses with a clear message', async () => {
  const nd = createNativeDevices({ invoke: async () => [], isTauri: () => false });
  await assert.rejects(() => nd.enumerate(), /desktop app/i);
});

test('a native failure surfaces, distinct from empty', async () => {
  const nd = createNativeDevices({ invoke: async () => { throw new Error('powershell not found'); },
    isTauri: () => true });
  await assert.rejects(() => nd.enumerate(), /powershell/i);
});
```

- [ ] **Step 2: Run to verify they fail** — Run: `node --test tests/aunlock/nativeDevices.test.mjs` → FAIL (module missing).
- [ ] **Step 3: Implement `createNativeDevices` + `toRaw`.**
- [ ] **Step 4: Run to verify they pass** — Expected: PASS (4 tests).
- [ ] **Step 5: Commit**

```bash
git add "novaura OS soveriegn/src/services/aunlock/nativeDevices.js" "novaura OS soveriegn/tests/aunlock/nativeDevices.test.mjs"
git commit -m "feat(aunlock): JS device bridge over the native enumerate command (Phase 1b-A)"
```

---

### Task 4: wire the bridge into the controller (list + picker + system-disk refusal)

**Files:**
- Modify: `novaura OS soveriegn/src/services/aunlock/controller.js`
- Modify: `novaura OS soveriegn/src/services/aunlock/deviceModel.js` (carry `systemDisk`/`bus`/`removable`/`nativeId` through additively)
- Modify: `novaura OS soveriegn/src/services/aunlock/native.js` (placeholder `enumerate` now delegates to the real bridge in `getController`; `recover`/`wipe` still throw the Phase 1b message)
- Test: `novaura OS soveriegn/tests/aunlock/controller.test.mjs` (extend), `novaura OS soveriegn/tests/aunlock/deviceModel.test.mjs` (extend)

**Interfaces:**
- Consumes: `nativeDevices.enumerate()` → raw blob list (Task 3).
- Produces (controller additions, backward-compatible):
  - `listConnectedDevices()` → `await native.enumerate()` (the raw blob list; no DB write).
  - `intakeDevice(jobId, raw)` — **`raw` optional**. With `raw`, intake that chosen blob. Without it (Phase 1a call sites), intake the first enumerated device. **Refuse** a blob with `systemDisk === true`: return `{ ok:false, reason:'That is this computer's system disk — not an intake target.' }` and write nothing.
  - `deviceModel.deviceRecord` gains `systemDisk`/`bus`/`removable`/`nativeId` passthrough. **Deny-by-default rule (pinned in the tests below):** a device is an intake target only when `systemDisk === false` *explicitly*; `intakeDevice` refuses any blob where `systemDisk !== false` (covers `true`, `undefined`, and `null`), so a bridge that fails to classify the host disk errs toward refusing it, never toward intaking it.

- [ ] **Step 1: Write the failing tests**

```js
test('listConnectedDevices returns the native blob list without storing', async () => {
  const { ctl, catalog } = make({ native: { enumerate: async () =>
    ([{ kind:'drive', serial:'S1', systemDisk:false }]) } });
  const j = await ctl.newJob();
  const list = await ctl.listConnectedDevices();
  assert.equal(list.length, 1);
  assert.deepEqual(await catalog.listDevices(j.id), []); // nothing written
});

test('intakeDevice refuses the host system disk', async () => {
  const { ctl, catalog } = make();
  const j = await ctl.newJob();
  const r = await ctl.intakeDevice(j.id, { kind:'drive', serial:'OS', systemDisk:true });
  assert.equal(r.ok, false);
  assert.match(r.reason, /system disk/i);
  assert.deepEqual(await catalog.listDevices(j.id), []);
});

test('intakeDevice stores a chosen non-system device', async () => {
  const { ctl, catalog } = make();
  const j = await ctl.newJob();
  await ctl.intakeDevice(j.id, { kind:'drive', serial:'S9', systemDisk:false });
  const devs = await catalog.listDevices(j.id);
  assert.equal(devs[0].serial, 'S9');
  assert.equal(devs[0].systemDisk, false);
});

test('intakeDevice with no blob still intakes the first enumerated (Phase 1a path)', async () => {
  const { ctl, catalog } = make(); // baseNative.enumerate returns one laptop
  const j = await ctl.newJob();
  await ctl.intakeDevice(j.id);
  assert.equal((await catalog.listDevices(j.id)).length, 1);
});
```

Update `baseNative.enumerate` in the test harness to return an **array** (`[{...}]`); adjust the existing Phase 1a assertions that assumed a single object. Add a `deviceModel` test asserting `systemDisk`/`nativeId` passthrough.

- [ ] **Step 2: Run to verify they fail** — Run: `node --test tests/aunlock/controller.test.mjs tests/aunlock/deviceModel.test.mjs` → FAIL.
- [ ] **Step 3: Implement** the controller additions, the `deviceModel` passthrough, and update `getController` to construct `createNativeDevices({ invoke: lazyTauriInvoke, isTauri })` and pass it as `native` (with `recover`/`wipe` still the placeholder throwers until their slices). Keep the authorization gate, retention sweep, and `discardJob` unchanged.
- [ ] **Step 4: Run to verify they pass** — then the whole JS suite: `npm test` (from `novaura OS soveriegn/`) → all green.
- [ ] **Step 5: Commit**

```bash
git add "novaura OS soveriegn/src/services/aunlock/controller.js" "novaura OS soveriegn/src/services/aunlock/deviceModel.js" "novaura OS soveriegn/src/services/aunlock/native.js" "novaura OS soveriegn/tests/aunlock/controller.test.mjs" "novaura OS soveriegn/tests/aunlock/deviceModel.test.mjs"
git commit -m "feat(aunlock): controller device picker with system-disk refusal (Phase 1b-A)"
```

---

### Task 5: AunlockWindow — scan & pick a connected device

**Files:**
- Create: `novaura OS soveriegn/src/services/aunlock/connectedPanel.js` (pure view model)
- Modify: `novaura OS soveriegn/src/components/windows/AunlockWindow.jsx`
- Test: `novaura OS soveriegn/tests/aunlock/connectedPanel.test.mjs`, extend `novaura OS soveriegn/tests/aunlock/window.test.*`

**Interfaces:**
- Consumes: `controller.listConnectedDevices()`, `controller.intakeDevice(jobId, raw)`.
- Produces: `export function describeConnectedDevices(list)` → `{ rows }` where each row is `{ label, sub, selectable, systemDisk }` — `selectable` is `false` when `systemDisk !== false`; `label` from model/serial, `sub` from kind/bus/storage; an empty list yields `{ rows: [] }` (the empty-state marker).

- [ ] **Step 1: Write the failing tests**

```js
test('describeConnectedDevices marks the system disk unselectable', () => {
  const { rows } = describeConnectedDevices([
    { model:'WD', serial:'S1', kind:'drive', systemDisk:false },
    { model:'OS',  serial:'OS', kind:'drive', systemDisk:true },
  ]);
  assert.equal(rows[0].selectable, true);
  assert.equal(rows[1].selectable, false);
});

test('an empty list yields no rows (empty state)', () => {
  assert.deepEqual(describeConnectedDevices([]).rows, []);
});
```

Window smoke test: a "Scan for devices" action calls `listConnectedDevices`, renders the rows, and clicking a selectable row calls `intakeDevice(jobId, raw)`; the system-disk row is disabled.

- [ ] **Step 2: Run to verify they fail** — FAIL (module missing).
- [ ] **Step 3: Implement** `describeConnectedDevices` and the `AunlockWindow` scan/pick UI (a "Scan for devices" button in `JobPanel` that lists results; selectable rows intake on click, the system disk is shown disabled with a "this PC" tag). Keep the existing authorize/recover/sanitize/discard controls.
- [ ] **Step 4: Run to verify they pass** — then `npm test` and `npm run build` (from `novaura OS soveriegn/`) → green, clean build.
- [ ] **Step 5: Commit**

```bash
git add "novaura OS soveriegn/src/services/aunlock/connectedPanel.js" "novaura OS soveriegn/src/components/windows/AunlockWindow.jsx" "novaura OS soveriegn/tests/aunlock/connectedPanel.test.mjs" "novaura OS soveriegn/tests/aunlock/window.test."*
git commit -m "feat(aunlock): scan and pick a connected device in the window (Phase 1b-A)"
```

---

### Task 6: Gated live check + crate-decision doc

**Files:**
- Create: `novaura OS soveriegn/src-tauri/aunlock/livecheck-enumerate.md` (procedure + what PASS looks like)
- Create: `novaura OS soveriegn/scripts/aunlock-livecheck-enumerate.ps1` (optional helper that prints the raw CIM JSON for comparison against the app's output)
- Modify: `MASTER_AUDIT_TODO.md` (Aunlock Phase 1b-A entry)

**Interfaces:** none (verification + docs only).

- [ ] **Step 1: Write the live-check procedure** — like Sentinel's Task 9: operator plugs a known USB drive/adapter into the real desktop build, opens Aunlock via the `aunlock` terminal command, clicks "Scan for devices," and confirms: (a) the connected drive appears with correct model/serial/size; (b) the host OS disk appears flagged `systemDisk` and is unselectable; (c) no device is written to or modified (read-only); (d) with nothing connected, the empty state shows. Record PASS/observations in the doc.
- [ ] **Step 2: Document the crate decision** — PowerShell-CIM chosen over `sysinfo`/`nusb`: why (no new deps, pure testable parse, matches existing process-exec modules), and the switch criteria if the live check shows gaps.
- [ ] **Step 3: Run the gated live check** — **STOP and get the operator's go-ahead** (hardware + their machine); this is a gated step, not an autonomous one. Capture the result.
- [ ] **Step 4: Commit**

```bash
git add "novaura OS soveriegn/src-tauri/aunlock/livecheck-enumerate.md" "novaura OS soveriegn/scripts/aunlock-livecheck-enumerate.ps1" MASTER_AUDIT_TODO.md
git commit -m "docs(aunlock): device-bridge live check + crate decision (Phase 1b-A)"
```

---

## Notes for the executor

- **Run Rust tests** with `npm run tauri:test` and the Rust compile check with `npm run tauri:check`, both **from the `novaura OS soveriegn/` subfolder** (that is where the npm scripts live; the repo root has none). Run the JS suite with `npm test` from the same subfolder.
- **Stage only the files each task names** — Gemini edits this tree in parallel; never `git add -A`.
- The recover/wipe native methods **stay placeholders** this slice; only `enumerate` becomes real. The authorization gate, retention, and terminal-only launcher gating are not touched.
- Task 6's live check is the only **gated stop**; Tasks 1–5 run continuously.
