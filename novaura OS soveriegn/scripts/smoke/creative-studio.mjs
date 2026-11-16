// creative-studio.mjs — Smoke test of the Creative Studio in the real app.
//
//   npx vite --port 5199 --strictPort      (in another terminal)
//   node scripts/smoke/creative-studio.mjs http://localhost:5199/ <screenshot dir>
//
// Opens the studio alone on scripts/smoke/creative-studio.html (the desktop needs node
// activation and sign-in, which a test browser doesn't have), paints, undoes and
// redoes with the keyboard, and fails on any page error.

import { mkdirSync } from 'node:fs';
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

  const fresh = b.errors.slice(baseline);
  check('no page errors after opening the studio', fresh.length === 0, fresh.slice(0, 4).join(' | '));
} catch (err) {
  check('smoke run', false, err.message);
} finally {
  console.log(results.join('\n'));
  await b.close();
  process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
}
