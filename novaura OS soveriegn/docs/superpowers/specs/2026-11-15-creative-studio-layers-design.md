# Creative Studio: layered editor — design

Date: 2026-11-15. Status: approved in conversation with Dillan; written spec under review.

## Goal

Turn the Creative Studio into a layered image editor that can compete with Photopea-class tools. The editor must run fully offline, the way all of Sovereign does. Users on powerful PCs should be able to use their hardware: no small fixed limits, memory budgets that scale with RAM, and filters that run on every CPU core.

**We'll know it worked when** a user can open a photo, add a shape layer, a text layer and an adjustment layer, mask one of them, change blend modes, undo back through all of it across the Paint, Photo and Meme tabs, and export a PSD that opens in Photopea or Photoshop with the same layers.

## Where we start

`src/components/windows/CreativeStudioWindow.jsx` (713 lines) holds three unrelated canvases:

- **Paint** is one flat bitmap.
  - Undo stores a full-picture data URL per step.
  - The eraser paints navy instead of clearing.
  - It uses mouse events only.
- **Photo** applies CSS filters to a fixed 600×400 sample.
  - You can't open your own image.
  - "Remove BG" clears every pixel close to the corner colour, inside the subject too.
  - "2× Upscale" scales by 1.5.
- **Meme** draws Impact text onto one of four built-in SVG templates.

There are no layers and the tabs share nothing. This work replaces all three with one engine. The four offline meme templates are kept.

## Decisions

| Question | Decision |
|---|---|
| What the Paint, Photo and Meme tabs are | Three workspaces over **one shared layered document**, like Affinity's Personas. Each tab keeps its own tools and layout. The Layers panel, History panel, canvas and colours are shared. |
| History | **One history per document**, spanning all three tabs. Undo never touches another open document. |
| Engine | **Our own engine on the browser's 2D canvas.** The drawing step sits behind one module (`compositor.js`), so a WebGL backend could replace it later. |
| PSD | **Open and export.** Uses the `ag-psd` library (MIT, works offline), pinned to an exact version. |
| Also in the first version | Masks, extra filters, several documents open at once. |
| Not in the first version | Selections, layer groups, crop and canvas resize. **Crop and resize come next**, with their own spec. |

## 1. The document

A document is a plain object that holds no DOM or React state, plus a side store of pixel buffers keyed by id.

```
document  { id, name, width, height, layers: Layer[] (bottom → top), activeLayerId,
            activeTarget: 'layer' | 'mask', dirty, fileHandle? }
Layer     { id, name, kind, visible, opacity (0–1), blend, locked, mask?: Mask,
            psdBlend?: string,            // original PSD mode when we render a fallback
            ...kind fields }
Mask      { x, y, width, height, bufferId, defaultValue (0 | 255), enabled }
```

The four layer kinds:

- **Pixel layer:** `{ x, y, width, height, bufferId }`.
  - New pixel layers cover the canvas. Placed images and PSD layers keep their own size and position.
  - A stroke that reaches past a pixel layer's edge first grows the layer to cover the canvas. The growth and the stroke make one history step.
- **Shape layer:** one shape per layer.
  - `{ shape: 'rect' | 'ellipse' | 'line' | 'polygon' | 'star', x, y, w, h, rotation, radius, sides, innerRatio, x1, y1, x2, y2, fill: colour | null, stroke: colour | null, strokeWidth }`.
  - It's drawn from these numbers every time, so it stays sharp and editable.
- **Text layer:** `{ text (multi-line), fontFamily, fontSize, fontWeight, italic, colour, align, lineHeight, strokeColour, strokeWidth, uppercase, x, y, rotation, wrapWidth? }`.
  - The fonts are the system fonts present on Windows and the fonts Sovereign bundles. Impact covers memes.
- **Adjustment layer:** `{ adjust: <type>, params }`. It changes everything composited beneath it. The types and their parameters are in section 5.

**Lock.** A locked layer can't be painted on, moved, edited, given a mask or deleted. Its visibility can still be toggled, as in Photoshop. Every function that edits a layer checks the lock and refuses with a reason the UI can show.

**Blend modes** are stored as canvas `globalCompositeOperation` names. There are 16:

- `source-over` (Normal), `multiply`, `screen`, `overlay`, `darken`, `lighten`;
- `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`;
- `hue`, `saturation`, `color`, `luminosity`.

## 2. History

Each document owns one history: a list of steps and a cursor. A step is `{ label, tab: 'paint' | 'photo' | 'meme', bytes, undo(), redo() }`.

- **Pixel steps** store only the changed rectangle, as before-and-after pixel data. Brush strokes track their dirty rectangle as they draw.
- **Property steps** store the old and new values: opacity, blend, visibility, lock, name, order, shape, text and adjustment parameters, and masks being added or removed.
- **Merging.** A slider drag becomes one step on release. Arrow-key nudges within 500 ms of each other merge into one step.
- **Branching.** A new change after an undo drops the undone steps.
- **Shortcuts.** Ctrl+Z undoes; Ctrl+Shift+Z and Ctrl+Y redo. They act only while the studio window has focus and focus isn't in a text field.
- **History panel.** It lists the steps with their tab icon. Clicking a step moves the cursor there and switches to the tab that step came from.
- **Budget.** There's no step limit. When the steps' total `bytes` passes the history budget (section 9), the oldest steps are dropped. The newest step is always kept.
- History isn't saved in project files.

## 3. Drawing the picture (compositor)

`compositor.js` draws a document onto a target canvas, from the bottom layer to the top:

1. **Pixel layer:** draw its buffer at `x, y` with `globalAlpha = opacity` and its blend mode.
2. **Shape or text layer:** render it into a scratch canvas, then composite like a pixel layer. Opacity then fades the whole layer, outline included.
3. **Masks:** before compositing, multiply the layer's alpha by the mask (`destination-in` with the mask as alpha). Outside the mask's rectangle, the mask counts as `defaultValue`.
4. **Adjustment layer:** take the composite so far, produce an adjusted copy, then draw that copy over the composite, using the layer's opacity and mask and the Normal blend. A 50% adjustment is therefore half strength, and a masked adjustment affects only the white areas.

**Caching.** Nothing redraws unless the document changed.
- While a layer is being edited, the compositor keeps one cached picture of everything beneath it.
- During a stroke, only the dirty rectangle is redrawn: the cache, the active layer, then the layers above it.

**PSD-only modes.** When a PSD layer uses a mode we don't have, we draw the closest one, keep the original in `psdBlend`, and show a marker on the layer. Exporting writes `psdBlend` back.

| PSD mode | Drawn as |
|---|---|
| Dissolve | Normal |
| Linear Burn | Color Burn |
| Darker Color | Darken |
| Lighter Color | Lighten |
| Linear Dodge (Add) | `lighter` (additive) |
| Vivid Light, Linear Light, Pin Light, Hard Mix | Hard Light |
| Subtract | Difference |
| Divide | Color Dodge |

## 4. The canvas view

- **Transparency:** a checkerboard background shows transparent areas.
- **Zoom:** 10%–3200%, with fit-to-window and 100% buttons, and Ctrl+scroll to zoom.
- **Pan:** hold Space and drag.
- **Input:** pointer events cover mouse, touch and pen.
  - Coalesced events keep strokes smooth.
  - Pen pressure scales the brush size. It's on by default and can be turned off.
- **Painting speed:** pixel buffers never live in React state, so painting doesn't re-render the interface.

## 5. The tabs and their tools

**Shared across all three tabs:**
- the canvas;
- the Layers panel;
- the History panel;
- the main and second colour (X swaps them);
- the document tabs;
- the status bar.

### Paint

- **Brush:** size, hardness, opacity, pressure.
  - Dabs within one stroke don't build up past the stroke's opacity, because the stroke is drawn into its own buffer first.
- **Pencil:** a hard edge with no anti-aliasing.
- **Eraser:** erases to transparent.
  - On a mask it paints black.
- **Fill bucket:**
  - tolerance from 0 to 255;
  - a contiguous option;
  - samples the current layer or all layers.
- **Gradient:** linear or radial, running main to second colour or main to transparent.
  - It works on pixel layers and masks.
- **Eyedropper:** samples the composite by default, or the current layer.
- **Shapes:** rectangle, ellipse, line, polygon and star.
  - Each shape you draw becomes a new shape layer.
  - A selected shape layer shows handles to move, resize and rotate it.
  - Its properties panel has fill, outline, outline width, corner radius, sides, and the star's inner ratio.
- **Move:** moves the selected layer.
  - Pixel layers change their `x, y`, so nothing is lost off the canvas.
  - Shape and text layers change their position.
  - Arrow keys nudge 1 px, or 10 px with Shift.
- **Text (T):** click to add a text layer.
  - The properties panel edits every text field.
- **Shortcuts:**
  - B brush, N pencil, E eraser, G fill, Shift+G gradient, I eyedropper, U shapes, V move, T text;
  - [ and ] change the brush size.

### Photo

- **Open:** starts a new document the size of the image.
- **Place:** adds an image as a new pixel layer.
- **Adjustments:** each one adds an adjustment layer above the selected layer, and the sliders edit the selected adjustment layer.
- **Filters:** they change the selected pixel layer, and each is one history step.
- **Remove BG:** flood-fills inward from the image edges with a tolerance slider, so the same colour inside the subject survives. It edits the layer, and you can undo it.
- **2× Upscale:** doubles the document.
  - Pixel layers resample at high quality.
  - Shapes, text and masks scale exactly.

**Adjustment layer types:**

| Adjustment | Parameters | How it's computed |
|---|---|---|
| Brightness/Contrast | brightness −150…150, contrast −50…100 | lookup table |
| Hue/Saturation | hue −180…180, saturation −100…100, lightness −100…100 | per-pixel HSL |
| Vibrance | vibrance −100…100, saturation −100…100 | per-pixel |
| Levels | input black, input white, gamma 0.1…9.99, output black, output white | lookup table |
| Curves | up to 16 points for RGB, and for R, G, B separately | lookup table |
| Black & White (grayscale) | amount 0…100 | per-pixel luminance |
| Invert | — | lookup table |
| Threshold | level 1…255 | lookup table |
| Posterize | levels 2…255 | lookup table |
| Sepia | amount 0…100 | canvas filter |
| Blur | radius 0…250 px | canvas filter |
| Vignette | amount −100…100, size 0…100, softness 0…100 | per-pixel |

**Filters:**
- Sharpen and Unsharp Mask (amount, radius, threshold);
- Add Noise (amount, mono or colour);
- Reduce Noise (median, radius 1…10);
- Motion Blur (angle, distance);
- Pixelate (cell size);
- Emboss (angle, height);
- Find Edges.

Heavy work runs in Web Workers.
- A pool sized to `navigator.hardwareConcurrency` splits the image into horizontal strips. Each strip overlaps its neighbours by the kernel radius, so there are no seams.
- Adjustment layers with per-pixel or lookup-table maths share the same pool, which keeps them live on large images.
- The window never freezes. Long jobs show progress and can be cancelled.

### Meme

- Picking a template places it as a locked pixel layer at the bottom.
- Top and bottom text are text layers in Impact with a black outline, uppercase on. Both stay editable.
- **Add text** adds another text layer.
- The four existing offline templates stay.

## 6. Masks

- Every layer kind can have one mask. White shows the layer, black hides it and grey partly shows it.
- **Add mask:** either "Reveal all" or "Hide all".
- **Editing:** click the mask thumbnail to edit the mask. The brush, pencil, eraser, fill and gradient then paint greys, and a marker on the canvas and the layer shows that the mask is the target.
- **Controls:** each of these is a history step.
  - Invert.
  - Turn off temporarily (Shift-click the thumbnail).
  - View the mask on its own (Alt-click).
  - Apply, which bakes the mask into a pixel layer.
  - Delete.
- **Copy layer to…:** carries masks along.
- **Files:** masks round-trip through PSD, are saved in `.novaart` files, and export to SVG as `<mask>`.

## 7. Several documents

- Document tabs sit above the canvas, each showing the document's name and a dot for unsaved changes.
- **New document:**
  - width and height from 1 to 16384 px;
  - presets: 1920×1080, 3840×2160, 1080×1080, 1024×1024, A4 at 300 dpi (2480×3508);
  - background: white, black, transparent or any colour.
- **Closing** a document with unsaved changes asks whether to save, discard or cancel.
- **Copy layer to…** copies the selected layer, with its mask, into another open document at the same position. It's one history step in the target document.
- There's no limit on the number of open documents. Memory is handled by the budget in section 9.

## 8. Files

### Project file: `.novaart`

A zip written by `src/services/zipService.js`:

```
document.json        format version, document fields, layers (all non-pixel fields)
layers/<id>.png      each pixel layer's buffer, lossless
masks/<id>.png       each mask, as a greyscale PNG
thumbnail.png        512 px on the long side
```

- PNGs are encoded with `OffscreenCanvas.convertToBlob` and stored without zip compression, since they're already compressed.
- **Save** writes into Sovereign's Files app (`fileStorageService.saveFile`). **Download** saves a copy to the PC (`triggerDownload`).
- **ZIP64.** `zipService` doesn't support ZIP64 today, so entries and archives over 4 GB fail. This work adds ZIP64 writing and reading, so large projects save; it fits the no-small-caps rule. Existing callers are unaffected, because ZIP64 records are only written when a size needs them.
- **Recovery.**
  - Every 2 minutes, each document with unsaved changes is packed as `.novaart` bytes into a separate Dexie database, `novaura_creative_recovery`. The main Sovereign schema is untouched.
  - Saving or closing a document clears its recovery copy.
  - When the studio opens and recovery copies exist, it offers to restore them.

### Opening files

- **Images:**
  - **PNG, JPG, WebP, GIF (first frame) and BMP** open as a pixel layer.
  - **SVG** is rendered to a pixel layer, at its own size or 1024 px on the long side when it has no size.
- **`.novaart`** reopens fully editable.
- **PSD:** see below.
- **Drag and drop:** dropping on the tab bar opens a new document; dropping on the canvas places the image as a layer.

### Opening a PSD

**Layers:**
- Pixel layers keep their name, position, opacity, blend mode (with the fallback table), visibility, lock and mask.
- Groups are flattened into their child layers. A hidden group hides its children, and the group's opacity multiplies into each child. A group's own blend mode, other than Pass Through, can't be kept and is reported.
- Text, vector shapes and smart objects become pixel layers from their rendered pixels. A text layer's text is kept in its name.

**Adjustment layers:**
- These Photoshop types become live adjustment layers: Brightness/Contrast, Hue/Saturation, Levels, Curves, Vibrance, Invert, Threshold, Posterize and Black & White.
- Any other adjustment comes in as a switched-off placeholder layer named after it.

**What can't be kept:**
- Layer effects, such as drop shadow, stroke and glow, are dropped and reported.

**Colour:**
- 8-bit RGB is fully supported.
- During implementation we test what `ag-psd` reads for 16-bit, 32-bit, CMYK and grayscale. Those it reads are converted to 8-bit RGB. Anything else is refused with a clear message.

**The open report:**
- It lists every conversion, fallback and drop, so nothing changes silently.

### Exporting a PSD

- **Pixel layers** keep their name, position, opacity, blend mode (or `psdBlend`), visibility, lock and mask.
- **Shape and text layers** go out as pixel layers at full resolution. Their names say what they were.
- **Adjustment layers:**
  - Those Photoshop also has go out as live PSD adjustment layers with the same settings.
  - Levels, Curves, Invert, Threshold and Posterize use published formulas and match exactly.
  - Brightness/Contrast, Hue/Saturation, Vibrance and Black & White can look slightly different in Photoshop, because Photoshop's exact formulas aren't published.
  - Adjustments Photoshop lacks (Blur, Sepia, Vignette) go out as a pixel layer holding their exact result over everything beneath, with the same opacity and mask. The picture is identical and the layers beneath stay intact.
- **"Exact look" option:** the export dialog can bake every adjustment this way, for a pixel-exact match at the cost of live adjustments.
- **Preview:** a flattened composite image is always included.

### Exporting SVG

- **Pixel layers** become `<image>` elements holding PNG data.
- **Shapes** become `<rect>`, `<ellipse>`, `<line>` or `<path>`, from the same geometry the canvas uses (`shapes.js`).
- **Text** becomes `<text>`, with its outline drawn behind the fill using `paint-order="stroke"`.
- **Layer properties:**
  - opacity becomes `opacity`;
  - blend modes become `mix-blend-mode`;
  - hidden layers stay in the file with `display="none"`;
  - masks become `<mask>`.
- **Adjustment layers** become SVG filters over a group holding everything beneath them.
- **Layer names:** each layer is a `<g>` with `inkscape:groupmode="layer"`, `inkscape:label` and `id`, so Inkscape and Illustrator list it as a layer.

### Exporting PNG, JPG and WebP

- These export the flattened composite.
- JPG and WebP have a quality slider from 1 to 100.
- The export scale can be 1×, 2× or 3×.

There are no file size caps. Big documents pack in the background so the window stays responsive.

## 9. Memory

`memory.js` sizes the budgets from Sovereign's hardware check (`evaluateHostHardware()` in `src/services/hardwareSpecService.js`). It falls back to 16 GB when the RAM can't be read.

- **History budget:** an eighth of RAM by default. That's 2 GB on 16 GB and 8 GB on 64 GB.
- **Warning:** when layers, masks and history together pass half of RAM, a warning suggests merging or closing documents. Work is never refused.
- **Status bar:** shows the memory used across all open documents.
- **Settings:** both budgets can be changed in the studio settings.
- **Canvas limit:** 16384 px per side is the browser's limit, not ours.

## 10. Code layout

**The engine** goes in `src/creative/`. It has no React and can be tested in Node.

| File | Purpose |
|---|---|
| `document.js` | Document and layer creation, every edit operation, lock checks |
| `history.js` | Steps, merging, branching, budget, per-document isolation |
| `compositor.js` | Draws a document; masks, adjustments, the below-cache, dirty rectangles |
| `blendModes.js` | The 16 modes, PSD names in both directions, the fallback table |
| `shapes.js` | Shape geometry for Path2D and for SVG path data |
| `text.js` | Text layout: wrapping, line height, uppercase, outline |
| `adjustments.js` | Adjustment definitions, defaults, lookup tables, canvas filter strings, SVG filter output |
| `filters/kernels.js` | Pure filter functions on pixel arrays |
| `filters/worker.js`, `filters/pool.js` | The worker entry point, and the strip-splitting pool |
| `tools/*.js` | Brush, pencil, eraser, fill, gradient, eyedropper, shape, text, move |
| `io/novaart.js` | Project pack and unpack |
| `io/psd.js` | PSD in and out via `ag-psd`, plus the open report |
| `io/svg.js` | SVG writer |
| `io/raster.js` | Opening images; PNG, JPG and WebP export |
| `io/recovery.js` | Crash recovery store |
| `memory.js` | Budgets and usage |
| `studioStore.js` | Open documents, the active document and tab; subscribe for React via `useSyncExternalStore` |

**The window:**

- **[`src/components/windows/CreativeStudioWindow.jsx`](../../../src/components/windows/CreativeStudioWindow.jsx)** becomes a slim frame: document tabs, the Paint/Photo/Meme switch and the status bar.
- **`src/components/windows/creative/`** holds the panels:
  - `CanvasView.jsx`
  - `LayersPanel.jsx`
  - `HistoryPanel.jsx`
  - `PaintPanel.jsx`
  - `PhotoPanel.jsx`
  - `MemePanel.jsx`
  - `ShapeProperties.jsx`
  - `TextProperties.jsx`
  - `NewDocumentDialog.jsx`
  - `ExportDialog.jsx`
  - `OpenReport.jsx`
  - `memeTemplates.js`, which holds the four existing templates.
- **`src/services/zipService.js`** gains ZIP64.

**Dependencies:**
- `ag-psd`, pinned to an exact version.
- Nothing else is new. Workers use Vite's `new Worker(new URL(...), { type: 'module' })`, which the app's CSP already allows (`worker-src 'self' blob:`).

## 11. Testing

**Unit tests** go in `tests/creative/*.test.mjs` and run with `npm test`:
- **document.js:** every edit, and every lock refusal.
- **History:**
  - undo and redo across tabs;
  - slider merging;
  - dropping undone steps;
  - budget eviction;
  - two documents never affecting each other.
- **Filter kernels:** each against known pixel results on small arrays, plus a check that splitting into strips gives the same output as one pass.
- **Adjustment lookup tables:** Levels, Curves, Threshold, Posterize and Invert against known values.
- **Tools and geometry:**
  - flood fill (tolerance, contiguous);
  - shape geometry;
  - text wrapping;
  - the blend-mode table in both directions.

**Round trips:**
- **PSD:** write it, read it back, and compare names, positions, opacity, blends (including `psdBlend`), visibility, locks, masks and live adjustments. Baked adjustments must match the composite pixel for pixel.
- **`.novaart`:** save and reopen, and the document is identical.
- **SVG:** the output parses as XML, its layers are named, and masks and filters are present.
- **zipService:** ZIP64 round-trips with a synthetic archive over 4 GB, written to the scratch disk. Existing zip tests stay green.

**Headless Chrome on the real build**, using a CDP script in the scratchpad, as with earlier smoke tests. It will:
- paint, then add shape, text and adjustment layers;
- mask a layer;
- change blend modes;
- undo across all three tabs;
- open a second document and copy a layer into it;
- export a PSD, reopen it, and compare its composite with the canvas;
- measure the frame time while painting on a 4000×3000 document;
- confirm there are no console errors.

**Independent check:**
- If `psd-tools` (Python) is on this machine, it reads our exported PSDs too.
- The final check is Dillan's: open one sample PSD in Photopea or Photoshop.

**Must still pass:**
- `npm run lint`;
- `npm run build`;
- all existing tests (218 today).

## 12. Build order

Each phase ends with the Creative Studio usable:

1. **Engine and Paint.**
   - Document, history, compositor, blend modes, canvas view, brush, pencil, eraser, fill, eyedropper, move.
   - The Paint tab runs on the new engine.
2. **Layers and masks.**
   - The Layers panel, the History panel, shape layers and their handles, the gradient tool, masks.
3. **Photo.**
   - Open and place, adjustment layers, filters with the worker pool, Remove BG, 2× Upscale.
4. **Meme and text.**
   - Text layers and the text tool, the Meme tab on text layers, the templates moved to `memeTemplates.js`.
5. **Several documents.**
   - Document tabs, the new-document dialog, close prompts, Copy layer to…, memory budgets and the status bar.
6. **Files.**
   - `.novaart`, ZIP64, recovery, PSD in and out with the report, SVG export, PNG/JPG/WebP export, drag and drop.

## Risks and open points

- **Gemini edits the same tree in parallel.** Before editing a file, check its modified time against the last read, and keep edits exact.
- **`ag-psd` coverage** of uncommon colour modes and adjustment types is confirmed in phase 6. Anything unsupported is reported, never silently dropped.
- **Paint speed on very large canvases** (8K and up, many layers) is limited by the 2D canvas. The phase 1 frame-time check sets the baseline. If it falls short, the compositor is the single place a WebGL backend would go.
- **Fonts:** a text layer whose font isn't on the machine falls back to Inter and says so in its properties panel.

## Follow-ups (not in this spec)

1. **Crop and canvas resize:** Dillan wants these next, after this group.
2. **Selections:** marquee, lasso and magic wand.
3. **Layer groups.**
4. **A WebGL compositor**, if the large-canvas numbers call for it.
