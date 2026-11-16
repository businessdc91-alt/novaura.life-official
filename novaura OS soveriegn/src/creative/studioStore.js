// studioStore.js — The Creative Studio's open documents and shared settings.
//
// Each open document is a session { id, doc, history, compositor, savedPath, savedVersion, dirty }.
// The store holds the sessions, which one is active, the Paint/Photo/Meme tab, the
// tool, and settings every tab shares (colours, brush, fill, gradient, eyedropper).
// Pixel data stays in the documents, never in this state, so painting never
// re-renders the interface. Any history change in any session notifies subscribers.

import { createDocument } from './document.js';
import { createHistory } from './history.js';
import { createCompositor } from './compositor.js';
// Every kind of layer registers how it is drawn; load them all with the store.
import './shapes.js';
import './text.js';
import './masks.js';
import './adjustmentLayers.js';

const NESTED = ['colours', 'brush', 'fill', 'gradient', 'eyedropper', 'shape'];

export function createStudioStore({ historyBytes = Infinity } = {}) {
  const listeners = new Set();
  const stopHistory = new Map(); // session id → unsubscribe
  let budget = historyBytes;
  let noticeCount = 0;
  let state = {
    sessions: [], activeId: null, tab: 'paint', tool: 'brush', version: 0, notice: null,
    colours: { primary: '#06b6d4', secondary: '#ffffff' },
    brush: { size: 12, hardness: 0.8, opacity: 1, pressure: true },
    fill: { tolerance: 32, contiguous: true, sampleAll: false },
    gradient: { type: 'linear', mode: 'toSecondary' },
    eyedropper: { sample: 'composite' },
    shape: { kind: 'rect', stroke: false, strokeWidth: 4 },
    maskView: null,
    busy: null, // { label, progress, cancel } while a long job (a filter) runs
    textFocus: null, // a text layer id whose text box should take focus
  };

  function set(patch) {
    state = { ...state, ...patch, version: state.version + 1 };
    for (const fn of listeners) fn(state);
  }

  function makeSession(doc, savedPath) {
    const session = {
      id: doc.id, doc, savedPath,
      history: createHistory({ budgetBytes: budget }),
      compositor: createCompositor(doc),
      savedVersion: doc.version,
      get dirty() { return this.doc.version !== this.savedVersion; },
    };
    stopHistory.set(session.id, session.history.subscribe(() => set({})));
    set({ sessions: [...state.sessions, session], activeId: session.id });
    return session;
  }

  const store = {
    getState: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    bump: () => set({}),

    newDocument: opts => makeSession(createDocument(opts), null),
    openDocument: (doc, { savedPath = null } = {}) => makeSession(doc, savedPath),

    closeDocument(id) {
      const index = state.sessions.findIndex(s => s.id === id);
      if (index < 0) return;
      const session = state.sessions[index];
      stopHistory.get(id)?.();
      stopHistory.delete(id);
      session.compositor.dispose();
      const sessions = state.sessions.filter(s => s.id !== id);
      const activeId = state.activeId === id
        ? (sessions[index] || sessions[index - 1] || null)?.id ?? null
        : state.activeId;
      set({ sessions, activeId });
    },

    setActive(id) { if (state.sessions.some(s => s.id === id)) set({ activeId: id }); },
    active: () => state.sessions.find(s => s.id === state.activeId) || null,
    setTab: tab => set({ tab }),
    setTool: tool => set({ tool }),

    /** Merge settings; nested groups (colours, brush, fill, gradient, eyedropper) merge key by key. */
    update(patch) {
      const next = { ...patch };
      for (const key of NESTED) if (patch[key]) next[key] = { ...state[key], ...patch[key] };
      set(next);
    },

    /** Show a message (a refusal reason, a notice). Repeating the same text still shows again. */
    notify: text => set({ notice: { text, id: ++noticeCount } }),

    setHistoryBudget(bytes) {
      budget = bytes;
      for (const s of state.sessions) s.history.setBudget(bytes);
    },
  };
  return store;
}
