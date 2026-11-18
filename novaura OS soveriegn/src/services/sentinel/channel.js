// channel.js — the host side of the Sentinel Probe control channel. Host and sandbox
// never share memory or a socket; they exchange one small JSON file per message in a
// mapped folder (the `io` folder). The host writes cmd-<n>.json, the in-sandbox executor
// writes obs-<n>.json back. The file names mirror Rust `channel_name` (sentinel_runner_rules.rs).
//
// Commands are written atomically (temp + rename) so the poller never reads half a file,
// and observations are parsed BOM-tolerantly because the executor's Set-Content -Encoding
// UTF8 prepends a byte-order mark.

import { writeFile, readFile, rename } from 'node:fs/promises';
import { join } from 'node:path';

const channelName = (kind, n) => `${kind}-${n}.json`;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const stripBom = (s) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

/**
 * createChannel(ioDir) -> { send(command) -> n, waitObservation(n, { timeoutMs, pollMs }) -> observation, close() }
 */
export function createChannel(ioDir) {
  let counter = 0;
  return {
    async send(command) {
      const n = ++counter;
      const final = join(ioDir, channelName('cmd', n));
      const tmp = `${final}.tmp`;
      await writeFile(tmp, JSON.stringify(command ?? {}), 'utf8');
      await rename(tmp, final); // atomic swap into place
      return n;
    },

    async waitObservation(n, { timeoutMs = 30000, pollMs = 200 } = {}) {
      const file = join(ioDir, channelName('obs', n));
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        try {
          return JSON.parse(stripBom(await readFile(file, 'utf8')));
        } catch (err) {
          // Not written yet (ENOENT) or caught mid-write (SyntaxError): keep waiting.
          if (err.code !== 'ENOENT' && !(err instanceof SyntaxError)) throw err;
        }
        if (Date.now() >= deadline) throw new Error(`Timed out waiting for observation ${n}.`);
        await delay(pollMs);
      }
    },

    close() {
      // Nothing is held open; the runner wipes the io folder when the run ends.
    },
  };
}
