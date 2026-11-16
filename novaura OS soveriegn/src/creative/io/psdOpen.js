// psdOpen.js — Open a PSD as a new document tab, and show what couldn't come across.

import { readPsdFile } from './psd.js';

const baseName = name => String(name || 'Photoshop file').replace(/\.psd$/i, '') || 'Photoshop file';

export async function openPsdBlob(store, blob, name) {
  const { doc, report } = readPsdFile(new Uint8Array(await blob.arrayBuffer()), baseName(name));
  const session = store.openDocument(doc);
  if (report.length) store.update({ openReport: { name: doc.name, lines: report } });
  return session;
}
