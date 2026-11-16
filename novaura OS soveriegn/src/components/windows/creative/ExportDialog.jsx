// ExportDialog.jsx — Export the active document: PSD with its layers (live or exact-look
// adjustments), SVG with its layers, or a flat PNG, JPG or WebP. Downloads to the PC.

import React, { useState } from 'react';

const EXPORT_FORMATS = [
  { id: 'psd', label: 'Photoshop (.psd)', note: 'Layers, masks, blend modes and adjustment layers.' },
  { id: 'svg', label: 'SVG (.svg)', note: 'Named layers; shapes and text stay vectors; pictures are embedded.' },
  { id: 'png', label: 'PNG (.png)', note: 'The flattened picture, transparency kept.' },
  { id: 'jpg', label: 'JPG (.jpg)', note: 'The flattened picture on white; smallest for photos.' },
  { id: 'webp', label: 'WebP (.webp)', note: 'The flattened picture; small, with transparency.' },
];
const RASTER = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

const safeName = name => String(name || 'Untitled').replace(/[\\/:*?"<>|]/g, '-').trim() || 'Untitled';

async function exportBlob(doc, format, options) {
  if (format === 'psd') {
    const { writePsdFile } = await import('../../../creative/io/psd.js');
    return { blob: new Blob([writePsdFile(doc, { exactLook: options.exactLook })], { type: 'image/vnd.adobe.photoshop' }), ext: 'psd' };
  }
  if (format === 'svg') {
    const { writeSvg } = await import('../../../creative/io/svg.js');
    return { blob: new Blob([await writeSvg(doc)], { type: 'image/svg+xml' }), ext: 'svg' };
  }
  if (RASTER[format]) {
    const { exportRaster } = await import('../../../creative/io/raster.js');
    return { blob: await exportRaster(doc, { type: RASTER[format], quality: options.quality / 100, scale: options.scale }), ext: format };
  }
  throw new Error(`Exporting ${format} isn't available.`);
}

export default function ExportDialog({ store, formats = EXPORT_FORMATS, onClose }) {
  const [format, setFormat] = useState(formats[0].id);
  const [exactLook, setExactLook] = useState(false);
  const [quality, setQuality] = useState(92);
  const [scale, setScale] = useState(1);
  const [working, setWorking] = useState(false);

  const run = async () => {
    const session = store.active();
    if (!session) return;
    setWorking(true);
    try {
      const { blob, ext } = await exportBlob(session.doc, format, { exactLook, quality, scale });
      const { triggerDownload } = await import('../../../services/fileStorageService.js');
      const fileName = `${safeName(session.doc.name)}.${ext}`;
      triggerDownload(fileName, blob);
      store.notify(`Exported ${fileName}`);
      onClose();
    } catch (err) {
      store.notify(`Couldn't export: ${err.message}`);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/60" onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Export" data-export-dialog=""
        className="w-[24rem] rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3 shadow-2xl">
        <h2 className="text-sm font-bold text-white">Export</h2>
        <fieldset className="space-y-1.5">
          {formats.map(f => (
            <label key={f.id} className={`flex items-start gap-2 rounded-md px-2 py-1.5 cursor-pointer ${format === f.id ? 'bg-slate-800' : 'hover:bg-slate-800/60'}`}>
              <input type="radio" name="export-format" data-format={f.id} checked={format === f.id} onChange={() => setFormat(f.id)} className="mt-0.5 accent-cyan-500" />
              <span><span className="block text-xs text-white">{f.label}</span><span className="block text-[11px] text-slate-400">{f.note}</span></span>
            </label>
          ))}
        </fieldset>
        {format === 'psd' && (
          <label className="flex items-start gap-2 text-[11px] text-slate-300">
            <input type="checkbox" data-exact-look="" checked={exactLook} onChange={e => setExactLook(e.target.checked)} className="mt-0.5 accent-cyan-500" />
            <span>Exact look (bakes adjustments). Levels, Curves, Invert, Threshold and Posterize already match; Brightness/Contrast, Hue/Saturation, Vibrance and Black &amp; White can look slightly different in Photoshop unless baked.</span>
          </label>
        )}
        {RASTER[format] && (
          <div className="space-y-2">
            {format !== 'png' && (
              <label className="block">
                <span className="flex justify-between text-[11px] text-slate-400 mb-1"><span>Quality</span><span className="tabular-nums text-slate-300">{quality}</span></span>
                <input type="range" min={1} max={100} value={quality} data-export-quality="" onChange={e => setQuality(Number(e.target.value))} className="w-full accent-cyan-500" />
              </label>
            )}
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              Size
              {[1, 2, 3].map(n => (
                <button key={n} type="button" data-export-scale={n} aria-pressed={scale === n} onClick={() => setScale(n)}
                  className={`px-2 py-0.5 rounded-md ${scale === n ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-300'}`}>{n}×</button>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs">Cancel</button>
          <button type="button" data-action="run-export" disabled={working} onClick={run}
            className="px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-semibold">
            {working ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
