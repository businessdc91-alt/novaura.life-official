// svg.js — Export a document as SVG, keeping its layers.
//
// Each layer is a <g> marked as an Inkscape layer with its name, opacity, blend mode
// (mix-blend-mode), visibility and mask. Shapes stay true vector elements (from the
// same geometry the canvas draws), text stays <text>, pixel layers become embedded PNG
// images. An adjustment layer becomes an SVG filter applied to a <use> of everything
// beneath it; one SVG can't express (vignette) is baked into an image.

import { shapeSvg } from '../shapes.js';
import { layoutText, canvasMeasure, resolveFont, fontAvailable } from '../text.js';
import { svgFilter } from '../adjustments.js';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = n => String(Math.round(n * 1000) / 1000 + 0);
const blendCss = id => (id === 'source-over' || !id ? 'normal' : id === 'lighter' ? 'plus-lighter' : id);

async function blobDataUrl(blob) {
  if (typeof FileReader === 'function') {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }
  return `data:${blob.type || 'image/png'};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;
}

const defaultPngDataUrl = async surface => blobDataUrl(await surface.toPngBlob());

async function defaultBake(doc, layer) {
  const [{ compositeBelow }, { adjustBelow }] = await Promise.all([import('../compositor.js'), import('../adjustmentLayers.js')]);
  const beneath = compositeBelow(doc, layer.id);
  return adjustBelow(doc, layer, beneath, { x: 0, y: 0, w: doc.width, h: doc.height }) || beneath;
}

const image = (href, x, y, w, h) => `<image href="${href}" x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" preserveAspectRatio="none"/>`;

function textSvg(layer, measure) {
  const family = resolveFont(layer.fontFamily, typeof OffscreenCanvas === 'function' ? fontAvailable : () => true).family;
  const lay = layoutText({ ...layer, fontFamily: family }, measure);
  const anchor = layer.align === 'center' ? 'middle' : layer.align === 'right' ? 'end' : 'start';
  const ax = layer.align === 'center' ? layer.x + lay.width / 2 : layer.align === 'right' ? layer.x + lay.width : layer.x;
  const lead = (lay.lineHeightPx - layer.fontSize) / 2;
  const stroke = layer.strokeWidth > 0
    ? ` stroke="${esc(layer.strokeColour || '#000000')}" stroke-width="${num(layer.strokeWidth * 2)}" paint-order="stroke" stroke-linejoin="round"`
    : '';
  const rotate = layer.rotation ? ` transform="rotate(${num(layer.rotation)} ${num(layer.x + lay.width / 2)} ${num(layer.y + lay.height / 2)})"` : '';
  const tspans = lay.lines.map(l => `<tspan x="${num(ax)}" y="${num(layer.y + l.y + lead)}">${esc(l.text)}</tspan>`).join('');
  return `<text font-family="${esc(family)}, Inter, sans-serif" font-size="${num(layer.fontSize)}" font-weight="${layer.fontWeight || 400}"${layer.italic ? ' font-style="italic"' : ''} fill="${esc(layer.colour || '#000000')}" text-anchor="${anchor}" dominant-baseline="text-before-edge"${stroke}${rotate} xml:space="preserve">${tspans}</text>`;
}

/** The document as an SVG string. Options can replace PNG encoding, text measuring and baking (for tests). */
export async function writeSvg(doc, { pngDataUrl = defaultPngDataUrl, measure = canvasMeasure, bake = defaultBake } = {}) {
  const defs = [];
  let body = [];
  let belowCount = 0;

  for (const layer of doc.layers) {
    const id = `l-${layer.id}`;
    let attrs = ` id="${esc(id)}" inkscape:groupmode="layer" inkscape:label="${esc(layer.name)}"`;
    if (layer.opacity < 1) attrs += ` opacity="${num(layer.opacity)}"`;
    if (blendCss(layer.blend) !== 'normal') attrs += ` style="mix-blend-mode:${blendCss(layer.blend)}"`;
    if (!layer.visible) attrs += ' display="none"';
    if (layer.mask && layer.mask.enabled !== false) {
      const m = layer.mask;
      const v = m.defaultValue;
      defs.push(`<mask id="m-${esc(layer.id)}" maskUnits="userSpaceOnUse" x="0" y="0" width="${doc.width}" height="${doc.height}">`
        + `<rect x="0" y="0" width="${doc.width}" height="${doc.height}" fill="rgb(${v}, ${v}, ${v})"/>`
        + `${image(await pngDataUrl(doc.buffers.get(m.bufferId)), m.x, m.y, m.width, m.height)}</mask>`);
      attrs += ` mask="url(#m-${esc(layer.id)})"`;
    }

    if (layer.kind === 'adjust') {
      const filter = svgFilter(layer.adjust, layer.params, `f-${layer.id}`);
      if (filter) {
        defs.push(filter);
        const below = `below-${++belowCount}`;
        body = [`<g id="${below}">${body.join('')}</g>`, `<g${attrs}><use href="#${below}" filter="url(#f-${esc(layer.id)})"/></g>`];
        continue;
      }
      const baked = await bake(doc, layer);
      attrs = attrs.replace(`inkscape:label="${esc(layer.name)}"`, `inkscape:label="${esc(`${layer.name} (baked)`)}"`).replace(/ style="[^"]*"/, '');
      body.push(`<g${attrs}>${image(await pngDataUrl(baked), 0, 0, doc.width, doc.height)}</g>`);
      continue;
    }

    let content = '';
    if (layer.kind === 'pixel') content = image(await pngDataUrl(doc.buffers.get(layer.bufferId)), layer.x, layer.y, layer.width, layer.height);
    else if (layer.kind === 'shape') content = shapeSvg(layer);
    else if (layer.kind === 'text') content = textSvg(layer, measure);
    body.push(`<g${attrs}>${content}</g>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${doc.width}" height="${doc.height}" viewBox="0 0 ${doc.width} ${doc.height}">`
    + `<title>${esc(doc.name)}</title><defs>${defs.join('')}</defs>${body.join('')}</svg>`;
}
