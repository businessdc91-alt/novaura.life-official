// probeRunner.js — the ProbeRunner interface and an in-process fake of it.
//
// A ProbeRunner is:
//   {
//     async start({ token, contentFiles, ioDir }) -> session,
//     async stop(session) -> void,
//   }
// where `session` exposes `session.channel`, a createChannel-compatible object
// ({ send(command) -> n, waitObservation(n, opts) -> observation, close() }).
//
// Two runners implement this: createFakeRunner (here, in-process — used by tests and as a
// dry-run) and the Windows Sandbox runner (windowsSandboxRunner.js, which starts a real
// no-egress VM). The orchestrator (probe.js) depends only on this interface, so the real
// runner is swapped in without any other change.
//
// This file imports nothing from Tauri, so it is safe to load under node:test.

/**
 * An in-process ProbeRunner. It does not isolate anything — it simply serves the given
 * contentFiles from memory and answers the one command the foundation supports (echo)
 * with the HTTP status it would return and the paths it holds. Use it to prove the
 * orchestration loop without a VM.
 */
export function createFakeRunner() {
  return {
    async start({ token, contentFiles }) {
      const files = new Map((contentFiles || []).map((f) => [f.path, f.content]));
      const answers = new Map(); // n -> observation
      let counter = 0;
      const channel = {
        async send(command) {
          const n = ++counter;
          if (command?.op === 'echo') {
            answers.set(n, {
              status: files.has('index.html') ? 200 : 404,
              headers: ['content-type', 'content-length'],
              servedPaths: [...files.keys()],
            });
          } else {
            answers.set(n, { status: -1, error: 'unsupported command' });
          }
          return n;
        },
        async waitObservation(n) {
          if (!answers.has(n)) throw new Error(`No observation for command ${n}.`);
          return answers.get(n);
        },
        close() {},
      };
      return { channel, token, fake: true };
    },
    async stop() {},
  };
}
