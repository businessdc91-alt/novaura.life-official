// deviceModel.js — normalize the native specs blob into a device record. Classification is
// deny-by-default: a kind or lock-state it does not recognise becomes 'unknown', never a guess,
// so an unidentified device never silently advances through the pipeline.

const KINDS = new Set(['laptop', 'phone', 'drive']);
const LOCKS = new Set(['none', 'user', 'bios', 'account', 'encrypted']);

/**
 * deviceRecord({ jobId, id, raw }) -> device
 * raw: { kind?, model?, serial?, ram?, cpu?, storage?, battery?, lock? }
 * device: { id, jobId, kind, model, serial, specs, lockState, updatedAt }
 *   kind ∈ laptop|phone|drive|unknown; lockState ∈ none|user|bios|account|encrypted|unknown.
 */
export function deviceRecord({ jobId, id, raw = {} } = {}) {
  return {
    id,
    jobId,
    kind: KINDS.has(raw.kind) ? raw.kind : 'unknown',
    model: raw.model ?? null,
    serial: raw.serial ?? null,
    specs: {
      ram: raw.ram ?? null,
      cpu: raw.cpu ?? null,
      storage: raw.storage ?? null,
      battery: raw.battery ?? null,
    },
    lockState: LOCKS.has(raw.lock) ? raw.lock : 'unknown',
    updatedAt: Date.now(),
  };
}
