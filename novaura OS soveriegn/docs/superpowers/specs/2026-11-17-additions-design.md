# Additions: user apps inside Sovereign — Design

**Status:** approved by the owner 2026-11-17; the decisions are recorded in the last section. Steps 0–1 (runtime and basic API) built 2026-11-18 on branch `aura-core/regulation` (plan: `docs/superpowers/plans/2026-11-18-additions-runtime.md`); the live check in the installed app is still to do. Steps 2–4 are not built.

## What this is

Each person can add their own apps to their Sovereign OS. These "Additions" can be:

- built for them by Cybeni,
- imported and rebranded in the Forge,
- installed from a file someone shared,
- or created by asking Aura, Nova or Cybeni ("add a habit tracker to my OS").

Additions run in OS windows. They can use OS services the person allows (their AI model, notifications, files they pick), and they keep working when we ship a new Sovereign build. Nobody needs our source code to make one.

## What already exists (and stays)

- `integrateAsApp` in `src/services/forge/forgeService.js` saves a Cybeni project as an app in the `user_apps` setting. `src/services/forge/userApps.js` puts it in the launcher under "my apps".
- `UserAppWindow.jsx` runs the app from the `cyprev` protocol (`src-tauri/src/preview.rs`). That protocol is a different origin from the OS, so the app cannot read the OS database or call OS commands.
- Signed bundles: `src/services/templates/novaTemplates.js` is a ZIP with a manifest, an Ed25519 signature and per-file SHA-256. It is pure code and already trusts `TRUSTED_AUTHORITIES` keys as "NovAura Originals".
- `previewHost.js` already sends messages between the OS and a preview frame (the Cybeni test agent uses this).

## Two gaps in today's sandbox (found while designing this)

1. **All user apps and Cybeni previews share one origin** (`http://cyprev.localhost`, framed with `allow-same-origin`). Any one of them can read or change the others' saved data (localStorage, IndexedDB). That includes a GitHub project imported into the Forge.
2. **`PREVIEW_CSP` lets app code connect to every port on this machine** (`http://localhost:*`, `http://127.0.0.1:*`) and to any `https:` host. Local servers such as LM Studio and Ollama are in reach. Whether a request takes effect depends on each server's CORS settings. Data can also leave the machine to any website.

These are acceptable while a person builds their own app in Cybeni. They are not acceptable for long-lived apps that people install and share. Additions close both gaps for installed apps (see Runtime). Narrowing `PREVIEW_CSP` for Cybeni previews themselves is a separate change. It is approved, but it starts only after the owner's go-ahead, once Gemini's recommendations for it have been reviewed.

## Goals

- Add an app from.four places: Cybeni, the Forge, a `.novapp` file, or a request to a companion.
- Additions can use OS services only through a small, versioned API, and only with permissions the person granted.
- Additions survive OS updates. OS updates may change any internal code, but never API v1.
- An addition can never reach:
  - identity or mesh keys, the vault, or wallet;
  - OS settings or the terminal;
  - Aura Core state or memories;
  - other additions' data;
  - Tauri commands.

## Non-goals for v1

- Native programs (.exe, Python) running inside the OS. Later, these become "linked programs" that open outside the OS, with a warning (see Later).
- Background services that run with no window open.
- Additions that change OS UI: sidebar widgets, themes, file-type handlers. These are "extension points", planned later.
- Paid additions and royalties. These come later on the Template Library pattern, with the 10% platform fee.

## Runtime: where an addition runs

**Frame.** An addition window loads the app from a `cyprev` session in an iframe with `sandbox="allow-scripts allow-forms allow-modals"`. There is no `allow-same-origin`, so each running addition gets its own opaque origin. It cannot share storage with anything, not even another copy of itself.

**Why not one real origin per app.** Tauri registers protocols at startup, and on Windows each protocol maps to one host. Separate origins per app would need a fixed pool of protocols. The opaque origin is simpler and stronger.

**Storage moves to the bridge.** An opaque origin has no localStorage or IndexedDB, so the OS stores each addition's data for it, keyed by addition id. The bridge script installs a `localStorage` replacement before the app's own code runs, so most existing apps work unchanged:

- it is synchronous and preloaded from a snapshot at start;
- every change is written through to the OS.

Data lives in a new Dexie table, `addition_data`, with primary key `[appId+key]`; this needs a database version bump from 21.

- **Default quota:** 1 GB per addition, which the person can raise.
- **Large values:** move in 16 MB chunks (no KB-scale limits).

**`ADDITION_CSP`** is a new policy in `preview.rs` for addition sessions:

- **Scripts and styles:** the app's own files, plus the CDN hosts Cybeni builds rely on today (esm.sh, cdn.tailwindcss.com, cdn.jsdelivr.net, unpkg.com).
- **`connect-src`, `img-src`, `media-src`, `font-src`, `frame-src`, `form-action`:** `'self'` and `data:`/`blob:` only. On top of that, only the origins listed in the manifest's `network` and approved by the person.
- **Never:** any `localhost` or `127.0.0.1` port, and never `http://ipc.localhost` (the same rule as today). The AI is reached through the bridge, so apps do not need local ports.
- **Header:** addition sessions also send `Access-Control-Allow-Origin: *`. An opaque-origin page fetches module scripts with CORS, so this header is required.

**Channel handshake.** A navigated-away page must not inherit the app's permissions, so the channel is set up per launch:

1. Each launch gets a random nonce in the frame URL's fragment (`index.html#nv=<nonce>`).
2. The bridge script reads the nonce and posts `{ __novaura: 'hello', nonce }` to the OS.
3. The host checks that `event.source` is that window's frame and that the nonce matches.
4. The host then hands the frame a `MessageChannel` port, and all later traffic uses that port.

A page the frame navigates to never sees the nonce or the port.

## The `novaura` API, version 1

The bridge script `__novaura/v1.js` is injected into every addition session by the preview builder, before the app's scripts. It defines `window.novaura`. Every method returns a promise. A call to a permission the person has not granted rejects with `{ code: 'permission_denied' }`. It never prompts mid-call; prompting happens at install or from the permissions page.

| Method | Permission | Notes |
| --- | --- | --- |
| `novaura.version` → `1`; `novaura.app` → `{ id, name, version, permissions }` | none | |
| `storage.get / set / remove / keys / usage` | none (own data only) | Also backs the `localStorage` replacement |
| `ui.theme()`, `ui.onThemeChange(fn)` | none | OS color tokens and light/dark, so additions match the OS |
| `ui.setTitle(text)`, `ui.close()` | none | Applies to its own window only |
| `notify({ title, body })` | `notifications` | Goes through `kernel.notifications` |
| `ai.chat(messages, { maxTokens, temperature, stream })` | `ai` | Runs on the person's chosen model through the existing AI subsystem with `useRag: false`. No persona, no companion memory, no Aura Core. Streaming comes back as port messages. |
| `files.open({ accept, multiple })` | `files` | The OS file picker. The addition receives only the files the person chose, never paths. |
| `files.save(name, data)` | `files` | The OS save dialog. |

**Budgets (backpressure, not small caps):**

- 50 requests per second per addition;
- messages up to 16 MB, with larger data in chunks;
- for `ai.chat`, the limit depends on where the model runs:
  - **a local model, or the person's own cloud API key:** no limit from Sovereign. Every cloud key is the person's own, so the provider's limits on that key apply.
  - **the NovAura decentralized inference network (community nodes):** 200k tokens per hour per addition, so the nodes don't get overloaded. The person can lower this limit but not raise it.

**Stability rule.** A v1 method never changes behavior. New methods may be added to v1. A breaking change means `v2.js` beside `v1.js`, and v1 stays for at least 6 releases. An addition declares `apiVersion` in its manifest and gets that bridge.

## Manifest and the `.novapp` file

`novapp.json` is stored with every addition and included in its file:

```json
{
  "format": "novapp/1",
  "id": "<publisher pub hex prefix>.<slug>",
  "name": "Habit Tracker",
  "version": "1.2.0",
  "apiVersion": 1,
  "entry": "index.html",
  "icon": "icon.png",
  "description": "…",
  "permissions": ["ai", "notifications"],
  "network": ["https://api.weather.gov"],
  "publisher": { "name": "…", "pub": "<ed25519 hex>" },
  "source": { "kind": "cybeni | forge | file", "url": "…", "license": "…" },
  "files": { "index.html": "<sha256>", "…": "…" }
}
```

A `.novapp` file is a ZIP laid out like `.novatemplate`:

- `novapp.json`;
- `novapp.sig`: an Ed25519 signature of `"NOVA-APP-V1\n"` plus the manifest's exact bytes, made with the publisher key (the person's node key);
- `files/…`.

The shared pieces of `novaTemplates.js` (safe paths, hashing, signature checks, ZIP reading) move into a small `bundleFormat.js` used by both.

**Install:**

1. Check the signature and every file hash.
2. Show the permission card.
3. Write the files as a project in `projectStore` under a new slug.
4. Save the `user_apps` entry with its manifest and granted permissions.

A bundle signed by a `TRUSTED_AUTHORITIES` key shows as a NovAura Original. Any other bundle shows "from (publisher's name), not verified by NovAura".

**Updates:**

- The same `id`, the same publisher key and a higher `version` update in place and keep the addition's data.
- A different key for the same `id` is refused, so nobody can take over someone else's app.
- Newly requested permissions or network origins need the person's approval again. Until they approve, the update installs with the new permissions off.

## Adding through Aura, Nova or Cybeni

A new agent tool in `NovaAgent.js`: `add_to_os({ request })`.

1. A companion calls it when the person asks for something to be added to their OS.
2. It opens Cybeni with the request, and the normal Cybeni build-and-test pipeline runs.
3. When the build passes its tests, the OS shows the install card: name, icon, permissions requested, network origins. The model proposes permissions in the manifest. Only the person's click grants them.
4. The tool result tells the companion the app is waiting for the person's approval. Companions can never install or grant permissions without that click.

Cybeni's generation prompt and templates learn the `novaura` API. Generated apps then call `novaura.ai.chat` instead of embedding provider URLs or keys, and `novaura.storage` instead of bare IndexedDB. This overlaps with Gemini's current Cybeni work and needs coordinating.

The Forge's "Add to Sovereign" button and Cybeni's own install button go through the same install card.

## Surviving OS updates

- Additions depend only on the runtime rules above and on API v1.
- Their files, which are Cybeni projects in `db.documents`, and their data (`addition_data`) live in the profile's WebView2 storage for `life.novaura.sovereign`, not in the program folder. An installer update leaves them alone as long as the app identifier stays the same. Verify this once with a real update before promising it publicly.
- **Contract fixture.** `tests/additions/fixture-app/` is an addition that calls every v1 method and every denied path. It runs in the test suite and in the headless-browser check. If an OS change breaks an addition, the release fails.
- "Export my additions" writes each one as a `.novapp` (Settings → Additions). This doubles as a backup.

## Screens

- **Launcher:** a category named "Additions" (renaming "my apps"), with each app's icon.
- **Install card:** plain language. "Habit Tracker wants to: use your AI model on this computer; send you notifications; connect to api.weather.gov." There are Install and Cancel buttons, plus a per-permission toggle.
- **Settings → Additions:** for each addition, its version, publisher (verified or not), permissions as toggles, network origins, data used and AI usage this hour. Actions are Export `.novapp`, Update from file and Remove. Remove asks whether to keep the app's data.
- **Addition window:** keeps the existing "Sandboxed" badge and adds a permissions button next to it.

## Existing "my apps"

Apps added before this change are moved over on first launch:

1. Open the old app once in a hidden frame on its old shared origin.
2. Copy its localStorage into `addition_data`.
3. Give it a manifest with no permissions and no network.
4. Mark it "added before permissions" so the person can review it.

If an old app needs the network, it shows one banner that opens its permissions page.

## Build order

0. **Spike, about half a day: go/no-go.** In the installed app's WebView2:
   - a Vite/React build loads in an opaque-origin frame from `cyprev`, with module scripts and the CORS header;
   - the nonce-and-port handshake works;
   - the `localStorage` replacement can be installed over `window.localStorage` before the app's code runs;
   - `ADDITION_CSP` blocks `fetch('http://localhost:1234')`.
1. **Runtime and basic API:**
   - `ADDITION_CSP`, the frame changes and the handshake;
   - storage and the `localStorage` replacement;
   - `ui.*` methods, the permission store, the contract fixture;
   - Settings → Additions.
2. **Services:** `ai.chat` with streaming and budgets, `notify`, `files.open/save`, the network allowlist and the install card.
3. **Packages:**
   - `novapp.json`;
   - `.novapp` export, import, signing and checking, with `bundleFormat.js` split out of `novaTemplates.js`;
   - updates from the same publisher.
4. **Companions and Cybeni:**
   - the `add_to_os` tool;
   - Cybeni generates against the `novaura` API;
   - the Forge and Cybeni install through the card;
   - moving existing "my apps" over.

Each step ships on its own and keeps the full test suite green.

## Tests

- **Unit tests:**
  - manifest checks;
  - permission checks (everything denied by default);
  - the bridge router: unknown method, wrong frame, wrong nonce, over-budget;
  - bundle signature and hash checks;
  - update rules: same key and higher version is accepted, a different key is refused, a new permission arrives off.
- **Headless browser, real IndexedDB:**
  - an addition cannot read another addition's data;
  - it cannot fetch `localhost:1234` or reach `ipc.localhost`;
  - it cannot open the OS database;
  - a non-granted method rejects;
  - the `localStorage` replacement survives a reload;
  - the contract fixture passes.
- **Manual, once, owner-approved:** install an addition, run a real Sovereign update, and confirm the app and its data are still there.

## Known limitations (found in review, 2026-11-18)

- **WebRTC is not covered by the CSP.** Chromium does not apply CSP to `RTCPeerConnection`, so an addition with no network grants could still reach a TURN/STUN server it names and send data in the request. Needs a decision before untrusted additions are common: a WebView2 setting that disables WebRTC for the addition frames, or an honest line in the install card.
- **Self-navigation is stopped by the OS window, not the addition CSP.** CSP does not govern a frame navigating itself (`location.href = …`). What keeps an addition from loading an outside page or a local port in its own frame is the OS window's `frame-src` in `tauri.conf.json` (`'self' blob: data:` plus the `cyprev`/`cygame` hosts). Widening that list (for example to `https:`) opens additions; the live check confirms it.
- **Apps that keep data in a browser database** (IndexedDB, Dexie, idb, localforage) can't keep it in an addition; the window says so when such an app opens.

## Later

- **Linked programs:** a launcher entry that opens an .exe or a script outside the OS, with a warning that it has full access to the computer.
- **Extension points:** sidebar widgets, file-type handlers ("open .csv with…"), companion skills that call an addition.
- Sharing additions over the mesh. A marketplace with royalties on the Template Library license pattern, with the 10% platform fee.
- More API: `clipboard`, `ai.embed`, `companion.ask` (ask a companion something, with consent each time), and per-app channels over the mesh.

## Owner decisions (answered 2026-11-17)

1. **Names:** "Additions" in the UI, and `.novapp` for the file.
2. **Existing "my apps":** move them over automatically, as described above.
3. **AI budget:** no limit from Sovereign on local models or on the person's own cloud API keys (the provider's limits apply). 200k tokens an hour per addition on the decentralized inference network.
4. **Companion installs:** always one click by the person. A companion never installs or grants permissions on its own.
5. **Cybeni previews:** tighten `PREVIEW_CSP`, as a separate change. Gemini is adding its own recommendations for it first. Review those, and check in with the owner before starting.
