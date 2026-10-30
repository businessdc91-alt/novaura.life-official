// Cybeni pipeline: edit blocks, reply parsing, JSON extraction, library notes and
// pins, starters, test normalisation, and the acceptance-test loop end to end with
// a scripted model and preview (triage, early stop, model fallback, approval rules).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../../src/services/cybeni/pipeline.js';
import * as L from '../../src/services/cybeni/libraryNotes.js';
import * as S from '../../src/services/cybeni/starters.js';
import * as T from '../../src/services/cybeni/testAgent.js';

const F = '```';
const ROLES = { architect: 'arch', developer: 'dev', reviewer: 'rev', designer: 'dev' };
const taskOf = (messages) => { const user = messages[1].content; return user.slice(user.lastIndexOf('## Your task')); };

test('edit blocks', () => {
  const file = 'function a() {\n  return 1;\n}\n\nfunction b() {\n  return 2;\n}\n';
  const exact = P.applyEdits(file, [{ search: '  return 1;', replace: '  return 10;' }]);
  assert.ok(exact.content.includes('return 10;') && exact.content.includes('return 2;') && !exact.failed.length, 'exact unique match is replaced');
  const loose = P.applyEdits(file, [{ search: 'function b() {\nreturn 2;\n}', replace: 'function b() {\n  return 20;\n}' }]);
  assert.ok(loose.content.includes('function b() {\n  return 20;\n}') && !loose.failed.length, 'indentation-insensitive match keeps the file indentation');
  const ambiguous = P.applyEdits('x = 1;\nx = 1;\n', [{ search: 'x = 1;', replace: 'x = 2;' }]);
  assert.ok(ambiguous.failed.length === 1 && ambiguous.content === 'x = 1;\nx = 1;\n', 'an ambiguous SEARCH is refused, not guessed');
  const missing = P.applyEdits(file, [{ search: 'return 99;', replace: 'nope' }]);
  assert.ok(missing.failed.length === 1 && missing.content === file, 'a missing SEARCH is reported');
  const parsed = P.parseFileBlocks(`${F}src/a.js\n<<<<<<< SEARCH\n  return 1;\n=======\n  return 5;\n>>>>>>> REPLACE\n<<<<<<< SEARCH\n  return 2;\n=======\n  return 6;\n>>>>>>> REPLACE\n${F}\n${F}src/b.js\nconst whole = 1;\n${F}`);
  assert.ok(parsed.edits.get('src/a.js')?.length === 2 && parsed.writes.get('src/b.js') === 'const whole = 1;' && !parsed.writes.has('src/a.js'), 'edit blocks and whole files are told apart');
});

test('"language:path" labels (Gemma 4 26B, live temperature build)', () => {
  const reply = `I'll build the converter.\n\n${F}js:src/utils/conversions.js\nexport const cToF = c => c * 9 / 5 + 32;\n${F}\n\n${F}jsx:src/components/Converter.jsx\nexport default function Converter() { return null; }\n${F}\n\n${F}jsx:src/App.jsx\nimport Converter from './components/Converter.jsx';\nexport default () => <Converter />;\n${F}`;
  const r = P.parseFileBlocks(reply);
  assert.deepEqual([...r.writes.keys()].sort(), ['src/App.jsx', 'src/components/Converter.jsx', 'src/utils/conversions.js']);
});

test('JSON extraction', () => {
  assert.equal(P.extractJson('{"a":1}')?.a, 1);
  assert.equal(P.extractJson('Here you go:\n```json\n{"a":2}\n```\nDone.')?.a, 2);
  assert.equal(P.extractJson('Sure! {"tests":[{"id":"T1"}]} hope this helps')?.tests?.length, 1);
  assert.equal(P.extractJson('no json here'), null);
});

test('library notes and pins', () => {
  assert.ok(!L.libraryNotes('a layout with three columns and a calm tone').includes('three r160'), 'the English word "three" does not pull in three.js');
  assert.ok(L.libraryNotes("import * as THREE from 'three';").includes('three r160'), 'an import of three does');
  assert.ok(L.libraryNotes('make a 3D scene with three.js').includes('three r160'), '"three.js" in a request does');
  assert.equal(L.libraryNotes('dashboard with recharts and react router').split('\n').length, 2, 'recharts and the react router alias');
  assert.equal(L.pinnedSpecifier('three/examples/jsm/controls/OrbitControls.js'), 'three@0.160.0/examples/jsm/controls/OrbitControls.js');
  assert.equal(L.pinnedSpecifier('@tanstack/react-query'), '@tanstack/react-query@5');
  assert.equal(L.pinnedSpecifier('lodash'), 'lodash');
  assert.equal(L.pinnedSpecifier('three@0.150.0'), 'three@0.150.0');
});

test('starters', () => {
  assert.equal(S.pickStarter('make a snake game with a high score'), 'game');
  assert.equal(S.pickStarter('a memory card game in React'), 'react');
  assert.equal(S.pickStarter('a game library tracker app'), 'react');
  assert.equal(S.pickStarter('todo list with categories'), 'react');
});

test('test normalisation', () => {
  const t = T.normalizeTests({ tests: [{ id: 'T1', name: 'ok', steps: [{ do: 'click', target: 'Add' }, { do: 'hack', target: 'x' }, { do: 'wait', ms: '300' }, { do: 'expect_text', text: 'ok' }] }, { id: 'T1', name: 'dup', steps: [{ do: 'expect_text', text: 'hi' }] }, { name: 'empty', steps: [] }] });
  assert.ok(t.length === 2 && t[0].steps.length === 3 && t[0].steps[1].ms === 300 && t[1].id !== 'T1', 'unknown steps dropped, numbers coerced, duplicate ids made unique, empty tests removed');

  // Degenerate steps from the first live run.
  const d = T.normalizeTests({ tests: [
    { id: 'T1', name: 'blank', steps: [{ do: 'type', target: 'New task', text: '   ' }, { do: 'press', key: 'Enter', count: 1 }, { do: 'expect_no_text', text: '   ' }, { do: 'expect_count', target: 'li', count: 2 }] },
    { id: 'T2', name: 'checks nothing', steps: [{ do: 'click', target: 'Add' }] },
    { id: 'T3', name: 'no target', steps: [{ do: 'click' }, { do: 'expect_text', text: 'ok' }, { do: 'expect_match', pattern: '([' }] },
  ] });
  assert.ok(d[0]?.steps.length === 3 && !d[0].steps.some(s => s.do === 'expect_no_text') && !('count' in d[0].steps[1]) && d[0].steps[0].text === '   ', 'blank expected text and stray fields are dropped');
  assert.ok(d.length === 2 && d[1].id === 'T3' && d[1].steps.length === 1, 'a test that checks nothing is removed; missing targets and bad patterns dropped');
});

test('acceptance loop end to end', async () => {
  const testsJson = JSON.stringify({
    requirements: [{ id: 'R1', text: 'Add tasks with the "New task" input and the "Add" button' }, { id: 'R2', text: 'Show "N left"' }],
    tests: [
      { id: 'T1', requirement: 'R1', name: 'Add a task', steps: [{ do: 'type', target: 'New task', text: 'Milk' }, { do: 'click', target: 'Add' }, { do: 'expect_text', text: 'Milk' }] },
      { id: 'T2', requirement: 'R2', name: 'Count', steps: [{ do: 'expect_text', text: '1 left' }] },
    ],
  });
  const prompts = [];
  let schemaSeen = null;
  const runModel = async (key, messages, opts) => {
    const user = messages[1].content;
    prompts.push({ key, user, opts });
    const task = taskOf(messages);
    if (key === 'arch') {
      if (task.includes('Turn the request and plan into a contract')) { schemaSeen = opts.jsonSchema; return `Here is the contract:\n${testsJson}`; }
      if (task.includes('Plan the application')) return 'GOAL: todo\nFEATURES:\n1. add\n2. count';
      if (task.includes('Sign off')) return 'APPROVED\nA todo app.';
      return 'APPROVE';
    }
    if (key === 'rev') return 'APPROVED\nLooks good.';
    // The developer also tries to rewrite the tests; that must be ignored.
    if (task.includes('Build the complete application')) return `${F}src/App.jsx\nexport default function App(){return null}\n${F}\n${F}.cybeni/acceptance.json\n{"tests":[]}\n${F}`;
    if (task.includes('failed with these problems')) return `${F}src/App.jsx\n<<<<<<< SEARCH\nexport default function App(){return null}\n=======\nexport default function App(){return 'fixed'}\n>>>>>>> REPLACE\n${F}`;
    return 'CHECKLIST: 2/2\nCLEAN';
  };
  const verify = async (files, opts) => {
    const fixed = (files.find(f => f.path === 'src/App.jsx')?.content || '').includes('fixed');
    return {
      errors: [],
      blank: false,
      tests: (opts.tests || []).map(t => ({ id: t.id, requirement: t.requirement, name: t.name, passed: fixed, failedStep: fixed ? -1 : 0, message: fixed ? '' : 'No field matching "New task". On screen: button "Go"' })),
    };
  };
  const out = await P.runPipeline({ request: 'a todo list app', mode: 'standard', roles: ROLES }, { runModel, verify });
  const testsFile = out.files.find(f => f.path === P.TESTS_PATH);
  assert.ok(schemaSeen?.properties?.tests, 'the contract is requested with a JSON schema');
  assert.equal(JSON.parse(testsFile.content).tests.length, 2, 'tests are saved and the developer cannot overwrite them');
  assert.ok(out.files.some(f => f.path === 'src/main.jsx') && out.changed.includes('index.html'), 'the build started from the React starter');
  const devBuild = prompts.find(p => p.key === 'dev' && p.user.includes('Build the complete application'));
  assert.ok(devBuild.user.includes('## Requirements') && devBuild.user.includes('## Acceptance tests') && devBuild.user.includes('type target "New task" text "Milk"') && devBuild.user.includes('## Starting point'), 'the developer sees requirements, the tests and the starter note');
  const repair = prompts.find(p => p.key === 'dev' && p.user.includes('failed with these problems'));
  assert.ok(repair.user.includes('Acceptance test T1 (R1) "Add a task" failed at step 1') && repair.user.includes('The tests are fixed'), 'a failing test becomes a concrete repair task');
  assert.ok(out.files.find(f => f.path === 'src/App.jsx').content.includes('fixed') && out.testResults.every(r => r.passed), 'the repair edit block was applied and the tests then pass');
  assert.ok(out.approved === true && out.requirements.length === 2, 'approved only after the tests pass');

  // The developer never fixes it: approval is withheld and the summary says why.
  const stubborn = async (key, messages, opts) => (key === 'dev' && taskOf(messages).includes('failed with these problems') ? 'I think it is fine.' : runModel(key, messages, opts));
  const bad = await P.runPipeline({ request: 'a todo list app', mode: 'standard', roles: ROLES }, { runModel: stubborn, verify });
  assert.ok(bad.approved === false && /Requirements check:[\s\S]*R1 FAILS/.test(bad.summary), 'failing tests overrule the models\' approval');

  // Quick mode on the finished project keeps the saved tests but does not run them.
  let quickTests = null;
  const quick = await P.runPipeline({ request: 'rename the button to Create', mode: 'quick', files: out.files, roles: ROLES },
    { runModel: async () => `${F}src/App.jsx\nexport default function App(){return 'fixed create'}\n${F}`, verify: async (f, o) => { quickTests = o.tests; return { errors: [], blank: false, tests: [] }; } });
  assert.ok(quick.files.some(f => f.path === P.TESTS_PATH) && Array.isArray(quickTests) && quickTests.length === 0, 'quick mode keeps saved tests but does not enforce them');
});

test('triage drops a wrong test; a stuck repair stops early', async () => {
  const contract = JSON.stringify({
    requirements: [{ id: 'R1', text: 'Add tasks' }, { id: 'R2', text: 'Count' }],
    tests: [
      { id: 'T1', requirement: 'R1', name: 'Add', steps: [{ do: 'expect_text', text: 'Milk' }] },
      { id: 'T2', requirement: 'R2', name: 'Impossible', steps: [{ do: 'expect_text', text: 'Unicorn mode' }] },
    ],
  });
  let triagePrompt = '';
  let repairs = 0;
  const make = (verdict) => async (key, messages) => {
    const task = taskOf(messages);
    if (task.includes('keep failing')) { triagePrompt = task; return JSON.stringify({ verdicts: [{ id: 'T2', verdict, reason: 'The request never mentions a unicorn mode.' }] }); }
    if (key === 'arch') {
      if (task.includes('Turn the request and plan into a contract')) return contract;
      if (task.includes('Plan the application')) return 'GOAL: x\nFEATURES:\n1. a';
      if (task.includes('Sign off')) return 'APPROVED\nDone.';
      return 'APPROVE';
    }
    if (key === 'rev') return 'APPROVED\nok';
    if (task.includes('failed with these problems')) { repairs++; return `${F}src/App.jsx\nexport default () => 'Milk v${repairs}'\n${F}`; }
    if (task.includes('Build the complete application')) return `${F}src/App.jsx\nexport default () => 'Milk'\n${F}`;
    return 'CHECKLIST: 1/1\nCLEAN';
  };
  const verify = async (files, opts) => ({ errors: [], blank: false, tests: (opts.tests || []).map(t => ({ id: t.id, requirement: t.requirement, name: t.name, passed: t.id === 'T1', failedStep: t.id === 'T1' ? -1 : 0, message: t.id === 'T1' ? '' : 'the text "Unicorn mode" is not on the page' })) });

  const dropped = await P.runPipeline({ request: 'todo', mode: 'standard', roles: ROLES, maxFixRounds: 3 }, { runModel: make('test'), verify });
  assert.ok(triagePrompt.includes('T2 "Impossible"') && triagePrompt.includes('Unicorn mode'), 'the reviewer is asked about the test that will not pass');
  assert.ok(dropped.droppedTests.length === 1 && dropped.droppedTests[0].id === 'T2' && dropped.approved === true && dropped.tests.length === 1, 'a wrong test is dropped, reported, and no longer blocks approval');
  assert.equal(JSON.parse(dropped.files.find(f => f.path === P.TESTS_PATH).content).dropped?.[0]?.id, 'T2', 'the saved contract records the drop');

  repairs = 0;
  const stuck = await P.runPipeline({ request: 'todo', mode: 'standard', roles: ROLES, maxFixRounds: 5 }, { runModel: make('app'), verify });
  assert.ok(stuck.droppedTests.length === 0 && stuck.approved === false, 'when the reviewer says the app is wrong, the test stays and approval is withheld');
  assert.ok(repairs < 10, `repairs stop early (${repairs} passes; the limit would be 10)`);
});

test('model fallback and approval rules (baseline benchmark run)', async () => {
  assert.deepEqual(P.modelsFor('reviewer', ROLES), ['rev', 'arch'], 'a reviewer never falls back to the developer model');
  assert.deepEqual(P.modelsFor('architect', ROLES), ['arch', 'rev', 'dev']);
  assert.ok(P.isUnavailable(new Error('llama-server process has terminated: exit status 1\nerror loading model: unable to allocate CPU buffer')));
  assert.ok(P.isUnavailable(new Error('Engine protocol predict request failed: fetch failed')));
  assert.ok(!P.isUnavailable(new Error('400 invalid json_schema')), 'a bad request is not a load failure');

  const contract = JSON.stringify({ requirements: [{ id: 'R1', text: 'Add' }], tests: [{ id: 'T1', requirement: 'R1', name: 'Add', steps: [{ do: 'expect_text', text: 'Milk' }] }] });
  const calls = [];
  const logs = [];
  const runModel = async (key, messages) => {
    calls.push(key);
    if (key === 'arch') throw new Error('llama-server process has terminated: exit status 1\nerror loading model: unable to allocate CPU buffer');
    const task = taskOf(messages);
    if (task.includes('Turn the request and plan into a contract')) return contract;
    if (task.includes('Plan the application')) return 'GOAL: x\nFEATURES:\n1. a';
    if (task.includes('Sign off')) return 'APPROVED\nDone.';
    if (task.includes('Build the complete application')) return `${F}src/App.jsx\nexport default () => 'Milk'\n${F}`;
    if (key === 'rev') return 'APPROVED\nok';
    return 'CHECKLIST: 1/1\nCLEAN';
  };
  const verify = async (files, opts) => ({ errors: [], blank: false, tests: (opts.tests || []).map(t => ({ id: t.id, requirement: t.requirement, name: t.name, passed: true, failedStep: -1, message: '' })) });
  const out = await P.runPipeline({ request: 'todo', mode: 'standard', roles: ROLES }, { runModel, verify, onLog: t => logs.push(t) });
  assert.ok(out.tests.length === 1 && out.plan.includes('GOAL'), 'the plan and contract are still written when the architect cannot load');
  assert.equal(calls.filter(k => k === 'arch').length, 1, 'the dead model is tried once, then skipped');
  assert.ok(logs.some(l => /arch could not run .*architect role continues on rev/.test(l)) && out.approved === true && out.stats.fallbacks === 1, 'the switch is logged and the build approved');

  // Every model down for the sign-off: no approval (the expense tracker was approved this way).
  const down = async (key, messages) => {
    if (taskOf(messages).includes('Sign off')) throw new Error('fetch failed');
    return runModel(key === 'arch' ? 'rev' : key, messages);
  };
  const noSignOff = await P.runPipeline({ request: 'todo', mode: 'standard', roles: ROLES }, { runModel: down, verify });
  assert.ok(noSignOff.approved === false && noSignOff.unreviewed.includes('final-review'), 'a failed sign-off withholds approval');

  // Inspection approved, but the preview still shows an error.
  const broken = async (files, opts) => ({ errors: ["Uncaught SyntaxError: Unexpected token '<' (line 74)"], blank: true, tests: (opts.tests || []).map(t => ({ id: t.id, name: t.name, passed: false, failedStep: 0, message: 'The app never loaded.' })) });
  const blankApp = await P.runPipeline({ request: 'todo', mode: 'standard', roles: ROLES, maxFixRounds: 1 }, { runModel: (k, m) => runModel(k === 'arch' ? 'rev' : k, m), verify: broken });
  assert.ok(blankApp.approved === false && blankApp.runtimeClean === false, 'a blank page with errors is never approved');

  // Only the developer's own model is left for review: no review, so no approval.
  let signOff = '';
  const solo = await P.runPipeline({ request: 'Notes app', mode: 'standard', roles: { architect: 'dev', developer: 'dev', designer: 'dev', reviewer: 'rev' } }, {
    runModel: async (key, messages) => {
      const task = taskOf(messages);
      if (key === 'rev') throw new Error('Failed to load model "google/gemma-4-31b-qat". Error: Model loading was stopped due to insufficient system resources.');
      if (task.includes('Sign off')) { signOff = task; return 'APPROVED\nAll done.'; }
      if (task.includes('Turn the request and plan into a contract')) return contract;
      if (task.includes('Plan the application')) return 'FEATURES:\n1. Notes';
      if (task.includes('Build the complete application')) return `${F}src/App.jsx\nexport default () => 'Milk'\n${F}`;
      return 'CLEAN';
    },
    verify,
  });
  assert.ok(solo.approved === false && solo.unreviewed.includes('cross-review') && solo.unreviewed.includes('inspection'), 'an unreviewed build is not approved');
  assert.match(signOff, /could not run, so no second model reviewed this build/, 'the sign-off is told the review did not run');
});
