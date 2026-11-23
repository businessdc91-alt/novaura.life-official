# Aunlock Nova — Reclaim & Refurb Toolset — Design

**Date:** 2026-11-19
**Owner:** Dillan Copeland
**Status:** Draft for owner approval

## Intent & why

A single Sovereign subapp — the refurbisher's whole bench, built for device refurbishment /
repair shops to use end to end. Plug a device in over USB, or boot it onto the LAN, and the
tool: identifies the device and its specs, lets the operator access and recover the
**owner's** files and drives, logs where the device came from and the authorization to work
on it, produces a sanitized, certified, resale-ready machine, and then **revives** it by
recommending and installing the right Linux distro for that hardware. Intake → recover →
sanitize/cert → revive, in one app. It replaces an ad-hoc manual workflow — the goal is to
make the legitimate work *fast and on-record*, with the paperwork that lets devices be
resold and that keeps the operator clear of handling property they can't account for.

## Goals (v1 — "B, lean")

- **Identify over USB:** make/model/serial/IMEI/storage/battery and lock-state, written to
  a device catalog. Works on a locked device (it's a hardware handshake, not user data).
- **File / drive access & recovery** — reading the owner's own, unencrypted data:
  - **Windows laptop:** mount an attached/internal drive (unencrypted) and browse/copy; or
    boot the target from the Sovereign **recovery stick** (live Linux), which networks to
    the hub and streams the internal drive's files over the LAN. No login needed — a
    Windows login password does not encrypt the disk.
  - **Android:** MTP / `adb` file access **when the device is unlocked and the computer is
    authorized by the owner**.
  - **iPhone:** AFC photo/file access **when the device is unlocked and the computer is
    trusted** (owner's passcode).
- **Intake / provenance log:** per device — who brought it, its source and the authorization
  to work on it (receipt, decommission manifest, owner present), timestamp, operator.
- **Sanitize + certify:** a NIST 800-88 wipe of a device **that has recorded authorization**,
  producing a sanitization certificate and a chain-of-custody record.
- **Revive (distro center):** a curated catalog of Linux distros, each with an honest
  write-up (what it's most like — Windows/Mac and which edition — strengths, flaws, and
  what it's best for: gaming, AI inference, atomic/immutable, full control, lightweight,
  reviving old hardware); a **spec-matched recommendation** that reads the machine's CPU/RAM/
  GPU/age (from intake) and names the distros that will make *that* box snappy; and
  **one-click → checksum-and-signature-verified download → bootable USB**. Writing/installing
  is operator-initiated.
- **Hub:** runs inside Sovereign, opened by a gated terminal command; the catalog and any
  staged recovered data live in the local DB / encrypted vault. The job view shows up to
  **3 active jobs as separate tabs**.

## Non-goals (v1)

- No built-in stolen/lost **blacklist feed** — there is no free universal source. Intake
  records IMEI/serial and a manual stolen-check field; a paid API (GSMA / CheckMEND) is a
  later hook.
- No cloud / multi-node sync — local to the Sovereign node.
- No part-level diagnostics/repair beyond identification.
- OEM reclaim produces the **proof-of-ownership request packet**; submitting it is manual.

## Anti-goals (HARD BOUNDARY — a failure even if it "works")

**No lock circumvention, ever.** The tool must never bypass or defeat a device's security:

- no BIOS/UEFI supervisor or power-on password stripping (CMOS/EEPROM/backdoor/brute-force);
- no resetting or bypassing a Windows login to hand back a logged-in session;
- no phone lockscreen bypass;
- no defeating encryption (BitLocker / FileVault / file-based encryption / Secure Enclave)
  without the owner's key;
- no Activation Lock / FRP / lost-or-stolen-device-lockdown circumvention.

A locked device with no establishable authorization is routed to **OEM / owner reclaim**, or
marked **"cannot clear — return / recycle."** It is never force-opened. "File/drive access"
means reading unencrypted media the owner authorizes, or a phone the owner unlocks/trusts —
never getting past a lock the operator lacks the credentials or authority for. The gated
terminal command is an operator convenience, **not** a place to hide any of the above.

This boundary is the spine of the tool. Any task in the plan that would cross it is wrong,
regardless of how it is framed.

## Constraints

- **Sovereign only** (Tauri 2 / React / Rust). Never edit `NovAura-WebOS/`.
- Native capability (USB enumeration, drive mount, LAN) lives in **Rust**; the UI is a
  Sovereign panel.
- Catalog + staged data use the existing local DB / encrypted vault. Recovered client data
  is **retained at most 10 days and only for the 3 most recent jobs** — a rolling window,
  each job in its own tab; a 4th job, or the 10-day expiry, purges the oldest automatically.
  Encrypted at rest; a manual purge is also available.
- Reuse existing Sovereign infrastructure: the terminal-command registry, Dexie database,
  vault, and window system.

## Approaches considered

- **A — USB-only, in-app file browser.** Simplest, but has no laptop-recovery path when you
  can't log in, and no multi-bench support. *Rejected:* misses the daily laptop case.
- **B — Hub + feeders (CHOSEN, lean).** A Sovereign hub plus two feeders: direct USB, and a
  LAN recovery-stick that boots the target and streams its drive. Handles the login-locked
  laptop case and multiple bench stations; the intake log + cert make the output
  resale-ready. *Chosen.*
- **C — Full pipeline now** (B + built-in blacklist feed + OEM submission automation +
  diagnostics). *Rejected for v1:* the blacklist needs a paid data source and OEM submission
  is manual; fold these in later.

## The how (decided)

- **Hub:** a Sovereign Tauri subsystem; a gated terminal command (working name `aunlock`,
  renameable) opens its panel.
- **Rust command layer:** enumerate USB devices and read specs; mount/read attached
  unencrypted drives; run the LAN listener the recovery stick reports to; perform the
  sanitization wipe; generate certs.
- **Recovery stick:** a documented live-Linux image that, on boot, networks to the hub and
  streams the internal drive's files (handles login-locked, non-BIOS-locked laptops; a BIOS
  boot-lock blocks it — those pull the drive to read over a USB adapter, or go to OEM
  reclaim). Building/publishing the image is a deliverable; the stick's internals are proven
  by a live check, not CI (like Sentinel's sandbox scripts).
- **Phones:** Android via `adb`/MTP, iPhone via libimobiledevice — invoked as tools; they
  only function when the owner unlocks/trusts.
- **Catalog:** device records, intake/provenance, runs, recovered-file manifests, and certs
  in the local DB; recovered bytes staged in the vault, purgeable.
- **Window / delivery:** Aunlock is one subapp with a tabbed panel (up to 3 job tabs). It
  can run in Sovereign's window system **and** as its own native Windows-desktop window
  launched from a desktop shortcut, auto-updating on the Sovereign runtime (so it stays in
  step with the ecosystem); a job tab can be dragged out into its own desktop window. This
  standalone-window delivery is built as a **reusable pattern** so other Sovereign subapps
  can adopt it later — but it is part of this app, not a prerequisite project.

## Build phasing (one app, sequenced modules)

One subapp, built in order so value ships early and the plan stays plannable:
1. **Device pipeline** — intake/ID, provenance log, file/drive recovery (USB + LAN recovery
   stick), sanitize + cert, tabbed 3-job view.
2. **Revive (distro center)** — catalog, spec-matched recommender, verified download, write
   bootable USB.
3. **Standalone-window delivery** — native desktop window + shortcut + auto-update + tab
   tear-off, built reusably.

### Recovery — slice tracking (module 1)

Recovery splits into the **drive** path (forensic tier — one module, built as an ordered series
of plans; see `2026-11-22-aunlock-drive-recovery-design.md`) and three **device-class** paths
(different hardware, their own slices). Owner set the drive ceiling to **forensic tier** on
2026-11-22 — match/beat the top standalone recovery suites and push past them (never lean).
Status:

- [x] Device intake / ID over USB — Phase 1b-A read-only device bridge (shipped).
- **Drive recovery module (forensic tier)** — beats R-Studio, UFS Explorer, PhotoRec, TestDisk,
  ddrescue, CrystalDiskInfo, into X-Ways/EnCase territory. Plans:
  - [ ] P1 — read-only access + live-file recovery (browse+select + presets) + encrypted
    staging + SMART health. **Built 2026-11-22** on branch `aunlock-drive-recovery-p1`
    (whole-branch reviewed, fix wave applied); **gated live check pending** on real drives
    (`docs/superpowers/live-checks/aunlock-drive-recovery.md`). Tick when the live check passes.
  - [ ] P2 — bad-sector-tolerant imaging + recover-from-image.
  - [ ] P3 — non-Windows filesystems (ext4, HFS+, APFS), read-only.
  - [ ] P4 — deleted-file recovery (signature carving + FS-aware undelete).
  - [ ] P5 — lost/deleted-partition recovery.
  - [ ] P6 — forensic tier: RAID/spanned reconstruction + damaged-FS deep repair.
- [ ] **LAN recovery stick** — boots a login-locked laptop, streams the drive over the LAN
  (own live check, not CI).
- [ ] **Android** file access — MTP / `adb`, only when unlocked and owner-authorized.
- [ ] **iPhone** file access — AFC via libimobiledevice, only when unlocked and trusted.

**Do not close out module 1 until every unchecked path above is built, or explicitly dropped by
the owner.** The HARD BOUNDARY (no lock circumvention, read-only source) applies to all.

## What's left to the builder

- Exact Rust crates for USB enumeration and Windows drive mounting; the live-Linux base and
  build for the recovery stick; the sanitization-certificate format/template; the distro
  catalog's data source and its signature/checksum verification; the standalone-window
  mechanism (Tauri multi-window) and the shortcut/auto-update wiring; the terminal-command
  wiring (follow the existing Sovereign command registry). TDD throughout; native/hardware
  paths that can't run in CI get a gated live check like Sentinel's Task 9.
