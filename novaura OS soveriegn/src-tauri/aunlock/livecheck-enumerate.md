# Aunlock Phase 1b-A — Device-bridge live check (read-only enumeration)

The device-spec normalization, the read-only guard on the query, the JS bridge, the controller's
system-disk refusal, and the scan/pick view model are all covered by CI
(`npm run tauri:test`, `npm test`). The one thing CI cannot exercise is the actual hardware read —
`aunlock_enumerate_devices` spawning PowerShell and reading real disks. This is proven here, by
hand, on the real desktop build, exactly like the Sentinel sandbox live check (Task 9). **It is a
gated step: run it only with the operator present and on their go-ahead** — it reads the machine's
own disk inventory.

## What it proves

1. **Real devices appear** with correct Model / Serial / capacity.
2. **The host OS/boot disk is flagged** `systemDisk` and is **shown disabled** ("this PC — not an
   intake target") — it can never be picked for intake (and so never for a future sanitize).
3. **Read-only** — nothing is written to, mounted-for-write, repartitioned, or unlocked on any
   device. (The query contains no mutating cmdlet; `cim_query_is_read_only` enforces that in CI.)
4. **Empty state** — with nothing connected, the scan shows "No device detected," not an error.

## Procedure

1. Build and run the Sovereign desktop app (`npm run tauri:build`, install, launch — or
   `npm run tauri:dev`).
2. Open the Aunlock window: in the Sovereign terminal, type `aunlock` (it is hidden from the
   launcher by design — terminal-gated).
3. Start a job (**+ New job**), then click **Scan for devices** with **nothing** external
   connected. Confirm:
   - the host's internal disk(s) appear, the OS/boot disk tagged **"this PC — not an intake
     target"** with its **Intake** button disabled;
   - no non-system device is listed (or only the ones that are genuinely attached).
4. Connect a **known** USB drive or a drive on a USB adapter. Click **Scan for devices** again.
   Confirm:
   - the drive appears with the right model/serial/capacity and an **enabled** Intake button;
   - clicking **Intake** records it on the job (it shows in the job), and the OS disk still cannot
     be intaken.
5. Cross-check the raw reading against the helper script (next section) — the drives and the
   boot/system flags should match what the app shows.
6. Unplug everything, scan once more, and confirm the **empty state** copy appears.

## Raw cross-check (read-only)

`scripts/aunlock-livecheck-enumerate.ps1` runs the **same** read-only query the Rust command uses
(`AUNLOCK_CIM_QUERY`) and prints the JSON. Compare its output to what the window shows:

```text
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/aunlock-livecheck-enumerate.ps1
```

Every disk the app lists should be in this JSON; the disk with `IsBoot`/`IsSystem` true is the one
the app must mark non-selectable. BitLocker-protected volumes report `Encrypted: true` (→ lock
"encrypted"); when BitLocker status can't be read the field is null (→ lock "unknown",
deny-by-default) — that is expected, not a failure.

## Crate decision — PowerShell CIM over `sysinfo` / `nusb`

Enumeration reads disks by shelling out to a read-only PowerShell query (`Get-Disk` +
`Get-BitLockerVolume`) and parsing the JSON with `serde_json`, rather than adding a native
enumeration crate. Why:

- **No new dependencies.** `serde_json` was already in the app crate; nothing else is added.
- **The testable surface stays pure.** All the logic — field mapping, deny-by-default
  classification, the system-disk flag, tolerance of a bare object / missing fields / garbage —
  lives in `normalize_devices`, unit-tested off captured JSON fixtures. Only the spawn is
  untestable in CI, and this live check covers it.
- **It matches the codebase.** `llm.rs`, `engines.rs`, and `forge.rs` already drive external
  processes this way; a refurb bench is Windows, which is the app's native target.

**Switch criteria** — move to `sysinfo` (disks) and/or `nusb`/`rusb` (raw USB) if the live check
shows the PowerShell path can't deliver what a slice needs: e.g. non-disk USB devices (phones are
already slated for `adb`/libimobiledevice, not this path), per-partition detail the recovery slice
needs, or environments where `Get-Disk` is unavailable. Switching is a ruling, not a silent change,
and `normalize_devices`' contract (its input JSON shape) stays the seam.

## Result

Record PASS/observations here after a run:

- Date / build version:
- Host OS disk flagged & non-selectable: ☐
- External drive detected with correct specs: ☐
- Read-only confirmed (nothing modified): ☐
- Empty state on no device: ☐
- Notes / crate-decision follow-ups:
