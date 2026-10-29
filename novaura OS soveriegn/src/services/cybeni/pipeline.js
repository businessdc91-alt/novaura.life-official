// pipeline.js — Cybeni's multi-model build pipeline.
//
// Roles (each can be a different model):
//   architect  plans, oversees as orchestrator (approve / redirect / take over), signs off
//   developer  writes and fixes code
//   reviewer   cross-checks the developer's work; ideally a different model
//   designer   visual polish
// Tool passes need no model:
//   static     syntax, missing files and entry point (previewBuilder.staticCheck)
//   runtime    runs the app in the isolated preview and collects real errors
//
// Modes:
//   quick     5 phases, for iterating on an existing project
//   standard  12 phases: plan, build, self-check, static, cross-review loop,
//             design, runtime + repair, inspection, reinforcement, sign-off
//   full      27 phases: the complete cascade with double self-checks, three
//             orchestrator checkpoints, dependency tracing and limit validation
//   fix       repair the errors the preview reported
//
// The runner takes its model call and runtime verifier as hooks, so it has no
// UI, database or network dependencies of its own.

import { normalizePath, staticCheck } from './previewBuilder.js';

export const MODES = {
  quick: { label: 'Quick', description: 'Fast edits on an existing project (5 passes)' },
  standard: { label: 'Standard', description: 'Plan, build, cross-model review, runtime repair (12 passes)' },
  full: { label: 'Full 27-pass', description: 'Complete orchestrated cascade with double self-checks (27 passes)' },
};

const PHASE_INFO = {
  plan: ['Plan & file map', 'architect'],
  build: ['Build', 'developer'],
  'build-check': ['Self-check against the plan', 'developer'],
  foundation: ['Foundation', 'developer'],
  'foundation-check-1': ['Foundation self-check 1/2', 'developer'],
  'foundation-check-2': ['Foundation self-check 2/2', 'developer'],
  data: ['Data & state layer', 'architect'],
  'orch-1': ['Orchestrator checkpoint 1', 'architect'],
  depth: ['Depth & full functionality', 'developer'],
  'depth-check-1': ['Depth self-check 1/2', 'developer'],
  'depth-check-2': ['Depth self-check 2/2', 'developer'],
  'orch-2': ['Orchestrator checkpoint 2', 'architect'],
  branching: ['Dependency & branching trace', 'architect'],
  'branching-check': ['Branching self-check', 'architect'],
  static: ['Static analysis (syntax, files, entry)', 'tool'],
  'cross-review': ['Cross-model review', 'reviewer'],
  'orch-3': ['Orchestrator checkpoint 3', 'architect'],
  design: ['Design polish', 'designer'],
  'design-check': ['Design self-check', 'designer'],
  'cap-logic': ['Limits & edge-case validation', 'reviewer'],
  'cap-logic-check': ['Limits self-check', 'reviewer'],
  runtime: ['Run in preview', 'tool'],
  'runtime-fix': ['Repair runtime errors', 'developer'],
  inspection: ['Final inspection', 'reviewer'],
  optimize: ['Performance & accessibility', 'developer'],
  reinforce: ['Reinforcement', 'developer'],
  'reinforce-check': ['Reinforcement self-check', 'developer'],
  'runtime-final': ['Final run', 'tool'],
  'final-review': ['Orchestrator sign-off', 'architect'],
  fix: ['Repair reported errors', 'developer'],
};

const MODE_PHASES = {
  quick: ['build', 'build-check', 'static', 'runtime', 'runtime-fix'],
  standard: ['plan', 'build', 'build-check', 'static', 'cross-review', 'design', 'runtime', 'runtime-fix', 'inspection', 'reinforce', 'runtime-final', 'final-review'],
  full: ['plan', 'foundation', 'foundation-check-1', 'foundation-check-2', 'data', 'orch-1', 'depth', 'depth-check-1', 'depth-check-2', 'orch-2',
    'branching', 'branching-check', 'static', 'cross-review', 'orch-3', 'design', 'design-check', 'cap-logic', 'cap-logic-check',
    'runtime', 'runtime-fix', 'inspection', 'optimize', 'reinforce', 'reinforce-check', 'runtime-final', 'final-review'],
  fix: ['fix', 'static', 'runtime', 'runtime-fix'],
};

// Phases an orchestrator takeover makes redundant (the architect rebuilt the app).
const TAKEOVER_SKIPS = new Set(['data', 'depth', 'depth-check-1', 'depth-check-2', 'orch-2', 'branching', 'branching-check', 'orch-3']);

export function phasesFor(mode) {
  return (MODE_PHASES[mode] || MODE_PHASES.standard).map(id => ({ id, label: PHASE_INFO[id][0], role: PHASE_INFO[id][1] }));
}

export const SECURITY_LEVELS = {
  standard: 'Follow standard security practice: validate and sanitise user input, escape output.',
  hardened: 'Security hardening: validate every input, never build HTML from untrusted strings (no innerHTML with user data), no eval, guard against injection, handle failures closed.',
  paranoid: 'Assume all input is hostile. Defence in depth, fail secure, no eval/new Function/innerHTML, strict validation everywhere.',
};

export const QUALITY_LEVELS = {
  standard: 'Clean, readable code with reasonable error handling.',
  strict: 'Production grade: complete error handling, loading/empty/error states, edge cases, no placeholders or TODOs.',
};

const FORMAT_RULES = `## Output format (mandatory)
- For every file you create or change, output the COMPLETE file in a fenced code block whose info string is the file path, for example:
\`\`\`src/App.jsx
...entire file...
\`\`\`
- Never output partial files, diffs, or placeholders such as "rest unchanged". Only output files you changed.
- To delete a file, write a line: DELETE: path/to/file
- Put at most three short lines of explanation before the files.
- If the request is genuinely ambiguous and you cannot proceed sensibly, reply with one line starting "QUESTION:" and nothing else.`;

const STACK_RULES = `## Target platform
The app runs in a browser preview with no build step:
- index.html at the project root plus ES modules. React 18 with JSX in .jsx/.tsx files is supported (import React from 'react'; mount into <div id="root"> with react-dom/client).
- TypeScript (.ts/.tsx) is supported (types are stripped, not checked).
- npm packages are imported by bare name and loaded from esm.sh at runtime, so only use packages that work in the browser. Do not write an import map: bare imports are resolved automatically.
- Tailwind is available by adding <script src="https://cdn.tailwindcss.com"></script> to index.html.
- No Node APIs, no require(), no bundler or package.json build config.
- Persist data with localStorage or IndexedDB unless the request says otherwise.
- For an empty project, default to React + Tailwind with index.html, src/main.jsx and src/App.jsx.`;

const ROLE_IDENTITY = {
  architect: 'You are the Lead Architect and Orchestrator of the Cybeni build pipeline. You plan, oversee every stage, and guard the user\'s intent.',
  developer: 'You are the Senior Developer in the Cybeni build pipeline. You write complete, working, production-quality code.',
  reviewer: 'You are the Reviewer in the Cybeni build pipeline. You are a different model from the developer, so you check their work independently and precisely.',
  designer: 'You are the Designer in the Cybeni build pipeline. You make interfaces beautiful, clear and polished without changing behaviour.',
};

// ── Parsing model output ───────────────────────────────────────────────────

const PATH_RE = /[\w@][\w@.-]*(?:\/[\w@.-]+)*\.[A-Za-z0-9]{1,6}/;

function pathFromInfo(info) {
  const tokens = String(info || '').trim().split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    const kv = /^(?:path|file|title|filename)=["']?([^"']+)["']?$/i.exec(t);
    const candidate = kv ? kv[1] : t;
    if (candidate.includes('.') && PATH_RE.test(candidate) && PATH_RE.exec(candidate)[0] === candidate) return candidate;
  }
  return null;
}

// A file label on the line just above a block: "### src/App.jsx", "**App.jsx**",
// "`App.jsx`", "File: App.jsx" or "App.jsx:". Only a line that is nothing but a
// label counts, so prose ("I updated App.jsx") or "DELETE: x" is never taken as one.
const LABEL_RE = /^(?:#{1,6}\s*)?(?:\*\*|`)?(?:(?:file|path)\s*:\s*)?(?:\*\*|`)?([\w@][\w@./-]*\.[A-Za-z0-9]{1,6})(?:\*\*|`)?\s*:?\s*(?:\*\*)?$/i;

function pathFromPreamble(text) {
  const line = text.split('\n').map(l => l.trim()).filter(Boolean).pop() || '';
  const m = LABEL_RE.exec(line);
  return m && PATH_RE.exec(m[1])?.[0] === m[1] ? m[1] : null;
}

/**
 * Extract file writes and deletions from a model reply.
 * Returns { writes: Map(path -> content), deletes: Set(path), truncated: path|null }.
 */
export function parseFileBlocks(text) {
  const src = String(text || '');
  const writes = new Map();
  const deletes = new Set();
  const fence = /```([^\n`]*)\n([\s\S]*?)```/g;
  let last = 0;
  let m;
  let labelBlock = null; // some models put the path in its own block, then the file in the next
  let unlabeled = 0;
  while ((m = fence.exec(src)) !== null) {
    const infoPath = pathFromInfo(m[1]);
    const body = m[2].trim();
    if (!infoPath && !body.includes('\n') && PATH_RE.exec(body)?.[0] === body) {
      labelBlock = body;
      last = fence.lastIndex;
      continue;
    }
    const path = infoPath || labelBlock || pathFromPreamble(src.slice(last, m.index))
      || pathFromFirstLineComment(body)
      || (/^\s*(<!DOCTYPE html|<html[\s>])/i.test(body) && !writes.has('index.html') ? 'index.html' : null);
    labelBlock = null;
    last = fence.lastIndex;
    if (!path) {
      unlabeled++;
      continue;
    }
    const clean = normalizePath(path);
    if (!clean || clean.length > 200) continue;
    writes.set(clean, m[2].replace(/\n$/, ''));
  }
  for (const d of src.matchAll(/^DELETE:\s*(\S+)\s*$/gim)) {
    const clean = normalizePath(d[1]);
    if (clean) deletes.add(clean);
  }
  // An odd number of fences means the reply was cut off inside a file.
  let truncated = null;
  if ((src.match(/```/g) || []).length % 2 === 1) {
    const tail = src.slice(src.lastIndexOf('```') + 3);
    truncated = pathFromInfo(tail.split('\n')[0]) || 'the last file';
  }
  return { writes, deletes, truncated, unlabeled };
}

// "// src/App.jsx", "/* styles.css */", "<!-- index.html -->" or "# app.py" as the first line.
function pathFromFirstLineComment(body) {
  const first = body.split('\n')[0].trim();
  const m = /^(?:\/\/|#|\/\*|<!--)\s*(?:file:\s*|path:\s*)?([\w@][\w@./-]*\.[A-Za-z0-9]{1,6})\s*(?:\*\/|-->)?$/i.exec(first);
  return m && PATH_RE.exec(m[1])?.[0] === m[1] ? m[1] : null;
}

function verdictOf(text, approveWord) {
  const first = String(text || '').trim().split('\n')[0].replace(/[*#`]/g, '').trim();
  return new RegExp(`^${approveWord}\\b`, 'i').test(first);
}

function afterFirstLine(text) {
  return String(text || '').trim().split('\n').slice(1).join('\n').trim();
}

function shortNote(text) {
  const line = String(text || '').split('\n').map(l => l.replace(/[*#`>]/g, '').trim())
    .find(l => l && !l.startsWith('```') && !/^(DELETE:|CHECKLIST)/i.test(l));
  return line ? line.slice(0, 180) : '';
}

// ── Project context ────────────────────────────────────────────────────────

function contextBudget(modelKey) {
  return String(modelKey || '').startsWith('cloud|') ? 320000 : 60000;
}

/** Files as fenced blocks within a character budget; focus files go first. */
function projectContext(files, budget, focus = []) {
  const order = [...new Set([...focus.filter(p => files.has(p)), ...files.keys()])];
  const parts = [];
  const omitted = [];
  let used = 0;
  for (const p of order) {
    const block = `\`\`\`${p}\n${files.get(p)}\n\`\`\``;
    if (used + block.length > budget) {
      omitted.push(p);
      continue;
    }
    parts.push(block);
    used += block.length;
  }
  if (omitted.length) parts.push(`(Not shown to fit your context window: ${omitted.join(', ')}. Do not rewrite these unless needed.)`);
  return parts.length ? parts.join('\n\n') : '(empty project)';
}

// ── Runner ─────────────────────────────────────────────────────────────────

/**
 * Run the pipeline.
 * input: { request, files: [{path, content}], mode, roles: {architect, developer, reviewer, designer},
 *          design?: string, security?: key, quality?: key, maxFixRounds?: number }
 * hooks: { runModel(modelKey, messages, opts) -> text,                        (required)
 *          verify?(files) -> { errors: [string], blank: bool, notes?: string },
 *          onPhase?(id, patch), onLog?(text), onFiles?(files, changedPaths),
 *          ask?(question) -> answer, isCancelled?() -> bool }
 */
export async function runPipeline(input, hooks) {
  const mode = MODE_PHASES[input.mode] ? input.mode : 'standard';
  const roles = input.roles || {};
  const request = String(input.request || '').trim();
  const files = new Map((input.files || []).map(f => [normalizePath(f.path), String(f.content ?? '')]));
  const changed = new Set();
  const deleted = new Set();
  const maxFixRounds = Math.max(1, Math.min(5, input.maxFixRounds ?? 3));
  const reviewRounds = mode === 'full' ? 3 : 2;
  const stats = { modelCalls: 0, charsIn: 0, charsOut: 0, startedAt: Date.now() };
  const phases = phasesFor(mode);
  const log = (t) => hooks.onLog?.(t);

  let plan = '';
  let directive = '';
  let takeover = false;
  let lastVerifiedAt = -1;
  let editsSinceVerify = 0;
  let runtimeClean = null;
  let inspectionIssues = '';
  let pendingProblems = [];
  let approved = null;
  let summary = '';

  const restrictions = [SECURITY_LEVELS[input.security] || SECURITY_LEVELS.hardened, QUALITY_LEVELS[input.quality] || QUALITY_LEVELS.strict].join('\n');

  const cancelled = () => {
    if (hooks.isCancelled?.()) throw new Error('CANCELLED');
  };

  async function call(role, task, { code = true, temperature, maxTokens, focus = [], extra = '' } = {}) {
    cancelled();
    const modelKey = roles[role];
    if (!modelKey) throw new Error(`No model is assigned to the ${role} role.`);
    const system = [ROLE_IDENTITY[role], code ? FORMAT_RULES : '', code ? STACK_RULES : '', `## Standards\n${restrictions}`].filter(Boolean).join('\n\n');
    const user = [
      `## User request\n${request}`,
      plan ? `## Plan\n${plan}` : '',
      directive && code ? `## Orchestrator directive\n${directive}` : '',
      extra,
      `## Project files\n${projectContext(files, contextBudget(modelKey), focus)}`,
      `## Your task\n${task}`,
    ].filter(Boolean).join('\n\n');
    const messages = [{ role: 'system', content: system }, { role: 'user', content: user }];
    const opts = { temperature: temperature ?? (role === 'designer' ? 0.6 : 0.25), maxTokens: maxTokens ?? (code ? 8192 : 2048) };

    let reply = await hooks.runModel(modelKey, messages, opts);
    stats.modelCalls++;
    stats.charsIn += system.length + user.length;
    stats.charsOut += String(reply || '').length;
    cancelled();

    const question = /^\s*QUESTION:\s*(.+)/i.exec(String(reply || ''));
    if (question && hooks.ask) {
      log(`${role} asked: ${question[1]}`);
      const answer = await hooks.ask(question[1].trim());
      cancelled();
      messages.push({ role: 'assistant', content: reply }, { role: 'user', content: `Answer from the user: ${answer}\n\nNow complete the task.` });
      reply = await hooks.runModel(modelKey, messages, opts);
      stats.modelCalls++;
      stats.charsOut += String(reply || '').length;
    }
    return String(reply || '');
  }

  function apply(reply, label) {
    const { writes, deletes, truncated, unlabeled } = parseFileBlocks(reply);
    for (const [p, c] of writes) {
      if (files.get(p) !== c) {
        files.set(p, c);
        changed.add(p);
        deleted.delete(p);
        editsSinceVerify++;
      }
    }
    for (const p of deletes) {
      if (files.delete(p)) {
        deleted.add(p);
        changed.delete(p);
        editsSinceVerify++;
      }
    }
    if (writes.size || deletes.size) {
      log(`${label}: ${writes.size} file(s) written${deletes.size ? `, ${deletes.size} deleted` : ''}.`);
      hooks.onFiles?.(snapshot(), [...changed]);
    }
    return { count: writes.size + deletes.size, truncated, unlabeled, paths: [...writes.keys()] };
  }

  // Code-writing pass. Asks once more if the reply was cut off, or if it held
  // code whose file paths could not be determined.
  async function codePass(role, label, task, opts = {}) {
    const reply = await call(role, task, opts);
    let result = apply(reply, label);
    if (result.truncated) {
      log(`${label}: reply was cut off in ${result.truncated}; asking for that file again.`);
      const again = await call(role, `Your previous reply was cut off while writing ${result.truncated}. Output that complete file again, and any other files you had not finished.`, opts);
      const more = apply(again, `${label} (continued)`);
      result = { ...result, count: result.count + more.count };
    } else if (result.count === 0 && result.unlabeled > 0) {
      log(`${label}: reply had code without file paths; asking for it again in the required format.`);
      const again = await call(role, [
        'Your previous reply contained code, but the file paths were missing, so nothing could be saved.',
        'Output every file again. Each file must be in its own fenced block whose info string is exactly the file path, like ```src/App.jsx',
        'Previous reply for reference:',
        reply.slice(0, 24000),
      ].join('\n'), opts);
      const more = apply(again, `${label} (reformatted)`);
      result = { ...result, count: more.count, paths: more.paths };
    }
    return { reply, ...result };
  }

  const snapshot = () => [...files.entries()].map(([path, content]) => ({ path, content }));

  async function selfCheck(role, label, n, total) {
    const task = [
      `Self-check ${n}/${total} for "${label}". Be self-critical and compare the code with the plan.`,
      'First write CHECKLIST: <done>/<total> covering every plan item, then list what is missing or wrong.',
      'Then fix: missing imports, undefined references, broken cross-file references, incomplete functions, placeholders/TODOs, logic errors, missing error handling, and anything the checklist shows as missing.',
      'Output complete corrected files. If nothing needs fixing, reply with the checklist and the single word CLEAN.',
    ].join('\n');
    const r = await codePass(role, `${label} self-check ${n}/${total}`, task, { temperature: 0.15 });
    const checklist = /CHECKLIST:\s*(\d+\s*\/\s*\d+)/i.exec(r.reply)?.[1];
    return `${checklist ? `Checklist ${checklist.replace(/\s/g, '')}. ` : ''}${r.count ? `Fixed ${r.count} file(s).` : 'Clean.'}`;
  }

  async function orchestrate(stageLabel) {
    const reply = await call('architect', [
      `You are overseeing the pipeline. Evaluate the output of "${stageLabel}":`,
      '1. Does it address the user\'s request and the plan?',
      '2. Is the architecture sound and the code quality right for this stage?',
      '3. Are there problems the next passes cannot reasonably fix?',
      'Reply with exactly one of these on the FIRST line, then at most five lines of reasoning:',
      'APPROVE',
      'REDIRECT: <specific instructions for the next pass>',
      'TAKEOVER (only if the work is badly off track; you will then rebuild it yourself)',
    ].join('\n'), { code: false, temperature: 0.1, maxTokens: 800 });
    const first = reply.trim().split('\n')[0].replace(/[*#`]/g, '').trim();
    if (/^TAKEOVER/i.test(first)) {
      const r = await codePass('architect', 'Orchestrator takeover', 'The pipeline output is off track. Rebuild the COMPLETE application yourself, following the plan. Output every file.', { temperature: 0.2 });
      takeover = true;
      directive = '';
      return `Took over and rebuilt ${r.count} file(s).`;
    }
    if (/^REDIRECT:?/i.test(first)) {
      directive = first.replace(/^REDIRECT:?\s*/i, '') || afterFirstLine(reply);
      return `Redirected: ${directive.slice(0, 160)}`;
    }
    return 'Approved.';
  }

  async function runtimeCheck(label) {
    if (!hooks.verify) return { note: 'Skipped: no preview available.', clean: null };
    if (!files.size) return { note: 'Skipped: empty project.', clean: null };
    const result = await hooks.verify(snapshot());
    cancelled();
    lastVerifiedAt = stats.modelCalls;
    editsSinceVerify = 0;
    const errors = result?.errors || [];
    const problems = [...errors];
    if (result?.blank && !errors.length) problems.push('The app rendered a blank page: nothing appeared in #root or the body.');
    runtimeClean = problems.length === 0;
    log(`${label}: ${runtimeClean ? 'ran cleanly' : `${problems.length} problem(s)`}.`);
    return { problems, clean: runtimeClean, note: runtimeClean ? 'Ran cleanly.' : `${problems.length} problem(s): ${problems[0].slice(0, 140)}` };
  }

  async function repairLoop(initialProblems, label) {
    let problems = initialProblems;
    for (let round = 1; round <= maxFixRounds && problems.length; round++) {
      await codePass('developer', `${label} round ${round}`, [
        'The app was run in the browser preview and failed with these problems:',
        ...problems.map((p, i) => `${i + 1}. ${p}`),
        'Find the root cause of each and fix it. Output the complete corrected files.',
      ].join('\n'), { temperature: 0.15 });
      const issues = staticCheck(snapshot());
      if (issues.length) {
        problems = issues.map(i => i.message);
        continue;
      }
      const again = await runtimeCheck(`${label} recheck ${round}`);
      problems = again.clean === false ? again.problems : [];
    }
    return problems;
  }

  // Review phases that could not run (for example the reviewer model failed to
  // load). A build nobody independently reviewed is never reported as approved.
  const REVIEW_PHASES = new Set(['cross-review', 'inspection']);
  const failedReviews = [];

  const handlers = {
    plan: async () => {
      plan = await call('architect', [
        files.size ? 'Plan how to fulfil the request in this existing project.' : 'Plan the application from scratch.',
        'Write a concise plan with these sections:',
        'GOAL: one sentence.',
        'FEATURES: a numbered checklist of concrete, testable features (this is what every later pass is checked against).',
        'FILES: each file path with its purpose.',
        'DATA: data shapes and where they persist.',
        'RISKS: edge cases and pitfalls to handle.',
        'Do not write code.',
      ].join('\n'), { code: false, temperature: 0.2, maxTokens: 2000 });
      return `${(plan.match(/^\s*\d+[.)]/gm) || []).length} features planned.`;
    },
    build: async () => {
      const r = await codePass('developer', 'Build', files.size
        ? 'Implement the request on top of the existing project. Change only what is needed, keep everything else working, and output every file you change in full.'
        : 'Build the complete application as planned: every file, fully working, polished defaults. No placeholders.', { focus: [] });
      if (!r.count && !files.size) throw new Error('The developer model returned no files. Try a stronger model for the developer role.');
      return shortNote(r.reply) || `${r.count} file(s) written.`;
    },
    'build-check': () => selfCheck('developer', 'Build', 1, 1),
    foundation: async () => {
      const r = await codePass('developer', 'Foundation', 'Pass 1, Foundation: create the core architecture following the plan: file structure, entry points, data models, UI skeleton, routing and base styling. Every function needs a real implementation. No TODOs.');
      if (!r.count && !files.size) throw new Error('The developer model returned no files. Try a stronger model for the developer role.');
      return shortNote(r.reply) || `${r.count} file(s) written.`;
    },
    'foundation-check-1': () => selfCheck('developer', 'Foundation', 1, 2),
    'foundation-check-2': () => selfCheck('developer', 'Foundation', 2, 2),
    data: async () => {
      const r = await codePass('architect', 'Data layer', 'Design and implement the data and state layer for this app: data shapes, validation, persistence (localStorage or IndexedDB unless the request says otherwise), migrations for stored data, and state management. Output complete files.');
      return `${r.count} file(s) updated.`;
    },
    'orch-1': () => orchestrate('Foundation and data layer'),
    depth: async () => {
      const r = await codePass('developer', 'Depth', 'Pass 2, Depth: add full functionality to the foundation. Complete every implementation and handler, all user interactions, loading/empty/error states, input validation and feedback. Output all changed files in full.');
      directive = '';
      return shortNote(r.reply) || `${r.count} file(s) updated.`;
    },
    'depth-check-1': () => selfCheck('developer', 'Depth', 1, 2),
    'depth-check-2': () => selfCheck('developer', 'Depth', 2, 2),
    'orch-2': () => orchestrate('Depth and functionality'),
    branching: async () => {
      const r = await codePass('architect', 'Branching', [
        'Dependency and branching trace. Follow every feature to its logical conclusion and make sure everything it needs exists.',
        'For each feature ask: what does it require? Does that exist? What does that require? Continue until the chain is complete.',
        'Also look for functions that reference things that do not exist, UI with no logic behind it, and data fields that are read but never written.',
        'Add whatever is missing and output complete files.',
      ].join('\n'));
      directive = '';
      return `${r.count} file(s) updated.`;
    },
    'branching-check': () => selfCheck('architect', 'Branching', 1, 1),
    static: async () => {
      let issues = staticCheck(snapshot());
      for (let round = 1; round <= 2 && issues.length; round++) {
        log(`Static analysis found ${issues.length} issue(s); sending to the developer.`);
        await codePass('developer', `Static fix ${round}`, ['Static analysis found these problems:', ...issues.map((i, n) => `${n + 1}. ${i.message}`), 'Fix them all and output the complete corrected files.'].join('\n'), { temperature: 0.1 });
        issues = staticCheck(snapshot());
      }
      return issues.length ? `${issues.length} issue(s) remain: ${issues[0].message}` : 'No syntax errors, missing files or entry problems.';
    },
    'cross-review': async () => {
      for (let round = 1; round <= reviewRounds; round++) {
        const review = await call('reviewer', [
          'Review this code, which was written by a different model. Check plan coverage, correctness, cross-file consistency, security and UX states.',
          'Reply with APPROVED on the first line if it is ready.',
          'Otherwise reply NEEDS_WORK on the first line, followed by a numbered list of concrete issues: file, problem, and the fix.',
          'Do not write code.',
        ].join('\n'), { code: false, temperature: 0.1, maxTokens: 2000 });
        if (verdictOf(review, 'APPROVED')) return `Approved in round ${round}.`;
        const issues = afterFirstLine(review) || review;
        log(`Reviewer requested changes (round ${round}/${reviewRounds}).`);
        await codePass('developer', `Review fixes ${round}`, `The reviewer found these issues. Fix every one and output the complete corrected files.\n\n${issues}`, { temperature: 0.15 });
        await selfCheck('developer', `Review fixes ${round}`, 1, 1);
      }
      if (mode === 'full') {
        await codePass('architect', 'Forced resolution', 'The review loop ran out of rounds. Resolve every remaining issue yourself and output the final corrected files.', { temperature: 0.1 });
        return 'Review rounds exhausted; the architect resolved the remaining issues.';
      }
      return 'Review rounds exhausted; remaining issues go to final inspection.';
    },
    'orch-3': () => orchestrate('Dependency trace and cross-model review'),
    design: async () => {
      const r = await codePass('designer', 'Design', [
        'Polish the visual design and UX without changing behaviour or data logic.',
        input.design ? `Design direction: ${input.design}` : 'Design direction: modern, clean and confident, with clear hierarchy and good contrast.',
        'Work on layout, spacing, typography, colour, responsive behaviour, hover/focus states, transitions and empty states. Output complete changed files.',
      ].join('\n'), { temperature: 0.5 });
      return `${r.count} file(s) polished.`;
    },
    'design-check': () => selfCheck('designer', 'Design', 1, 1),
    'cap-logic': async () => {
      const r = await codePass('reviewer', 'Limits validation', [
        'Validate limits and edge cases, then fix them yourself:',
        'dead code, unreachable branches, missing returns, race conditions, unhandled promise rejections,',
        'empty, huge and malformed inputs, numeric limits, scaling and balancing values, corrupted stored data, and anything that could crash.',
        'Output complete corrected files.',
      ].join('\n'), { temperature: 0.15 });
      return `${r.count} file(s) hardened.`;
    },
    'cap-logic-check': () => selfCheck('reviewer', 'Limits validation', 1, 1),
    runtime: async () => {
      const r = await runtimeCheck('Preview run');
      pendingProblems = r.problems || [];
      return r.note;
    },
    'runtime-fix': async () => {
      const problems = pendingProblems;
      if (!problems.length) return { skipped: true, note: 'Nothing to repair.' };
      const left = await repairLoop(problems, 'Runtime repair');
      return left.length ? `${left.length} problem(s) remain after ${maxFixRounds} round(s).` : 'Repaired; the app now runs cleanly.';
    },
    inspection: async () => {
      const reply = await call('reviewer', [
        'Final quality inspection. Check: does it run, are all planned features implemented, is it secure, is the UX polished, does it match what the user asked for?',
        runtimeClean === false ? 'Note: the last preview run still reported problems.' : '',
        'Reply APPROVED on the first line followed by a short summary if everything passes.',
        'Otherwise reply ISSUES on the first line followed by a numbered list.',
      ].filter(Boolean).join('\n'), { code: false, temperature: 0.1, maxTokens: 1500 });
      approved = verdictOf(reply, 'APPROVED');
      inspectionIssues = approved ? '' : (afterFirstLine(reply) || reply);
      return approved ? 'Approved.' : `Issues found: ${shortNote(inspectionIssues)}`;
    },
    optimize: async () => {
      const r = await codePass('developer', 'Optimisation', 'Improve performance and accessibility without changing behaviour: avoid needless re-renders and repeated work, lazy-load heavy parts, add labels, roles and keyboard support, and remove dead code. Output complete changed files.', { temperature: 0.15 });
      return `${r.count} file(s) optimised.`;
    },
    reinforce: async () => {
      if (!inspectionIssues) return { skipped: true, note: failedReviews.includes('inspection') ? 'Inspection did not run; nothing to reinforce from it.' : 'Inspection approved; nothing to reinforce.' };
      const r = await codePass('developer', 'Reinforcement', `The final inspection found these issues. Fix all of them and output the complete corrected files.\n\n${inspectionIssues}`, { temperature: 0.2 });
      return `${r.count} file(s) reinforced.`;
    },
    'reinforce-check': () => (inspectionIssues ? selfCheck('developer', 'Reinforcement', 1, 1) : { skipped: true, note: 'Not needed.' }),
    'runtime-final': async () => {
      if (editsSinceVerify === 0 && lastVerifiedAt >= 0) return { skipped: true, note: `No changes since the last run (${runtimeClean ? 'clean' : 'had problems'}).` };
      const r = await runtimeCheck('Final run');
      if (r.clean === false) {
        const left = await repairLoop(r.problems, 'Final repair');
        return left.length ? `${left.length} problem(s) remain.` : 'Repaired; runs cleanly.';
      }
      return r.note;
    },
    'final-review': async () => {
      const reply = await call('architect', [
        'Sign off this build for the user.',
        failedReviews.length ? `Important: the independent ${failedReviews.join(' and ')} could not run, so no second model reviewed this build. Say so in the release note.` : '',
        'First line: APPROVED or ISSUES.',
        'Then a short release note in plain language: what was built, how to use it, and any known limitations.',
      ].filter(Boolean).join('\n'), { code: false, temperature: 0.2, maxTokens: 1200 });
      approved = verdictOf(reply, 'APPROVED');
      summary = afterFirstLine(reply) || reply;
      return approved ? 'Signed off.' : 'Signed off with known issues.';
    },
    fix: async () => {
      const r = await codePass('developer', 'Repair', `Fix the problems described in the user request at their root cause. Output the complete corrected files.`, { temperature: 0.15 });
      return `${r.count} file(s) changed.`;
    },
  };

  try {
    for (const phase of phases) {
      cancelled();
      if (takeover && TAKEOVER_SKIPS.has(phase.id)) {
        hooks.onPhase?.(phase.id, { status: 'skipped', note: 'Not needed after the orchestrator takeover.' });
        continue;
      }
      const started = Date.now();
      hooks.onPhase?.(phase.id, { status: 'running', model: roles[phase.role] || null });
      try {
        const out = await handlers[phase.id]();
        const skipped = out && typeof out === 'object' && out.skipped;
        const note = typeof out === 'string' ? out : out?.note || '';
        hooks.onPhase?.(phase.id, { status: skipped ? 'skipped' : 'done', note, ms: Date.now() - started });
      } catch (err) {
        if (err.message === 'CANCELLED') throw err;
        hooks.onPhase?.(phase.id, { status: 'failed', note: err.message, ms: Date.now() - started });
        log(`${phase.label} failed: ${err.message}`);
        if (REVIEW_PHASES.has(phase.id)) failedReviews.push(phase.id);
        // A failed build pass leaves nothing to check; other failures are survivable.
        if (['build', 'foundation', 'fix'].includes(phase.id) && changed.size === 0) throw err;
      }
    }
  } catch (err) {
    if (err.message === 'CANCELLED') {
      log('Pipeline cancelled.');
      return { status: 'cancelled', files: snapshot(), changed: [...changed], deleted: [...deleted], plan, summary, approved, stats: { ...stats, ms: Date.now() - stats.startedAt } };
    }
    return { status: 'failed', error: err.message, files: snapshot(), changed: [...changed], deleted: [...deleted], plan, summary, approved, stats: { ...stats, ms: Date.now() - stats.startedAt } };
  }

  if (!summary && mode !== 'full' && mode !== 'standard') {
    summary = changed.size ? `Changed ${[...changed].join(', ')}.` : 'No files changed.';
  }
  return {
    status: 'done',
    files: snapshot(),
    changed: [...changed],
    deleted: [...deleted],
    plan,
    summary,
    approved: failedReviews.length ? false : approved,
    unreviewed: failedReviews,
    runtimeClean,
    stats: { ...stats, ms: Date.now() - stats.startedAt },
  };
}
