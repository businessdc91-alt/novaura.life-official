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
  const pixel = () => b.evaluate(`(() => {
    const c = document.querySelector('[data-creative-canvas]');
    const r = c.getBoundingClientRect();
    const dpr = c.width / r.width;
    return [...c.getContext('2d').getImageData(Math.round((${cx} - r.left) * dpr), Math.round((${cy} - r.top) * dpr), 1, 1).data];
  })()`);

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

  const fresh = b.errors.slice(baseline);
  check('no page errors after opening the studio', fresh.length === 0, fresh.slice(0, 4).join(' | '));
} catch (err) {
  check('smoke run', false, err.message);
} finally {
  console.log(results.join('\n'));
  await b.close();
  process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
}
