# Aunlock — Drive Recovery Module (forensic tier) — Design

**Date:** 2026-11-22
**Owner:** Dillan Copeland
**Status:** Draft for owner approval
**Parent spec:** [2026-11-19-aunlock-nova-design.md](2026-11-19-aunlock-nova-design.md)
(this is the drive-recovery half of the parent spec's module 1; the device-class paths —
LAN recovery stick, Android, iPhone — remain their own slices)

## Intent & why

Make Aunlock's **recover** step a drive-recovery capability that a refurb or data-recovery
shop would choose over the standalone tools they'd otherwise buy — and then go past them.
Owner-authorized, read-only, on-record recovery of a drive's data: present files, **deleted**
files, data from **damaged** filesystems and **failing** disks, across the filesystems a bench
actually meets, up to and including **forensic-tier** reconstruction. Today `controller.recover`
is wired and authorization-gated but `native.recover` is a placeholder that produced an empty
manifest. This module makes it real and deep.

The owner picked the **forensic ceiling** (2026-11-22): match the best standalone recovery
suites and push beyond them into the forensic-lab tier. We never ship lean here —
[[feedback_never_ship_lean]].

## Competitive target (what each capability has to beat)

| Capability | Standalone tool we must match or beat |
| --- | --- |
| Browse + select / presets, preview, filter | Disk Drill, EaseUS, Recuva |
| Multi-filesystem read (NTFS/exFAT/FAT/ext4/HFS+/APFS) | R-Studio, UFS Explorer |
| Deleted-file signature carving | PhotoRec |
| Lost / deleted partition recovery | TestDisk |
| Bad-sector-tolerant imaging of failing disks | GNU ddrescue, HDDSuperClone |
| Drive health (SMART) | CrystalDiskInfo, GSmartControl |
| RAID / spanned reconstruction, damaged-FS deep repair | X-Ways Forensics, EnCase, R-Studio (RAID) |

**Our edge none of them have:** recovery is one stage of an integrated, on-record pipeline —
intake → provenance → **recover** → sanitize → certificate → revive — with encrypted staging,
retention, and chain-of-custody. Standalone tools recover; none hand a shop resale-ready
paperwork and a sanitized, revived machine at the end.

## Goals

- **Read-only, owner-authorized access** to the intaken disk's volumes; the source is never
  written, repartitioned, or modified.
- **Live-file recovery:** browse + select and one-click presets (standard user folders),
  preview, filter by type/date/size, verify recovered files.
- **All the filesystems a bench sees:** NTFS, exFAT, FAT32, ext4, HFS+, APFS — parsed
  read-only, on Windows, from an attached drive or a captured image.
- **Deleted-file recovery:** signature carving of unallocated space (PhotoRec-class) plus
  filesystem-aware undelete (NTFS `$MFT`, ext inodes/journal, APFS).
- **Lost / deleted partition recovery:** scan for and reconstruct partition layouts read-only,
  then recover from them (TestDisk-class).
- **Failing-disk imaging:** bad-sector-tolerant, read-only block imaging with a sector map,
  multi-pass retry, and **resume** (ddrescue-class); recovery runs **from the image** so a
  dying drive is read as little as possible.
- **Drive health:** SMART read up front, so the operator images-first when a drive is sick.
- **Forensic tier:** RAID/spanned-volume reconstruction from member disks or images;
  damaged-filesystem deep repair to extract data; image-map-driven multi-pass recovery.
- **Encrypted at rest + retention:** recovered bytes and images are encrypted on disk, counted
  against the ≤10-day / 3-job rolling window, and **actually deleted** (bytes, not just rows)
  on purge/expiry. Budget + backpressure protect the host — no size caps
  ([[feedback_no_kb_caps]]).

## Non-goals

- **Device-class paths** (LAN recovery stick, Android, iPhone) — their own slices in the parent
  spec; different hardware, different competitors.
- Cloud / multi-node sync — local to the Sovereign node.
- Writing data **back** to the source device, or in-place filesystem repair of the owner's
  drive (we repair our *copy/image* to extract data; the source stays untouched).
- Price/market decision to chase the forensic market commercially — that's a business call, not
  this doc; the capability is built regardless.

## Anti-goals (HARD BOUNDARY — inherited verbatim from the parent spec)

**No lock circumvention, ever.** This module reads **unencrypted media the owner authorizes**.
It must never defeat BitLocker / FileVault / file-based encryption / Secure Enclave without the
owner's key, write to or alter the source, or treat a locked/encrypted volume as recoverable.
"Damaged-filesystem deep repair" and "deleted-file recovery" operate on **unencrypted** data
the owner owns — recovering a deleted file or a corrupt structure is not bypassing a lock. A
volume we cannot read honestly (encrypted without key, no establishable authorization) is
**refused and routed to reclaim** — never force-opened. Crossing this boundary is a failure even
if the code "works." Every plan task is checked against this line.

## Constraints

- **Sovereign only** (Tauri 2 / React / Rust). Never touch `NovAura-WebOS/`.
- All native capability (volume resolve, read-only block/file IO, FS parsing, carving, imaging,
  RAID math, crypto) lives in **Rust**; JS orchestrates through the existing
  `controller.recover` seam and renders the Sovereign panel.
- Reuse existing infra: the `aunlock_recovered` Dexie table (extended), `get_app_data_dir()`
  for on-disk staging, the DPAPI seal for small per-file/-image keys, the authorization gate,
  and the retention sweep. Multi-GB bytes **never** go through `sync_vault_state` (in-memory
  seal) or IndexedDB.
- Recovered client data + images: encrypted at rest, ≤10 days / 3 most-recent jobs, manual
  purge, bytes deleted on purge.

## Approaches considered

- **Native Rust by default; a GPL/third-party engine only where native would lose capability
  (DECIDED 2026-11-22).** Build imaging, FS parsers, carving, partition and RAID reconstruction
  natively in Rust (permissively-licensed crates — `ntfs`, `fatfs`, ext4 readers, etc.). Native
  is the strong default: it keeps Sovereign self-owned and free of copyleft distribution strings
  (the owner's Aetherium GPL-rewrite stance), and the owner finds wrappers "cheap." Wrapping a
  mature GPL tool (PhotoRec/TestDisk/ddrescue) is permitted for a specific component **only**
  when going native would be a real capability downgrade versus that tool — capability is never
  cut to stay native, and a wrapper is never chosen merely to save time when native can match it.
  Decided **per engine, at that plan's design time**, native assumed, with real evidence required
  to pick a wrapper. Expected native: imaging, NTFS/FAT/exFAT, carving, partition scan, RAID
  math. Only candidates even worth evaluating for a wrapper: APFS/HFS+ parsing and
  damaged-filesystem deep repair.
- **Sequenced plans, not a monolith (CHOSEN).** Build the full forensic depth as an ordered
  series of deep plans (below), each a shippable increment with its own tests and gated live
  check — so nothing is cut, and the module stays plannable. *Chosen over* one giant plan
  (unreviewable) and over *cutting capabilities* (rejected — never lean).
- **Store bytes in Dexie / single-seal vault.** *Rejected:* breaks on multi-GB data; wrong
  store for images and large recoveries.

## The how (architecture, decided)

- **New Rust subsystem `aunlock_recover*`** mirroring the device bridge's split: thin Tauri I/O
  shells (`aunlock_recover.rs`, `aunlock_image.rs`, …) over pure, unit-tested `_rules` modules
  (FS structure parsing, carving signatures, partition/RAID math, path/traversal guards,
  refusal predicates, manifest shaping). The spawn / raw-block-IO / crypto lines CI can't cover
  get **gated live checks** like the device bridge's Task 6 and Sentinel's Task 9.
- **Commands (shape):** `aunlock_read_health(device_ref)`,
  `aunlock_list_volume(device_ref)`/`aunlock_list_dir(...)` (read-only browse),
  `aunlock_recover_files(job_id, device_ref, selection)` → `Vec<RecoveredEntry>`,
  `aunlock_image_device(job_id, device_ref, opts)` → image + sector map,
  `aunlock_scan_deleted(...)`, `aunlock_scan_partitions(...)`,
  `aunlock_reconstruct_raid(members, layout)`, `aunlock_purge_recovered(job_id)`.
- **Staging:** `get_app_data_dir()/aunlock_recovered/<jobId>/…` (files) and
  `…/aunlock_images/<jobId>/…` (images + maps). Mirrors source relative paths. Bytes stream;
  no whole file/image is held in memory.
- **Encryption at rest:** streaming AEAD (chacha20poly1305 / AES-256-GCM) in frames, per-file/
  per-image random key; the small key is DPAPI-sealed (existing seal) and stored with the
  manifest.
- **Recover-from-image:** once a device is imaged, every later engine (browse, carve, partition
  scan, FS parse, RAID) runs against the **image**, not the drive — decoupling recovery from
  failing hardware and giving repeatable, multi-pass runs.
- **JS seam:** `native.recover` stops throwing and invokes the Rust commands; `controller`
  keeps its gate → recover → status flow; `catalog.putRecovered` gains `stagedRef` (+ fields
  for source: live / carved / partition / image). `deleteJobCascade` and the retention sweep
  call `aunlock_purge_recovered` so on-disk bytes die with the rows.
- **UI:** the Aunlock job tab gains a recovery view — health banner, volume/partition tree,
  browse+select with preview/filter, preset buttons, an imaging panel (progress, sector map,
  pass log), and a staged-results list with verify. Follows the existing Sovereign panel +
  3-job-tab pattern.

## Build sequence (ordered plans — each deep, shippable, gated)

Each is its own design-backed plan (`writing-plans`) with TDD and, where it touches raw
hardware/crypto, a gated live check. Order ships working recovery fast, then deepens.

1. **Access + live recovery + staging spine + health.** Read-only volume resolve (refuse
   encrypted/locked), SMART health, NTFS/exFAT/FAT browse + select + presets, preview/filter/
   verify, streaming encrypted staging, manifest, retention that deletes bytes, budget/
   backpressure. *Beats:* consumer transfer tools + CrystalDiskInfo. *Live check:* real
   attached drive.
2. **Bad-sector-tolerant imaging + recover-from-image.** ddrescue-class read-only imaging with
   sector map, multi-pass retry, resume; re-point the Plan 1 engines at the image. *Beats:*
   ddrescue, as an integrated step. *Live check:* a drive with induced read errors.
3. **Non-Windows filesystems (ext4, HFS+, APFS), read-only.** Parse and browse/recover Mac and
   Linux drives/images. *Beats:* the "Windows-only" ceiling of many tools; matches R-Studio
   multi-FS.
4. **Deleted-file recovery.** Signature carving of unallocated space + FS-aware undelete (NTFS
   `$MFT`, ext inode/journal, APFS). *Beats:* PhotoRec, Recuva.
5. **Lost/deleted partition recovery.** Scan + reconstruct partition layouts read-only, recover
   from them. *Beats:* TestDisk.
6. **Forensic tier.** RAID/spanned reconstruction from members or images; damaged-filesystem
   deep repair to extract data; image-map-driven multi-pass recovery. *Beats into:* X-Ways /
   EnCase territory.

## Review focus (seed for every plan — inputs the happy path won't hit)

1. **Read-only source** — assert the source is never opened for write; imaging and all engines
   touch only copies/images.
2. **Reparse points / symlinks / junctions / hardlinks** on the source — never followed off the
   intended scope or off-volume; recovery stays inside its target.
3. **Encrypted/locked-volume refusal fires** — BitLocker/RAW/encrypted → refused and routed to
   reclaim, never copied as ciphertext, never a silent empty "done".
4. **Retention deletes bytes** — after purge/cascade/expiry, the on-disk `<jobId>` files **and**
   images are gone, not just Dexie rows.
5. **Secrets in recovered data** — manifests and logs record **paths/metadata, never contents**;
   flight-recorder redaction covers all error text.
6. **Host disk exhaustion / malformed on-disk structures** — imaging or carving a drive larger
   than free space stops cleanly under budget; a corrupt/adversarial FS structure can't panic,
   loop, over-read, or write out of bounds (forensic engines parse hostile data by nature).

## What's left to the builder (per-plan)

Exact Rust crates per filesystem and for the AEAD; the encrypted-frame format; the SMART access
method on Windows; the imaging sector-map format and resume journal; carving signature set;
partition-scan heuristics; RAID layout detection vs. operator-specified; the progress-event
channel (Tauri event vs. polled status); the exact `device_ref`/`selection` payloads from the
catalog. TDD throughout; native/hardware/crypto paths get gated live checks. Each plan is
written only when its predecessor is approved, so interfaces are known before the next is
planned.
