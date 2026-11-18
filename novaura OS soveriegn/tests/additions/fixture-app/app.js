// The contract fixture as an addition: run every check against the real bridge and
// report the results to the window that launched it.
import { runChecks } from './checks.js';

const results = await runChecks(window.novaura, { localStorage });
parent.postMessage({ __fixture: results }, '*');
