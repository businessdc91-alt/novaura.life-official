// SVG export: named layers Inkscape and Illustrator list, real shapes and text, masks, blends and filters.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ArraySurface, setSurfaceFactory } from '../../src/creative/surface.js';
import { createDocument, createLayer, insertLayer } from '../../src/creative/document.js';
import { createMask } from '../../src/creative/masks.js';
import { defaultParams } from '../../src/creative/adjustments.js';
import { TEXT_DEFAULTS } from '../../src/creative/text.js';
import { writeSvg } from '../../src/creative/io/svg.js';

beforeEach(() => setSurfaceFactory((w, h) => new ArraySurface(w, h)));

const options = {
  pngDataUrl: async () => 'data:image/png;base64,AAAA',
  measure: text => text.length * 10,
  bake: () => new ArraySurface(1, 1),
};

function python() {
  for (const cmd of ['python', 'python3']) {
    try { execFileSync(cmd, ['--version'], { stdio: 'ignore' }); return cmd; } catch { /* next */ }
  }
  return null;
}

function sampleDoc() {
  const doc = createDocument({ name: 'Card', width: 200, height: 100 });
  const add = (kind, fields) => { const l = createLayer(doc, kind, fields); insertLayer(doc, l, doc.layers.length); return l; };
  add('shape', { name: 'Box', shape: 'rect', x: 10, y: 10, w: 50, h: 30, rotation: 0, fill: '#ff0000', stroke: null, strokeWidth: 0, blend: 'multiply' });
  add('text', { ...TEXT_DEFAULTS, name: 'Words', text: 'one two three', x: 5, y: 50, fontSize: 20, wrapWidth: 80, colour: '#112233', strokeWidth: 2, align: 'center' });
  const ghost = add('pixel', { name: 'Ghost', visible: false });
  ghost.mask = createMask(doc, false);
  add('adjust', { name: 'Grey', adjust: 'blackWhite', params: defaultParams('blackWhite'), opacity: 0.5 });
  add('pixel', { name: 'a<b&"c"' });
  return doc;
}

test('output is well-formed XML', async (t) => {
  const py = python();
  if (!py) { t.skip('python not available'); return; }
  const svg = await writeSvg(sampleDoc(), options);
  execFileSync(py, ['-I', '-c', 'import sys, xml.etree.ElementTree as E; E.fromstring(sys.stdin.buffer.read())'], { input: svg });
});

test('each layer is a named inkscape layer group', async () => {
  const svg = await writeSvg(sampleDoc(), options);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*width="200" height="100" viewBox="0 0 200 100"/);
  assert.match(svg, /xmlns:inkscape="http:\/\/www\.inkscape\.org\/namespaces\/inkscape"/);
  for (const name of ['Background', 'Box', 'Words', 'Ghost', 'Grey']) {
    assert.match(svg, new RegExp(`<g id="[^"]+" inkscape:groupmode="layer" inkscape:label="${name}"`), name);
  }
});

test('a rect shape is a <rect>', async () => {
  assert.match(await writeSvg(sampleDoc(), options), /<rect x="10" y="10" width="50" height="30" fill="#ff0000"/);
});

test('text lines become tspans', async () => {
  const svg = await writeSvg(sampleDoc(), options);
  const tspans = [...svg.matchAll(/<tspan [^>]*>([^<]*)<\/tspan>/g)].map(m => m[1]);
  assert.deepEqual(tspans, ['one two', 'three']);
  assert.match(svg, /<text [^>]*text-anchor="middle"[^>]*paint-order="stroke"/);
  assert.match(svg, /fill="#112233"/);
});

test('a hidden layer has display="none"', async () => {
  assert.match(await writeSvg(sampleDoc(), options), /inkscape:label="Ghost"[^>]*display="none"/);
});

test('multiply → mix-blend-mode:multiply', async () => {
  assert.match(await writeSvg(sampleDoc(), options), /inkscape:label="Box"[^>]*style="mix-blend-mode:multiply"/);
});

test('a mask becomes <mask>', async () => {
  const svg = await writeSvg(sampleDoc(), options);
  const id = /inkscape:label="Ghost"[^>]*mask="url\(#([^)]+)\)"/.exec(svg)[1];
  assert.match(svg, new RegExp(`<mask id="${id}" maskUnits="userSpaceOnUse"`));
  assert.match(svg, /<rect x="0" y="0" width="200" height="100" fill="rgb\(0, 0, 0\)"\/>/);
});

test('an adjustment becomes a filter over a <use> of the content beneath', async () => {
  const svg = await writeSvg(sampleDoc(), options);
  const below = /<g id="(below-[^"]+)">/.exec(svg)[1];
  assert.match(svg, new RegExp(`inkscape:label="Grey"[^>]*opacity="0.5"[^>]*><use href="#${below}" filter="url\\(#([^)]+)\\)"`));
  assert.match(svg, /<filter id="[^"]+" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"\/><\/filter>/);
});

test('an adjustment SVG cannot express (vignette) is baked into an image', async () => {
  const doc = createDocument({ width: 20, height: 10 });
  insertLayer(doc, createLayer(doc, 'adjust', { name: 'Edges', adjust: 'vignette', params: defaultParams('vignette') }), 1);
  const svg = await writeSvg(doc, options);
  assert.match(svg, /inkscape:label="Edges \(baked\)"[^>]*><image /);
});

test('layer names and text are XML-escaped', async () => {
  const svg = await writeSvg(sampleDoc(), options);
  assert.match(svg, /inkscape:label="a&lt;b&amp;&quot;c&quot;"/);
  assert.ok(!svg.includes('a<b&"c"'));
});

// A shared .novaart is untrusted: whatever its document.json says, Export SVG must not
// write markup or attributes the project put there (an .svg opened in a browser runs scripts).
test('values from a project file cannot add markup or attributes to the SVG', async () => {
  const evil = '1" onload="alert(1)"><script>alert(1)</script><g a="';
  const doc = createDocument({ name: 'Shared', width: 200, height: 100 });
  doc.width = evil;
  doc.height = evil;
  const add = (kind, fields) => { const l = createLayer(doc, kind, fields); insertLayer(doc, l, doc.layers.length); return l; };
  add('text', { ...TEXT_DEFAULTS, name: 'Words', text: 'hi', x: 5, y: 50, fontSize: 20, fontWeight: evil });
  add('adjust', { name: 'Hue', adjust: 'hueSaturation', params: { ...defaultParams('hueSaturation'), hue: evil } });
  add('adjust', { name: 'Soft', adjust: 'blur', params: { ...defaultParams('blur'), radius: evil } });
  const odd = add('adjust', { name: 'Odd id', adjust: 'invert', params: defaultParams('invert') });
  odd.id = evil;
  const svg = await writeSvg(doc, options);
  assert.doesNotMatch(svg, /<script/i);
  assert.doesNotMatch(svg, /\sonload\s*=\s*["']/i, 'no live onload attribute (escaped text inside a value is inert)');
  assert.match(svg, /width="0" height="0"/, 'a size that is not a number is written as 0');
});
