// tools/index.js — The tool registry, tool keys, and the context tools receive.
//
// A tool is { id, cursor, down(ctx, p), move(ctx, p), up(ctx, p), cancel(ctx), key?(ctx, event) }.
// p is { x, y, pressure, shift, alt, ctrl, coalesced } in document coordinates.

import { brush, pencil, eraser } from './brush.js';
import { fill } from './fill.js';
import { eyedropper } from './eyedropper.js';
import { move } from './move.js';

export const TOOLS = { brush, pencil, eraser, fill, eyedropper, move };

/** Later tools (gradient, shape, text) add themselves here. */
export function registerTool(tool) { TOOLS[tool.id] = tool; }

const KEYS = {
  b: 'brush', n: 'pencil', e: 'eraser', g: 'fill', 'shift+g': 'gradient', i: 'eyedropper', u: 'shape', v: 'move', t: 'text',
};

/** The tool a key press selects, or null (modifier keys, unknown keys, tools not registered). */
export function toolForKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey || !event.key) return null;
  const id = KEYS[`${event.shiftKey ? 'shift+' : ''}${event.key.toLowerCase()}`];
  return id && TOOLS[id] ? id : null;
}

/** What a tool gets: the store, the active session, its compositor, the tab, and callbacks. */
export function toolContext(store, { requestRender = () => {}, notify } = {}) {
  const state = store.getState();
  const session = store.active();
  return {
    store, state, session,
    compositor: session?.compositor ?? null,
    tab: state.tab,
    requestRender,
    notify: notify || (message => store.notify(message)),
  };
}
