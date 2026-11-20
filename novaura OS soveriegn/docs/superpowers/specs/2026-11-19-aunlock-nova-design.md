# Aunlock Nova — Reclaim & Refurb Toolset — Design

**Date:** 2026-11-19
**Owner:** Dillan Copeland
**Status:** Draft for owner approval

## Intent & why

An internal Sovereign operator tool for a device refurbishment / repair shop. Plug a
device in over USB, or boot it onto the LAN, and the tool: identifies the device and its
specs, lets the operator access and recover the **owner's** files and drives, logs where
the device came from and the authorization to work on it, and produces a sanitized,
certified, resale-ready machine. It replaces an ad-hoc manual workflow — the goal is to
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
- **Hub:** runs inside Sovereign, opened by a gated terminal command; the catalog and any
  staged recovered data live in the local DB / encrypted vault.

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
  is **minimized and purgeable** (default: staged for the active job, encrypted at rest,
  explicit purge).
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

## What's left to the builder

- Exact Rust crates for USB enumeration and Windows drive mounting; the live-Linux base and
  build for the recovery stick; the sanitization-certificate format/template; the
  terminal-command wiring (follow the existing Sovereign command registry). TDD throughout;
  native/hardware paths that can't run in CI get a gated live check like Sentinel's Task 9.
