// pointerController.js — Turns pointer events into tool calls, in document coordinates.
//
// One pointer at a time drives the tool. Coalesced events are passed along so fast
// strokes stay smooth. Pen pressure is used; a mouse always counts as full pressure
// (browsers report 0.5 for a pressed mouse). pointercancel and lostpointercapture end
// the stroke the same way pointerup does, so a pen leaving the tablet keeps the work.

import { screenToDoc } from './view.js';
import { TOOLS, toolContext } from './tools/index.js';

const pressureOf = e => (e.pointerType === 'pen' ? (e.pressure ?? 1) : 1);

export function createPointerController({ store, getView, getRect, requestRender = () => {}, notify }) {
  let tool = null;
  let pointerId = null;

  function point(e) {
    const view = getView();
    const rect = getRect();
    const coalesced = typeof e.getCoalescedEvents === 'function'
      ? e.getCoalescedEvents().map(c => ({ ...screenToDoc(c, view, rect), pressure: pressureOf(c) }))
      : [];
    return {
      ...screenToDoc(e, view, rect), pressure: pressureOf(e),
      shift: !!e.shiftKey, alt: !!e.altKey, ctrl: !!(e.ctrlKey || e.metaKey), coalesced,
    };
  }

  const context = () => toolContext(store, { requestRender, notify, view: getView() });

  function release() {
    const t = tool;
    tool = null;
    pointerId = null;
    return t;
  }

  return {
    down(e) {
      if (tool || (e.button != null && e.button !== 0)) return;
      const next = TOOLS[store.getState().tool];
      if (!next) return;
      tool = next;
      pointerId = e.pointerId;
      tool.down(context(), point(e));
    },
    move(e) {
      if (tool && e.pointerId === pointerId) tool.move(context(), point(e));
    },
    up(e) {
      if (tool && e.pointerId === pointerId) release().up(context(), point(e));
    },
    cancel(e) {
      if (tool && (e?.pointerId == null || e.pointerId === pointerId)) release().cancel(context());
    },
    get busy() { return tool !== null; },
  };
}
