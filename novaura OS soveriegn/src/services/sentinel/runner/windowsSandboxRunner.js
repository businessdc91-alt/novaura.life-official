// windowsSandboxRunner.js — the real ProbeRunner. It writes the copied target content and
// the static in-sandbox scripts into the run's `in/` folder, then asks the Rust side to
// launch a throwaway Windows Sandbox with NO network adapter (sentinel_sandbox_start).
// The host talks to the executor only through the mapped `io/` folder (createChannel).
//
// This module imports Tauri and the toolkit scripts, so it is loaded only by the real app
// and the Task 9 live check — never under node:test. Its behaviour is proven in Task 9.

import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { createChannel } from '../channel.js';
import startupPs1 from '../toolkit/startup.ps1?raw';
import executorPs1 from '../toolkit/executor.ps1?raw';

const dirOf = (p) => p.slice(0, Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')));

async function tauriFs() {
  return import('@tauri-apps/plugin-fs');
}

/**
 * createWindowsSandboxRunner({ invoke, fs }) -> ProbeRunner
 * Dependencies are injectable so the live check can drive it with explicit fs/invoke.
 */
export function createWindowsSandboxRunner(deps = {}) {
  const invoke = deps.invoke || tauriInvoke;
  return {
    async start({ token, contentFiles, ioDir }) {
      const fs = deps.fs || (await tauriFs());
      // ioDir is <runDir>/io; the content and scripts go in a sibling <runDir>/in.
      const runDir = ioDir.replace(/[\\/]io[\\/]?$/, '');
      const inDir = `${runDir}/in`;
      const siteDir = `${inDir}/site`;
      await fs.mkdir(siteDir, { recursive: true });
      await fs.mkdir(ioDir, { recursive: true });
      await fs.writeTextFile(`${inDir}/startup.ps1`, startupPs1);
      await fs.writeTextFile(`${inDir}/executor.ps1`, executorPs1);
      for (const f of contentFiles || []) {
        const dest = `${siteDir}/${f.path}`;
        await fs.mkdir(dirOf(dest), { recursive: true });
        await fs.writeTextFile(dest, typeof f.content === 'string' ? f.content : '');
      }
      // Refuses (throws) if Windows Sandbox is unavailable — no silent downgrade.
      const sessionId = await invoke('sentinel_sandbox_start', { inDir, ioDir });
      return { sessionId, token, channel: createChannel(ioDir), inDir, ioDir };
    },

    async stop(session) {
      const invokeFn = deps.invoke || tauriInvoke;
      if (session?.sessionId) await invokeFn('sentinel_sandbox_stop', { sessionId: session.sessionId });
    },
  };
}
