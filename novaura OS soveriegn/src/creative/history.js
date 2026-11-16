// history.js — One document's undo history.
//
// A step is { label, tab, bytes, apply(), revert(), mergeKey?, mergeWindowMs?, mergeWith?(newer) }.
// The change has already happened when a step is pushed; undo calls revert(), redo
// calls apply(). Steps with the same mergeKey fold into one (a slider drag, or arrow
// nudges within mergeWindowMs). There is no step limit: when the steps' bytes pass
// the budget, the oldest are dropped, but the newest step is always kept.

export function createHistory({ budgetBytes = Infinity, now = Date.now } = {}) {
  const listeners = new Set();
  let budget = budgetBytes;

  const history = {
    steps: [],
    cursor: 0, // how many steps are applied
    version: 0,

    push(step) {
      step.time = now();
      history.steps.length = history.cursor; // a new change drops the undone steps
      const top = history.steps[history.cursor - 1];
      const merges = top && step.mergeKey != null && top.mergeKey === step.mergeKey && typeof top.mergeWith === 'function'
        && (step.mergeWindowMs == null || step.time - top.time <= step.mergeWindowMs);
      if (merges) {
        const merged = top.mergeWith(step);
        merged.time = step.time;
        merged.mergeKey = step.mergeKey;
        merged.mergeWindowMs = step.mergeWindowMs;
        history.steps[history.cursor - 1] = merged;
      } else {
        history.steps.push(step);
        history.cursor += 1;
      }
      evict();
      changed();
    },

    undo() {
      if (!history.canUndo()) return null;
      const step = history.steps[--history.cursor];
      step.revert();
      changed();
      return step;
    },

    redo() {
      if (!history.canRedo()) return null;
      const step = history.steps[history.cursor++];
      step.apply();
      changed();
      return step;
    },

    /** Move to having `count` steps applied, reverting or applying in order. */
    jumpTo(count) {
      const target = Math.max(0, Math.min(count, history.steps.length));
      while (history.cursor > target) history.steps[--history.cursor].revert();
      while (history.cursor < target) history.steps[history.cursor++].apply();
      changed();
    },

    canUndo: () => history.cursor > 0,
    canRedo: () => history.cursor < history.steps.length,
    totalBytes: () => history.steps.reduce((sum, s) => sum + (s.bytes || 0), 0),

    setBudget(bytes) {
      budget = bytes;
      if (evict()) changed();
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };

  function evict() {
    let dropped = false;
    while (history.steps.length > 1 && history.totalBytes() > budget) {
      history.steps.shift();
      history.cursor = Math.max(0, history.cursor - 1);
      dropped = true;
    }
    return dropped;
  }

  function changed() {
    history.version += 1;
    for (const fn of listeners) fn(history);
  }

  return history;
}

/** Several steps that undo and redo as one. */
export function compoundStep(steps, { label, tab }) {
  return {
    label, tab,
    bytes: steps.reduce((sum, s) => sum + (s.bytes || 0), 0),
    apply() { for (const s of steps) s.apply(); },
    revert() { for (let i = steps.length - 1; i >= 0; i--) steps[i].revert(); },
  };
}
