# Creative Studio Layered Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Creative Studio's three unrelated canvases with one layered editor engine.

**Architecture:**
- **Engine.** `src/creative/` holds React-free modules: document, history, compositor, tools and file formats.
- **Window.** `CreativeStudioWindow.jsx` becomes a slim frame over panels in `src/components/windows/creative/`.
- **Shared document.** Paint, Photo and Meme are three workspaces over one shared document per tab.
- **Pixels.** Pixel data lives in surfaces (an OffscreenCanvas in the app, an array in Node tests), never in React state.

**Tech Stack:**
- React 19
- Vite
- Canvas 2D / OffscreenCanvas
- Web Workers
- Dexie
- `ag-psd` 34.1.0
- node:test
- A headless Chrome/Edge harness over CDP

**Spec:** [docs/superpowers/specs/2026-11-15-creative-studio-layers-design.md](../specs/2026-11-15-creative-studio-layers-design.md). Section numbers below (§N) refer to it.

## Global Constraints

**Offline and dependencies**
- Fully offline. No network calls from any studio code.
- The only new dependency is `ag-psd`, pinned with `--save-exact` to `34.1.0`.
  - 34.2.0 (2026-11-11) is under two weeks old.
- Never edit `NovAura-WebOS/`.
- No Firebase or cloud services.

**Values the spec fixes**
- **Blend modes:** exactly these 16 ids are offered, in this order:
  - `source-over`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`;
  - `hard-light`, `soft-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity`.
  - `lighter` exists only as a PSD fallback.
- **Canvas limit:** 16384 px per side (`MAX_SIDE`).
- **Budgets:** history is RAM/8 and the warning is at RAM/2, with RAM falling back to 16 GB. There are no step limits and no file size caps.
- **Locks:** a locked layer allows only `visible`, `locked` and `name` changes and reordering. Painting, moving, editing, masking and deleting are refused, each with a reason.
- **Merging:** arrow-key nudges merge within 500 ms. A slider drag merges into one step through a per-drag `mergeKey`.
- **Shortcuts:** Ctrl+Z undoes; Ctrl+Shift+Z and Ctrl+Y redo. They act only while focus is inside the studio and not in an `input`, `textarea`, `select` or contenteditable element.
- **Recovery:** every 120 000 ms, into Dexie database `novaura_creative_recovery`. The main schema in `src/database/sovereignDatabase.js` is untouched.
- **Settings key:** `creative_studio_settings_v1`, through `db.getSetting` and `db.setSetting`.
- **Meme templates:** the four in `CreativeStudioWindow.jsx` lines 8–138 move verbatim to `memeTemplates.js`.

**Process**
- **Commands.** Run every command from `z:\Novaura platform\novaura OS soveriegn`. The project's shell has `NODE_ENV=production`, so pass `--include=dev` when installing dev tooling.
- **Shared tree.** Gemini edits this tree in parallel.
  - Before editing an existing file, re-read it.
  - Stage only the files the task names (`git add <paths>`), never `git add -A`.
  - Skip `build/`, `scratch/` and `0.26.0`.
- **Commits.** One commit per task, message prefix `feat(creative):` (or `fix`/`test`/`chore`). Every commit message ends with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```
- **Builds.** Don't bump `src-tauri/tauri.conf.json`. Don't build or run the installer.

**Test commands**
- **Unit:** `node --experimental-test-module-mocks --test tests/creative/<name>.test.mjs`
- **Browser:** `node scripts/browser-test.mjs tests/creative/browser/<name>.browser.mjs`
- **Full suite:** `npm test`, `npm run lint`, `npm run build`. All must pass at the end of every phase.

## Shared types (used throughout)

**Basic shapes**
- `Rect = { x, y, w, h }`, in document pixels.
- `Pixels = { width, height, data: Uint8ClampedArray }`. This is ImageData-compatible, non-premultiplied RGBA.

**`Surface`** (Task 1)
- Fields: `{ width, height, canvas, ctx, bytes }`. `canvas` and `ctx` are `null` on an ArraySurface.
- `read(x, y, w, h) → Pixels`: clipped; pixels outside the surface read as transparent.
- `write(x, y, pixels)`
- `clear()`
- `resizeCanvas(width, height, offsetX, offsetY)`: grows the surface, keeping its content shifted by the offset.
- `clone() → Surface`
- `toPngBlob() → Promise<Blob>`

**`Layer`** (§1)
- Common fields: `{ id, name, kind, visible, opacity, blend, locked, mask, psdBlend, role, rev }`.
  - `rev` is set by `touchLayer` (Task 3) whenever the layer's fields or pixels change. The compositor's caches key on it.
  - `kind ∈ 'pixel' | 'shape' | 'text' | 'adjust'`.
  - `mask` is `Mask | null`.
  - `psdBlend` is a string or `null`.
  - `role` is `null`, `'memeTemplate'`, `'memeTop'` or `'memeBottom'`.
- Kind fields:
  - pixel: `{ x, y, width, height, bufferId }`
  - shape and text: the §1 fields
  - adjust: `{ adjust, params }`
- `Mask = { x, y, width, height, bufferId, defaultValue, enabled }`. The mask surface is grey RGB with alpha 255.

**`Doc`**
- `{ id, name, width, height, layers, activeLayerId, activeTarget, buffers: Map<string, Surface>, version }`
- `version` goes up on every mutation.

**`Session`** (Task 8)
- `{ id, doc, history, compositor, savedPath, savedVersion, dirty }`
- `dirty` is a getter: `doc.version !== savedVersion`.

**Results and metadata**
- `Result = { ok: true, layer? } | { ok: false, reason }`
- `Meta = { tab: 'paint' | 'photo' | 'meme', label?, mergeKey?, mergeWindowMs? }`

## Review Focus

These are the input classes most likely to bite users. Each has a test in the task named.

1. **Zoomed, panned or HiDPI canvas** (Windows at 125% or 150% scaling). The stroke must land under the cursor. → Task 10, `screenToDoc` tests at zoom 2 with pan, at devicePixelRatio 1 and 1.5.
2. **Ctrl+Z while typing** in a layer-rename box or the text-layer box. It must edit the text, not the history. → Task 10, `shouldHandleShortcut` test.
3. **The pointer lost mid-stroke** (the pen leaves the tablet, `pointercancel`, `lostpointercapture`). The stroke must still commit as one undoable step and leave no stuck drawing state. → Task 10 browser test.
4. **An image wider or taller than 16384 px** (a phone panorama). It must open scaled down to fit, with a notice, not fail. → Task 18, `fitWithinLimit` test.
5. **Closing the whole Creative Studio window with unsaved documents.** Their recovery copies are written at once, so reopening the studio offers them back. → Task 25 browser test.

---

## Phase 1 — Engine and Paint

### Task 0: Browser test harness

**Files:**
- Create: `scripts/browser-test.mjs`, `tests/creative/browser/harness.js`, `tests/creative/browser/smoke.browser.mjs`

**Interfaces:**
- Produces:
  - **The script.** `node scripts/browser-test.mjs <file.browser.mjs>...` runs each file in headless Edge or Chrome, prints `ok  <name>` or `FAIL <name> (<message>)`, and exits 1 on any failure.
  - **Browser lookup.** It uses `CHROME_PATH` if set, then `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe` (Edge is WebView2's engine), then `C:/Program Files/Google/Chrome/Application/chrome.exe`.
  - **The harness.** Browser test files `import { test, assert } from './harness.js'`.
    - `assert` provides `equal`, `deepEqual`, `ok`, `near(a, b, tolerance)` and `throws`.
    - `test(name, async fn)` registers a test.

- [ ] **Step 1: Write `smoke.browser.mjs`.**
  - It should contain one passing test, `test('OffscreenCanvas works', ...)`, that draws a red pixel and reads it back as `[255, 0, 0, 255]`.
  - It should also contain one test that throws on purpose, guarded by `if (location.search.includes('selftest'))`.
- [ ] **Step 2: Implement the harness.**
  - **Server.** `browser-test.mjs` starts a static server (node:http) rooted at the project. It serves `.js`/`.mjs` as `text/javascript`.
  - **Runner page.** The server also serves a generated page, `/__runner.html?file=<path>`, which imports the test file and then `harness.run()`. `run()` stores the results in `window.__results` and sets `window.__done = true`.
  - **Chrome.** It launches with `--headless=new`, `--remote-debugging-port`, a temporary `--user-data-dir` and `--no-first-run`.
    - It fetches `http://127.0.0.1:<port>/json/list` and opens a WebSocket to the page target.
    - It calls `Page.navigate`, then polls `Runtime.evaluate` (`returnByValue: true`) on `window.__done` every 200 ms, for up to 60 s.
  - **Diagnostics.** It reports `Runtime.exceptionThrown` and console errors as failures.
- [ ] **Step 3: Run the check.** `node scripts/browser-test.mjs tests/creative/browser/smoke.browser.mjs` should print `ok  OffscreenCanvas works` and exit 0.
- [ ] **Step 4: Add the npm script.** Add `"test:browser": "node scripts/browser-test.mjs"` to `package.json` scripts. Re-read `package.json` first, because Gemini edits it.
- [ ] **Step 5: Commit.** `chore(creative): headless browser test harness`.

### Task 1: Surfaces

**Files:**
- Create: `src/creative/surface.js`
- Test: `tests/creative/surface.test.mjs`, `tests/creative/browser/surface.browser.mjs`

**Interfaces:**
- Produces:
  - **Constant:** `MAX_SIDE = 16384`
  - **Classes:** `class ArraySurface` and `class CanvasSurface`, both with the Surface API.
  - **Creation:**
    - `createSurface(width, height) → Surface` throws `RangeError('Canvas sides must be 1–16384 px.')` when a side is outside 1–16384.
    - It returns a CanvasSurface when `OffscreenCanvas` exists, otherwise an ArraySurface.
  - **Test hook:** `setSurfaceFactory(fn | null)`.
  - **From pixels:** `surfaceFromPixels(pixels) → Surface`.
  - **From PNG:** `surfaceFromPngBlob(blob) → Promise<Surface>`.
    - In the browser it uses `createImageBitmap`.
    - On an ArraySurface it uses `decodePng` from Task 24. Until Task 24 lands, it throws `Error('PNG decoding needs src/creative/io/png.js')`.

- [ ] **Step 1: Write the failing tests** in `surface.test.mjs`. Each one calls `setSurfaceFactory((w, h) => new ArraySurface(w, h))` first.
  - `read clips to bounds and returns transparent outside`: write a 2×2 red patch at (1,1) on a 4×4 surface. `read(-1, -1, 3, 3)` then gives pixel (2,2) = red and pixel (0,0) = `[0,0,0,0]`.
  - `resizeCanvas keeps content shifted by the offset`: after `resizeCanvas(6, 6, 2, 1)`, the old pixel (1,1) is at (3,2).
  - `clone is independent`: changing the clone leaves the original unchanged.
  - `bytes is width × height × 4`.
  - `createSurface rejects 0 and 16385`.
- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL, module not found.
- [ ] **Step 3: Implement `src/creative/surface.js`.**
  - CanvasSurface uses `new OffscreenCanvas(w, h)` and `getContext('2d')`.
  - Its `read` and `write` go through `getImageData` and `putImageData`, clipped.
  - Its `resizeCanvas` makes a new canvas and calls `drawImage(old, offsetX, offsetY)`.
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Add the browser test.** `surface.browser.mjs` runs the same five assertions against a CanvasSurface. Run it.
- [ ] **Step 6: Commit.** `feat(creative): pixel surfaces`.

### Task 2: Pixel patches

**Files:**
- Create: `src/creative/pixelRecorder.js`
- Test: `tests/creative/pixelRecorder.test.mjs`

**Interfaces:**
- Consumes: `Surface` (Task 1).
- Produces:
  - `beginPixelEdit(surface, tileSize = 256) → { touch(x, y, w, h), finish() → PixelPatch | null }`
  - `PixelPatch = { tiles: [{ x, y, w, h, before, after }], rect, bytes }`
  - `applyPatch(surface, patch, 'before' | 'after')`

- [ ] **Step 1: Write the failing tests.**
  - `only touched tiles are stored`: on a 600×600 surface with tile size 256, `touch(10, 10, 5, 5)` followed by a write there gives `finish().tiles.length === 1` and `bytes === 256*256*4*2`.
  - `edge tiles are clipped`: the tile at x=512 is 88 wide.
  - `unchanged tiles are dropped and nothing changed gives null`.
  - `before/after round-trip`: `applyPatch(s, p, 'before')` restores the original bytes exactly, and `'after'` restores the edit.
  - `touch saves the original only the first time`: touching the same area twice, with a write between, keeps the first original.
- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.** Tiles sit on a grid aligned to multiples of `tileSize`. `touch` copies the original pixels of tiles not yet saved. `finish` reads the `after` pixels and drops tiles whose bytes are equal.
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit.** `feat(creative): tile-based pixel patches for history`.

### Task 3: Document model

**Files:**
- Create: `src/creative/document.js`
- Test: `tests/creative/document.test.mjs`

**Interfaces:**
- Consumes: `createSurface` (Task 1).
- Produces:
  - `createDocument({ name = 'Untitled', width, height, background = 'white' }) → Doc`
    - `background` is `'white'`, `'black'`, `'transparent'` or `'#rrggbb'`.
    - A filled background creates a pixel layer named `Background`. Transparent creates an empty `Layer 1`.
  - `createLayer(doc, kind, fields = {}) → Layer`: applies defaults and gives the layer a `crypto.randomUUID()` id.
    - A pixel layer without `fields.surface` gets a canvas-sized surface. With `fields.surface`, it adopts that surface and its size.
  - Lookups: `getLayer(doc, id)`, `layerIndex(doc, id)`, `surfaceOf(doc, layer, part = 'layer' | 'mask') → Surface`.
  - `canEdit(layer, action) → { ok: true } | { ok: false, reason }`, where `action` is one of `'paint' | 'move' | 'edit' | 'mask' | 'delete' | 'visibility' | 'unlock' | 'rename' | 'reorder'`.
  - `touchLayer(doc, layer)`: sets `layer.rev = ++doc.version`.
    - Every path that changes a layer's fields or pixels calls it: the mutators below, `commitPatch`, strokes, filters, history apply and revert, and mask edits.
  - Low-level mutators, each bumping `doc.version` and touching the layers they change:
    - `insertLayer(doc, layer, index)`
    - `removeLayerAt(doc, index) → Layer`
    - `moveLayer(doc, from, to)`
    - `assignLayer(doc, id, patch) → previousValues`
  - `cloneLayer(doc, layer, intoDoc = doc) → Layer`: a deep copy with a new id and cloned buffers (mask included).

- [ ] **Step 1: Write the failing tests.**
  - **`createDocument` backgrounds:**
    - White gives a Background layer whose pixel (0,0) is `[255,255,255,255]`.
    - Transparent gives `Layer 1` with `[0,0,0,0]`.
    - `#102030` fills with that colour.
  - **`createLayer` defaults:** `visible: true`, `opacity: 1`, `blend: 'source-over'`, `locked: false`, `mask: null`, `psdBlend: null`, `role: null`.
    - Pixel layers cover the canvas.
    - A shape layer is named `Rectangle` for `shape: 'rect'`.
    - An adjust layer is named after the adjustment's label (until Task 15 lands, name it after `adjust`).
  - **Lock rules:** on a locked layer, `canEdit(locked, a)` is ok for `visibility`, `unlock`, `rename` and `reorder`.
    - It refuses `paint`, `move`, `edit`, `mask` and `delete` with `reason === '"<name>" is locked.'`.
  - **Wrong kind:** `canEdit(shapeLayer, 'paint')` refuses with `reason === 'Only pixel layers can be painted on. Paint its mask, or add a pixel layer.'`.
  - **Version:** `assignLayer` returns the previous values and bumps `version`.
  - **Clones:** `cloneLayer` gives a new id and a separate buffer, so writing to the clone leaves the source unchanged.
- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement `document.js`.** No DOM and no React.
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit.** `feat(creative): document and layer model`.

### Task 4: History

**Files:**
- Create: `src/creative/history.js`
- Test: `tests/creative/history.test.mjs`

**Interfaces:**
- Produces:
  - `createHistory({ budgetBytes = Infinity, now = Date.now } = {}) → History`
    - Fields: `steps`, `cursor`, `version`.
    - Methods: `push(step)`, `undo() → Step | null`, `redo() → Step | null`, `jumpTo(count)`, `canUndo()`, `canRedo()`, `totalBytes()`, `setBudget(bytes)`, `subscribe(fn) → unsubscribe`.
  - `Step = { label, tab, bytes, apply(), revert(), mergeKey?, mergeWindowMs?, time, mergeWith?(newer) → Step }`
    - `push` doesn't call `apply`, because the change has already happened.
  - `compoundStep(steps, { label, tab }) → Step`: applies in order and reverts in reverse.

- [ ] **Step 1: Write the failing tests.** Use counter-based fake steps.
  - `undo/redo walks the steps and reports the step`: undo returns the step whose label was pushed last.
  - `push after undo drops the undone steps`.
  - `merge: same mergeKey merges into one step; undo reverts to the value before the first`.
  - `merge window: nudges 400 ms apart merge, 600 ms apart do not`: uses `mergeWindowMs: 500` with a fake `now`.
  - `no merge into a step that was undone`.
  - `budget drops the oldest steps but always keeps the newest`: three steps of 100 bytes with a budget of 250 keep the last two. One step of 1000 bytes with a budget of 10 keeps that one.
  - `jumpTo(1) from cursor 3 reverts two steps, in order`.
  - `subscribe fires on push/undo/redo/jump and version increases`.
  - `compoundStep reverts in reverse order`.
- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.**
  - On push, set `time` from `now()`.
  - Merge only when the top step is at the cursor, its `mergeKey` equals the new one (both non-null), it has `mergeWith`, and either `mergeWindowMs` is null or the gap is within the window.
  - Evict after the push.
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit.** `feat(creative): per-document history`.

### Task 5: Edits and strokes

**Files:**
- Create: `src/creative/edits.js`, `src/creative/stroke.js`
- Test: `tests/creative/edits.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–4. `composeLayers` comes from Task 7, imported lazily inside `mergeDown` so that Node tests of the other edits don't need a canvas.
- Produces, in `edits.js` (all with `s = { doc, history }`, each one applying its change and pushing one step):
  - **Layers:**
    - `addLayer(s, kind, fields, meta, index?) → Result`: by default inserts above the active layer and makes it active.
    - `deleteLayer(s, id, meta) → Result`: refuses the last layer with `'A document needs at least one layer.'`.
    - `moveLayerTo(s, id, toIndex, meta) → Result`
    - `setLayerProps(s, id, patch, meta) → Result`: the lock action follows the patch's keys.
      - `{visible}` checks `visibility`, `{locked}` checks `unlock` and `{name}` checks `rename`.
      - `{x,y}` checks `move`. Anything else checks `edit`.
      - Uses `meta.mergeKey` and `meta.mergeWindowMs`.
    - `duplicateLayer(s, id, meta) → Result`
    - `mergeDown(s, id, meta) → Result`: both layers must be unlocked, and the result is one pixel layer.
    - `setActiveLayer(s, id, target = 'layer')`: not a history step.
  - **Pixels:** `commitPatch(s, layerId, part, patch, meta, extraSteps = []) → Step`
- Produces, in `stroke.js`:
  - `beginStroke(s, { layerId, part = 'layer' }, meta) → { ok: true, stroke } | { ok: false, reason }`
  - `stroke = { surface, origin: { x, y }, ensureCovers(rect), touch(rect), end() → Step | null, cancel() }`
  - The rect arguments are in document coordinates. `ensureCovers` grows the target to the union of its bounds and the canvas the first time a rect falls outside it, which updates `surface` and `origin`. `end` pushes `compoundStep([grow?, patch])` with `meta.label`.

- [ ] **Step 1: Write the failing tests** with the ArraySurface factory. Each one asserts its effect, then that undo reverts it and redo re-applies it.
  - `addLayer inserts above active and becomes active`.
  - `setLayerProps on a locked layer refuses edit but allows visible/name/locked`.
  - `opacity drag merges into one step via mergeKey`.
  - `deleteLayer refuses the last layer`.
  - `moveLayerTo reorders even when locked`.
  - `duplicateLayer copies pixels into a separate buffer`.
  - `stroke on a 10×10 layer at (50,50) that touches (0,0) grows the layer to the canvas, and one undo restores both size and pixels`.
  - `stroke.cancel() restores pixels and pushes nothing`.
  - `beginStroke refuses a locked layer with its reason`.
- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.** Every step records `bytes`:
  - patch bytes for pixel steps;
  - 64 for property steps;
  - the old surface's bytes for a growth.
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit.** `feat(creative): undoable edits and strokes`.

### Task 6: Blend modes

**Files:**
- Create: `src/creative/blendModes.js`
- Test: `tests/creative/blendModes.test.mjs`

**Interfaces:**
- Produces:
  - `BLEND_MODES`: 16 entries `{ id, label, psd }`, in the Global Constraints order. `psd` uses ag-psd's names, for example `'color dodge'`.
  - `blendLabel(layer) → string`
  - `toPsdBlend(layer) → string`: returns `layer.psdBlend` when it's set.
  - `fromPsdBlend(key) → { blend, psdBlend }`: `psdBlend` is `null` unless the mode is a fallback.
  - `PSD_FALLBACKS`: the §3 table.
    - `'dissolve'` → `'source-over'`; `'linear burn'` → `'color-burn'`.
    - `'darker color'` → `'darken'`; `'lighter color'` → `'lighten'`.
    - `'linear dodge'` → `'lighter'`.
    - `'vivid light'`, `'linear light'`, `'pin light'` and `'hard mix'` → `'hard-light'`.
    - `'subtract'` → `'difference'`; `'divide'` → `'color-dodge'`.

- [ ] **Step 1: Write the failing tests.**
  - `16 modes in order`.
  - `every mode round-trips through its PSD name with psdBlend null`.
  - `every fallback maps per the table and keeps psdBlend`.
  - `toPsdBlend prefers psdBlend`.
  - `blendLabel shows "Linear Dodge (PSD)" for a fallback layer`.
- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit.** `feat(creative): blend modes and PSD mapping`.

### Task 7: Compositor

**Files:**
- Create: `src/creative/compositor.js`
- Test: `tests/creative/browser/compositor.browser.mjs`

**Interfaces:**
- Consumes: Tasks 1, 3 and 6.
- Produces:
  - `createCompositor(doc) → { render(ctx, rect?), invalidate(rect?), setFocusLayer(id | null), setLiveStroke(live | null), dispose() }`
    - `live = { layerId, part, surface, origin, opacity, erase }`.
  - `composeLayers(doc, layers, { x = 0, y = 0, width = doc.width, height = doc.height } = {}) → Surface`
  - `flatten(doc) → Surface`
  - `compositeBelow(doc, layerId) → Surface`
  - `rasterizeLayer(doc, layer) → { surface, x, y }`
  - `registerLayerRenderer(kind, fn(ctx, doc, layer))`: draws a non-pixel layer, unmasked and at full opacity, into a scratch context.
  - `setMaskProvider(fn(doc, layer) → Surface | null)`: masks hook in here in Task 14.
  - `setAdjustmentProvider(fn(doc, layer, belowSurface) → Surface)`: adjustments hook in here in Task 16.

- [ ] **Step 1: Write the failing browser tests.**
  - `normal at 50% over white`: red over white at opacity 0.5 gives `[255,128,128,255]`, ±1.
  - `multiply`: `#808080` multiplied over `#ff0000` gives `[128,0,0,255]`, ±1.
  - `hidden layers are skipped`.
  - `pixel layer offset x,y is respected`.
  - `render(rect) only changes pixels inside rect`.
  - `live stroke shows on its layer with stroke opacity, and erase cuts through`.
  - `below-cache: after setFocusLayer(top), changing a lower layer and calling invalidate() still shows the change`: a stale-cache guard.
  - `composeLayers of a subset ignores other layers`.
- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.**
  - Draw the layers in order. Pixel layers draw their surface canvas with `globalAlpha` and `globalCompositeOperation`.
  - Non-pixel kinds draw through their registered renderer into a scratch canvas, which is then composited.
  - The below-cache holds the composite of the layers beneath the focus layer. It records the highest `rev`, the layer ids and the order it was built from. It's rebuilt when `invalidate` runs or any of those change.
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit.** `feat(creative): layer compositor`.

### Task 8: Studio store

**Files:**
- Create: `src/creative/studioStore.js`, `src/components/windows/creative/useStudio.js`
- Test: `tests/creative/studioStore.test.mjs`

**Interfaces:**
- Consumes: Tasks 3, 4 and 7.
- Produces:
  - **`createStudioStore({ historyBytes = Infinity } = {})`**
    - Reading and subscribing: `getState()`, `subscribe(fn)`, `bump()`.
    - Documents:
      - `newDocument(opts) → Session` creates a document and makes it active.
      - `openDocument(doc, { savedPath = null }) → Session`
      - `closeDocument(id)`
      - `setActive(id)`
      - `active() → Session | null`
    - Workspace: `setTab(tab)`, `setTool(id)`, `update(patch)`, `notify(message)`.
  - **State:**
    - `{ sessions, activeId, tab: 'paint', tool: 'brush', version, notice }`
    - `colours: { primary: '#06b6d4', secondary: '#ffffff' }`
    - `brush: { size: 12, hardness: 0.8, opacity: 1, pressure: true }`
    - `fill: { tolerance: 32, contiguous: true, sampleAll: false }`
    - `gradient: { type: 'linear', mode: 'toSecondary' }`
    - `eyedropper: { sample: 'composite' }`
    - `maskView: null`
  - Every session's history change calls `bump()`.
  - **Hook:** `useStudio(store, selector)`, built on `useSyncExternalStore`.

- [ ] **Step 1: Write the failing tests.**
  - `newDocument makes it active`.
  - `closeDocument picks a neighbour as active`.
  - `a history push in a session bumps the store version`.
  - `dirty follows doc.version vs savedVersion`.
  - `update merges nested settings without dropping keys`.
- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit.** `feat(creative): studio store`.

### Task 9: Paint tools

**Files:**
- Create:
  - `src/creative/tools/brush.js` (exports brush, pencil and eraser)
  - `src/creative/tools/fill.js`
  - `src/creative/tools/eyedropper.js`
  - `src/creative/tools/move.js`
  - `src/creative/tools/index.js`
- Test: `tests/creative/tools.test.mjs`, `tests/creative/browser/brush.browser.mjs`

**Interfaces:**
- Consumes: Tasks 5, 7 and 8.
- Produces:
  - **Tool:** `{ id, cursor, down(ctx, p), move(ctx, p), up(ctx, p), cancel(ctx), key?(ctx, event) }`
    - The pointer is `p = { x, y, pressure, shift, alt, ctrl, coalesced: [{ x, y, pressure }] }`, in document coordinates.
    - The tool context is `ctx = { session, compositor, state, tab, requestRender(rect?), notify(msg) }`.
  - **Brush helpers:**
    - `dabPositions(from, to, spacing, carry) → { points, carry }`
    - `dabSize(size, pressure, usePressure) → number`
  - **Fill:** `floodFill(pixels, x, y, rgba, { tolerance, contiguous, sample }) → Rect | null`, which mutates `pixels`.
  - **Registry:**
    - `TOOLS`
    - `toolForKey(event) → toolId | null`, using the keys B, N, E, G, Shift+G (gradient, Task 13), I, U (Task 12), V and T (Task 19).
    - Keys whose tool doesn't exist yet return `null`.

- [ ] **Step 1: Write the failing Node tests.**
  - **Dab spacing:**
    - `dabPositions spaces dabs evenly`: from (0,0) to (10,0) with spacing 2 gives x = 0, 2, 4, 6, 8, 10.
    - `carry continues spacing across segments`.
  - **Pressure:** `dabSize: pressure 0.5 halves size when on, ignored when off, minimum 1`.
  - **Fill:**
    - `floodFill fills a contiguous region within tolerance and returns its rect`.
    - `floodFill non-contiguous fills all matching pixels`.
    - `floodFill samples another image when sample is given`.
  - **Move:**
    - `move tool: arrow nudges 1 px, Shift 10 px, and nudges within 500 ms merge`.
    - `move on a locked layer notifies the lock reason and changes nothing`.
  - **Keys:** `toolForKey maps B/N/E/G/I/V`.
- [ ] **Step 2: Write the failing browser tests.**
  - `a brush stroke at opacity 0.5 never builds past 0.5 alpha where dabs overlap`: alpha ≤ 128 ±1.
  - `the eraser makes pixels transparent`.
  - `the pencil draws with no anti-aliasing`: every alpha is 0 or 255.
  - `one stroke = one history step labelled "Paint · Brush stroke"`.
- [ ] **Step 3: Run both and confirm they fail.**
- [ ] **Step 4: Implement.**
  - **Brush.** It draws round dabs into the stroke's surface at full strength (hardness gives a radial-gradient falloff). It shows the stroke through `compositor.setLiveStroke` at `brush.opacity`.
    - On `up`, it merges into the layer with `globalAlpha = opacity`, using `destination-out` for the eraser, inside `stroke.touch` areas. Then it calls `stroke.end()`.
    - Spacing is `max(1, size × 0.15)`.
  - **Eyedropper.** It reads `flatten` or the layer, following `state.eyedropper.sample` (`'composite'` by default), and sets `colours.primary`.
- [ ] **Step 5: Run both and confirm they pass.**
- [ ] **Step 6: Commit.** `feat(creative): brush, pencil, eraser, fill, eyedropper, move`.

### Task 10: Canvas view and the Paint frame

**Files:**
- Create:
  - `src/creative/view.js`
  - `src/creative/shortcuts.js`
  - `src/creative/pointerController.js`
  - `src/components/windows/creative/CanvasView.jsx`
  - `src/components/windows/creative/PaintPanel.jsx`
  - `src/components/windows/creative/LegacyPhotoTab.jsx`
  - `src/components/windows/creative/LegacyMemeTab.jsx`
  - `src/components/windows/creative/memeTemplates.js`
  - `scripts/smoke/creative-studio.mjs`
- Modify: `src/components/windows/CreativeStudioWindow.jsx` (rewritten as the frame)
- Test: `tests/creative/view.test.mjs`, `tests/creative/browser/canvasView.browser.mjs`

**Interfaces:**
- Consumes: Tasks 7–9.
- Produces:
  - **`view.js`:**
    - `ZOOM_MIN = 0.1`, `ZOOM_MAX = 32`
    - `screenToDoc({ clientX, clientY }, view, rect) → { x, y }`, with `view = { zoom, panX, panY }` in CSS pixels.
    - `fitView(docW, docH, viewW, viewH) → view`
    - `zoomAt(view, factor, anchor) → view`, clamped to the zoom range.
  - **`shortcuts.js`:**
    - `shouldHandleShortcut(event) → boolean`
    - `historyActionFor(event) → 'undo' | 'redo' | null`
    - `studioActionFor(event) → 'swapColours' | 'brushSmaller' | 'brushLarger' | null`
      - X swaps the colours.
      - `[` and `]` step the brush size by 10%, by at least 1, within 1–500.
  - **`src/creative/pointerController.js`:**
    - `createPointerController({ store, getView, getRect }) → { down(e), move(e), up(e), cancel(e) }`
    - It turns pointer events into tool calls: it maps them with `screenToDoc`, expands `getCoalescedEvents()`, and routes `pointercancel` and `lostpointercapture` to `cancel`, which ends the stroke the same way `up` does.
    - `CanvasView` only binds DOM events to it.
  - **`memeTemplates.js`:** exports `MEME_TEMPLATES`, moved verbatim.
  - **`LegacyPhotoTab` and `LegacyMemeTab`:** today's Photo and Meme JSX and logic, moved unchanged. They'll be removed in Tasks 18 and 20.

- [ ] **Step 1: Write the failing Node tests.**
  - **Coordinates (Review Focus 1):**
    - `screenToDoc at zoom 2, pan (30,40), rect at (100,50)`: client (160,140) maps to doc (15,25).
    - `screenToDoc is unaffected by devicePixelRatio 1.5`: it uses CSS pixels only.
  - **Zoom:**
    - `fitView centres and fits`.
    - `zoomAt keeps the anchor point fixed and clamps to 0.1–32`.
  - **Shortcuts (Review Focus 2):**
    - `shouldHandleShortcut is false for INPUT, TEXTAREA, SELECT and contentEditable targets`.
    - `historyActionFor maps Ctrl+Z → undo, Ctrl+Shift+Z and Ctrl+Y → redo, plain Z → null`.
    - `studioActionFor maps X, [ and ]`.
- [ ] **Step 2: Write the failing browser test (Review Focus 3).** `pointercancel mid-stroke commits one step and the next pointerdown starts a new stroke`.
  - It drives `createPointerController` with synthetic pointer-event objects against a real store and session.
- [ ] **Step 3: Run both and confirm they fail.**
- [ ] **Step 4: Implement `view.js`, `shortcuts.js` and `CanvasView.jsx`.**
  - **Canvas sizing.** The visible canvas backing store is CSS size × `devicePixelRatio`, and drawing uses `setTransform(dpr·zoom, 0, 0, dpr·zoom, dpr·panX, dpr·panY)`.
  - **Transparency.** A checkerboard sits under the document.
  - **Pointer input.**
    - Use `setPointerCapture`.
    - Feed `getCoalescedEvents()` to the tool.
    - `pointercancel` and `lostpointercapture` both call `tool.up`, and that commits.
  - **Zoom and pan.**
    - Ctrl+wheel calls `zoomAt`.
    - Holding Space while dragging pans.
    - Fit-to-window and 100% buttons sit in the view corner.
  - **Redrawing.** Rendering is scheduled with `requestAnimationFrame` only when `requestRender` was called.
- [ ] **Step 5: Implement the frame.** `CreativeStudioWindow.jsx` holds the header, the Paint/Photo/Meme switch, and a root `div` with `tabIndex={-1}`.
  - **Focus.** It's focused on `pointerdown`, and its `onKeyDown` handles undo/redo and tool keys through `shortcuts.js`.
  - **Paint.** Shows `PaintPanel` (tools, colours, brush settings, undo and redo buttons) next to `CanvasView` on a 1920×1080 white document.
  - **Photo and Meme.** Show the Legacy tabs.
- [ ] **Step 6: Run the tests and confirm they pass.**
- [ ] **Step 7: Write the smoke script.**
  - `scripts/smoke/creative-studio.mjs <url> <outDir>` opens the window with `window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: 'creative_studio' }))` and draws a stroke with CDP `Input.dispatchMouseEvent`.
  - It asserts the canvas changed, that Ctrl+Z restores it, and that there are no console errors.
  - It saves screenshots.
- [ ] **Step 8: Run it.** Run it against `npx vite --port 5199` and expect all ok.
- [ ] **Step 9: Run the full suite.** Run `npm test`, `npm run lint` and `npm run build`.
- [ ] **Step 10: Commit.** `feat(creative): Paint on the layered engine`.

## Phase 2 — Layers and masks

### Task 11: Layers and History panels

**Files:**
- Create: `src/components/windows/creative/LayersPanel.jsx`, `src/components/windows/creative/HistoryPanel.jsx`
- Modify: `CreativeStudioWindow.jsx`, which shows both panels on every tab.
- Test: extend `scripts/smoke/creative-studio.mjs`

**Interfaces:**
- Consumes: the `edits.js` functions (Task 5), `blendLabel` and `BLEND_MODES` (Task 6), and the store (Task 8).
- Produces:
  - **Test hooks:** rows carry `data-layer-id`, the selected row has `aria-selected`, and history rows carry `data-step-index`.
  - **History rows** show `<tab icon> <label>`. Clicking a row calls `history.jumpTo(index + 1)` and `store.setTab(step.tab)`.

- [ ] **Step 1: Extend the smoke script.**
  - Add a layer, rename it, hide it and lock it.
  - Drag its opacity slider from 100 to 40, and assert that it makes one history step.
  - Set the blend to Multiply.
  - Move the layer down.
  - Merge down.
  - Click the first history row and assert the layer count is back to 1.
- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement the panels** as in §5 and §2.
  - **Layer rows:** top layer first, with a thumbnail (a 48 px `flatten` of that layer, refreshed on `doc.version`), double-click to rename, an eye and a padlock.
  - **Selected layer:** an opacity slider and a blend menu.
    - The opacity slider uses `mergeKey: opacity:<id>:<dragId>`, with a new `dragId` on each `pointerdown`.
  - **Buttons:** new, duplicate, delete, merge down, up and down.
  - **Reordering:** drag rows with HTML5 drag and drop, calling `moveLayerTo`.
  - **Refusals:** show the `Result.reason` through `store.notify`.
- [ ] **Step 4: Run it and confirm it passes.**
- [ ] **Step 5: Run the full suite.**
- [ ] **Step 6: Commit.** `feat(creative): Layers and History panels`.

### Task 12: Shape layers

**Files:**
- Create:
  - `src/creative/shapes.js`
  - `src/creative/transformHandles.js`
  - `src/creative/tools/shape.js`
  - `src/components/windows/creative/ShapeProperties.jsx`
- Modify: `src/creative/tools/index.js` (adds the U key), `src/components/windows/creative/CanvasView.jsx` (draws the handles overlay)
- Test: `tests/creative/shapes.test.mjs`, `tests/creative/browser/shapes.browser.mjs`

**Interfaces:**
- Consumes: `registerLayerRenderer` (Task 7) and `addLayer`/`setLayerProps` (Task 5).
- Produces, in `shapes.js`:
  - `SHAPE_KINDS = ['rect', 'ellipse', 'line', 'polygon', 'star']`
  - `defaultShape(kind, rect, colours) → fields`, with defaults `radius 0`, `sides 5`, `innerRatio 0.5`, `fill = primary`, `stroke null` and `strokeWidth 0`.
  - `shapePathData(layer) → string`: SVG path data, unrotated.
  - `shapeBounds(layer) → Rect`: includes rotation and half the stroke width.
  - `shapeSvg(layer) → string`: a `<rect>`, `<ellipse>`, `<line>` or `<path>` with `transform="rotate(r cx cy)"`.
  - `renderShape(ctx, layer)`
- Produces, in `transformHandles.js`:
  - `handlesFor(layer) → [{ id, x, y }]`, with ids `nw n ne e se s sw w rotate`.
  - `hitHandle(layer, x, y, radius) → id | null`
  - `dragHandle(layer, id, start, now, { shift }) → patch`
    - Shift keeps the aspect ratio when resizing and snaps rotation to 15°.

- [ ] **Step 1: Write the failing tests.**
  - `rect path with radius 0 is M x y H … Z`.
  - `polygon has sides vertices`.
  - `star has 2×points vertices alternating radius`.
  - `bounds of a 100×50 rect rotated 90° is 50×100 about the same centre`.
  - `handles of an unrotated rect sit on its corners and edge midpoints, with rotate 24 px above n`.
  - `dragging se by (10,20) grows w,h by 10,20`.
  - `shift-drag keeps aspect`.
  - `rotate handle snaps to 15° with shift`.
  - `shapeSvg for a line gives <line x1 y1 x2 y2>`.
- [ ] **Step 2: Write the failing browser tests.**
  - `drawing with the shape tool creates one shape layer and one step`.
  - `a shape layer at 50% opacity fades its outline too`: the outline pixel's alpha is 128 ±2.
- [ ] **Step 3: Run both and confirm they fail.**
- [ ] **Step 4: Implement.** The shape tool draws a new layer by dragging. When a shape layer is active, it drags the handles, using `mergeKey: shape:<id>:<dragId>`. `ShapeProperties` edits fill, outline, width, radius, sides and inner ratio.
- [ ] **Step 5: Run both and confirm they pass.**
- [ ] **Step 6: Commit.** `feat(creative): editable shape layers`.

### Task 13: Gradient tool

**Files:**
- Create: `src/creative/tools/gradient.js`
- Modify: `tools/index.js` (adds Shift+G), `PaintPanel.jsx` (adds the gradient options)
- Test: `tests/creative/tools.test.mjs` (extend), `tests/creative/browser/gradient.browser.mjs`

**Interfaces:**
- Consumes: Task 5's `beginStroke`.
- Produces: `gradientStops(primary, secondary, mode) → [{ offset, colour }]`, where `mode` is `'toSecondary'` or `'toTransparent'`.

- [ ] **Step 1: Write the failing tests.**
  - Node: `toTransparent ends with alpha 0 of the primary colour`.
  - Browser:
    - `linear gradient left→right on a 256-wide layer: pixel 0 = primary, pixel 255 = secondary`, ±2.
    - `radial gradient: the centre is primary`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.** Drag from start to end. Canvas `createLinearGradient` and `createRadialGradient` fill the layer through a stroke covering the whole canvas, so it's one step.
- [ ] **Step 4: Run them and confirm they pass.**
- [ ] **Step 5: Commit.** `feat(creative): gradient tool`.

### Task 14: Masks

**Files:**
- Create: `src/creative/masks.js`
- Modify: `edits.js` (mask edits), `compositor.js` (registers the mask provider), the brush, fill and gradient tools (paint greys on a mask target), `LayersPanel.jsx` (mask thumbnail and controls), `CanvasView.jsx` (mask-target marker and the view-mask-alone mode)
- Test: `tests/creative/masks.test.mjs`, `tests/creative/browser/masks.browser.mjs`

**Interfaces:**
- Consumes: Tasks 3, 5 and 7.
- Produces, in `masks.js`:
  - `createMask(doc, reveal) → Mask`: canvas-sized at (0,0), filled with 255 or 0, `defaultValue` the same.
  - `maskAlpha(doc, layer) → Surface`: a cached alpha surface where alpha is the grey value, refreshed for dirty areas after `invalidateMaskAlpha(layer, rect?)`.
  - `greyOf(hex) → 0..255`, using luminance `0.299r + 0.587g + 0.114b`, rounded.
  - `invertPixels(pixels)`
- Produces, in `edits.js`:
  - `addMask(s, id, reveal, meta)`
  - `deleteMask(s, id, meta)`
  - `setMaskEnabled(s, id, enabled, meta)`
  - `invertMask(s, id, meta)`
  - `applyMask(s, id, meta)`: pixel layers only. It multiplies alpha by the mask and removes the mask.
- Layer state: `store.update({ maskView: layerId | null })` turns on the view-mask-alone mode. The active target is set with `setActiveLayer(s, id, 'mask')`.

- [ ] **Step 1: Write the failing Node tests.**
  - `greyOf('#ffffff') === 255 and greyOf('#ff0000') === 76`.
  - `addMask on a locked layer refuses`.
  - `addMask then undo removes it`.
  - `invertMask twice restores the pixels`.
  - `applyMask multiplies alpha`: a 50%-grey mask on an opaque layer gives alpha 128 ±1.
  - `a mask grows like a layer when painted outside its bounds`.
- [ ] **Step 2: Write the failing browser tests.**
  - `a hide-all mask hides the layer`.
  - `a reveal-all mask shows it`.
  - `outside the mask rect, defaultValue applies`.
  - `a disabled mask is ignored`.
  - `brush on the mask target paints grey`.
  - `the eraser on the mask target paints black`.

  (The masked-adjustment test belongs to Task 16.)
- [ ] **Step 3: Run both and confirm they fail.**
- [ ] **Step 4: Implement.**
  - **Compositing.** The compositor applies `maskAlpha` with `destination-in` on the layer's scratch canvas. Pixel layers are copied to scratch only when they have a mask.
  - **Layers panel.**
    - A mask thumbnail sits next to the layer thumbnail; click it to target the mask.
    - Shift-click turns the mask on or off.
    - Alt-click shows the mask alone.
    - The menu has invert, apply and delete.
- [ ] **Step 5: Run both and confirm they pass.**
- [ ] **Step 6: Run the full suite.**
- [ ] **Step 7: Commit.** `feat(creative): layer masks`.

## Phase 3 — Photo

### Task 15: Adjustment definitions

**Files:**
- Create: `src/creative/adjustments.js`
- Modify: `src/creative/document.js`, so that `createLayer` names adjust layers by `ADJUSTMENTS[adjust].label`.
- Test: `tests/creative/adjustments.test.mjs`

**Interfaces:**
- Produces:
  - `ADJUSTMENTS`: keyed by id, each entry `{ label, compute: 'lut' | 'pixel' | 'filter', params: { name: { min, max, default, step } } }`.
    - Ids and parameter ranges come from the §5 table.
    - The ids are `brightnessContrast`, `hueSaturation`, `vibrance`, `levels`, `curves`, `blackWhite`, `invert`, `threshold`, `posterize`, `sepia`, `blur` and `vignette`.
  - `defaultParams(type)`
  - `buildLut(type, params) → { r, g, b: Uint8Array(256) }`
  - `applyAdjustmentPixels(type, params, pixels, { docWidth, docHeight, originX, originY })`
  - `canvasFilter(type, params) → string | null`
  - `svgFilter(type, params, id) → string`
  - `curveTable(points) → Uint8Array(256)`
  - `isIdentity(type, params) → boolean`
- Formulas. Alpha is untouched, and every output is rounded and clamped to 0–255.
  - **levels:** `out = outBlack + (outWhite − outBlack) · clamp((v − inBlack)/(inWhite − inBlack), 0, 1)^(1/gamma)`
  - **posterize n:** `out = round(round(v·(n−1)/255) · 255/(n−1))`
  - **threshold:** with `lum = 0.299r + 0.587g + 0.114b`, every channel becomes `lum ≥ level ? 255 : 0`.
  - **invert:** `255 − v`
  - **curves:** a Fritsch–Carlson monotone cubic through the points, sorted by input, flat beyond the end points.
    - `out_c = rgbCurve[channelCurve_c[v]]`.
    - Missing channel curves are the identity.
  - **brightnessContrast:** `out = (v − 127.5)·(1 + contrast/100) + 127.5 + brightness`
  - **hueSaturation:** works in HSL.
    - `h += hue`, then `s = clamp(s·(1 + saturation/100))`.
    - For lightness > 0: `l = l + (1 − l)·lightness/100`. For lightness < 0: `l = l·(1 + lightness/100)`.
  - **vibrance:**
    - With `avg = (r + g + b)/3`, `k = vibrance/100 · (1 − (max − min)/255)`, then `c = avg + (c − avg)(1 + k)`.
    - Then saturation applies the same way with `k = saturation/100`.
  - **blackWhite:** `c = c + (lum − c)·amount/100`
  - **sepia:** `canvasFilter` returns `sepia(a%)`.
  - **blur:** `canvasFilter` returns `blur(rpx)`.
  - **vignette:**
    - `d` is the elliptical distance from the document centre, scaled so the corners are 1.
    - `start = 1 − size/100`, `end = start + (1 − start)·max(0.05, softness/100)`, `t = smoothstep(start, end, d)`.
    - If amount < 0: `c = c·(1 + amount/100·t)`. If amount > 0: `c = c + (255 − c)·amount/100·t`.

- [ ] **Step 1: Write the failing tests.**
  - **Levels:**
    - `levels identity at defaults`.
    - `levels inBlack 64 maps 64→0 and 255→255`.
    - `levels gamma 2 maps 128→181`, ±1.
  - **Posterize:** `posterize 2 maps 100→0, 200→255`.
  - **Threshold:** `threshold 128: (200,200,200)→255, (50,50,50)→0`.
  - **Invert:** `invert twice is identity`.
  - **Curves:**
    - `curves through (0,0),(255,255) is identity`.
    - `curves is monotone between increasing points`.
    - `curves channel then rgb compose`.
  - **Brightness/Contrast:** `brightnessContrast(0,0) identity; brightness 50 maps 100→150`.
  - **Hue/Saturation:** `hueSaturation hue 120 maps pure red to pure green`, ±1.
  - **Black & White:** `blackWhite 100 makes r=g=b=lum`.
  - **Vignette:** `vignette amount −100 size 100 softness 100: centre unchanged, corner black`.
  - **Canvas filters:** `canvasFilter for sepia/blur; null for lut kinds`.
  - **SVG filters:** `svgFilter for levels uses feComponentTransfer with a 256-entry table`.
- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Commit.** `feat(creative): adjustment definitions`.

### Task 16: Adjustment layers

**Files:**
- Create: `src/components/windows/creative/PhotoPanel.jsx` (the adjustments part)
- Modify: `compositor.js` (registers the adjustment provider), `CreativeStudioWindow.jsx` (the Photo tab uses `PhotoPanel`; `LegacyPhotoTab` stays only for Remove BG and Upscale until Task 18)
- Test: `tests/creative/browser/adjustments.browser.mjs`

**Interfaces:**
- Consumes: Task 15; `addLayer(s, 'adjust', { adjust, params }, meta)` and `setLayerProps` (Task 5).
- Produces:
  - The adjusted copy of the content beneath, drawn with the layer's opacity and mask (§3 step 4).
  - Slider drags use `mergeKey: adjust:<id>:<param>:<dragId>`.

- [ ] **Step 1: Write the failing browser tests.**
  - `invert adjustment at 100% inverts everything below`.
  - `invert at 50% gives mid-grey on black/white`: 128 ±1.
  - `layers above an adjustment are not affected`.
  - `editing params re-renders`.
  - `the masked adjustment only affects white areas`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
  - **`'filter'` kinds** draw the beneath surface with `ctx.filter = canvasFilter(...)`.
  - **`'lut'` and `'pixel'` kinds** run `applyAdjustmentPixels` on a copy. Task 17 routes this through the worker pool; until then it runs in the main thread.
  - **Caching.** Cache the adjusted result per layer, keyed on its params and the beneath version.
  - **`PhotoPanel`** offers an "Add adjustment" menu plus sliders built from `ADJUSTMENTS[type].params`.
- [ ] **Step 4: Run them and confirm they pass.**
- [ ] **Step 5: Commit.** `feat(creative): live adjustment layers`.

### Task 17: Filters on every core

**Files:**
- Create: `src/creative/filters/kernels.js`, `src/creative/filters/pool.js`, `src/creative/filters/worker.js`
- Modify: `PhotoPanel.jsx` (Filters section, with progress and cancel), `compositor.js` (lut and pixel adjustments go through the pool when the area is over 1 megapixel)
- Test: `tests/creative/filters.test.mjs`, `tests/creative/browser/filterPool.browser.mjs`

**Interfaces:**
- Produces, in `kernels.js`:
  - `FILTERS`: keyed by id, each entry `{ label, params }`.
    - The ids are `unsharp`, `sharpen`, `addNoise`, `reduceNoise`, `motionBlur`, `pixelate`, `emboss` and `findEdges`.
    - Parameters:
      - unsharp: `amount 1–500`, `radius 0.5–100`, `threshold 0–255`
      - addNoise: `amount 0–100`, `mono`, `seed`
      - reduceNoise: `radius 1–10`
      - motionBlur: `angle −180–180`, `distance 1–200`
      - pixelate: `cell 2–200`
      - emboss: `angle`, `height 1–10`
  - `overlapFor(id, params) → px`:
    - unsharp `ceil(3·radius)`
    - reduceNoise `radius`
    - motionBlur `ceil(distance)`
    - pixelate `cell`
    - every other filter `1`
  - `runFilter(id, src: Pixels, params, [y0, y1] = [0, src.height]) → Uint8ClampedArray`: computes only rows y0–y1, reading neighbours from `src`.
- Produces, in `pool.js`:
  - `planStrips(height, count, overlap) → [{ y0, y1, srcY0, srcY1 }]`
  - `runInStrips(id, src, params, count, runStrip) → Promise<Pixels>`
  - `createFilterPool({ size = navigator.hardwareConcurrency || 4 }) → { run(id, src, params, { onProgress, signal }) → Promise<Pixels>, runAdjustment(type, params, pixels, geom) → Promise<Pixels>, dispose() }`
- Algorithms:
  - **unsharp:** a separable Gaussian with σ = radius. With `diff = orig − blur`, wherever `|diff| ≥ threshold`, `out = orig + amount/100·diff`.
  - **sharpen:** the kernel `[0,−1,0; −1,5,−1; 0,−1,0]`.
  - **addNoise:** noise comes from a hash of `(seed, x, y, channel)`, so the result doesn't depend on the strips. Uniform noise of ±amount·2.55. Mono uses one value for all three channels.
  - **reduceNoise:** the per-channel median over a (2r+1)² window.
  - **motionBlur:** the mean of `distance` samples along the angle, centred.
  - **pixelate:** cells are aligned to absolute coordinates (0,0).
  - **emboss:** a 3×3 emboss kernel rotated to the angle and scaled by height, plus 128.
  - **findEdges:** `255 − min(255, Sobel magnitude)` per channel.

- [ ] **Step 1: Write the failing tests.**
  - `sharpen on a flat image is unchanged`.
  - `pixelate cell 2 averages 2×2 blocks`.
  - `reduceNoise removes a single hot pixel`.
  - `findEdges on a flat image is white`.
  - `motionBlur distance 1 is identity`.
  - `addNoise is identical across runs with the same seed`.
  - `for every filter, runInStrips with 1, 3 and 7 strips equals runFilter on the whole image`: this uses a seeded 97×61 random image, so the strips can't leave seams.
  - `planStrips covers every row exactly once with overlap clamped to bounds`.
- [ ] **Step 2: Write the failing browser test.** `the worker pool gives the same bytes as runFilter, reports progress to 1, and abort() rejects with AbortError`.
- [ ] **Step 3: Run both and confirm they fail.**
- [ ] **Step 4: Implement.**
  - The worker is created with `new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })`.
  - The source strip, margins included, is transferred to the worker.
  - Each filter edits the active pixel layer as one step, labelled `Photo · <Filter>`, through `beginStroke` and `touch` over the whole layer.
- [ ] **Step 5: Run both and confirm they pass.**
- [ ] **Step 6: Commit.** `feat(creative): multi-core filters`.

### Task 18: Open, place, Remove BG, 2× Upscale

**Files:**
- Create: `src/creative/io/raster.js` (the opening half), `src/creative/removeBackground.js`
- Modify:
  - `edits.js`: adds `upscaleDocument`.
  - `PhotoPanel.jsx`: adds Open, Place, Remove BG with a tolerance slider (default 40), and 2× Upscale.
  - `CreativeStudioWindow.jsx`: removes `LegacyPhotoTab`. Delete `LegacyPhotoTab.jsx` in this task.
- Test: `tests/creative/photo.test.mjs`, `tests/creative/browser/photo.browser.mjs`

**Interfaces:**
- Produces:
  - **`openImageFile(blob, name) → Promise<{ surface, width, height, scaledFrom: { width, height } | null }>`**
    - SVGs with no size open at 1024 px on the long side.
    - GIFs open their first frame.
  - **`fitWithinLimit(w, h, max = 16384) → { width, height, scale }`**
  - **`removeBackground(pixels, tolerance) → number`**: returns the count of pixels cleared.
    - It's a multi-source BFS from every edge pixel.
    - It enters a neighbour when its RGB Euclidean distance to the seed colour that reached it is ≤ tolerance, or when the neighbour is already transparent.
  - **`upscaleDocument(s, factor, meta) → Result`**
    - It refuses when a side would exceed 16384, with `'2× would make the image larger than 16384 px.'`.
    - Pixel layers and masks are redrawn with `imageSmoothingQuality = 'high'`.
    - Shape, text and adjustment numbers scale exactly: positions, sizes, `strokeWidth`, `fontSize`, `radius` and the blur radius.

- [ ] **Step 1: Write the failing tests.**
  - **Size limit (Review Focus 4):** `fitWithinLimit(30000, 8000) → width 16384, height 4369, scale ≈ 0.546`, and an image within the limit gets scale 1.
  - **Remove BG:**
    - `removeBackground clears a white border but keeps white pixels enclosed inside a black ring`.
    - `tolerance 0 only clears exact matches`.
  - **Upscale (browser tests):**
    - `upscaleDocument doubles size, layer x/y, shape w/h and fontSize`.
    - `upscaleDocument refuses past 16384`.
    - `one undo restores everything`.
  - **Opening (browser tests):**
    - `open a PNG blob makes a document its size`.
    - `place adds a layer at its own size`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.** An image over the limit opens scaled, and `store.notify` says `Opened at <w>×<h> — the original <W>×<H> is over the 16384 px limit.`.
- [ ] **Step 4: Run them and confirm they pass.**
- [ ] **Step 5: Run the full suite.**
- [ ] **Step 6: Commit.** `feat(creative): open, place, Remove BG and upscale`.

## Phase 4 — Meme and text

### Task 19: Text layers

**Files:**
- Create:
  - `src/creative/text.js`
  - `src/creative/tools/text.js`
  - `src/components/windows/creative/TextProperties.jsx`
- Modify: `tools/index.js` (adds T), `compositor.js` (registers the text renderer)
- Test: `tests/creative/text.test.mjs`, `tests/creative/browser/text.browser.mjs`

**Interfaces:**
- Produces:
  - **`FONT_CHOICES`:** Inter, Impact, Arial, Georgia, Times New Roman, Courier New, Verdana, Trebuchet MS, Segoe UI, Comic Sans MS, JetBrains Mono.
  - **`fontCss(layer) → string`**
  - **`layoutText(layer, measure(text, font) → width) → { lines: [{ text, width, y }], width, height, lineHeightPx }`**
    - Applies `uppercase`.
    - Wraps at `wrapWidth` on spaces, breaking a word longer than the width by characters.
    - Line height is `fontSize · lineHeight`.
  - **`resolveFont(family, isAvailable) → { family, fallback }`:** falls back to Inter.
  - **`fontAvailable(family) → boolean`:** compares widths against monospace and serif with `measureText`.
  - **`renderText(ctx, layer)`**
  - **The text tool:** a click adds a text layer with `text: 'Text'`, `fontFamily: 'Inter'`, `fontSize: 64`, `colour: primary`, `align: 'left'`, `lineHeight: 1.2` and `strokeWidth: 0`, then focuses `TextProperties`.
  - **Typing:** edits use `mergeKey: text:<id>`, `mergeWindowMs: 1000`.

- [ ] **Step 1: Write the failing tests.** These use a fake measure where width = characters × 10.
  - `wraps on spaces at wrapWidth 50`.
  - `breaks a long word`.
  - `uppercase applies`.
  - `explicit newlines start new lines`.
  - `no wrapWidth → one line per paragraph`.
  - `resolveFont falls back to Inter`.
- [ ] **Step 2: Write the failing browser tests.**
  - `text renders inside its box`.
  - `outline draws behind fill`: the stroke is drawn first.
  - `typing three characters within 1 s is one step`.
- [ ] **Step 3: Run both and confirm they fail.**
- [ ] **Step 4: Implement.**
  - **Box.** Text is drawn at x,y as the box's top-left corner and rotated about the box centre.
  - **Missing fonts.** When a family is missing, `TextProperties` says `<Family> isn't installed, showing Inter.`.
- [ ] **Step 5: Run both and confirm they pass.**
- [ ] **Step 6: Commit.** `feat(creative): editable text layers`.

### Task 20: Meme tab on layers

**Files:**
- Create: `src/components/windows/creative/MemePanel.jsx`, `src/creative/meme.js`
- Modify: `CreativeStudioWindow.jsx` (the Meme tab uses `MemePanel`). Delete `LegacyMemeTab.jsx`.
- Test: `tests/creative/browser/meme.browser.mjs`

**Interfaces:**
- Consumes: Tasks 5 and 19, and `MEME_TEMPLATES` (Task 10).
- Produces, in `meme.js`:
  - `applyMemeTemplate(s, template, meta) → Promise<Result>`:
    - It draws the template to cover the canvas into a pixel layer named `Template: <name>` with `role: 'memeTemplate'`, locked, at the bottom.
    - If a template layer already exists, it replaces it.
    - Either way, it's one step.
  - `setMemeText(s, which: 'top' | 'bottom', text, meta) → Result`: finds or creates the text layer with role `memeTop` or `memeBottom`.
    - Font: Impact, `fontSize = round(doc.width·0.09)`, white, uppercase.
    - Outline: black, `strokeWidth = round(fontSize·0.08)`.
    - Box: `align: 'center'`, `wrapWidth = doc.width·0.9`, `x = doc.width·0.05`.
    - Position: top text at `y = doc.height·0.04`; bottom text with its last line ending at `doc.height·0.96`.
    - Editing uses the `mergeKey` typing merge.
  - `addMemeText(s, meta) → Result`: the same style, centred.

- [ ] **Step 1: Write the failing browser tests.**
  - `picking a template adds one locked bottom layer and one step`.
  - `picking another replaces it`.
  - `top and bottom text create text layers with the meme style`.
  - `typing updates the same layer`.
  - `the template layer refuses painting with the lock reason`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and confirm they pass.**
- [ ] **Step 5: Run the full suite.** It must not reference `LegacyMemeTab`.
- [ ] **Step 6: Commit.** `feat(creative): Meme tab on text layers`.

## Phase 5 — Several documents

### Task 21: Document tabs

**Files:**
- Create:
  - `src/components/windows/creative/DocumentTabs.jsx`
  - `src/components/windows/creative/NewDocumentDialog.jsx`
  - `src/components/windows/creative/ConfirmCloseDialog.jsx`
- Modify: `edits.js` (adds `copyLayerToDocument`), `LayersPanel.jsx` (adds the "Copy layer to…" menu), `CreativeStudioWindow.jsx`
- Test: `tests/creative/edits.test.mjs` (extend), `scripts/smoke/creative-studio.mjs` (extend)

**Interfaces:**
- Produces:
  - **`copyLayerToDocument(fromSession, layerId, toSession, meta) → Result`:**
    - It clones the layer with `cloneLayer(fromDoc, layer, toDoc)`, mask included, and places it at the same x,y above the target's active layer.
    - It pushes a step only in the target.
  - **`NEW_DOCUMENT_PRESETS`:**
    - `{ label: 'HD 1920×1080', width: 1920, height: 1080 }`
    - `{ label: '4K 3840×2160', width: 3840, height: 2160 }`
    - `{ label: 'Square 1080', width: 1080, height: 1080 }`
    - `{ label: 'Square 1024', width: 1024, height: 1024 }`
    - `{ label: 'A4 300 dpi', width: 2480, height: 3508 }`

- [ ] **Step 1: Write the failing tests.**
  - Node:
    - `copyLayerToDocument adds to the target only; undo in the target removes it; the source history is unchanged`.
    - `copied mask pixels are independent`.
  - Smoke:
    - Open a second document and switch tabs; each keeps its own layers and history.
    - Closing a dirty tab shows the Save / Don't save / Cancel prompt, and Cancel keeps it open.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
  - **Tabs:** each shows the name, plus a `●` when dirty.
  - **New document:** the dialog takes width and height (1–16384), the presets, and a background of white, black, transparent or a custom colour.
- [ ] **Step 4: Run them and confirm they pass.**
- [ ] **Step 5: Commit.** `feat(creative): several documents at once`.

### Task 22: Memory budgets and status bar

**Files:**
- Create:
  - `src/creative/memory.js`
  - `src/components/windows/creative/StatusBar.jsx`
  - `src/components/windows/creative/StudioSettings.jsx`
- Modify: `studioStore.js` (applies `historyBytes` to every session's history and to new ones), `CreativeStudioWindow.jsx`
- Test: `tests/creative/memory.test.mjs`

**Interfaces:**
- Produces:
  - **`budgetsFor(ramGB) → { ramGB, historyBytes: ramGB·2³⁰/8, warnBytes: ramGB·2³⁰/2 }`**
  - **`loadBudgets({ evaluate, getSetting }) → Promise<budgets>`**
    - `evaluate` defaults to `evaluateHostHardware`; it reads `detected.ramGB` and falls back to 16.
    - `getSetting` defaults to `db.getSetting`, reading `creative_studio_settings_v1` as `{ historyBytes?, warnBytes? }` overrides.
  - **`usage(sessions) → { layers, history, total }`**, in bytes.
  - **The status bar** shows zoom, document size and `Memory: <used> of <warn>`.
    - Past `warnBytes` it shows `Memory is high — merge layers or close documents you don't need.`.
    - Work is never blocked.

- [ ] **Step 1: Write the failing tests.**
  - `budgetsFor(16) → history 2 GiB, warn 8 GiB`.
  - `budgetsFor(64) → history 8 GiB`.
  - `loadBudgets falls back to 16 GB when evaluate throws`.
  - `saved overrides win`.
  - `usage sums surfaces, masks and history bytes across sessions`.
- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.** `StudioSettings` edits both budgets in GB and saves them with `db.setSetting`. It also holds the pressure toggle and the eyedropper sample mode.
- [ ] **Step 4: Run the tests and confirm they pass.**
- [ ] **Step 5: Run the full suite.**
- [ ] **Step 6: Commit.** `feat(creative): memory budgets sized to the PC`.

## Phase 6 — Files

### Task 23: ZIP64 and Blob output in zipService

**Files:**
- Modify: `src/services/zipService.js`. Re-read it first.
- Test: `tests/desktop/zip.test.mjs` (extend)

**Interfaces:**
- Produces:
  - **`buildZipBlob(files: [{ path, blob? | bytes? }], { date = new Date(), zip64 = 'auto' } = {}) → Promise<Blob>`**
    - Entries are stored, not compressed.
    - The CRC is computed by streaming each blob.
    - The Blob is built from parts, so archives larger than memory work.
    - ZIP64 records (the 0x0001 extra field, the ZIP64 end record 0x06064b50, and locator 0x07064b50) are written when `zip64 === 'always'`, when any size or offset is ≥ 0xFFFFFFFF, or when there are ≥ 0xFFFF entries.
  - **Readers:** `readZip`, `listZipEntries` and `readZipEntry` read ZIP64 archives. The `'ZIP64 archives are not supported.'` errors are removed.
  - **Test approach (differs from the spec).** We test ZIP64 with `zip64: 'always'` on small archives, checked against Python's zipfile in both directions. This replaces the spec's "synthetic archive over 4 GB", which would need over 4 GB of test data. The ZIP64 paths are identical; only the threshold differs.

- [ ] **Step 1: Write the failing tests.**
  - `buildZipBlob → listZipEntries/readZipEntry round-trips blobs and bytes`.
  - `zip64 'always' archives read back with readZip and listZipEntries`.
  - `interop: Python zipfile reads our zip64 archive`: run `python -c` with `zipfile.ZipFile(p).testzip() is None`, as in the existing interop test.
  - `interop: we read Python's force_zip64 archive`: Python writes it with `zf.open(name, 'w', force_zip64=True)`.
  - All existing zip tests stay green.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and confirm they pass.** Run `node --experimental-test-module-mocks --test tests/desktop/zip.test.mjs`.
- [ ] **Step 5: Commit.** `feat(zip): ZIP64 and streaming Blob archives`.

### Task 24: `.novaart` projects and "Edit in Creative Studio"

**Files:**
- Create: `src/creative/io/png.js`, `src/creative/io/novaart.js`
- Modify:
  - `src/creative/surface.js`: ArraySurface PNG encoding and decoding uses `png.js`.
  - `src/services/openWith.js`, `src/services/fileStorageService.js`: add `psd` and `novaart` to `MIME_BY_EXT`. Re-read both first.
  - `CreativeStudioWindow.jsx`: File menu (New, Open, Place, Save, Download project, Export…), plus the `fileId` handoff.
- Test: `tests/creative/novaart.test.mjs`, `tests/desktop/openWith.test.mjs` (create it, or extend it if it exists)

**Interfaces:**
- Produces, in `png.js`:
  - `encodePng(pixels) → Promise<Uint8Array>`: RGBA 8-bit, compressed with `CompressionStream('deflate')`.
  - `decodePng(bytes) → Promise<Pixels>`: colour types 0, 2, 4 and 6 at 8-bit, all five filters, not interlaced. Anything else throws `Error('Unsupported PNG')`.
- Produces, in `novaart.js`:
  - `packProject(doc, { thumbnail = typeof OffscreenCanvas !== 'undefined' } = {}) → Promise<Blob>`: the §8 layout, written with `buildZipBlob`.
  - `unpackProject(blob) → Promise<Doc>`: reads entries one at a time with `listZipEntries`.
  - **The format:**
    - `document.json = { format: 'novaart', version: 1, name, width, height, activeLayerId, layers }`.
    - Pixel layers carry `image: 'layers/<id>.png'`. Masks carry `image: 'masks/<id>.png'`.
    - A version newer than 1 throws `Error('This project was made by a newer Creative Studio.')`.
- Produces, in `openWith.js`:
  - `fileKind` returns `'design'` for `/\.(psd|novaart)$/i`. This check runs before the image check.
  - For `design` files, the first option is `{ id: 'creative_studio', label: 'Edit in Creative Studio', run: () => handOff('creative_studio', { fileId: doc.id }) }`.
  - Images get the same option with `secondary: true`, after "View in Files". `defaultOpen` skips options marked `secondary`, so double-clicking an image behaves exactly as today.
- **The handoff:**
  - The studio reads `props.fileId` and `novaura:app_context` (with `appId === 'creative_studio'`) and dedupes by `openId`, following the pattern in `NovaMediaDeckWindow.jsx` lines 360–387.
  - It loads the file with `db.documents.get(fileId)` and `contentToBytes`.
- **Save and Download:**
  - The first Save goes to `/Creative Studio/<name>.novaart` (using `uniqueChildPath`), through `saveFile(path, blob, 'application/x-novaart')`. Later saves overwrite `savedPath` and set `savedVersion`.
  - Download uses `triggerDownload`.

- [ ] **Step 1: Write the failing tests.**
  - **PNG codec:**
    - `png encode→decode round-trips random RGBA`.
    - `decodePng reads an RGB (type 2) PNG`: the fixture is built by hand, with one IDAT and filter 1.
  - **Projects:**
    - `packProject→unpackProject restores every layer field, pixel bytes, masks, psdBlend and role`.
    - `a newer version is refused with the message`.
  - **Open with:**
    - `openWithOptions(psd) first option is creative_studio`.
    - `defaultOpen(image) is unchanged ('files' outside Files, null inside)`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and confirm they pass.**
- [ ] **Step 5: Extend the smoke script.** Save, close the tab, then reopen from Files with "Edit in Creative Studio". The document must match.
- [ ] **Step 6: Commit.** `feat(creative): .novaart projects and Edit in Creative Studio`.

### Task 25: Crash recovery

**Files:**
- Create: `src/creative/io/recovery.js`, `src/components/windows/creative/RecoveryPrompt.jsx`
- Modify: `studioStore.js` (adds `dispose()`, which flushes recovery), `CreativeStudioWindow.jsx` (calls `store.dispose()` on unmount and shows the prompt on mount)
- Test: `tests/creative/browser/recovery.browser.mjs`

**Interfaces:**
- Produces:
  - `openRecoveryDb()`: a Dexie database named `novaura_creative_recovery`, with `version(1).stores({ docs: 'id, updatedAt' })`.
  - `saveRecovery(session) → Promise<void>`: stores `{ id: session.id, name, updatedAt, blob: await packProject(doc, { thumbnail: false }) }`.
  - `listRecovery() → Promise<[{ id, name, updatedAt }]>`
  - `takeRecovery(id) → Promise<Doc>`
  - `clearRecovery(id) → Promise<void>`
  - `startRecovery(store, intervalMs = 120000) → stop()`: saves only dirty sessions whose `doc.version` changed since their last recovery copy.

- [ ] **Step 1: Write the failing browser tests.**
  - `a dirty session is saved on the interval`: run with `intervalMs` set to 50.
  - `save and close clear the copy`.
  - **Review Focus 5:** `store.dispose() with unsaved documents writes their copies before resolving`.
  - `takeRecovery restores the document exactly`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.** The prompt reads `Creative Studio closed with unsaved work. Restore <n> document(s)?` with buttons Restore and Discard.
- [ ] **Step 4: Run them and confirm they pass.**
- [ ] **Step 5: Commit.** `feat(creative): crash recovery`.

### Task 26: Opening PSDs

**Files:**
- Modify: `package.json` and `package-lock.json`, by running `npm install --save-exact ag-psd@34.1.0`.
- Create: `src/creative/io/psd.js` (the reading half), `src/components/windows/creative/OpenReport.jsx`
- Test: `tests/creative/psd.test.mjs`

**Interfaces:**
- Consumes: Tasks 3, 6 and 15.
- Produces:
  - **`readPsdFile(bytes) → { doc, report: string[] }`**
    - It calls `readPsd(bytes, { useImageData: true, skipThumbnail: true })`.
    - Pixel layers come from `layer.imageData`, `left` and `top`.
    - Masks come from `layer.mask` (`imageData`, `left`, `top`, `defaultColor` and `disabled`).
    - `protected` becomes `locked`.
    - Blend modes go through `fromPsdBlend`.
  - **Groups (`children`)** are flattened.
    - A hidden group hides its children.
    - The group's opacity multiplies into each child.
    - A group blend other than `pass through` is reported as `Group "<n>": blend mode "<m>" can't be kept; its layers use their own modes.`.
  - **Adjustment layers.** Adjustment types with a counterpart become `adjust` layers: Brightness/Contrast, Hue/Saturation, Levels, Curves, Vibrance, Invert, Threshold, Posterize and Black & White.
    - Black & White becomes `blackWhite` at amount 100.
    - Any other type becomes a hidden placeholder layer named after it.
  - **Text layers** keep `layer.text.text` in the name when the name doesn't already contain it.
  - **Report lines:**
    - Layer effects: `"<layer>": layer effects (<names>) were dropped.`
    - Colour modes other than 8-bit RGB: `Converted from <mode> <bits>-bit to 8-bit RGB.`, or the error `This PSD uses <mode>, which Creative Studio can't open yet.`.

- [ ] **Step 1: Probe ag-psd.** Confirm, in a scratch script:
  - `import { readPsd, writePsd } from 'ag-psd'` works from Node ESM;
  - `writePsd` with `imageData` and `generateThumbnail: false` needs no canvas;
  - which adjustment types and fields `node_modules/ag-psd/dist/psd.d.ts` defines;
  - what `readPsd` returns for 16-bit and CMYK files.

  Record the findings as a comment at the top of `psd.js`. If ESM import fails, use `createRequire`.
- [ ] **Step 2: Write the failing tests.** The fixtures are written with ag-psd's `writePsd` inside the test.
  - `names, positions, opacity, hidden, protected→locked and blend survive`.
  - `'linear dodge' reads as blend 'lighter' with psdBlend 'linear dodge'`.
  - `a mask with defaultColor 0 reads with defaultValue 0`.
  - `a hidden group hides its children; group opacity 0.5 multiplies`.
  - `a levels adjustment becomes a levels adjust layer with the same values`.
  - `an unsupported adjustment becomes a hidden placeholder and a report line`.
  - `effects produce a report line`.
- [ ] **Step 3: Run them and confirm they fail.**
- [ ] **Step 4: Implement.** `OpenReport.jsx` lists the report lines after an open, and shows nothing when the report is empty.
- [ ] **Step 5: Run them and confirm they pass.**
- [ ] **Step 6: Commit.** `feat(creative): open PSD files`.

### Task 27: Exporting PSDs

**Files:**
- Modify: `src/creative/io/psd.js` (the writing half)
- Create: `src/components/windows/creative/ExportDialog.jsx` (the PSD part)
- Test: `tests/creative/psd.test.mjs` (extend), `tests/creative/browser/psdExport.browser.mjs`

**Interfaces:**
- Produces:
  - **`writePsdFile(doc, { exactLook = false, rasterize, flatten, compositeBelow }) → ArrayBuffer`**
    - The three functions are passed in. The app passes the compositor's `rasterizeLayer`, `flatten` and `compositeBelow`. The Node tests pass array versions that only handle normal-blend pixel layers.
  - **Layers** keep their name, position, opacity, `toPsdBlend`, hidden, locked (as protected on all three flags) and mask.
  - **Shape and text layers** go out rasterized, named `<name>`.
  - **Adjustment layers:**
    - Types with a PSD counterpart go out as PSD adjustment layers, unless `exactLook` is set.
    - The others (blur, sepia, vignette), and every type when `exactLook` is set, go out as a pixel layer named `<name> (baked)`.
      - It holds the adjusted copy of `compositeBelow`, with the same opacity and mask and the Normal blend.
  - **The composite:** `imageData` is `flatten(doc)`.

- [ ] **Step 1: Write the failing tests.**
  - Node:
    - `round trip: writePsdFile → readPsdFile keeps every layer property, mask and psdBlend`.
    - `a levels adjust layer round-trips live`.
    - `exactLook bakes it to a pixel layer named "(baked)"`.
    - `blur is always baked`.
  - Browser:
    - `the baked layer over the layers beneath reproduces flatten() pixel for pixel`: the maximum channel difference is ≤ 1.
    - `the exported composite equals flatten()`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.** The dialog's PSD option has an "Exact look (bakes adjustments)" checkbox.
- [ ] **Step 4: Run them and confirm they pass.**
- [ ] **Step 5: Commit.** `feat(creative): export layered PSD`.

### Task 28: Exporting SVG

**Files:**
- Create: `src/creative/io/svg.js`
- Modify: `ExportDialog.jsx`, which adds SVG.
- Test: `tests/creative/svg.test.mjs`

**Interfaces:**
- Produces: `writeSvg(doc, { pngDataUrl(surface) → Promise<string>, measure }) → Promise<string>`.
- **The document:** an `<svg>` with `width`, `height` and `viewBox`, and `xmlns:inkscape`.
- **Layers:** each is `<g id="<id>" inkscape:groupmode="layer" inkscape:label="<name>">`, carrying:
  - `opacity`;
  - `style="mix-blend-mode:<mode>"`, with `source-over` → `normal` and `lighter` → `plus-lighter`;
  - `display="none"` when hidden;
  - `mask="url(#m-<id>)"`.
- **Each kind:**
  - Pixel layers are `<image>` elements.
  - Shapes use `shapeSvg`.
  - Text is `<text>` with one `<tspan>` per line from `layoutText`, and `paint-order="stroke"`.
- **Masks:** `<mask maskUnits="userSpaceOnUse">` holding a rect filled with the `defaultValue` grey, plus the mask image.
- **Adjustment layers:**
  - Everything beneath goes into `<g id="below-<n>">`.
  - It's followed by `<use href="#below-<n>" filter="url(#f-<id>)">`, carrying the layer's opacity and mask.
  - The filter is built from `svgFilter`.

- [ ] **Step 1: Write the failing tests.**
  - **Well-formed:** `output is well-formed XML`, checked with `python -c "import sys, xml.etree.ElementTree as E; E.fromstring(sys.stdin.read())"` through `execFileSync`.
  - **Contents:**
    - `each layer is a named inkscape layer group`.
    - `a rect shape is a <rect>`.
    - `text lines become tspans`.
    - `a hidden layer has display="none"`.
    - `multiply → mix-blend-mode:multiply`.
    - `a mask becomes <mask>`.
    - `an adjustment becomes a filter over a <use> of the content beneath`.
  - **Escaping:** `layer names and text are XML-escaped`, using a name `a<b&"c"`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and confirm they pass.**
- [ ] **Step 5: Commit.** `feat(creative): layered SVG export`.

### Task 29: PNG/JPG/WebP export and drag-and-drop

**Files:**
- Modify:
  - `src/creative/io/raster.js`: the export half.
  - `ExportDialog.jsx`: formats, a quality slider from 1 to 100 (default 92), and scale 1×, 2× or 3×.
  - `CanvasView.jsx` and `DocumentTabs.jsx`: drop targets.
- Test: `tests/creative/raster.test.mjs`, `tests/creative/browser/raster.browser.mjs`

**Interfaces:**
- Produces:
  - **`exportRaster(doc, { type: 'image/png' | 'image/jpeg' | 'image/webp', quality = 0.92, scale = 1 }) → Promise<Blob>`**
    - JPG is flattened onto white.
    - Scale past 16384 px is refused, with `'That scale would make the image larger than 16384 px.'`.
  - **`classifyDrop(target: 'tabs' | 'canvas', files) → [{ file, action: 'open' | 'place' | 'reject' }]`**
    - `.psd` and `.novaart` files always open.
    - Images open when dropped on the tabs and are placed when dropped on the canvas.
    - Anything else is rejected, with a notice naming the file.

- [ ] **Step 1: Write the failing tests.**
  - Node:
    - `classifyDrop routes psd/novaart to open, images by target, others to reject`.
    - `scale past the limit is refused`.
  - Browser:
    - `PNG export at 2× is twice the size`.
    - `JPG has no transparency`: the corner pixel is white.
    - `WebP quality 10 is smaller than quality 100`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and confirm they pass.**
- [ ] **Step 5: Commit.** `feat(creative): raster export and drag-and-drop`.

### Task 30: Final verification

**Files:**
- Modify: `scripts/smoke/creative-studio.mjs`, which covers the whole §11 run.
- Modify: `MASTER_AUDIT_TODO.md` at the repo root. Re-read it first; Gemini edits it.

- [ ] **Step 1: Extend the smoke script to the full §11 run.**
  - Paint, then add a shape, text and an adjustment.
  - Mask a layer and change a blend mode.
  - Undo across all three tabs.
  - Open a second document and copy a layer into it.
  - Export a PSD, reopen it, and compare the composites (maximum difference ≤ 1).
  - Measure paint frame time on a 4000×3000 document: 60 strokes, reporting the median and p95 ms.
  - Expect no console errors.
- [ ] **Step 2: Run it** against `npx vite --port 5199`. Everything should be ok. Record the paint frame-time numbers in the commit message.
- [ ] **Step 3: Check with an independent PSD reader.**
  - Run `python -m venv <scratchpad>/psdenv` and `<scratchpad>/psdenv/Scripts/pip install psd-tools`.
  - Read the exported smoke-test PSD with `psd_tools.PSDImage.open`, then assert the layer names, opacity, blend modes and visibility.
- [ ] **Step 4: Run the full suite.** Run `npm test`, `npm run test:browser -- tests/creative/browser/*.browser.mjs`, `npm run lint` and `npm run build`. All must pass, including the earlier 218 tests.
- [ ] **Step 5: Update `MASTER_AUDIT_TODO.md`.** Add a "Creative Studio layered editor" section with:
  - what shipped;
  - the paint frame-time baseline;
  - the open items: Dillan checks one PSD in Photopea or Photoshop, plus the follow-ups crop/resize (next), selections, layer groups and a WebGL compositor.
- [ ] **Step 6: Commit.** `test(creative): full verification and audit update`.
