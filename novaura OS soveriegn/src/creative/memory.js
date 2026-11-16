// memory.js — How much memory the studio may use, sized to the PC.
//
// History may hold an eighth of the RAM; past half of the RAM (layers, masks and
// history together) the status bar warns. Work is never refused. Both can be changed
// in the studio settings. The RAM comes from Sovereign's hardware check; 16 GB if unknown.

export const SETTINGS_KEY = 'creative_studio_settings_v1';
const GiB = 2 ** 30;

export function budgetsFor(ramGB) {
  return { ramGB, historyBytes: (ramGB * GiB) / 8, warnBytes: (ramGB * GiB) / 2 };
}

const defaultEvaluate = async () => (await import('../services/hardwareSpecService.js')).evaluateHostHardware();
const defaultGetSetting = async (key, fallback) => (await import('../database/sovereignDatabase.js')).db.getSetting(key, fallback);
const defaultSetSetting = async (key, value) => (await import('../database/sovereignDatabase.js')).db.setSetting(key, value);

export async function loadBudgets({ evaluate = defaultEvaluate, getSetting = defaultGetSetting } = {}) {
  let ramGB = 16;
  try {
    const found = Number((await evaluate())?.detected?.ramGB);
    if (found > 0) ramGB = found;
  } catch { /* unknown hardware: keep 16 GB */ }
  const budgets = budgetsFor(ramGB);
  let saved = null;
  try { saved = await getSetting(SETTINGS_KEY, null); } catch { saved = null; }
  if (saved?.historyBytes > 0) budgets.historyBytes = saved.historyBytes;
  if (saved?.warnBytes > 0) budgets.warnBytes = saved.warnBytes;
  return budgets;
}

export async function saveBudgets({ historyBytes, warnBytes }, { setSetting = defaultSetSetting } = {}) {
  await setSetting(SETTINGS_KEY, { historyBytes, warnBytes });
}

/** Bytes used by open documents: { layers (pixels and masks), history, total }. */
export function usage(sessions) {
  let layers = 0;
  let history = 0;
  for (const s of sessions) {
    for (const surface of s.doc.buffers.values()) layers += surface.bytes;
    history += s.history.totalBytes();
  }
  return { layers, history, total: layers + history };
}

export function formatBytes(n) {
  if (n >= GiB) return `${(n / GiB).toFixed(n >= 10 * GiB ? 0 : 1)} GB`;
  if (n >= 2 ** 20) return `${Math.round(n / 2 ** 20)} MB`;
  return `${Math.max(0, Math.round(n / 1024))} KB`;
}
