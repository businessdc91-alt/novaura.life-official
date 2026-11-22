# Aunlock drive recovery — gated live check

Status: NOT YET RUN. CI cannot drive real hardware; this is the proof obligation for the Rust
I/O shell (`src-tauri/src/aunlock_recover.rs`). Run at Plan 1 Task 10. Do not mark passed until
every box below is checked against a real install.

Commands under test: `aunlock_resolve_volumes`, `aunlock_read_health`, `aunlock_list_dir`,
`aunlock_recover_files`, `aunlock_purge_recovered`. Drive the installed app via the WebView2
DevTools port + CDP script (see project_sovereign_live_testing). Never use real client data.

## Setup
- Drive A: a known UNENCRYPTED USB drive (NTFS or exFAT) with a `Users\<name>\Documents`,
  `Desktop`, `Pictures` tree, including: a >16 MiB file (multi-block), a 0-byte file, a file
  whose name is `NUL.txt`-style or contains a reserved/odd name (create via `\\?\` path), and a
  junction/symlink pointing outside the drive.
- Drive B: a BitLocker-encrypted USB drive (locked, and also unlocked-but-encrypted).
- Before starting, record every file path, size and last-write time on Drive A (e.g.
  `Get-ChildItem -Recurse -Force | Select FullName,Length,LastWriteTimeUtc | Export-Csv before.csv`).

## Checks
1. [ ] Attach Drive A. `aunlock_resolve_volumes(serial)` returns its volume with `encrypted:false`, `readable:true`.
2. [ ] `aunlock_read_health` returns a status (and does not modify the drive).
3. [ ] `aunlock_list_dir(letter, "")` and `("Users")` list entries; the junction is NOT listed.
4. [ ] `aunlock_list_dir(letter, "..\\..")` and an absolute subpath are rejected (escape).
5. [ ] `aunlock_recover_files(job, letter, {preset:true, paths:[]})` returns entries with
       `sourceType:"live"`; preset folders only; the junction target is not copied.
6. [ ] Every staged file under `%APPDATA%\novaura-sovereign\aunlock_recovered\<job>\` decrypts:
       records are `u32 LE keylen || sealed key || u32 LE ctlen || ct`; open each sealed key
       (DPAPI), `decrypt_chunks`, concatenate; length equals `size` and SHA-256 equals `checksum`.
       Includes the >16 MiB file (multiple records) and the 0-byte file (one record).
7. [ ] Each record has a DIFFERENT sealed key (no key reuse); the staged files contain no plaintext
       (grep a known string from a source file).
8. [ ] Reserved/odd names were staged under sanitized names (no `:` / device names on disk).
9. [ ] `paths` selection: a path outside the volume (`D:\..\C:\Windows`) or on another drive is refused.
10. [ ] `aunlock_purge_recovered(job)` returns `true` and the job directory is gone; calling it
        again returns `true` (absent tree).
11. [ ] Attach Drive B: `aunlock_recover_files` is REFUSED with an error pointing to reclaim, and
        stages nothing (no empty "success").
12. [ ] Low-disk backpressure: fill the staging volume (or temporarily point at a small volume)
        and confirm the job stops with a clear error, leaving the source and app intact.
13. [ ] Source unchanged: re-run the inventory on Drive A and diff against `before.csv` —
        identical files, sizes and last-write times; no new files (e.g. no `System Volume
        Information` writes caused by the app, no temp files). Mount was read-only throughout.
14. [ ] Pull Drive A mid-copy: command returns an error/skips, app stays responsive, purge still works.

## Result
Date / build / tester / outcome: _(fill in at Task 10)_
