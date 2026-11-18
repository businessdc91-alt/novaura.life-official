# Additions — Runtime and Basic API (spec steps 0–1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Installed user apps ("Additions") run in their own opaque-origin frame. Each one gets its own storage through the OS, a per-app network allowlist, and the `novaura` API v1 (`version`, `app`, `storage`, `ui`; `notify`/`ai`/`files` stay closed until plan 2). Existing "my apps" are moved over with their data.

**Architecture:**
- **Native side:** `cyprev` gets a separate pool of addition sessions. Each session has its own CSP, built in Rust from the network origins the person approved.
- **The frame:** it loads `__novaura/boot.js` (a snapshot, served once) and then `__novaura/v1.js` (the bridge). The bridge proves itself with a nonce from the URL fragment, and gets a `MessageChannel` port in return.
- **The OS side:** a router answers each request with permission checks, budgets and chunked storage. Data goes into a new Dexie table, `addition_data`.

**Tech Stack:** Tauri 2 (Rust, custom protocol), React/Vite, Dexie 4.4, node:test (`--experimental-test-module-mocks`), Rust pure tests (`npm run tauri:test`), headless Edge (`scripts/browser-test.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-17-additions-design.md` (approved 2026-11-17). Later plans cover spec steps 2 (services), 3 (packages) and 4 (companions and Cybeni), each written once the previous one lands.

All paths are relative to `novaura OS soveriegn/`. Commands run from there.

## Global Constraints

- **Frame:** sandbox exactly `allow-scripts allow-forms allow-modals`. Never `allow-same-origin`.
- **Data:** a Dexie table `addition_data` with primary key `[appId+key]`, added in database version 22 (it is 21 today).
- **Quota and chunks:** default quota 1 GB per addition, which the person can raise. Large values move in 16 MB chunks. No KB-scale limits anywhere.
- **`ADDITION_CSP`:**
  - scripts and styles: the app's own files, plus esm.sh, cdn.tailwindcss.com, cdn.jsdelivr.net and unpkg.com;
  - `connect-src`/`img-src`/`media-src`/`font-src`/`frame-src`/`form-action`: `'self'`, `data:`/`blob:`, and the network origins the person approved;
  - never a `localhost` or `127.0.0.1` port, and never `http://ipc.localhost`;
  - addition responses send `Access-Control-Allow-Origin: *`.
- **Handshake:**
  - the frame URL is `index.html#nv=<nonce>`;
  - the frame sends `{ __novaura: 'hello', nonce }`;
  - the host checks the `event.source` frame and the nonce, then hands over a `MessageChannel` port;
  - all later traffic uses that port.
- **API v1:**
  - `novaura.version` is `1`; `novaura.app` is `{ id, name, version, permissions }`; every method returns a promise;
  - a method the person has not granted rejects with `{ code: 'permission_denied' }`;
  - the API never prompts mid-call;
  - a v1 method never changes behavior once shipped.
- **Budgets:** 50 requests per second per addition; messages up to 16 MB, with larger data in chunks.
- **Manifest:** `"format": "novapp/1"`, with `apiVersion` 1.
- **Names and badges:**
  - "Additions" in the UI, and the launcher category is "Additions";
  - the window keeps its "Sandboxed" badge and gets a permissions button.
- **Existing "my apps":** each gets a manifest with no permissions and no network, and is marked "added before permissions".
- **Gated, do not touch:** `PREVIEW_CSP` and the Cybeni preview sandbox (they wait for the owner's go-ahead), `NovAura-WebOS/`, and the version in `tauri.conf.json`.
- **Tooling:**
  - Rust tests only through `npm run tauri:test` (a Tauri-linked test binary can't start on Windows), so testable Rust goes in Tauri-free `*_rules.rs` files included by `src-tauri/pure-tests`;
  - write commit messages to a file with bash `printf`, then run `git commit -F <file>` (PowerShell adds a BOM);
  - stage only the files named in each task, because Gemini edits the tree in parallel.

## Rulings made while planning (for the owner to review)

1. **Moving existing "my apps" over happens here, not in step 4.** Step 1 takes those apps off the shared origin, so without the move their data would seem to vanish.
2. **How old data is split up.** All old apps shared one storage.
   - Keys that `@cybeni/backend` wrote under an app's name go only to that app, with the name prefix removed: the addition runtime has no prefix.
   - Plain keys are copied to every old app, since every old app could already read them.
   - Keys belonging to Cybeni projects that were never installed stay behind.
   - Old data is never deleted. Settings offers "Copy old data again".
3. **The network allowlist plumbing moves into this plan.** That means the manifest's `network` field, the person's approval and the CSP built from it. Moved-over apps that call an API can then get it back. The frame reports origins the CSP blocked, and the window shows one banner. The install card stays in step 2.
4. **The `localStorage` replacement holds up to 64 MB per addition.** Browsers allow 5–10 MB. Larger data uses `novaura.storage`, under the 1 GB quota. Past 64 MB, `setItem` throws `QuotaExceededError`, as browsers do.
5. **The storage snapshot arrives as `__novaura/boot.js`.** That file is served once and then deleted, so nothing can read it later.
6. **`notify`, `ai.chat` and `files.*` exist in v1.js from the start.** Here they reject with `permission_denied`, because nothing can grant them yet, or with `not_available` if granted. Plan 2 implements them.
7. **Additions get their own session pool in `cyprev`:** 32 sessions, 256 MB each, 1 GB in total. Cybeni previews then can't push out a running addition.
8. **`@cybeni/backend` must stop overwriting `window.novaura`.** Today it puts its own object there. It keeps `window.cybeniBackend`. Reconciling the `@novaura/sdk` name waits for plan 4.
9. **Backpressure, not failure.** Above 50 requests/s the bridge waits and retries instead of failing. `localStorage` writes are combined into one message every 50 ms and flushed when the page hides.
10. **An app that reloads itself loses its nonce.** The bridge then asks to be relaunched, and the host relaunches it with a new session and nonce.
11. **One window per addition.** The desktop's `openApp` already reuses an open window of the same app, so the storage snapshot never needs syncing between windows.

## Review Focus

1. **An app that calls `location.reload()`** should come back working, with its data. This is pinned in Task 7 (the bridge asks to be relaunched), Task 12 (the controller relaunches) and Task 14 (browser).
2. **An old app that used IndexedDB, Dexie or localforage** can't keep that data: opaque origins have no browser database. The person should be told rather than see a silent failure. Task 11 flags such apps, and Task 13 shows a note.
3. **Closing the window right after a write** must keep the write. Task 7 flushes on `pagehide`, Task 9 keeps the host's port open for a 1 s drain, and Task 14 tests a write followed by a close.
4. **Apps that route with the URL hash** (HashRouter) must start on their default route, not on `#nv=…`. Task 7 checks the hash is empty after boot.
5. **Approving a network origin** only works after a relaunch, because the CSP is fixed for a session. The app should relaunch by itself. Task 12 relaunches on `novaura:addition_changed`.

---

### Task 1: Network origins and `ADDITION_CSP` (Rust pure + JS mirror)

**Files:**
- Create: `tests/additions/network-origins.cases.txt`, `tests/additions/addition-csp.golden.txt`
- Create: `src-tauri/src/addition_csp_rules.rs`; Modify: `src-tauri/pure-tests/src/lib.rs`
- Create: `src/services/additions/network.js`; Test: `tests/additions/network.test.mjs`

**Interfaces:**
- Produces (Rust): `pub fn clean_network_origin(input: &str) -> Option<String>`, `pub fn addition_csp(network: &[String]) -> Result<String, String>` (Err names the first bad origin; it never silently drops one; duplicates are removed and order is kept).
- Produces (JS): `cleanNetworkOrigin(input) -> string | null`, `originOf(url) -> string | null` (scheme://host[:port] of any URL, or null).

- [ ] **Step 1: Write the shared case table and golden file**

`network-origins.cases.txt`: one case per line, `ok <input> => <clean>` or `bad <input>`.
- `ok` cases:
  - `https://api.weather.gov`;
  - `https://API.Weather.gov/` → `https://api.weather.gov`;
  - `https://maps.example.com:8443`;
  - `wss://stream.example.org`.
- `bad` cases:
  - `http://api.weather.gov`, `https://localhost`, `https://localhost:1234`, `https://app.localhost`;
  - `https://127.0.0.1`, `https://[::1]`, `https://192.168.1.5`;
  - `http://ipc.localhost`, `https://ipc.localhost`;
  - `https://*.example.com`, `https://example.com/path`, `https://example.com?x=1`, `https://user@example.com`, `https://example.com;script-src`, `https://exa mple.com`;
  - `https://intranet`, `https://example.com:0`, `https://example.com:99999`;
  - `'self'`, `*`, `data:`, `javascript:alert(1)`.

`addition-csp.golden.txt`: blank-line-separated blocks of `network: <space-separated origins or nothing>` and `csp: <policy>`. There are two blocks: `network:` (empty) and `network: https://api.weather.gov wss://stream.example.org`. The policy text is fixed by the spec. `{N}` is a space and then the origins, or nothing:

```
default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https://esm.sh https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' data: https://esm.sh https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://unpkg.com; img-src 'self' data: blob:{N}; font-src 'self' data: blob:{N}; media-src 'self' data: blob:{N}; connect-src 'self' data: blob:{N}; frame-src 'self' data: blob:{N}; form-action 'self'{N}; worker-src 'self' blob:; object-src 'none'; base-uri 'self'
```

- [ ] **Step 2: Write the failing tests**

Rust, in `addition_csp_rules.rs` `#[cfg(test)]`, reading both files with `include_str!("../../tests/additions/…")`:
- `network_origin_cases_match_the_shared_table`;
- `addition_csp_matches_the_golden_file`;
- `a_bad_origin_is_refused_not_dropped`: `addition_csp(&["https://ok.example".into(), "http://bad".into()])` is an `Err` containing `http://bad`;
- `the_csp_never_allows_local_ports_or_the_ipc_host`: no golden policy contains `localhost`, `127.0.0.1` or `ipc.`.

JS, in `network.test.mjs`:
- `every shared case is cleaned the same way as in Rust`: reads the table and compares `cleanNetworkOrigin`;
- `originOf gives the origin of a blocked URL`: `originOf('https://api.weather.gov/points?x=1')` is `'https://api.weather.gov'`, and `originOf('about:blank')` is `null`.

- [ ] **Step 3: Run them and watch them fail**

Run: `npm run tauri:test` and `node --experimental-test-module-mocks --test tests/additions/network.test.mjs`
Expected: Rust fails to compile (missing fns); JS fails with ERR_MODULE_NOT_FOUND.

- [ ] **Step 4: Implement both**

- Accept only `https:`/`wss:`, a host of LDH labels with at least one dot and no trailing dot, an optional port from 1 to 65535, and an optional single trailing `/`. Lowercase the host.
- Reject IP literals, `localhost`, any `*.localhost`, `ipc.localhost`, userinfo, paths, queries, fragments, wildcards, whitespace, quotes, `;` and `,`.
- Add `#[path = "../../src/addition_csp_rules.rs"] pub mod addition_csp_rules;` to pure-tests.

- [ ] **Step 5: Run both again**

Expected: Rust tests and `network.test.mjs` pass.

- [ ] **Step 6: Commit** `tests/additions/*.txt`, `src-tauri/src/addition_csp_rules.rs`, `src-tauri/pure-tests/src/lib.rs`, `src/services/additions/network.js` and `tests/additions/network.test.mjs`, with the message `feat(additions): network origin rules and ADDITION_CSP`.

---

### Task 2: Addition sessions in `cyprev`

**Files:**
- Create: `src-tauri/src/addition_sessions_rules.rs` (moves `clean_path` and `percent_decode` here from `preview.rs`, with their tests)
- Modify: `src-tauri/src/preview.rs`, `src-tauri/src/lib.rs`, `src-tauri/pure-tests/src/lib.rs`

**Interfaces:**
- Consumes: `addition_csp` (Task 1).
- Produces (pure):
  - `pub struct AdditionSessions`, with `new()`;
  - `publish(&mut self, session: &str, files: Vec<(String /*path*/, String /*mime*/, Vec<u8>)>, csp: String, once: &[String], now: u64) -> Result<usize, String>`;
  - `serve(&mut self, session: &str, raw_path: &str) -> Served`;
  - `clear(&mut self, session: &str)`;
  - `pub enum Served { NotAddition, File { mime: String, body: Vec<u8>, csp: String }, Missing { csp: String } }`.
- Limits: `MAX_ADDITION_SESSIONS = 32`, `MAX_ADDITION_SESSION_BYTES = 256 MiB`, `MAX_ADDITION_TOTAL_BYTES = 1 GiB`, `MAX_ADDITION_FILES = 4000`.
- Produces (commands):
  - `addition_publish(session: String, files: Vec<PreviewFileIn>, network: Vec<String>, once: Vec<String>) -> Result<usize, String>`: the CSP is built here from `network`, never taken from JS;
  - `addition_clear(session: String)`.
- `handle()` serves addition sessions first (with `Access-Control-Allow-Origin: *`), otherwise as before.

- [ ] **Step 1: Write the failing pure tests**
  - `serves_files_with_the_session_csp`;
  - `once_files_are_served_one_time`: a second `serve` of `__novaura/boot.js` gives `Missing`;
  - `spa_fallback_and_bad_paths`: the existing preview cases;
  - `oversized_sessions_are_refused`;
  - `past_the_pool_size_the_oldest_session_goes_but_never_the_new_one`;
  - `an_unknown_session_is_not_an_addition`: returns `NotAddition`, so previews still serve.
- [ ] **Step 2: Run them and watch them fail.** Run `npm run tauri:test`. Expected: it does not compile.
- [ ] **Step 3: Implement the store, then wire up `preview.rs` and the commands.** Re-export `clean_path`/`percent_decode` from `preview.rs` so its current callers compile unchanged.
- [ ] **Step 4: Run** `npm run tauri:test` and `npm run tauri:check`. Expected: all pure tests pass, and the check is clean with no new warnings.
- [ ] **Step 5: Commit** with the message `feat(additions): addition sessions in cyprev with their own CSP`.

---

### Task 3: Fake `cyprev` server and the runtime browser checks (spec step 0, headless half)

**Files:**
- Modify: `scripts/browser-test.mjs`. It gets a second server on `127.0.0.1:<port2>`, a different origin from the runner:
  - `OPTIONS` → 204 with `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Headers: content-type`;
  - `POST /__publish/<session>` with `{ files:[{path,content,mime}], csp, once }`;
  - `POST /__clear/<session>`;
  - `GET /<session>/<path>`, served with the session CSP, ACAO `*`, `no-store`, `nosniff`, once-only files and the SPA fallback.
  - The runner URL gets `cyprev=<base>` in its query (both the static and the `--vite` runner).
- Create: `tests/additions/browser/cyprev.js` with `cyprevBase()`, `publish(session, files, { csp, once })`, `clear(session)`, `goldenCsp(networkList)` (reads `/tests/additions/addition-csp.golden.txt`) and `frameFor(src, sandbox) -> Promise<HTMLIFrameElement>`.
- Create: `tests/additions/browser/runtime.browser.mjs`

- [ ] **Step 1: Write the browser tests.** All use the golden CSP with no network, and sandbox `allow-scripts allow-forms allow-modals`:
  - `a module app loads in an opaque-origin frame from cyprev`: `index.html` loads `./main.js`, which imports `./util.js` and posts `self.origin` to the parent. Assert the message arrives with `'null'`.
  - `localStorage can be replaced before the app's code runs`: a first classic script runs `Object.defineProperty(window,'localStorage',{value:shim,configurable:true})`, and the module then reads `localStorage.getItem('k') === 'v'`.
  - `the frame cannot fetch a local port or the IPC host`: `fetch('http://127.0.0.1:1234/')` and `fetch('http://ipc.localhost/')` both reject, and `securitypolicyviolation` fires for each.
  - `the frame cannot open a browser database`: `indexedDB.open('SovereignDB')` throws or fires `error`.
  - `a port handed over after hello reaches the app`: the frame posts `{__novaura:'hello', nonce}` taken from `location.hash`; the test checks the nonce, posts a `MessageChannel` port, and gets a round trip.
- [ ] **Step 2: Run it.** Run `node scripts/browser-test.mjs tests/additions/browser/runtime.browser.mjs`. Expected first: it fails until the server routes exist. Then add them.
- [ ] **Step 3: Run again.** Expected: 5 `ok`, no page errors.
- [ ] **Step 4: Commit** with the message `test(additions): fake cyprev server and runtime browser checks`.

---

### Task 4: Spike in the real app (spec step 0, in-app half) — GATED

**Stop and ask the owner first.** This launches, or restarts, the installed Sovereign with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`.

**Files:** a throwaway script in the scratchpad (`spike-additions.mjs`, CDP over `http://127.0.0.1:9333/json/list`). Nothing is committed.

- [ ] **Step 1:** Inside the OS page, `invoke('cybeni_preview_publish', …)` the same three small apps as Task 3's tests 1, 2 and 5. Frame each one with sandbox `allow-scripts allow-forms allow-modals` at `http://cyprev.localhost/<session>/index.html#nv=<nonce>`.
- [ ] **Step 2:** Record the results:
  - do module scripts load in the opaque frame;
  - can `localStorage` be replaced;
  - does the port round trip.
  
  CSP blocking needs a build with Task 2's command, so it is checked in Task 15.
- [ ] **Step 3: Go/no-go, written into the ledger.**
  - **Go:** continue with the next tasks.
  - **No-go on module loading:** `Ruling: addition builds are published as one index.html with inline data: modules (buildPreview inline mode) inside the same opaque frame and ADDITION_CSP`. Task 10 then builds that path instead. Nothing else changes.
- [ ] **Step 4:** Close the app with `taskkill /PID <pid>` (no `/F`), and only if this task started it.

---

### Task 5: `addition_data` table and data store

**Files:**
- Modify: `src/database/sovereignDatabase.js`: `this.version(22).stores({ addition_data: '[appId+key], appId' })` and `this.addition_data = this.table('addition_data')`.
- Create: `src/services/additions/limits.js`, `src/services/additions/dataStore.js`
- Create: `tests/additions/fakeTable.js` (in memory: `get`, `put`, `bulkPut`, `delete`, `bulkDelete`, and `where('appId').equals(x)` with `.toArray()`, `.primaryKeys()` and `.delete()`)
- Test: `tests/additions/dataStore.test.mjs`

**Interfaces:**
- `limits.js`: `DEFAULT_QUOTA_BYTES = 1024 ** 3`, `LOCAL_STORAGE_LIMIT_BYTES = 64 * 1024 ** 2`, `CHUNK_BYTES = 16 * 1024 ** 2`, `MAX_MESSAGE_BYTES = 16 * 1024 ** 2`, `REQUESTS_PER_SECOND = 50`, `LS_BATCH_MS = 50`, `DRAIN_MS = 1000`.
- `createAdditionData(table)` returns:
  - `snapshotLocalStorage(appId) -> Promise<Record<string,string>>`;
  - `writeLocalStorage(appId, ops)`, where each op is `{op:'set'|'remove'|'clear', key?, value?}`;
  - `get(appId, key)`;
  - `set(appId, key, value, { quotaBytes })`, which rejects with an Error whose `code` is `'quota_exceeded'` and leaves the old value;
  - `remove(appId, key)`, `keys(appId)`, `usage(appId) -> bytes`, `clearApp(appId)`.
- `sizeOf(value) -> bytes`. Keys are stored as `ls:<key>` (localStorage) and `s:<key>` (storage). Rows are `{ appId, key, value, size, updatedAt }`.
- `getAdditionData()` returns the one store backed by `db.addition_data`.

- [ ] **Step 1: Write the failing tests:**
  - `two additions never see each other's data`;
  - `the localStorage snapshot holds only localStorage keys`;
  - `clear removes only this app's localStorage keys`;
  - `a write over the quota is refused and the old value stays`;
  - `usage adds up both kinds of data`;
  - `clearApp leaves other additions alone`.
- [ ] **Step 2: Run** `node --experimental-test-module-mocks --test tests/additions/dataStore.test.mjs`. Expected: ERR_MODULE_NOT_FOUND.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run it, then `npm test`.** Expected: it passes, and the suite stays green after the database version bump.
- [ ] **Step 5: Commit** with the message `feat(additions): addition_data table and data store`.

---

### Task 6: Manifest and registry

**Files:**
- Create: `src/services/additions/manifest.js`, `src/services/additions/registry.js`
- Modify: `src/services/forge/forgeService.js`. `integrateAsApp` attaches `localManifest(...)` and keeps an existing entry's grants; its kind is `'forge'` when the project has `origin`, otherwise `'cybeni'`.
- Test: `tests/additions/manifest.test.mjs`, `tests/additions/registry.test.mjs`

**Interfaces:**
- Consumes: `cleanNetworkOrigin` (Task 1), `getAdditionData().clearApp` (Task 5).
- `manifest.js`:
  - `FORMAT = 'novapp/1'`, `API_VERSION = 1`, `PERMISSIONS = ['ai','notifications','files']`;
  - `validateManifest(raw) -> { ok, manifest?, errors: string[] }`;
  - `localManifest({ slug, name, kind = 'cybeni', permissions = [], network = [] })`, which gives id `local.<slug>`, version `1.0.0`, `apiVersion` 1, entry `index.html`, publisher `null` and files `{}`.
- `registry.js` (the addition id is the existing `user_apps` id, `user_<slug>`):
  - `listAdditions()` and `getAddition(appId)`, which return `{ id, slug, name, color, iconBlobId, addedAt, manifest|null, grants: { permissions: [], network: [] }, requested: { network: [] }, legacy: false, legacyNotes: [], quotaBytes }`;
  - `updateAddition(appId, patch)`;
  - `setGrants(appId, { permissions?, network? })`, which grants only what the manifest or `requested` asks for;
  - `noteBlockedOrigin(appId, origin) -> boolean`, true when a valid origin is newly requested;
  - `setQuota(appId, bytes)`;
  - `removeAddition(appId, { keepData })`.
- Every change dispatches `novaura:user_apps_changed` and `novaura:addition_changed` (`detail: appId`).

- [ ] **Step 1: Write the failing tests.**
  - Manifest: `the spec's sample manifest is valid`, plus one test per rejected field: format, id, a non-semver version, `apiVersion` 2, an unknown permission, an `http:` origin, a localhost origin, and an entry containing `..`.
  - Registry:
    - `apps saved before this change are listed with no manifest yet`;
    - `a permission the app did not ask for cannot be granted`;
    - `a network origin must be asked for and valid`;
    - `a blocked local or IPC address is never offered`;
    - `the same blocked origin is noted once`;
    - `adding an app again keeps what the person granted`;
    - `removing without keeping data clears it`.
  
  These mock `sovereignDatabase.js` with an in-memory `getSetting`/`setSetting`.
- [ ] **Step 2: Run them.** Expected: ERR_MODULE_NOT_FOUND.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them, then `npm test`.** Expected: all pass.
- [ ] **Step 5: Commit** with the message `feat(additions): manifest checks and the additions registry`.

---

### Task 7: The v1 bridge (`__novaura/v1.js`)

**Files:**
- Create: `src/services/additions/bridgeSource.js`
- Test: `tests/additions/bridge.test.mjs` (runs the source in `node:vm` with a fake window: `location`, `history`, `parent.postMessage` capture, `document.addEventListener`, timers, `DOMException`, `Blob`)

**Interfaces:**
- Consumes: `limits.js`.
- The bridge is written as a real, self-contained function, `function bridgeMain(limits) { … }`, that refers to nothing outside itself. The module exports `NOVAURA_V1_SOURCE = '(' + bridgeMain.toString() + ')(' + JSON.stringify(LIMITS) + ');'`. `LIMITS` is `{ chunkBytes, localStorageLimit, batchMs }`, and tests pass small values.
- Wire format (the frame side of Task 8):
  - requests are `{ id, m, a }`;
  - replies are `{ id, ok: true, v }` or `{ id, ok: false, e: { code, message, retryAfterMs? } }`;
  - events from the frame are `{ t: 'ls.batch', ops }` and `{ t: 'blocked', uri, directive }`;
  - events to the frame are `{ t: 'theme', theme }`.
- Window messages are `{ __novaura: 'hello', nonce, apiVersion: 1 }`, `{ __novaura: 'relaunch' }` and `{ __novaura: 'port' }` (with the port).
- Boot: `window.__novauraBoot = { app, snapshot, theme, hostOrigin }`. The bridge reads and deletes it.
- Methods: `storage.get/set/remove/keys/usage`, `ui.theme/onThemeChange/setTitle/close`, `notify`, `ai.chat`, `files.open/save`. `storage.set/get` switch to the `storage.put.begin/chunk/commit` and `storage.get.chunk` calls when a string, ArrayBuffer or Blob is larger than `chunkBytes`.

- [ ] **Step 1: Write the failing tests:**
  - `hello carries the nonce, goes only to the OS origin, and the hash is cleared`;
  - `boot data is removed from the page`;
  - `localStorage reads the snapshot before anything is sent`;
  - `localStorage writes go out as one batch after 50 ms, and early writes wait for the port`;
  - `a write past 64 MB throws QuotaExceededError and keeps the old value`;
  - `pending writes are flushed when the page hides`;
  - `novaura.version is 1, novaura.app comes from boot, and the object is frozen`;
  - `a call resolves with the OS's value`;
  - `an error reply rejects with its code`;
  - `rate_limited is retried after retryAfterMs`;
  - `a port from another source, or a second port, is ignored`;
  - `without boot data it asks to be relaunched, calls reject not_connected, and localStorage still works in memory`;
  - `theme events reach onThemeChange listeners until unsubscribed`;
  - `large values go in chunks no bigger than chunkBytes`;
  - `a blocked origin is reported once`.
- [ ] **Step 2: Run them.** Expected: ERR_MODULE_NOT_FOUND.
- [ ] **Step 3: Implement `bridgeMain`.**
  - Install `localStorage` and an in-memory `sessionStorage` with `Object.defineProperty(window, name, { value, configurable: true })` before anything else.
  - Clear the hash with `history.replaceState(null, '', location.pathname + location.search)`.
- [ ] **Step 4: Run them.** Expected: all pass. Also run `npx oxlint src/services/additions`, which should be clean.
- [ ] **Step 5: Commit** with the message `feat(additions): novaura v1 bridge`.

---

### Task 8: Router

**Files:**
- Create: `src/services/additions/router.js`
- Test: `tests/additions/router.test.mjs`

**Interfaces:**
- Consumes: the wire format (Task 7), the data store (Task 5), `PERMISSIONS` (Task 6), and `originOf` and `cleanNetworkOrigin` (Task 1). The router only reports a blocked origin through `onBlocked`; the controller (Task 12) passes it to `noteBlockedOrigin`.
- Produces: `createRouter({ addition, data, ui: { theme(), setTitle(text), close() }, onBlocked(origin), now = Date.now, limits })`, which returns `{ handle(msg) -> Promise<reply | null> }`. Events return `null`.
- Error codes: `unknown_method`, `permission_denied`, `not_available`, `rate_limited` (with `retryAfterMs`), `too_large`, `quota_exceeded`, `bad_request`.
- Budget: a token bucket of 50 per second (capacity 50) that counts requests only. Events are already batched or de-duplicated by the bridge.
- `ui.setTitle`: plain text, trimmed, at most 120 characters.

- [ ] **Step 1: Write the failing tests:**
  - `an unknown method is refused`;
  - `notify, ai.chat, files.open and files.save are denied by default and never reach a service`;
  - `a granted but unbuilt service says not_available`;
  - `the 51st request in a second is rate_limited and passes again later`: uses a fake clock;
  - `storage round trip, keys and usage`;
  - `chunked put and get give back the same string and the same bytes`;
  - `a request over 16 MB is too_large`;
  - `over the quota is quota_exceeded`;
  - `ls.batch is written`;
  - `a blocked https or wss origin is passed on; a local one is not`;
  - `setTitle is trimmed and shortened`.
- [ ] **Step 2: Run them.** Expected: ERR_MODULE_NOT_FOUND.
- [ ] **Step 3: Implement.** Pending chunked uploads are per key and dropped after 60 s.
- [ ] **Step 4: Run them.** Expected: all pass.
- [ ] **Step 5: Commit** with the message `feat(additions): bridge router with permissions and budgets`.

---

### Task 9: Host handshake, theme, window title, and the contract test

**Files:**
- Create: `src/services/additions/host.js`, `src/services/additions/theme.js`
- Modify: `src/kernel/subsystems/WindowManager.js` to add `setTitle(id, title)`, which updates `win.title` and notifies.
- Create: `tests/additions/fixture-app/checks.js`. It exports `runChecks(novaura, { localStorage }) -> Promise<[{ name, ok, detail }]>`, and runs in Node and in the browser. It checks:
  - `novaura.version` and `novaura.app`;
  - `storage` set/get/keys/remove/usage;
  - `localStorage` set/get;
  - `ui.theme()` has a `mode`;
  - `ui.setTitle` resolves;
  - `notify`, `ai.chat`, `files.open` and `files.save` reject with `permission_denied`.
- Test: `tests/additions/host.test.mjs`, `tests/additions/theme.test.mjs`, `tests/additions/contract.test.mjs`, and a WindowManager test.

**Interfaces:**
- `host.js`: `connectAddition({ frame, nonce, hostWindow = window, router, onRelaunch, drainMs }) -> { dispose(), pushTheme(theme) }`.
  - It accepts a hello only from `frame.contentWindow`, with an equal nonce compared in constant time, and only the first one.
  - It posts `{ __novaura: 'port' }` with one transferred port to `frame.contentWindow` with target `'*'`; the frame is opaque.
  - A `relaunch` message from that frame calls `onRelaunch()`.
  - `dispose()` stops accepting and closes the port after `drainMs`.
- `theme.js`: `currentTheme(doc = document) -> { name, mode: 'light'|'dark', colors }`, where `colors` holds `background`, `foreground`, `primary`, `primaryForeground`, `secondary`, `accent`, `card`, `cardForeground`, `muted`, `mutedForeground`, `border`, `ring`, `destructive`, `success` and `warning`, each as `hsl(…)` from the CSS variables. `mode` is light when the background lightness is above 50%. `subscribeTheme(fn, doc) -> unsubscribe` watches `data-theme`.

- [ ] **Step 1: Write the failing tests.**
  - Host:
    - `a hello from another window is ignored`;
    - `a wrong nonce is ignored`;
    - `only the first hello gets a port`;
    - `requests reach the router and replies come back`;
    - `relaunch from the frame calls onRelaunch; from elsewhere it does not`;
    - `after dispose no new hello is accepted, but queued messages are still handled during the drain`.
  - Theme: `the theme is read from the OS variables`, `changes reach subscribers`.
  - WindowManager: `setTitle changes the title`.
  - Contract: `the contract fixture passes against the real bridge, host and router`. It wires `NOVAURA_V1_SOURCE` in a vm context with Node's `MessageChannel`, connects a host and a router (fake table, fake ui), and calls `runChecks(ctx.window.novaura, …)`. Every result must be ok.
- [ ] **Step 2: Run them.** Expected: they fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them, then `npm test`.** Expected: all pass.
- [ ] **Step 5: Commit** with the message `feat(additions): host handshake, theme and contract test`.

---

### Task 10: Builder mode, backend guard, and launch

**Files:**
- Modify: `src/services/cybeni/previewBuilder.js` to add `mode: 'addition'`. It is the same as `'server'`, except:
  - the head starts with `<script src="${baseUrl}__novaura/boot.js"></script><script src="${baseUrl}__novaura/v1.js"></script>`;
  - there is no storage isolation, test agent or app-id script;
  - `serverFiles` includes `__novaura/v1.js`.
- Modify: `src/services/cybeni/fullStackRuntime.js` to set `window.novaura` only when no v1 bridge is there (`window.novaura?.version === 1`). It always sets `window.cybeniBackend`.
- Create: `src/services/additions/launch.js`
- Test: `tests/additions/launch.test.mjs`, plus one case added to `tests/cybeni/previewBackend.test.mjs`.

**Interfaces:**
- Consumes: registry (Task 6), data store (Task 5), bridge source (Task 7), `currentTheme` (Task 9), and the `addition_publish`/`addition_clear` commands (Task 2).
- Produces:
  - `ADDITION_SANDBOX = 'allow-scripts allow-forms allow-modals'`;
  - `bootScript({ app, snapshot, theme, hostOrigin }) -> string` (JSON with `<`, U+2028 and U+2029 escaped);
  - `launchAddition(addition, { data, invoke, loadFiles, hostOrigin, newSession, newNonce, theme }) -> Promise<{ session, nonce, src, sandbox }>`, which publishes `once: ['__novaura/boot.js']` and `network: addition.grants.network`;
  - `stopAddition(session, invoke)`.
- In a plain browser (dev), it returns `{ srcdoc }` from inline mode with boot and bridge inlined.

- [ ] **Step 1: Write the failing tests:**
  - `publish gets the app files, the bridge and the boot file, and boot is served once`;
  - `only granted network origins go to the CSP, not merely requested ones`;
  - `the frame URL carries the nonce in its fragment, and the sandbox has no allow-same-origin`;
  - `boot data cannot close its script tag`;
  - `addition mode loads boot and the bridge before the import map and leaves out the test agent`;
  - `@cybeni/backend keeps an existing v1 window.novaura`.
- [ ] **Step 2: Run them.** Expected: they fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them, then `npm test`.** Expected: all pass.
- [ ] **Step 5: Commit** with the message `feat(additions): addition build mode and launch`.

---

### Task 11: Moving existing "my apps" over

**Files:**
- Create: `src/services/additions/migrate.js`
- Modify: `src/services/forge/userApps.js` to run `ensureMigrated()` before the first `load()`. A failure logs and is retried on the next launch.
- Test: `tests/additions/migrate.test.mjs`

**Interfaces:**
- `attributeLegacyStorage(snapshot, slugs) -> Map<slug, Record<string,string>>`:
  - `__cybeni_db__:<slug>:<t>` becomes `__cybeni_db__:<t>`, and the same goes for `__cybeni_kv__:<slug>:`;
  - `__cybeni_auth_users__:<slug>:` becomes `__cybeni_auth_users__`, and `__cybeni_auth_session__:<slug>:` becomes `__cybeni_auth_session__`;
  - keys namespaced to slugs not in the list are left out;
  - plain keys go to every slug;
  - `__cybeni_probe__` is skipped.
- `usesBrowserDatabase(files) -> boolean`: true for `indexedDB`, or an import of `dexie`, `idb` or `localforage`.
- `migrateLegacyApps({ registry, data, readSharedStorage, loadFiles, isDesktop }) -> { migrated: appId[] }`. It sets `manifest = localManifest(...)` with no permissions or network, `legacy: true`, `legacyNotes` and `migratedAt`. It writes the data rows only on the desktop, and it never deletes anything.
- `readSharedStorageViaCyprev()` publishes a one-page preview session. A hidden frame with `allow-scripts allow-same-origin` posts its `localStorage` to the host with a token. The timeout is 10 s, after which it returns `{}`.
- `ensureMigrated()` runs once, memoized.
- `copyOldDataAgain(appId)`.

- [ ] **Step 1: Write the failing tests:**
  - `an app's own @cybeni/backend keys go only to it, without the name prefix`;
  - `another project's keys are left behind`;
  - `plain keys are copied to every old app`;
  - `moved apps get a manifest with no permissions and no network, marked added before permissions`;
  - `apps that already have a manifest are not touched, and a second run does nothing`;
  - `the old shared data is only read`;
  - `outside the desktop the manifest is added without copying data`;
  - `an app that uses a browser database is flagged`.
- [ ] **Step 2: Run them.** Expected: they fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them, then `npm test`.** Expected: all pass.
- [ ] **Step 5: Commit** with the message `feat(additions): move existing my apps over with their data`.

---

### Task 12: The addition window

**Files:**
- Create: `src/services/additions/controller.js`, `src/services/additions/settingsLink.js`
- Modify: `src/components/windows/UserAppWindow.jsx`. It becomes a thin view over the controller: an iframe with `ADDITION_SANDBOX`, the "Sandboxed" badge, a permissions button, Reload, "Change with Cybeni", and a banner like "<name> tried to connect to <origin>." with a **Review** button.
- Modify: `src/config/appRegistry.js` (category `'additions'`) and `src/components/AppLauncherModal.jsx` (`{ id: 'additions', label: 'Additions' }`).
- Test: `tests/additions/controller.test.mjs`

**Interfaces:**
- Consumes: `ensureMigrated` (Task 11), `getAddition` (Task 6), `launchAddition`/`stopAddition` (Task 10), `connectAddition` (Task 9), `createRouter` (Task 8), `subscribeTheme`/`currentTheme` (Task 9), and `kernel.wm.setTitle`.
- `createAdditionController({ appId, deps }) -> { start(frame) -> Promise<{src|srcdoc, sandbox}>, relaunch(), dispose(), onBlocked(fn) }`:
  - it relaunches on a host relaunch request, and on `novaura:addition_changed` for this app only;
  - the router's `onBlocked(origin)` goes to `noteBlockedOrigin`, and a `true` result raises the banner;
  - each launch uses a new session and nonce, and clears the previous session.
- `openAdditionSettings(appId)` opens `settings`, dispatches `novaura:open_settings_tab` with `'additions'`, and leaves a pending focus. `takePendingAdditionFocus() -> appId | null`.

- [ ] **Step 1: Write the failing tests:**
  - `a relaunch request starts a new session and nonce and clears the old one`;
  - `a change to this addition relaunches it; a change to another does not`;
  - `a blocked origin raises the banner once`;
  - `dispose clears the session and stops listening`;
  - `setTitle and close reach the window`.
- [ ] **Step 2: Run them.** Expected: they fail.
- [ ] **Step 3: Implement the controller, then the window, registry and launcher changes.**
- [ ] **Step 4: Run them, then `npm test` and `npx vite build`.** Expected: all pass, and the build is green.
- [ ] **Step 5: Commit** with the message `feat(additions): addition window, Additions launcher category`.

---

### Task 13: Settings → Additions

**Files:**
- Create: `src/services/additions/panelModel.js`, `src/components/windows/settings/AdditionsPanel.jsx`
- Modify: `src/components/windows/SettingsDiagnosticsWindow.jsx` to add an `additions` tab and a nav button labelled "Additions". It calls `takePendingAdditionFocus()` on mount and on the tab event.
- Test: `tests/additions/panelModel.test.mjs`

**Interfaces:**
- `PERMISSION_LABELS`: `ai` is "Use your AI model on this computer", `notifications` is "Send you notifications", and `files` is "Open and save files you choose".
- `describeAddition(addition, usageBytes) -> { title, version, publisher, legacy, notes, permissions: [{ id, label, granted }], network: [{ origin, granted, declared }], usage, quota }`.
  - The publisher reads "Made on this computer" when the publisher is null.
  - The notes line for an app that uses a browser database reads "This app used a browser database, which additions can't keep. Its saved data there was not moved."
- `formatBytes(n)`. The quota choices are 1, 2, 5, 10 and 50 GB.
- The panel's actions are:
  - toggle a network origin, which calls `setGrants` and makes the app relaunch;
  - change the quota;
  - Remove, which asks with a "Keep its data" checkbox;
  - "Copy old data again", shown only for apps added before permissions.
  
  Export and Update come in plan 3, and AI usage in plan 2.

- [ ] **Step 1: Write the failing tests:**
  - `a moved app shows as added before permissions with no permissions`;
  - `declared and blocked origins are both listed, with their grants`;
  - `usage and quota read in plain units`;
  - `the browser-database note appears only when flagged`.
- [ ] **Step 2: Run them.** Expected: they fail.
- [ ] **Step 3: Implement the model and the panel.**
- [ ] **Step 4: Run them, then `npm test` and `npx vite build`.** Expected: all pass, and the build is green.
- [ ] **Step 5: Commit** with the message `feat(additions): Settings → Additions`.

---

### Task 14: Contract fixture app and the additions browser suite

**Files:**
- Create: `tests/additions/fixture-app/index.html` and `app.js`. They publish `checks.js` into the session, run `runChecks(window.novaura, { localStorage })`, and post the results to the parent as `{ __fixture: results }`.
- Create: `tests/additions/browser/additions.browser.mjs`, run with `--vite`. It uses the real `launch.js`, `host.js`, `router.js` and `dataStore.js` on real IndexedDB. Its `invoke` stand-in publishes to the fake `cyprev` server with `goldenCsp(network)`.
- Modify: `package.json` to add `"test:additions": "node scripts/browser-test.mjs --vite=http://localhost:5199/ tests/additions/browser/runtime.browser.mjs tests/additions/browser/additions.browser.mjs"`. It needs the dev server running.

- [ ] **Step 1: Write the browser tests:**
  - `the contract fixture passes every check`;
  - `an addition cannot read another addition's data`;
  - `an addition cannot reach local ports or the IPC host`;
  - `an addition cannot open the OS database`;
  - `a method that was not granted rejects`;
  - `localStorage survives a relaunch`;
  - `an app that reloads itself comes back with its data`;
  - `a write right before the window closes is kept`.
- [ ] **Step 2: Run** `npm run test:additions` with `npx vite --port 5199 --strictPort` running. Expected: they fail until the fixture exists, then 13 `ok` (5 runtime and 8 additions) with no page errors.
- [ ] **Step 3: Commit** with the message `test(additions): contract fixture and browser suite`.

---

### Task 15: Live check in the desktop app, and docs — GATED

**Stop and ask the owner first.** This needs a build with Tasks 2–13 (`npm run tauri:dev` or an installer build), running on the owner's real profile. On first launch, existing "my apps" are moved over; their old data is only ever copied.

- [ ] **Step 1: Check in the real WebView2, over CDP on port 9333:**
  - an existing "my app" opens as an addition with its data;
  - `fetch('http://localhost:1234')` and `fetch('http://ipc.localhost/')` are blocked;
  - Settings → Additions lists the app;
  - approving a network origin relaunches the app, and the origin then works.
- [ ] **Step 2: Docs:**
  - a `MASTER_AUDIT_TODO.md` entry;
  - the spec's status line, "steps 0–1 built";
  - the `project_additions` memory.
- [ ] **Step 3: Final verification:**
  - `npm test`, `npm run tauri:test` and `npm run tauri:check`: all green;
  - `npx vite build`: green;
  - `npm run test:additions`: 13 `ok`.
- [ ] **Step 4: Commit** with the message `docs(additions): runtime and basic API built`.
