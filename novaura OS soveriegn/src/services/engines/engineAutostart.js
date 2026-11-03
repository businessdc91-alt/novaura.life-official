// engineAutostart.js — When the desktop opens, start the local AI engine and
// load the default image model, so the first generation waits for neither.
// AI Engines turns it off (autoStart) and picks the model (defaultModel).

import {
  MODEL_CATALOG, modelFileName, getEngineConfig, installStatus, ensureComfyRunning, applyStopOnExit, runWorkflow, setEngineStatus,
  needsClassicLoading, restartWithClassicLoading,
} from './comfyEngine.js';
import { buildWarmupWorkflow } from './checkpoints.js';
import { pickImageModel } from './imageGen.js';

/** A readable name for a checkpoint file. */
export function modelLabel(checkpoint) {
  const entry = MODEL_CATALOG.find(m => modelFileName(m) === checkpoint);
  return entry ? entry.name : String(checkpoint || '').replace(/\.(safetensors|ckpt|pt|pth|bin|gguf)$/i, '');
}

let loadSeq = 0;

/**
 * Load the default image model into the running engine.
 * Resolves with its file name, or null when no image model is installed.
 */
export async function loadDefaultModel() {
  const seq = ++loadSeq;
  const latest = () => seq === loadSeq; // a newer choice owns the status
  setEngineStatus({ phase: 'loading', message: 'Loading the default model…' });
  const checkpoint = await pickImageModel();
  if (!checkpoint) {
    if (latest()) setEngineStatus({ phase: 'ready', message: 'The engine is running. No image model is installed yet.' });
    return null;
  }
  const name = modelLabel(checkpoint);
  const loading = { phase: 'loading', model: checkpoint, message: `Loading ${name}…` };
  if (latest()) setEngineStatus(loading);
  const warm = () => runWorkflow(buildWarmupWorkflow(checkpoint), { timeoutMs: 10 * 60000 });
  try {
    try {
      await warm();
    } catch (err) {
      if (!(await needsClassicLoading(err))) throw err;
      if (latest()) setEngineStatus({ phase: 'starting', model: checkpoint, message: 'Model loading failed. Restarting the engine with standard loading…' });
      await restartWithClassicLoading();
      if (latest()) setEngineStatus(loading);
      await warm();
    }
  } catch (err) {
    const message = `The engine is running, but ${name} did not load: ${err.message}`;
    if (latest()) setEngineStatus({ phase: 'error', message });
    throw new Error(message);
  }
  if (latest()) setEngineStatus({ phase: 'ready', model: checkpoint, message: `${name} is loaded.` });
  return checkpoint;
}

/** Start the engine if it isn't running, then load the default model. */
export async function startEngineAndLoad() {
  await ensureComfyRunning({ markReady: false });
  return loadDefaultModel();
}

let autostarted = false;

/**
 * Runs once per launch, after the desktop opens. Does nothing unless the engine
 * is installed (and not mid-install) and auto-start is on.
 * notify({ title, message }) reports the outcome.
 */
export async function autostartEngine({ notify } = {}) {
  if (autostarted) return;
  autostarted = true;
  const cfg = await getEngineConfig().catch(() => null);
  if (!cfg?.autoStart || !cfg.installDir) return;
  const install = await installStatus(cfg.installDir).catch(() => null);
  if (!install?.installed || install.running) return;

  try {
    await ensureComfyRunning({ markReady: false });
    // An engine left running by an earlier session still follows the stop-on-exit choice.
    applyStopOnExit().catch(() => {});
  } catch (err) {
    notify?.({ title: 'The local AI engine did not start', message: `${err.message} Open AI Engines for details.` });
    return;
  }
  try {
    const model = await loadDefaultModel();
    notify?.({
      title: 'Local AI engine ready',
      message: model ? `${modelLabel(model)} is loaded, so image tools start right away.` : 'No image model is installed yet. Add one in AI Engines.',
    });
  } catch (err) {
    notify?.({ title: 'Local AI engine running', message: err.message });
  }
}
