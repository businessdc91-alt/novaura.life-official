// text.js (tool) — The text tool (T): click to add a text layer, typed in the properties
// panel; drag inside the selected text layer to move it.

import { getLayer, canEdit } from '../document.js';
import { addLayer, setLayerProps } from '../edits.js';
import { TEXT_DEFAULTS, textBox } from '../text.js';
import { registerTool } from './index.js';

let drag = null;
let dragCount = 0;

const inside = (b, p) => p.x >= b.x && p.y >= b.y && p.x <= b.x + b.w && p.y <= b.y + b.h;

export const text = {
  id: 'text',
  cursor: 'text',
  down(ctx, p) {
    const s = ctx.session;
    if (!s) return;
    const layer = getLayer(s.doc, s.doc.activeLayerId);
    if (layer?.kind === 'text' && inside(textBox(layer), p)) {
      const allowed = canEdit(layer, 'move');
      if (!allowed.ok) { ctx.notify(allowed.reason); drag = null; return; }
      drag = { layerId: layer.id, sx: p.x, sy: p.y, x0: layer.x, y0: layer.y, id: ++dragCount };
      return;
    }
    drag = { create: true };
  },
  move(ctx, p) {
    if (!drag || drag.create) return;
    const r = setLayerProps(ctx.session, drag.layerId, { x: drag.x0 + Math.round(p.x - drag.sx), y: drag.y0 + Math.round(p.y - drag.sy) }, {
      tab: ctx.tab, label: 'Move layer', mergeKey: `text-move:${drag.layerId}:${drag.id}`,
    });
    if (!r.ok) ctx.notify(r.reason);
    ctx.compositor?.invalidate();
    ctx.requestRender();
  },
  up(ctx, p) {
    const was = drag;
    drag = null;
    if (!was) return;
    if (!was.create) { if (p) text.move(ctx, p); return; }
    if (!p) return;
    const { colours } = ctx.store.getState();
    const r = addLayer(ctx.session, 'text', { ...TEXT_DEFAULTS, colour: colours.primary, x: Math.round(p.x), y: Math.round(p.y) }, { tab: ctx.tab, label: 'Add text' });
    if (!r.ok) { ctx.notify(r.reason); return; }
    ctx.store.update({ textFocus: r.layer.id });
    ctx.compositor?.invalidate();
    ctx.requestRender();
  },
  cancel(ctx) { text.up(ctx, null); },
};

registerTool(text);
