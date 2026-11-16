// canvasOverlay.js — What the canvas draws on top of the picture: the shape being drawn,
// and the handles of the selected shape. Sizes are divided by the zoom so handles stay
// the same size on screen.

import { getLayer } from '../../../creative/document.js';
import { renderShape } from '../../../creative/shapes.js';
import { handlesFor } from '../../../creative/transformHandles.js';
import { shapePreview } from '../../../creative/tools/shape.js';

const ACCENT = '#22d3ee';

export function makeOverlay(store) {
  return (ctx, session, view) => {
    const z = view.zoom;
    const preview = shapePreview();
    if (preview) {
      ctx.save();
      ctx.globalAlpha = 0.75;
      renderShape(ctx, preview);
      ctx.restore();
    }
    if (store.getState().tool !== 'shape') return;
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
