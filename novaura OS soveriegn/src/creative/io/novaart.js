// novaart.js — The Creative Studio project file: a zip holding everything, editable.
//
//   document.json      format and version, document fields, every layer's settings
//   layers/<id>.png    each pixel layer's pixels, lossless
//   masks/<id>.png     each mask (greys)
//   thumbnail.png      512 px on the long side (when a canvas is available)
//
// Entries are stored, not compressed (PNGs already are), and the zip is a Blob made
// of parts, so very large projects never have to sit in one buffer.

import { buildZipBlob, listZipEntries, readZipEntry } from '../../services/zipService.js';
import { surfaceFromPngBlob } from '../surface.js';

export const FORMAT = 'novaart';
export const VERSION = 1;

function layerRecord(layer) {
  const { bufferId: _buffer, rev: _rev, mask, ...fields } = layer; // buffers go in as PNGs; rev is runtime-only
  const record = { ...fields, mask: mask ? { ...mask, bufferId: undefined, image: `masks/${layer.id}.png` } : null };
  if (layer.kind === 'pixel') record.image = `layers/${layer.id}.png`;
  return JSON.parse(JSON.stringify(record));
}

async function thumbnailBlob(doc) {
  const { flatten } = await import('../compositor.js');
  const flat = flatten(doc);
  const scale = 512 / Math.max(doc.width, doc.height);
  const w = Math.max(1, Math.round(doc.width * Math.min(1, scale)));
  const h = Math.max(1, Math.round(doc.height * Math.min(1, scale)));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(flat.canvas, 0, 0, w, h);
  return canvas.convertToBlob({ type: 'image/png' });
}

/** The document as a .novaart Blob. */
export async function packProject(doc, { thumbnail = typeof OffscreenCanvas !== 'undefined' } = {}) {
  const json = { format: FORMAT, version: VERSION, name: doc.name, width: doc.width, height: doc.height, activeLayerId: doc.activeLayerId, layers: doc.layers.map(layerRecord) };
  const files = [{ path: 'document.json', bytes: new TextEncoder().encode(JSON.stringify(json)) }];
  for (const layer of doc.layers) {
    if (layer.kind === 'pixel') files.push({ path: `layers/${layer.id}.png`, blob: await doc.buffers.get(layer.bufferId).toPngBlob() });
    if (layer.mask) files.push({ path: `masks/${layer.id}.png`, blob: await doc.buffers.get(layer.mask.bufferId).toPngBlob() });
  }
  if (thumbnail) files.push({ path: 'thumbnail.png', blob: await thumbnailBlob(doc) });
  return buildZipBlob(files);
}

const newId = () => globalThis.crypto.randomUUID();

/** A .novaart Blob → a document, every layer editable again. */
export async function unpackProject(blob) {
  let entries;
  try { entries = await listZipEntries(blob); } catch { throw new Error("This file isn't a Creative Studio project."); }
  const byPath = new Map(entries.map(e => [e.path, e]));
  const docEntry = byPath.get('document.json');
  if (!docEntry) throw new Error("This file isn't a Creative Studio project.");
  const json = JSON.parse(new TextDecoder().decode(await readZipEntry(blob, docEntry)));
  if (json.format !== FORMAT) throw new Error("This file isn't a Creative Studio project.");
  if (!(json.version <= VERSION)) throw new Error('This project was made by a newer Creative Studio.');

  const doc = {
    id: newId(), name: json.name || 'Untitled', width: json.width, height: json.height, layers: [],
    activeLayerId: json.activeLayerId, activeTarget: 'layer', buffers: new Map(), version: 0, nextLayerNumber: json.layers.length + 1,
  };
  const surfaceAt = async (path) => {
    const entry = byPath.get(path);
    if (!entry) throw new Error(`The project is missing ${path}.`);
    return surfaceFromPngBlob(new Blob([await readZipEntry(blob, entry)], { type: 'image/png' }));
  };
  for (const record of json.layers) {
    const { image, mask, ...fields } = record;
    const layer = { ...fields, rev: 0, mask: null };
    if (layer.kind === 'pixel') {
      layer.bufferId = newId();
      doc.buffers.set(layer.bufferId, await surfaceAt(image));
    }
    if (mask) {
      const { image: maskImage, ...maskFields } = mask;
      layer.mask = { ...maskFields, bufferId: newId() };
      doc.buffers.set(layer.mask.bufferId, await surfaceAt(maskImage));
    }
    doc.layers.push(layer);
  }
  if (!doc.layers.some(l => l.id === doc.activeLayerId)) doc.activeLayerId = doc.layers.at(-1)?.id ?? null;
  return doc;
}
