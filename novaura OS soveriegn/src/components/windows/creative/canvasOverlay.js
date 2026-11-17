// canvasOverlay.js — What the canvas draws on top of the picture: the shape being drawn,
// and the handles of the selected shape. Sizes are divided by the zoom so handles stay
// the same size on screen.

import { getLayer } from '../../../creative/document.js';
import { renderShape } from '../../../creative/shapes.js';
import { handlesFor } from '../../../creative/transformHandles.js';
import { shapePreview } from '../../../creative/tools/shape.js';
import { gradientPreview } from '../../../creative/tools/gradient.js';
import { selectionPreview } from '../../../creative/tools/selection.js';
import { getCropRect, cropHandles } from '../../../creative/tools/crop.js';
import { selectionOutlineCanvas } from '../../../creative/selection.js';
import { textBox } from '../../../creative/text.js';

const ACCENT = '#22d3ee';

// Show one layer's mask in greys over the whole picture ("view the mask alone").
function drawMaskAlone(ctx, session, layerId) {
  const { doc } = session;
  const layer = getLayer(doc, layerId);
  const grey = layer?.mask && doc.buffers.get(layer.mask.bufferId);
  if (!grey?.canvas) return;
  const d = layer.mask.defaultValue;
  ctx.save();
  ctx.fillStyle = `rgb(${d}, ${d}, ${d})`;
  ctx.fillRect(0, 0, doc.width, doc.height);
  ctx.drawImage(grey.canvas, layer.mask.x, layer.mask.y);
  ctx.restore();
}

export function makeOverlay(store) {
  return (ctx, session, view) => {
    const z = view.zoom;
    const { maskView } = store.getState();
    if (maskView) drawMaskAlone(ctx, session, maskView);
    if (session.doc.activeTarget === 'mask') {
      // Painting goes to the mask: mark the canvas edge.
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3 / z;
      ctx.setLineDash([10 / z, 6 / z]);
      ctx.strokeRect(1.5 / z, 1.5 / z, session.doc.width - 3 / z, session.doc.height - 3 / z);
      ctx.restore();
    }
    const preview = shapePreview();
    if (preview) {
      ctx.save();
      ctx.globalAlpha = 0.75;
      renderShape(ctx, preview);
      ctx.restore();
    }
    const line = gradientPreview();
    if (line) {
      ctx.save();
      ctx.lineWidth = 1.5 / z;
      ctx.strokeStyle = ACCENT;
      ctx.setLineDash([6 / z, 4 / z]);
      ctx.beginPath();
      ctx.moveTo(line.start.x, line.start.y);
      ctx.lineTo(line.end.x, line.end.y);
      ctx.stroke();
      ctx.restore();
    }
    const { tool } = store.getState();

    // Active pixel selection contour (Marquee / Lasso / Magic Wand)
    if (session.doc.selection) {
      const outline = selectionOutlineCanvas(session.doc.selection);
      if (outline) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(outline.canvas, outline.x, outline.y);
        ctx.restore();
      }
    }

    // Live drag preview while tracing Marquee or Lasso
    const selDrag = selectionPreview();
    if (selDrag) {
      ctx.save();
      ctx.lineWidth = 1.5 / z;
      ctx.strokeStyle = '#ffffff';
      ctx.setLineDash([5 / z, 4 / z]);
      if (selDrag.kind === 'rect') {
        const { x, y, w, h } = selDrag.rect;
        ctx.strokeRect(x, y, w, h);
      } else if (selDrag.kind === 'ellipse') {
        const { x, y, w, h } = selDrag.rect;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (selDrag.kind === 'lasso' && selDrag.points.length > 1) {
        ctx.beginPath();
        selDrag.points.forEach((pt, idx) => ctx[idx ? 'lineTo' : 'moveTo'](pt.x, pt.y));
        ctx.stroke();
      }
      ctx.restore();
    }

    // Interactive Crop frame + darkened outer veil + rule of thirds
    if (tool === 'crop') {
      const crop = getCropRect(session.doc);
      if (crop) {
        const { width: dw, height: dh } = session.doc;
        ctx.save();
        ctx.fillStyle = 'rgba(2, 6, 23, 0.58)';
        ctx.fillRect(0, 0, dw, Math.max(0, crop.y));
        ctx.fillRect(0, crop.y + crop.h, dw, Math.max(0, dh - (crop.y + crop.h)));
        ctx.fillRect(0, crop.y, Math.max(0, crop.x), crop.h);
        ctx.fillRect(crop.x + crop.w, crop.y, Math.max(0, dw - (crop.x + crop.w)), crop.h);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1 / z;
        for (const t of [1 / 3, 2 / 3]) {
          ctx.beginPath();
          ctx.moveTo(crop.x + crop.w * t, crop.y);
          ctx.lineTo(crop.x + crop.w * t, crop.y + crop.h);
          ctx.moveTo(crop.x, crop.y + crop.h * t);
          ctx.lineTo(crop.x + crop.w, crop.y + crop.h * t);
          ctx.stroke();
        }
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 1.5 / z;
        ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);
        const hs = 8 / z;
        for (const h of cropHandles(crop)) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
          ctx.strokeRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
        }
        ctx.restore();
      }
    }

    const selected = getLayer(session.doc, session.doc.activeLayerId);
    if (selected?.kind === 'text' && selected.visible && (tool === 'text' || tool === 'move')) {
      const box = textBox(selected);
      ctx.save();
      ctx.lineWidth = 1 / z;
      ctx.strokeStyle = ACCENT;
      ctx.setLineDash([4 / z, 3 / z]);
      ctx.strokeRect(box.x, box.y, Math.max(box.w, 4 / z), box.h);
      ctx.restore();
    }
    if (tool !== 'shape') return;
    const layer = getLayer(session.doc, session.doc.activeLayerId);
    if (!layer || layer.kind !== 'shape' || !layer.visible) return;
    const handles = handlesFor(layer, { rotateOffset: 24 / z });
    const at = id => handles.find(h => h.id === id);
    ctx.save();
    ctx.lineWidth = 1 / z;
    ctx.strokeStyle = ACCENT;
    ctx.beginPath();
    if (layer.shape === 'line') {
      ctx.moveTo(at('p1').x, at('p1').y);
      ctx.lineTo(at('p2').x, at('p2').y);
    } else {
      for (const [i, id] of ['nw', 'ne', 'se', 'sw'].entries()) ctx[i ? 'lineTo' : 'moveTo'](at(id).x, at(id).y);
      ctx.closePath();
      ctx.moveTo(at('n').x, at('n').y);
      ctx.lineTo(at('rotate').x, at('rotate').y);
    }
    ctx.stroke();
    const size = 8 / z;
    for (const h of handles) {
      ctx.beginPath();
      if (h.id === 'rotate') ctx.arc(h.x, h.y, size / 2 + 1 / z, 0, Math.PI * 2);
      else ctx.rect(h.x - size / 2, h.y - size / 2, size, size);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  };
}
