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
// Acceptance tests: in standard and full mode the architect turns the request into
// numbered requirements (R1, R2, ...) and behavioural tests before any code is
// written. The developer builds against them, the preview runs them after every
// build, and failures go back as concrete repair tasks. A build is only approved
// when they pass. Tests live in .cybeni/acceptance.json, which models cannot edit.
//
// The runner takes its model call and runtime verifier as hooks, so it has no
// UI, database or network dependencies of its own.

import { normalizePath, staticCheck } from './previewBuilder.js';
import { TESTS_SCHEMA, normalizeTests, normalizeRequirements, describeStep, failureProblems } from './testAgent.js';
import { pickStarter, starterFiles, STARTER_NOTE } from './starters.js';
import { libraryNotes } from './libraryNotes.js';

export const TESTS_PATH = '.cybeni/acceptance.json';
const TRIAGE_SCHEMA = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, verdict: { type: 'string', enum: ['app', 'test'] }, reason: { type: 'string' } },
        required: ['id', 'verdict', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['verdicts'],
  additionalProperties: false,
};
const PROTECTED_RE = /^\.cybeni\//;

export const MODES = {
  quick: { label: 'Quick', description: 'Fast edits on an existing project (5 passes)' },
  standard: { label: 'Standard', description: 'Plan, build, cross-model review, runtime repair (12 passes)' },
  full: { label: 'Full 27-pass', description: 'Complete orchestrated cascade with double self-checks (27 passes)' },
};

const PHASE_INFO = {
  plan: ['Plan, requirements & tests', 'architect'],
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
- Exception for small fixes to a large existing file: you may instead output an edit block. The SEARCH text must be copied exactly from the current file and be unique in it:
\`\`\`src/App.jsx
<<<<<<< SEARCH
exact lines from the current file
=======
the replacement lines
>>>>>>> REPLACE
\`\`\`
  One block may hold several SEARCH/REPLACE pairs. New files and large changes always use complete files.
- To delete a file, write a line: DELETE: path/to/file
- Never write or change files under .cybeni/ (the acceptance tests).
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
    // "jsx:src/App.jsx" (language, colon, path) is a common label format too.
    const langPath = /^[a-z][a-z0-9+#-]*:([\w@][\w@./-]*)$/i.exec(t);
    const candidate = kv ? kv[1] : langPath ? langPath[1] : t;
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

const EDIT_RE = /<<<<<<< SEARCH\n([\s\S]*?)\n?=======\n([\s\S]*?)\n?>>>>>>> REPLACE/g;

/** SEARCH/REPLACE pairs in a block body, or null when the body is a whole file. */
export function parseEditBlock(body) {
  if (!/^<<<<<<< SEARCH$/m.test(body)) return null;
  const pairs = [];
  for (const m of body.replace(/\r\n/g, '\n').matchAll(EDIT_RE)) pairs.push({ search: m[1], replace: m[2] });
  return pairs;
}

/**
 * Apply SEARCH/REPLACE edits to a file. An exact match is tried first, then a
 * match that ignores indentation and trailing spaces (models often get those
 * slightly wrong). Returns { content, failed: [search] }.
 */
export function applyEdits(content, pairs) {
  let out = String(content ?? '');
  const failed = [];
  for (const { search, replace } of pairs) {
    if (!search.trim()) { failed.push(search); continue; }
    const at = out.indexOf(search);
    if (at >= 0 && out.indexOf(search, at + 1) < 0) {
      out = out.slice(0, at) + replace + out.slice(at + search.length);
      continue;
    }
    const lines = out.split('\n');
    const want = search.split('\n').map(l => l.trim());
    while (want.length && !want[want.length - 1]) want.pop();
    while (want.length && !want[0]) want.shift();
    const hits = [];
    for (let i = 0; i + want.length <= lines.length; i++) {
      if (want.every((w, j) => lines[i + j].trim() === w)) hits.push(i);
    }
    if (hits.length !== 1) { failed.push(search); continue; }
    // Keep the file's own indentation for the first replaced line.
    const indent = /^\s*/.exec(lines[hits[0]])[0];
    const repl = replace.split('\n');
    const replIndent = /^\s*/.exec(repl[0] || '')[0];
    const adjusted = repl.map(l => (l.startsWith(replIndent) ? indent + l.slice(replIndent.length) : l));
    lines.splice(hits[0], want.length, ...adjusted);
    out = lines.join('\n');
  }
  return { content: out, failed };
}

/**
 * Extract file writes, edits and deletions from a model reply.
 * Returns { writes: Map(path -> content), edits: Map(path -> pairs), deletes: Set(path), truncated: path|null }.
 */
export function parseFileBlocks(text) {
  const src = String(text || '');
  const writes = new Map();
  const edits = new Map();
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
    const pairs = parseEditBlock(m[2]);
    if (pairs) edits.set(clean, [...(edits.get(clean) || []), ...pairs]);
    else writes.set(clean, m[2].replace(/\n$/, ''));
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
  return { writes, edits, deletes, truncated, unlabeled };
}

// "// src/App.jsx", "/* styles.css */", "<!-- index.html -->" or "# app.py" as the first line.
function pathFromFirstLineComment(body) {
  const first = body.split('\n')[0].trim();
  const m = /^(?:\/\/|#|\/\*|<!--)\s*(?:file:\s*|path:\s*)?([\w@][\w@./-]*\.[A-Za-z0-9]{1,6})\s*(?:\*\/|-->)?$/i.exec(first);
  return m && PATH_RE.exec(m[1])?.[0] === m[1] ? m[1] : null;
}

// The model could not be loaded or reached (as opposed to a bad request); another model can stand in.
const UNAVAILABLE_RE = /out[- ]of[- ]memory|failed to allocate|unable to allocate|process has terminated|failed to load|not loaded|fetch failed|ECONNREFUSED|ECONNRESET|socket hang up|network ?error/i;

// Which other roles' models stand in for a role, best first. A reviewer never falls
// back to the developer's model: a model reviewing its own code is not a review.
const FALLBACK_ORDER = {
  architect: ['reviewer', 'designer', 'developer'],
  reviewer: ['architect', 'designer'],
  developer: ['designer', 'architect', 'reviewer'],
  designer: ['developer', 'architect', 'reviewer'],
};

/** Models to try for a role: its own, then the other roles' distinct models. */
export function modelsFor(role, roles) {
  const order = [role, ...(FALLBACK_ORDER[role] || Object.keys(roles))];
  const keys = [...new Set(order.map(r => roles[r]).filter(Boolean))];
  return role === 'reviewer' ? keys.filter((k, i) => i === 0 || k !== roles.developer) : keys;
}

export function isUnavailable(err) {
  return UNAVAILABLE_RE.test(String(err?.message || err || ''));
}

function verdictOf(text, approveWord) {
  const first = String(text || '').trim().split('\n')[0].replace(/[*#`]/g, '').trim();
  return new RegExp(`^${approveWord}\\b`, 'i').test(first);
}

/** The JSON object in a model reply, tolerating fences or prose around it. Null if none parses. */
export function extractJson(text) {
  const src = String(text || '').trim();
  const fenced = /```(?:json)?\s*\n([\s\S]*?)```/i.exec(src);
  const candidates = [src, fenced?.[1]];
  const first = src.indexOf('{');
  const last = src.lastIndexOf('}');
  if (first >= 0 && last > first) candidates.push(src.slice(first, last + 1));
  for (const c of candidates) {
    if (!c) continue;
    try {
      const v = JSON.parse(c);
      if (v && typeof v === 'object') return v;
    } catch { /* try the next form */ }
  }
  return null;
}

// "local|lmstudio:google/gemma-4-26b" -> "gemma-4-26b"
function modelLabel(key) {
  return String(key || '').split(/[|:/]/).pop() || String(key);
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
  const stats = { modelCalls: 0, fallbacks: 0, charsIn: 0, charsOut: 0, startedAt: Date.now() };
  const unavailable = new Set();
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

  // Requirements and acceptance tests saved by earlier runs on this project.
  let requirements = [];
  let tests = [];
  let testResults = null;
  if (files.has(TESTS_PATH)) {
    try {
      const saved = JSON.parse(files.get(TESTS_PATH));
      tests = normalizeTests(saved);
      requirements = normalizeRequirements(saved);
    } catch {
      log('The saved acceptance tests could not be read; they will be written again.');
    }
  }
  // Quick edits may change behaviour on purpose, so saved tests only run in the other modes.
  const runTests = mode !== 'quick';

  // A new project starts from a known-good scaffold instead of a blank page.
  let starter = null;
  const starterPaths = [];
  if (!files.size && mode !== 'fix' && input.starter !== false) {
    starter = pickStarter(request);
    for (const f of starterFiles(starter)) {
      files.set(f.path, f.content);
      starterPaths.push(f.path);
    }
    log(`Started from the ${starter === 'game' ? 'canvas game' : 'React + Tailwind'} starter.`);
  }

  const restrictions = [SECURITY_LEVELS[input.security] || SECURITY_LEVELS.hardened, QUALITY_LEVELS[input.quality] || QUALITY_LEVELS.strict].join('\n');

  const cancelled = () => {
    if (hooks.isCancelled?.()) throw new Error('CANCELLED');
  };

  const testsText = () => tests.map(t => `${t.id}${t.requirement ? ` [${t.requirement}]` : ''} ${t.name}:\n${t.steps.map(s => `  - ${describeStep(s)}`).join('\n')}`).join('\n');

  // Imports in the project, so library notes follow what the code actually uses.
  const importLines = () => [...files.values()].join('\n').split('\n').filter(l => /\bimport\b|require\(/.test(l)).join('\n');

  async function call(role, task, { code = true, temperature, maxTokens, focus = [], extra = '', jsonSchema } = {}) {
    cancelled();
    const modelKey = roles[role];
    if (!modelKey) throw new Error(`No model is assigned to the ${role} role.`);
    const system = [ROLE_IDENTITY[role], code ? FORMAT_RULES : '', code ? STACK_RULES : '', `## Standards\n${restrictions}`].filter(Boolean).join('\n\n');
    const notes = code ? libraryNotes(request, plan, importLines()) : '';
    const user = [
      `## User request\n${request}`,
      plan ? `## Plan\n${plan}` : '',
      requirements.length ? `## Requirements\n${requirements.map(r => `${r.id}. ${r.text}`).join('\n')}` : '',
      tests.length && code && runTests ? `## Acceptance tests\nThe finished app is tested with these steps in the preview; each test runs on a freshly loaded app with empty storage. It must pass every one, so use these exact labels, placeholders and texts in the UI.\n${testsText()}` : '',
      starter && code ? `## Starting point\n${STARTER_NOTE[starter]}` : '',
      notes ? `## Library notes\n${notes}` : '',
      directive && code ? `## Orchestrator directive\n${directive}` : '',
      extra,
      `## Project files\n${projectContext(files, contextBudget(modelKey), focus)}`,
      `## Your task\n${task}`,
    ].filter(Boolean).join('\n\n');
    const messages = [{ role: 'system', content: system }, { role: 'user', content: user }];
    const opts = {
      scope: `cybeni:${role}`,
      temperature: temperature ?? (role === 'designer' ? 0.6 : 0.25),
      maxTokens: maxTokens ?? (code ? 8192 : 2048),
      ...(jsonSchema ? { jsonSchema } : {}),
    };

    let usedKey = modelKey;
    const send = async () => {
      // A model that failed to load stays skipped for the rest of the run instead of failing every call.
      const candidates = modelsFor(role, roles).filter(k => !unavailable.has(k));
      if (!candidates.length) throw new Error(`No model could be loaded for the ${role} role.`);
      for (let i = 0; i < candidates.length; i++) {
        try {
          const out = await hooks.runModel(candidates[i], messages, opts);
          usedKey = candidates[i];
          return out;
        } catch (err) {
          if (err.message === 'CANCELLED' || !isUnavailable(err) || i === candidates.length - 1) throw err;
          unavailable.add(candidates[i]);
          stats.fallbacks++;
          log(`${modelLabel(candidates[i])} could not run (${err.message.trim().split('\n').pop().slice(0, 90)}); the ${role} role continues on ${modelLabel(candidates[i + 1])}.`);
          cancelled();
        }
      }
    };

    let reply = await send();
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
      reply = await hooks.runModel(usedKey, messages, opts);
      stats.modelCalls++;
      stats.charsOut += String(reply || '').length;
    }
    return String(reply || '');
  }

  function apply(reply, label) {
    const { writes, edits, deletes, truncated, unlabeled } = parseFileBlocks(reply);
    const written = [];
    const failedEdits = [];
    let blocked = 0;
    for (const [p, c] of writes) {
      if (PROTECTED_RE.test(p)) { blocked++; continue; }
      written.push(p);
      if (files.get(p) !== c) {
        files.set(p, c);
        changed.add(p);
        deleted.delete(p);
        editsSinceVerify++;
      }
    }
    for (const [p, pairs] of edits) {
      if (PROTECTED_RE.test(p)) { blocked++; continue; }
      if (!files.has(p)) {
        failedEdits.push({ path: p, why: 'the file does not exist', searches: [] });
        continue;
      }
      const r = applyEdits(files.get(p), pairs);
      if (r.failed.length) failedEdits.push({ path: p, why: `${r.failed.length} of ${pairs.length} SEARCH block(s) were not found exactly once`, searches: r.failed });
      if (r.content !== files.get(p)) {
        files.set(p, r.content);
        changed.add(p);
        editsSinceVerify++;
        written.push(p);
      }
    }
    let removed = 0;
    for (const p of deletes) {
      if (PROTECTED_RE.test(p)) { blocked++; continue; }
      if (files.delete(p)) {
        deleted.add(p);
        changed.delete(p);
        editsSinceVerify++;
        removed++;
      }
    }
    if (blocked) log(`${label}: ignored ${blocked} change(s) to the acceptance tests.`);
    if (written.length || removed) {
      log(`${label}: ${written.length} file(s) written${edits.size ? ' (with edit blocks)' : ''}${removed ? `, ${removed} deleted` : ''}.`);
      hooks.onFiles?.(snapshot(), [...changed]);
    }
    return { count: written.length + removed, truncated, unlabeled, failedEdits, paths: written };
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
    if (result.failedEdits?.length) {
      // An edit whose SEARCH text does not match would silently drop a fix; ask for whole files.
      log(`${label}: ${result.failedEdits.length} edit block(s) did not match; asking for complete files.`);
      const again = await call(role, [
        'Some of your edit blocks could not be applied because their SEARCH text does not match the current file:',
        ...result.failedEdits.map(f => `- ${f.path}: ${f.why}${f.searches.length ? `\n  First unmatched SEARCH:\n${f.searches[0].slice(0, 600)}` : ''}`),
        'The project files above show the current content. Output the COMPLETE corrected version of each of those files (whole files, no edit blocks), including the change you intended.',
      ].join('\n'), { ...opts, focus: result.failedEdits.map(f => f.path) });
      const more = apply(again, `${label} (whole files)`);
      result = { ...result, count: result.count + more.count, failedEdits: more.failedEdits };
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
    const active = runTests ? tests : [];
    const result = await hooks.verify(snapshot(), { tests: active });
    cancelled();
    lastVerifiedAt = stats.modelCalls;
    editsSinceVerify = 0;
    const errors = result?.errors || [];
    const problems = [...errors];
    if (result?.blank && !errors.length) problems.push('The app rendered a blank page: nothing appeared in #root or the body.');
    let testNote = '';
    if (active.length && Array.isArray(result?.tests)) {
      testResults = result.tests;
      const passed = testResults.filter(r => r.passed).length;
      testNote = ` ${passed}/${active.length} acceptance tests pass.`;
      if (!testResults.length) problems.push('The acceptance tests did not run: the page never reported back. It may be stuck in a loop.');
      problems.push(...failureProblems(testResults, active));
    }
    runtimeClean = problems.length === 0;
    log(`${label}: ${runtimeClean ? 'ran cleanly' : `${problems.length} problem(s)`}.${testNote}`);
    return { problems, clean: runtimeClean, note: runtimeClean ? `Ran cleanly.${testNote}` : `${problems.length} problem(s).${testNote} First: ${problems[0].slice(0, 140)}` };
  }

  /** One line per requirement: passes, FAILS (with its tests) or has no automated test. */
  function coverage() {
    if (!tests.length) return 'No acceptance tests.';
    if (!testResults) return 'Acceptance tests were written but have not run (no preview was available).';
    const byId = new Map(testResults.map(r => [r.id, r]));
    const status = (t) => `${t.id} ${byId.get(t.id)?.passed ? 'passed' : 'failed'}`;
    const lines = requirements.map(r => {
      const own = tests.filter(t => t.requirement === r.id);
      if (!own.length) return `${r.id} (no automated test): ${r.text}`;
      return `${r.id} ${own.every(t => byId.get(t.id)?.passed) ? 'passes' : 'FAILS'}: ${r.text} (${own.map(status).join(', ')})`;
    });
    const loose = tests.filter(t => !requirements.some(r => r.id === t.requirement));
    if (loose.length) lines.push(`Other tests: ${loose.map(status).join(', ')}`);
    for (const d of droppedTests) lines.push(`Dropped test ${d.id} "${d.name}" (judged wrong: ${d.reason})`);
    return lines.join('\n');
  }

  // Files a problem report points at (stack traces, test failures), shown to the model first.
  const focusFrom = (problems) => [...files.keys()].filter(p => !PROTECTED_RE.test(p) && problems.some(t => t.includes(p) || t.includes(`/${p.split('/').pop()}`)));

  // Tests that keep failing while the developer makes no progress may be wrong
  // themselves (they ask for something the request never did, or can never pass).
  // A second model judges each one; tests it rejects are dropped and reported,
  // never silently ignored, and at most half of the contract can be dropped.
  const droppedTests = [];
  const judged = new Set();
  const failingIds = () => (testResults || []).filter(r => !r.passed).map(r => r.id).sort();

  async function triageTests(ids) {
    const fresh = ids.filter(id => !judged.has(id));
    const budget = Math.floor((tests.length + droppedTests.length) / 2) - droppedTests.length;
    if (!fresh.length || budget <= 0) return 0;
    fresh.forEach(id => judged.add(id));
    const judge = roles.reviewer ? 'reviewer' : 'architect';
    const failing = (testResults || []).filter(r => fresh.includes(r.id));
    const reply = await call(judge, [
      'These acceptance tests keep failing although the developer has tried to fix the app. For each one, decide whether the APP is wrong or the TEST is wrong.',
      ...failing.map(r => `- ${r.id} "${r.name}": ${r.message.slice(0, 400)}\n  Steps: ${(tests.find(t => t.id === r.id)?.steps || []).map(describeStep).join('; ')}`),
      'Verdict "test" only when the test itself is wrong: it checks something the request never asked for, contradicts the request, can never pass (for example it expects blank text), or targets a label the request did not specify while the app uses a reasonable one. Otherwise the verdict is "app". When unsure, say "app".',
      'Reply with only JSON: {"verdicts":[{"id":"T1","verdict":"app"|"test","reason":"one sentence"}]}',
    ].join('\n'), { code: false, temperature: 0.1, maxTokens: 1500, focus: focusFrom(failing.map(r => r.message)), jsonSchema: TRIAGE_SCHEMA });
    const verdicts = (extractJson(reply)?.verdicts || []).filter(v => v && fresh.includes(v.id) && v.verdict === 'test').slice(0, budget);
    for (const v of verdicts) {
      const t = tests.find(x => x.id === v.id);
      if (!t) continue;
      droppedTests.push({ id: t.id, name: t.name, reason: String(v.reason || 'judged wrong').slice(0, 300) });
      log(`Dropped acceptance test ${t.id} "${t.name}": ${v.reason}`);
    }
    if (!verdicts.length) return 0;
    const gone = new Set(verdicts.map(v => v.id));
    tests = tests.filter(t => !gone.has(t.id));
    testResults = (testResults || []).filter(r => !gone.has(r.id));
    files.set(TESTS_PATH, `${JSON.stringify({ requirements, tests, dropped: droppedTests }, null, 2)}\n`);
    changed.add(TESTS_PATH);
    return gone.size;
  }

  async function repairLoop(initialProblems, label) {
    let problems = initialProblems;
    let lastFailing = failingIds().join();
    let stalled = 0;
    for (let round = 1; round <= maxFixRounds && problems.length; round++) {
      const testFailures = problems.some(p => p.startsWith('Acceptance test'));
      await codePass('developer', `${label} round ${round}`, [
        'The app was run in the browser preview and failed with these problems:',
        ...problems.slice(0, 12).map((p, i) => `${i + 1}. ${p}`),
        testFailures ? 'A failed acceptance test means the app does not yet do what was asked. The tests are fixed: change the app (its labels, texts and behaviour) so each passes. "On screen" lists what the test could see.' : '',
        'Find the root cause of each and fix it. For a small fix in a large file you may use edit blocks; otherwise output complete corrected files.',
      ].filter(Boolean).join('\n'), { temperature: 0.15, focus: focusFrom(problems) });
      const issues = staticCheck(snapshot());
      if (issues.length) {
        problems = issues.map(i => i.message);
        continue;
      }
      const again = await runtimeCheck(`${label} recheck ${round}`);
      problems = again.clean === false ? again.problems : [];
      // Same tests failing as before the round: maybe the tests are wrong, or the repair is stuck.
      const failing = failingIds();
      if (failing.length && failing.join() === lastFailing) {
        const dropped = await triageTests(failing);
        if (dropped) {
          const gone = new Set(droppedTests.map(d => d.id));
          problems = problems.filter(p => !/^Acceptance test (\S+)/.test(p) || !gone.has(/^Acceptance test (\S+)/.exec(p)[1]));
          runtimeClean = problems.length === 0;
          stalled = 0;
        } else if (++stalled >= 2) {
          log(`${label}: the same problems remain after ${round} rounds; stopping repairs early.`);
          break;
        }
      } else stalled = 0;
      lastFailing = failingIds().join();
    }
    return problems;
  }

  // Review phases that could not run (for example the reviewer model failed to
  // load). A build nobody independently reviewed is never reported as approved.
  const REVIEW_PHASES = new Set(['cross-review', 'inspection']);
  const failedReviews = [];
  // Without a plan and test contract, or without a sign-off, nothing checked the
  // build against the request, so it is not approved either.
  const CONTRACT_PHASES = new Set(['plan', 'final-review']);
  const failedChecks = [];

  // The architect turns the request into numbered requirements and acceptance
  // tests (structured JSON, one retry). Existing tests are updated, not discarded.
  async function writeTests() {
    const task = [
      'Turn the request and plan into a contract the build will be tested against.',
      'Reply with only a JSON object: {"requirements":[{"id":"R1","text":"..."}],"tests":[{"id":"T1","requirement":"R1","name":"...","steps":[...]}]}',
      'requirements: every concrete, checkable thing the user asked for, numbered R1, R2, ... Name the exact visible labels the UI will use (button texts, input placeholders, headings), because the tests rely on them.',
      'tests: 3 to 8 tests a person could carry out, each with its "requirement" id. Each test runs on a freshly loaded app with empty storage, so every test must create what it needs itself (for example add two tasks before checking "2 left"). The page cannot be reloaded during a test, so persistence cannot be tested.',
      'Steps (use only these):',
      '  {"do":"click","target":"<button or link text, or a label>"}',
      '  {"do":"type","target":"<input placeholder or label>","text":"..."}',
      '  {"do":"press","key":"Enter","target":"<input>"}   keys: Enter, Escape, Tab, Space, ArrowUp/ArrowDown/ArrowLeft/ArrowRight, or a letter',
      '  {"do":"select","target":"<select label>","value":"<option text>"}',
      '  {"do":"wait","ms":500}',
      '  {"do":"expect_text","text":"..."}   {"do":"expect_no_text","text":"..."}',
      '  {"do":"expect_match","pattern":"<regular expression>"}',
      '  {"do":"expect_element","target":"<label, text or CSS selector>","text":"<optional>"}',
      '  {"do":"expect_value","target":"<input>","text":"..."}',
      '  {"do":"expect_count","target":"<CSS selector>","count":3}   (or "min":1)',
      '  {"do":"expect_canvas"}   a canvas has something drawn on it',
      'Rules: test only what is visible on the page. Never expect blank or whitespace-only text. To reach a checkbox or other unlabelled control, use its label, or the target "checkbox" for the first one on the page. No network. Nothing timing-sensitive: a timer may only be checked for starting (for example Start turning into Pause). For canvas games: check the canvas is drawn, that pressing the control keys does not crash it, and that the score or HUD text appears. Keep targets short and literal.',
      tests.length ? `Existing contract from earlier work on this project; keep what still applies, change what this request changes, and add what is new:\n${JSON.stringify({ requirements, tests })}` : '',
    ].filter(Boolean).join('\n');
    let parsed = null;
    for (let attempt = 1; attempt <= 2 && !parsed; attempt++) {
      const reply = await call('architect', attempt === 1 ? task : `${task}\n\nYour previous reply was not a valid JSON object. Reply with the JSON object only.`, { code: false, temperature: 0.1, maxTokens: 4000, jsonSchema: TESTS_SCHEMA });
      parsed = extractJson(reply);
      if (parsed && !normalizeTests(parsed).length) parsed = null;
    }
    if (!parsed) {
      log('The architect did not produce usable acceptance tests; building without them.');
      return;
    }
    requirements = normalizeRequirements(parsed);
    tests = normalizeTests(parsed);
    files.set(TESTS_PATH, `${JSON.stringify({ requirements, tests }, null, 2)}\n`);
    changed.add(TESTS_PATH);
    hooks.onFiles?.(snapshot(), [...changed]);
  }

  const handlers = {
    plan: async () => {
      plan = await call('architect', [
        files.size && !starter ? 'Plan how to fulfil the request in this existing project.' : 'Plan the application from scratch, on the starter project.',
        'Write a concise plan with these sections:',
        'GOAL: one sentence.',
        'FEATURES: a numbered checklist of concrete, testable features (this is what every later pass is checked against).',
        'FILES: each file path with its purpose.',
        'DATA: data shapes and where they persist.',
        'RISKS: edge cases and pitfalls to handle.',
        'Do not write code. If the request is genuinely ambiguous in a way that changes what to build, reply with one line starting "QUESTION:" instead.',
      ].join('\n'), { code: false, temperature: 0.2, maxTokens: 2000 });
      await writeTests();
      const features = (plan.match(/^\s*\d+[.)]/gm) || []).length;
      return `${features} features planned; ${requirements.length} requirements and ${tests.length} acceptance tests written.`;
    },
    build: async () => {
      const r = await codePass('developer', 'Build', files.size && !starter
        ? 'Implement the request on top of the existing project. Change only what is needed, keep everything else working, and output every file you change in full.'
        : 'Build the complete application as planned on the starter: every file, fully working, polished defaults. No placeholders.', { focus: [] });
      if (!r.count && (starter || !files.size)) throw new Error('The developer model returned no files. Try a stronger model for the developer role.');
      return shortNote(r.reply) || `${r.count} file(s) written.`;
    },
    'build-check': () => selfCheck('developer', 'Build', 1, 1),
    foundation: async () => {
      const r = await codePass('developer', 'Foundation', 'Pass 1, Foundation: create the core architecture following the plan: file structure, entry points, data models, UI skeleton, routing and base styling. Every function needs a real implementation. No TODOs.');
      if (!r.count && (starter || !files.size)) throw new Error('The developer model returned no files. Try a stronger model for the developer role.');
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
        testResults ? `Automated acceptance results (from actually running the app):\n${coverage()}` : '',
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
        testResults ? `Automated acceptance results (from actually running the app). A requirement that FAILS is a known limitation and must be named in the release note:\n${coverage()}` : '',
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
        if (CONTRACT_PHASES.has(phase.id)) failedChecks.push(phase.id);
        // A failed build pass leaves nothing to check; other failures are survivable.
        if (['build', 'foundation', 'fix'].includes(phase.id) && [...changed].every(p => PROTECTED_RE.test(p))) throw err;
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
  // Tests that ran and failed overrule any model's approval: the app does not do what was asked.
  const testsFailed = Boolean(runTests && tests.length && testResults && !(testResults.length === tests.length && testResults.every(r => r.passed)));
  if ((testsFailed || droppedTests.length) && summary) summary += `\n\nRequirements check:\n${coverage()}`;
  return {
    status: 'done',
    files: snapshot(),
    changed: [...new Set([...starterPaths, ...changed])],
    deleted: [...deleted],
    plan,
    summary,
    // Errors still showing in the preview mean the app is broken, whatever a model said.
    approved: failedReviews.length || failedChecks.length || testsFailed || runtimeClean === false ? false : approved,
    unreviewed: [...failedReviews, ...failedChecks],
    runtimeClean,
    requirements,
    tests,
    testResults,
    droppedTests,
    stats: { ...stats, ms: Date.now() - stats.startedAt },
  };
}
