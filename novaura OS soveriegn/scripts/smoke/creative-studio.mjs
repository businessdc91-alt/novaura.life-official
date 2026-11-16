// creative-studio.mjs — Smoke test of the Creative Studio in the real app.
//
//   npx vite --port 5199 --strictPort      (in another terminal)
//   node scripts/smoke/creative-studio.mjs http://localhost:5199/ <screenshot dir>
//
// Opens the studio alone on scripts/smoke/creative-studio.html (the desktop needs node
// activation and sign-in, which a test browser doesn't have), paints, undoes and
// redoes with the keyboard, and fails on any page error.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchBrowser, sleep } from '../lib/cdp.mjs';

const [URL = 'http://localhost:5199/', OUT = 'smoke-shots'] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? ` (${extra})` : ''}`);

const b = await launchBrowser({ width: 1600, height: 1000 });
try {
  const baseline = b.errors.length;
  await b.navigate(`${URL.replace(/\/?$/, '/')}scripts/smoke/creative-studio.html`);
  const opened = await b.waitFor(`!!document.querySelector('[data-creative-canvas]')`, 30000);
  check('the Creative Studio opens with a canvas', opened);
  await sleep(800);
  await b.screenshot(join(OUT, 'c1_open.png'));

  // The canvas centre, and a pixel read from its backing store.
  const box = await b.evaluate(`(() => { const r = document.querySelector('[data-creative-canvas]').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const pixelAt = (x, y) => b.evaluate(`(() => {
    const c = document.querySelector('[data-creative-canvas]');
    const r = c.getBoundingClientRect();
    const dpr = c.width / r.width;
    return [...c.getContext('2d').getImageData(Math.round((${x} - r.left) * dpr), Math.round((${y} - r.top) * dpr), 1, 1).data];
  })()`);
  const pixel = () => pixelAt(cx, cy);

  const before = await pixel();
  check('the new document is white', before.slice(0, 3).every(v => v > 240), String(before));
  await b.drag([cx - 120, cy], [cx + 120, cy], 24);
  await sleep(400);
  const painted = await pixel();
  check('painting changes the canvas', painted.join() !== before.join(), `${before} → ${painted}`);
  await b.screenshot(join(OUT, 'c2_painted.png'));

  await b.key('z', 'KeyZ', 90, 2);
  await sleep(400);
  const undone = await pixel();
  check('Ctrl+Z undoes the stroke', undone.join() === before.join(), String(undone));
  await b.key('y', 'KeyY', 89, 2);
  await sleep(400);
  check('Ctrl+Y redoes it', (await pixel()).join() === painted.join());

  await b.key('e', 'KeyE', 69);
  await sleep(200);
  check('E selects the eraser', await b.evaluate(`document.querySelector('[data-tool="eraser"]')?.getAttribute('aria-pressed') === 'true'`));
  await b.key('b', 'KeyB', 66);

  // ── Layers and History panels ──
  const centre = sel => b.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, left: r.left, width: r.width }; })()`);
  const clickOn = async (sel, clicks = 1) => {
    const at = await centre(sel);
    if (!at) throw new Error(`nothing matches ${sel}`);
    for (let n = 1; n <= clicks; n++) {
      await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.x, y: at.y, button: 'left', buttons: 1, clickCount: n });
      await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y, button: 'left', buttons: 0, clickCount: n });
    }
    await sleep(250);
  };
  const layerCount = () => b.evaluate(`document.querySelectorAll('[data-layer-id]').length`);
  const layerNames = () => b.evaluate(`[...document.querySelectorAll('[data-layer-name]')].map(e => e.textContent)`);
  const stepCount = () => b.evaluate(`document.querySelectorAll('[data-step-index]:not([data-step-index="-1"])').length`);
  const lastStep = () => b.evaluate(`[...document.querySelectorAll('[data-step-index]')].pop()?.textContent || ''`);
  const selected = '[data-layer-id][aria-selected="true"]';

  check('the Layers panel lists the Background layer', (await layerNames()).join() === 'Background');
  await clickOn('[data-action="new-layer"]');
  check('New layer adds a layer on top', (await layerNames()).join() === 'Layer 1,Background');

  await clickOn(`${selected} [data-layer-name]`, 2);
  await b.send('Input.insertText', { text: 'Sky' });
  await b.key('Enter', 'Enter', 13);
  await sleep(250);
  check('double-click renames a layer', (await layerNames())[0] === 'Sky', (await layerNames()).join());

  const stepsBefore = await stepCount();
  const slider = await centre('[data-opacity-slider]');
  await b.drag([slider.left + slider.width - 2, slider.y], [slider.left + slider.width * 0.4, slider.y], 12);
  await sleep(300);
  const opacityShown = await b.evaluate(`document.querySelector('[data-opacity-value]')?.textContent`);
  check('dragging the opacity slider makes one history step', (await stepCount()) === stepsBefore + 1, `${stepsBefore} → ${await stepCount()}, opacity ${opacityShown}`);
  check('the opacity follows the drag', /^(3[5-9]|4[0-5])%$/.test(opacityShown || ''), opacityShown);

  await b.evaluate(`(() => { const s = document.querySelector('[data-blend-select]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'multiply'); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await sleep(250);
  check('choosing a blend mode is a labelled step', /Paint · Blend mode/.test(await lastStep()), await lastStep());

  await clickOn(`${selected} [data-action="toggle-visible"]`);
  check('the eye hides the layer', await b.evaluate(`document.querySelector('${selected}').dataset.visible === 'false'`));
  await clickOn(`${selected} [data-action="toggle-visible"]`);
  await clickOn(`${selected} [data-action="toggle-lock"]`);
  check('the padlock locks the layer', await b.evaluate(`document.querySelector('${selected}').dataset.locked === 'true'`));
  await clickOn(`${selected} [data-action="toggle-lock"]`);

  await clickOn('[data-action="layer-down"]');
  check('Move down reorders the stack', (await layerNames()).join() === 'Background,Sky', (await layerNames()).join());
  await clickOn('[data-action="layer-up"]');
  await clickOn('[data-action="merge-down"]');
  await sleep(300);
  check('Merge down leaves one layer', (await layerCount()) === 1, (await layerNames()).join());

  const newLayerStep = await b.evaluate(`[...document.querySelectorAll('[data-step-index]')].find(e => /New layer/.test(e.textContent))?.dataset.stepIndex`);
  await clickOn(`[data-step-index="${newLayerStep}"]`);
  check('clicking an earlier history step goes back to it', (await layerCount()) === 2, (await layerNames()).join());
  await clickOn('[data-step-index="-1"]');
  check('clicking "New document" goes back to the start', (await layerCount()) === 1);
  await b.screenshot(join(OUT, 'c3_layers.png'));

  // ── Shapes ──
  await b.key('u', 'KeyU', 85);
  await sleep(200);
  await clickOn('[data-shape-kind="star"]');
  await b.drag([cx - 150, cy - 120], [cx + 30, cy + 60], 12);
  await sleep(300);
  check('the shape tool draws a star layer', (await layerNames())[0] === 'Star', (await layerNames()).join());
  check('the selected shape shows its properties', await b.evaluate(`!!document.querySelector('[aria-label="Selected shape"]')`));
  await b.screenshot(join(OUT, 'c4_shape.png'));

  // ── Masks ──
  await clickOn('[data-action="add-mask"]');
  check('Add mask gives the layer a mask, ready to paint', await b.evaluate(`document.querySelector('${selected} [data-action="mask-thumb"]')?.getAttribute('aria-pressed') === 'true'`));
  // The star was drawn from (cx-150, cy-120) to (cx+30, cy+60); its middle is (cx-60, cy-30).
  const starPixel = await pixelAt(cx - 60, cy - 30);
  check('the star is painted at its middle', starPixel.join() !== before.join(), String(starPixel));
  // The Add mask button turns itself off, so focus falls out of the studio: keys must still work.
  await b.key('e', 'KeyE', 69);
  await sleep(200);
  check('tool keys still work after a button disables itself', await b.evaluate(`document.querySelector('[data-tool="eraser"]')?.getAttribute('aria-pressed') === 'true'`));
  await b.drag([cx - 100, cy - 30], [cx - 20, cy - 30], 16);
  await sleep(400);
  const masked = await pixelAt(cx - 60, cy - 30);
  check('erasing on the mask hides that part of the layer', masked.join() === before.join(), `${starPixel} → ${masked}`);
  await clickOn('[data-action="view-mask"]');
  await b.screenshot(join(OUT, 'c5_mask_alone.png'));
  await clickOn('[data-action="view-mask"]');
  await clickOn('[data-action="delete-mask"]');
  check('Delete mask removes it', await b.evaluate(`!document.querySelector('${selected} [data-action="mask-thumb"]')`));
  const unmasked = await pixelAt(cx - 60, cy - 30);
  await b.screenshot(join(OUT, 'c6_mask_deleted.png'));
  check('and the layer shows again', unmasked.join() === starPixel.join(), String(unmasked));

  // ── Text ──
  await b.key('t', 'KeyT', 84);
  await sleep(150);
  await b.click(cx + 100, cy + 80);
  await sleep(300);
  check('a click with T adds a text layer and focuses its text box', await b.evaluate(`document.activeElement?.matches('[data-text-input]')`));
  await b.send('Input.insertText', { text: 'Hello Sovereign' });
  await sleep(400);
  check('typing renames the layer after its words', (await layerNames())[0] === 'Hello Sovereign', (await layerNames()).join());
  check('typing in the text box is one history step', /Paint · Edit text/.test(await lastStep()), await lastStep());
  await b.key('z', 'KeyZ', 90, 2);
  await sleep(200);
  check('Ctrl+Z inside the text box edits the text, not the picture history', /Paint · Edit text/.test(await lastStep()));
  await b.screenshot(join(OUT, 'c8_text.png'));
  await b.click(cx - 200, cy + 150);

  // ── Photo: adjustment layers ──
  await clickOn('[data-tab="photo"]');
  const beforeAdjust = await pixelAt(cx + 200, cy + 100);
  await clickOn('[data-add-adjustment="invert"]');
  await sleep(300);
  const inverted = await pixelAt(cx + 200, cy + 100);
  check('an Invert adjustment layer inverts the picture', inverted.slice(0, 3).join() === beforeAdjust.slice(0, 3).map(v => 255 - v).join(), `${beforeAdjust} → ${inverted}`);
  check('it is a Photo step in the history', /Photo · Add Invert/.test(await lastStep()), await lastStep());
  await clickOn('[data-add-adjustment="levels"]');
  check('Levels shows its settings', await b.evaluate(`!!document.querySelector('[data-param="gamma"]')`));
  await clickOn('[data-add-adjustment="curves"]');
  check('Curves shows the curve editor', await b.evaluate(`!!document.querySelector('[data-curves-editor]')`));
  await b.screenshot(join(OUT, 'c7_photo.png'));
  await b.key('z', 'KeyZ', 90, 2);
  await b.key('z', 'KeyZ', 90, 2);
  await b.key('z', 'KeyZ', 90, 2);
  await sleep(300);
  check('undo removes the adjustments again', (await pixelAt(cx + 200, cy + 100)).join() === beforeAdjust.join());

  // ── Photo: a filter on the workers ──
  const bgRow = await b.evaluate(`[...document.querySelectorAll('[data-layer-id]')].find(r => r.querySelector('[data-layer-name]')?.textContent === 'Background')?.dataset.layerId`);
  await clickOn(`[data-layer-id="${bgRow}"] [data-layer-name]`);
  await clickOn('[data-filter="addNoise"]');
  await clickOn('[data-action="apply-filter"]');
  check('a filter finishes on the workers', await b.waitFor(`!document.querySelector('[data-busy]') && /Photo · Add Noise/.test([...document.querySelectorAll('[data-step-index]')].pop()?.textContent || '')`, 20000), await lastStep());
  check('and changes the picture', (await pixelAt(cx + 200, cy + 100)).join() !== beforeAdjust.join());
  await b.key('z', 'KeyZ', 90, 2);
  await sleep(300);
  check('undo takes the filter back', (await pixelAt(cx + 200, cy + 100)).join() === beforeAdjust.join());

  // ── Photo: Remove BG and 2× Upscale ──
  await clickOn('[data-action="remove-bg"]');
  check('Remove BG is a Photo step', /Photo · Remove background/.test(await lastStep()), await lastStep());
  check('and the plain background is gone (the checkerboard shows)', (await pixelAt(cx + 200, cy + 100)).join() !== beforeAdjust.join());
  await b.key('z', 'KeyZ', 90, 2);
  await clickOn('[data-action="upscale"]');
  check('2× Upscale is a Photo step', /Photo · 2× Upscale/.test(await lastStep()), await lastStep());
  await b.key('z', 'KeyZ', 90, 2);
  await sleep(300);
  check('undo restores the original size', (await pixelAt(cx + 200, cy + 100)).join() === beforeAdjust.join());

  // ── Meme ──
  await clickOn('[data-tab="meme"]');
  await clickOn('[data-meme-template="doge"]');
  await sleep(500);
  check('picking a template adds a locked template layer', await b.evaluate(`[...document.querySelectorAll('[data-layer-id]')].some(r => /^Template: /.test(r.querySelector('[data-layer-name]')?.textContent || '') && r.dataset.locked === 'true')`));
  await clickOn('[data-meme-top]');
  await b.send('Input.insertText', { text: 'when it runs offline' });
  await clickOn('[data-meme-bottom]');
  await b.send('Input.insertText', { text: 'on your own machine' });
  await sleep(400);
  const memeNames = await layerNames();
  check('captions are text layers', memeNames.includes('Top text') && memeNames.includes('Bottom text'), memeNames.join());
  check('meme steps are labelled Meme', /^Meme · (Bottom text|Edit text)$/.test((await lastStep()).trim()), await lastStep());
  await b.screenshot(join(OUT, 'c9_meme.png'));

  // ── Several documents ──
  const tabCount = () => b.evaluate(`document.querySelectorAll('[data-doc-tab]').length`);
  check('the open document has a tab, marked unsaved', await b.evaluate(`document.querySelector('[data-doc-tab][aria-selected="true"]')?.textContent.includes('●')`));
  await clickOn('[data-action="new-document"]');
  check('New document opens the dialog', await b.evaluate(`!!document.querySelector('[data-new-document-dialog]')`));
  await clickOn('[data-preset="Square 1080"]');
  await clickOn('[data-action="create-document"]');
  await sleep(300);
  check('a second document opens in its own tab', (await tabCount()) === 2);
  check('it starts with just its background', (await layerNames()).join() === 'Background', (await layerNames()).join());
  await clickOn('[data-doc-tab]');
  await sleep(200);
  check('switching back shows the first document\'s layers', (await layerNames()).includes('Top text'));
  const starId = await b.evaluate(`[...document.querySelectorAll('[data-layer-id]')].find(r => r.querySelector('[data-layer-name]')?.textContent === 'Star')?.dataset.layerId`);
  await clickOn(`[data-layer-id="${starId}"] [data-layer-name]`);
  const otherId = await b.evaluate(`document.querySelector('[data-copy-layer-to] option[value]:not([value=""])')?.value`);
  await b.evaluate(`(() => { const s = document.querySelector('[data-copy-layer-to]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(otherId)}); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await sleep(200);
  await clickOn('[data-doc-tab]:last-of-type');
  await sleep(200);
  check('Copy layer to… puts it in the other document', (await layerNames()).join() === 'Star,Background', (await layerNames()).join());
  await clickOn('[data-doc-tab]');
  await clickOn('[data-doc-tab][aria-selected="true"] [data-action="close-document"]');
  check('closing a document with unsaved changes asks first', await b.evaluate(`!!document.querySelector('[data-confirm-close]')`));
  await clickOn('[data-action="cancel-close"]');
  check('Cancel keeps it open', (await tabCount()) === 2);
  await b.screenshot(join(OUT, 'c10_documents.png'));

  // ── Saving and reopening a project ──
  const namesBefore = await layerNames();
  await b.key('s', 'KeyS', 83, 2);
  check('Ctrl+S saves the project to Files', await b.waitFor(`/Saved to Files: \\/Creative Studio\\/Untitled\\.novaart/.test(document.querySelector('[role=status]')?.textContent || '')`, 15000));
  check('and the unsaved dot goes away', await b.evaluate(`!document.querySelector('[data-doc-tab][aria-selected="true"]')?.textContent.includes('●')`));
  await clickOn('[data-doc-tab][aria-selected="true"] [data-action="close-document"]');
  check('a saved document closes without asking', (await tabCount()) === 1 && await b.evaluate(`!document.querySelector('[data-confirm-close]')`));
  const fileId = await b.evaluate(`(async () => (await (await import('/src/services/fileStorageService.js')).getFileByPath('/Creative Studio/Untitled.novaart'))?.id)()`);
  await b.evaluate(`window.dispatchEvent(new CustomEvent('novaura:app_context', { detail: { appId: 'creative_studio', props: { fileId: ${JSON.stringify(fileId)}, openId: 'smoke-1' } } }))`);
  check('Edit in Creative Studio reopens it from Files', await b.waitFor(`document.querySelectorAll('[data-doc-tab]').length === 2`, 15000));
  await sleep(300);
  check('with the same layers', (await layerNames()).join() === namesBefore.join(), `${namesBefore} → ${await layerNames()}`);
  check('and not marked unsaved', await b.evaluate(`!document.querySelector('[data-doc-tab][aria-selected="true"]')?.textContent.includes('●')`));

  // ── Status bar and memory ──
  check('the status bar shows the document size', /^\d+ × \d+ px$/.test(await b.evaluate(`document.querySelector('[data-status-size]')?.textContent`)));
  const memory = await b.evaluate(`document.querySelector('[data-memory]')?.textContent || ''`);
  check('the status bar shows memory against a budget sized to the PC', /^Memory: [\d.]+ (KB|MB|GB) of \d+(\.\d)? GB$/.test(memory), memory);
  await clickOn('[data-action="studio-settings"]');
  check('the studio settings open', await b.evaluate(`!!document.querySelector('[data-studio-settings]')`));
  await clickOn('[data-action="studio-settings"]');

  // ── Crash recovery: close the studio with unsaved work, then open it again ──
  check('there is unsaved work to protect', await b.evaluate(`[...document.querySelectorAll('[data-doc-tab]')].some(t => t.textContent.includes('●'))`));
  await b.evaluate('window.__unmountStudio()');
  await sleep(1500);
  const errorsBeforeReload = b.errors.length;
  await b.navigate(`${URL.replace(/\/?$/, '/')}scripts/smoke/creative-studio.html`);
  check('reopening the studio offers to restore the unsaved work', await b.waitFor(`!!document.querySelector('[data-recovery-prompt]')`, 20000));
  await clickOn('[data-action="restore-recovery"]');
  await sleep(800);
  const restoredNames = await layerNames();
  check('Restore brings the document back', restoredNames.join() === 'Star,Background', restoredNames.join());
  check('still marked unsaved', await b.evaluate(`document.querySelector('[data-doc-tab][aria-selected="true"]')?.textContent.includes('●')`));
  check('and the empty starting document is not left behind', (await tabCount()) === 1);
  await b.screenshot(join(OUT, 'c11_recovered.png'));
  check('no page errors after reopening', b.errors.length === errorsBeforeReload, b.errors.slice(errorsBeforeReload, errorsBeforeReload + 3).join(' | '));

  // ── Opening a PSD through File > Open ──
  const { writePsd } = await import('ag-psd');
  const swatch = (w, h, rgba) => ({ width: w, height: h, data: Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => rgba[i % 4]) });
  const psdPath = join(OUT, 'fixture-poster.psd');
  writeFileSync(psdPath, new Uint8Array(writePsd({
    width: 300, height: 200, imageData: swatch(300, 200, [255, 255, 255, 255]),
    children: [
      { name: 'Paper', left: 0, top: 0, imageData: swatch(300, 200, [240, 230, 210, 255]) },
      { name: 'Ink', blendMode: 'multiply', children: [{ name: 'Logo', left: 40, top: 30, opacity: 0.8, imageData: swatch(120, 80, [30, 60, 160, 255]) }] },
      { name: 'Brighten', adjustment: { type: 'brightness/contrast', brightness: 20, contrast: 10 } },
    ],
  }, { generateThumbnail: false, noBackground: true })));
  await clickOn('[data-menu="file"]');
  const input = await b.send('Runtime.evaluate', { expression: `document.querySelector('input[type=file][accept*=".psd"]')` });
  await b.send('DOM.setFileInputFiles', { files: [psdPath], objectId: input.result.result.objectId });
  check('File > Open opens a PSD in its own tab', await b.waitFor(`[...document.querySelectorAll('[data-doc-tab]')].some(t => t.textContent.includes('fixture-poster'))`, 20000));
  await sleep(400);
  check('with its layers', (await layerNames()).join() === 'Brighten,Logo,Paper', (await layerNames()).join());
  check('and a report of what changed', /Group "Ink": blend mode "multiply"/.test(await b.evaluate(`document.querySelector('[data-open-report]')?.textContent || ''`)));
  await b.screenshot(join(OUT, 'c12_psd_open.png'));
  await clickOn('[data-action="close-open-report"]');

  // ── Exporting a PSD ──
  await clickOn('[data-menu="file"]');
  await clickOn('[data-action="file-export"]');
  check('File > Export opens the export dialog', await b.evaluate(`!!document.querySelector('[data-export-dialog]')`));
  await clickOn('[data-format="psd"]');
  await clickOn('[data-exact-look]');
  await clickOn('[data-action="run-export"]');
  check('exporting a PSD finishes', await b.waitFor(`/Exported fixture-poster\\.psd/.test(document.querySelector('[role=status]')?.textContent || '')`, 20000));
  await clickOn('[data-menu="file"]');
  await clickOn('[data-action="file-export"]');
  await clickOn('[data-format="svg"]');
  await clickOn('[data-action="run-export"]');
  check('exporting an SVG finishes', await b.waitFor(`/Exported fixture-poster\\.svg/.test(document.querySelector('[role=status]')?.textContent || '')`, 20000));

  const fresh = b.errors.slice(baseline);
  check('no page errors after opening the studio', fresh.length === 0, fresh.slice(0, 4).join(' | '));
} catch (err) {
  check('smoke run', false, err.message);
} finally {
  console.log(results.join('\n'));
  if (results.some(r => r.startsWith('FAIL')) && b.errors.length) console.log(`page errors:\n${b.errors.slice(-8).join('\n')}`);
  await b.close();
  process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
}
