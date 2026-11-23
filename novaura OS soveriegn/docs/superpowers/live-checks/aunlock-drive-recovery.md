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
3. [ ] `aunlock_list_dir(serial, sizeBytes, letter, "")` and `("Users")` list entries; the junction
       IS listed with the note "link (junction/symlink) — not followed" and cannot be descended into.
4. [ ] `aunlock_list_dir(letter, "..\\..")` and an absolute subpath are rejected (escape).
5. [ ] `aunlock_recover_files(job, letter, {preset:true, paths:[]})` returns entries with
       `sourceType:"live"`; preset folders only; the junction target is not copied.
6. [ ] Every staged file under `%APPDATA%\novaura-sovereign\aunlock_recovered\<job>\` verifies:
       `aunlock_verify_recovered(job, stagedRef, size, checksum)` (the Verify button) returns `true`
       for every row, including the >16 MiB file (multiple records) and the 0-byte file (one
       record). Flip one byte in a staged file → Verify reports a mismatch or a decrypt error,
       never `true`.
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
14. [ ] Outcome shape: a normal run returns `complete:true, skipped:[], stopReason:null`. In the
        low-disk run (check 12) the result is an Ok `RecoverOutcome` with the files staged so far
        in `entries`, every omitted file in `skipped` (reason "disk full"), `complete:false`,
        `stopReason:"disk full"`. A volume refusal (check 11) stays an Err, never an empty Ok.
15. [ ] Per-device health: with Drive A attached, `aunlock_read_health(serial of A)` reports A's
        health, not the bench PC's system disk; with no/unknown serial it falls back to the
        worst disk.
16. [ ] Last-access time: compare `LastAccessTimeUtc` of Drive A files before/after a recover.
        Windows often disables last-access updates (`fsutil behavior query disablelastaccess`),
        so unchanged is expected; note the setting in the result. Opening a file read-only can
        still touch metadata on some setups. True forensic read-only needs a read-only mount or
        a hardware write-blocker, which is out of Plan 1 scope.
17. [ ] Pull Drive A mid-copy: command returns an error/skips, app stays responsive, purge still works.

## UI walkthrough (Aunlock window → job tab → Recovery)
18. [ ] Intake Drive A into a job. The Recovery section shows Drive A's health (not the bench PC's
        system disk) and lists A's volume as recoverable (Browse / Recover user files enabled).
19. [ ] Before recording authorization: Browse and Recover are refused with the authorization
        message; drive health and the volume list still show (hardware metadata only).
20. [ ] After recording authorization: Browse lists folders first, then files; clicking a folder
        descends, Up climbs. Tick one folder and one file → "Recover selected" → the outcome banner
        reads "Recovered N files (size)"; the Staged list shows those rows with size and a checksum
        prefix — never file contents.
21. [ ] "Recover user files (all volumes)" pulls only the preset folders (Desktop, Documents,
        Downloads, Pictures, Videos, Music, Favorites, Links) from every recoverable volume.
22. [ ] Drive B (BitLocker) volume row shows the encrypted reason with Browse/Recover disabled.
        A suspended/unlocked BitLocker volume on an otherwise-clear disk is also refused when
        Browse or Recover is aimed at it directly (controller explicit-letter check).
23. [ ] "Discard job + data": the job tab disappears and `aunlock_recovered\<job>` is gone. Then
        repeat with a staged file held open by another program: discard reports the files could
        not be deleted yet and will be retried, the tab shows `purge-pending`; release the file,
        reopen the Aunlock window → the job is gone and its folder deleted.
24. [ ] Low disk (check 12) from the UI: the banner warns "Partial recovery … stopped — disk full"
        and the Skipped list names every omitted file.

## Final-review fix wave checks
25. [ ] Non-elevated launch (normal double-click, NOT "Run as administrator"): if BitLocker status
        can't be read, Drive A's volume shows "Encryption status could not be verified … run
        Sovereign as administrator" — refused, and NOT told to reclaim. Relaunch elevated → the
        same volume is recoverable. Record which launch mode the bench needs.
26. [ ] OneDrive known-folder profile on Drive A (`Users\<name>\OneDrive\Desktop|Documents`): the
        preset recovers the locally present OneDrive files; online-only placeholders appear in
        Skipped as "online-only cloud file — not downloaded" (nothing is downloaded — confirm no
        new files and no hydration on Drive A afterwards).
27. [ ] An EFS-encrypted file on Drive A (`cipher /e`): listed with the EFS note, not selectable,
        and in Skipped as "file-based encryption (EFS) — not recovered" — never staged.
28. [ ] Discard during a run: start "Recover user files" on a large tree, click "Discard job +
        data" mid-run → the job shows `purge-pending` ("will be retried"), the run stops at the next
        file, and when the window refreshes the job and `aunlock_recovered\<job>` are both gone. No
        rows remain for it. Start a second recovery on the same job while one runs → refused.
29. [ ] Orphan reconciliation: with the app closed, create an empty folder
        `aunlock_recovered\job_999_orphan`; open the Aunlock window → the folder is deleted.
30. [ ] Device binding: two drives in a dual-bay dock that report the same serial → neither is
        recoverable under one job unless their sizes differ (then only the matching one).
        Calling `aunlock_list_dir` / `aunlock_recover_files` directly (DevTools) with the intaken
        device's serial and the bench's own `C:` letter, or another device's letter → refused.

## Not in Plan 1 (follow-ups)
- Live progress during a long copy — needs a native progress channel (Tauri event); today the UI
  shows a busy state until the run returns. Cancel is available indirectly (Discard).

## Result
Status: NOT YET RUN. Needs the owner's hardware — a known unencrypted USB drive and a BitLocker
drive — attached to a freshly built and installed app. All Sovereign builds carry version 1.0.0,
so compare the `app.exe` date to confirm the new binary, not a stale installer.
Date / build / tester / outcome: _(fill in when run)_
