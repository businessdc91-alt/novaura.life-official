// benchmarks.js — A fixed suite for measuring Cybeni.
//
// Each benchmark is a request a typical user might make, with acceptance tests
// written here, by hand. The pipeline never sees these tests: it writes its own
// from the request, builds, and is then scored against these. So a model cannot
// grade itself, and a change to the pipeline (or a different set of models) can
// be compared run against run.
//
// The requests name their visible labels, the way a clear request would, so the
// scoring tests can find things without guessing. Like the pipeline's own tests,
// each one runs on a freshly loaded app and sets up everything it checks.

import { db } from '../../database/sovereignDatabase.js';
import { runPipeline } from './pipeline.js';

export const BENCHMARKS = [
  {
    id: 'todo', title: 'Todo list',
    request: 'A todo list. An input with placeholder "New task" and a button "Add" (pressing Enter in the input also adds). Each task shows its text, a checkbox to mark it done, and a "Delete" button. Show "N left" counting unfinished tasks. Tasks persist in localStorage.',
    tests: [
      { id: 'B1', name: 'Add with the button', steps: [{ do: 'type', target: 'New task', text: 'Buy milk' }, { do: 'click', target: 'Add' }, { do: 'expect_text', text: 'Buy milk' }, { do: 'expect_text', text: '1 left' }] },
      { id: 'B2', name: 'Add with Enter', steps: [{ do: 'type', target: 'New task', text: 'Buy milk' }, { do: 'click', target: 'Add' }, { do: 'type', target: 'New task', text: 'Walk the dog' }, { do: 'press', key: 'Enter', target: 'New task' }, { do: 'expect_text', text: 'Walk the dog' }, { do: 'expect_text', text: '2 left' }] },
      { id: 'B3', name: 'Delete', steps: [{ do: 'type', target: 'New task', text: 'Temporary' }, { do: 'click', target: 'Add' }, { do: 'expect_text', text: '1 left' }, { do: 'click', target: 'Delete' }, { do: 'expect_no_text', text: 'Temporary' }, { do: 'expect_text', text: '0 left' }] },
    ],
  },
  {
    id: 'counter', title: 'Counter with step',
    request: 'A counter that starts at 0, shown in a large heading, with buttons "+", "-" and "Reset". A number input labelled "Step" (default 1) sets how much + and - change the count.',
    tests: [
      { id: 'B1', name: 'Increment', steps: [{ do: 'click', target: '+' }, { do: 'click', target: '+' }, { do: 'expect_match', pattern: '(^|\\s)2(\\s|$)' }] },
      { id: 'B2', name: 'Step', steps: [{ do: 'type', target: 'Step', text: '5' }, { do: 'click', target: '+' }, { do: 'click', target: '+' }, { do: 'expect_match', pattern: '(^|\\s)10(\\s|$)' }, { do: 'click', target: '-' }, { do: 'expect_match', pattern: '(^|\\s)5(\\s|$)' }] },
      { id: 'B3', name: 'Reset', steps: [{ do: 'click', target: '+' }, { do: 'click', target: '+' }, { do: 'click', target: '+' }, { do: 'expect_match', pattern: '(^|\\s)3(\\s|$)' }, { do: 'click', target: 'Reset' }, { do: 'expect_match', pattern: '(^|\\s)0(\\s|$)' }] },
    ],
  },
  {
    id: 'temperature', title: 'Temperature converter',
    request: 'A temperature converter with two inputs labelled "Celsius" and "Fahrenheit". Typing in either one updates the other immediately, rounded to one decimal place (show whole numbers without decimals).',
    tests: [
      { id: 'B1', name: 'Celsius to Fahrenheit', steps: [{ do: 'type', target: 'Celsius', text: '100' }, { do: 'expect_value', target: 'Fahrenheit', text: '212' }] },
      { id: 'B2', name: 'Fahrenheit to Celsius', steps: [{ do: 'type', target: 'Fahrenheit', text: '32' }, { do: 'expect_value', target: 'Celsius', text: '0' }] },
    ],
  },
  {
    id: 'tip', title: 'Tip calculator',
    request: 'A tip calculator with number inputs labelled "Bill", "Tip %" and "People". Show "Tip: $X" (the total tip) and "Per person: $Y" (bill plus tip, split evenly), both with two decimals, updating as you type.',
    tests: [
      { id: 'B1', name: 'Split a bill', steps: [{ do: 'type', target: 'Bill', text: '100' }, { do: 'type', target: 'Tip %', text: '20' }, { do: 'type', target: 'People', text: '4' }, { do: 'expect_text', text: 'Tip: $20.00' }, { do: 'expect_text', text: 'Per person: $30.00' }] },
    ],
  },
  {
    id: 'notes', title: 'Notes with search',
    request: 'A notes app. Inputs labelled "Title" and "Note" and a button "Save note". Saved notes appear as cards showing their title and text. A search box with placeholder "Search" filters the cards by title or text.',
    tests: [
      { id: 'B1', name: 'Save two notes', steps: [{ do: 'type', target: 'Title', text: 'Groceries' }, { do: 'type', target: 'Note', text: 'milk and eggs' }, { do: 'click', target: 'Save note' }, { do: 'type', target: 'Title', text: 'Ideas' }, { do: 'type', target: 'Note', text: 'build a robot' }, { do: 'click', target: 'Save note' }, { do: 'expect_text', text: 'Groceries' }, { do: 'expect_text', text: 'build a robot' }] },
      { id: 'B2', name: 'Search filters', steps: [{ do: 'type', target: 'Title', text: 'Groceries' }, { do: 'type', target: 'Note', text: 'milk and eggs' }, { do: 'click', target: 'Save note' }, { do: 'type', target: 'Title', text: 'Ideas' }, { do: 'type', target: 'Note', text: 'build a robot' }, { do: 'click', target: 'Save note' }, { do: 'type', target: 'Search', text: 'robot' }, { do: 'expect_text', text: 'Ideas' }, { do: 'expect_no_text', text: 'milk and eggs' }] },
    ],
  },
  {
    id: 'quiz', title: 'Planet quiz',
    request: 'A 3-question multiple choice quiz, one question at a time, each answer a button. Q1 "Which planet is the largest?" answers Mars, Jupiter, Venus (Jupiter is right). Q2 "Which planet is closest to the Sun?" answers Mercury, Earth, Neptune (Mercury). Q3 "Which planet is known as the Red Planet?" answers Mars, Saturn, Uranus (Mars). After the last answer show "Score: N/3" and a "Restart" button.',
    tests: [
      { id: 'B1', name: 'Score', steps: [{ do: 'expect_text', text: 'Which planet is the largest?' }, { do: 'click', target: 'Jupiter' }, { do: 'click', target: 'Mercury' }, { do: 'click', target: 'Saturn' }, { do: 'expect_text', text: 'Score: 2/3' }] },
      { id: 'B2', name: 'Restart', steps: [{ do: 'click', target: 'Venus' }, { do: 'click', target: 'Earth' }, { do: 'click', target: 'Mars' }, { do: 'expect_text', text: 'Score: 1/3' }, { do: 'click', target: 'Restart' }, { do: 'expect_text', text: 'Which planet is the largest?' }] },
    ],
  },
  {
    id: 'dice', title: 'Dice roller',
    request: 'A dice roller: a "Roll" button shows "You rolled N" (N from 1 to 6) and adds the roll to a history list of the last 5 rolls; each history entry is an element with class "roll".',
    tests: [
      { id: 'B1', name: 'Roll', steps: [{ do: 'click', target: 'Roll' }, { do: 'expect_match', pattern: 'You rolled [1-6]\\b' }] },
      { id: 'B2', name: 'History', steps: [{ do: 'click', target: 'Roll' }, { do: 'click', target: 'Roll' }, { do: 'click', target: 'Roll' }, { do: 'expect_count', target: '.roll', count: 3 }] },
    ],
  },
  {
    id: 'kanban', title: 'Kanban board',
    request: 'A kanban board with three columns titled "To do", "Doing" and "Done". An input with placeholder "New card" and a button "Add card" add a card to "To do". Every card not in Done has a "Move →" button that moves it to the next column. Cards are elements with class "card".',
    tests: [
      { id: 'B1', name: 'Add a card', steps: [{ do: 'expect_text', text: 'Doing' }, { do: 'type', target: 'New card', text: 'Write spec' }, { do: 'click', target: 'Add card' }, { do: 'expect_count', target: '.card', count: 1 }] },
      { id: 'B2', name: 'Move to Done', steps: [{ do: 'type', target: 'New card', text: 'Write spec' }, { do: 'click', target: 'Add card' }, { do: 'click', target: 'Move →' }, { do: 'click', target: 'Move →' }, { do: 'expect_no_text', text: 'Move →' }, { do: 'expect_text', text: 'Write spec' }] },
    ],
  },
  {
    id: 'expenses', title: 'Expense tracker',
    request: 'An expense tracker. Inputs labelled "Description" and "Amount" and a button "Add expense". Expenses show in a list, and "Total: $X" shows the sum with two decimals.',
    tests: [
      { id: 'B1', name: 'Total', steps: [{ do: 'type', target: 'Description', text: 'Coffee' }, { do: 'type', target: 'Amount', text: '3.50' }, { do: 'click', target: 'Add expense' }, { do: 'type', target: 'Description', text: 'Lunch' }, { do: 'type', target: 'Amount', text: '12.25' }, { do: 'click', target: 'Add expense' }, { do: 'expect_text', text: 'Coffee' }, { do: 'expect_text', text: 'Total: $15.75' }] },
    ],
  },
  {
    id: 'snake', title: 'Snake game',
    request: 'A snake game on a canvas. The arrow keys steer the snake; eating food adds 1 to the score, shown as "Score: N". Space pauses and resumes, showing "Paused" while paused.',
    tests: [
      { id: 'B1', name: 'Canvas and score', steps: [{ do: 'expect_canvas' }, { do: 'expect_text', text: 'Score: 0' }] },
      { id: 'B2', name: 'Controls do not crash', steps: [{ do: 'press', key: 'ArrowUp' }, { do: 'press', key: 'ArrowLeft' }, { do: 'wait', ms: 300 }, { do: 'expect_canvas' }] },
      { id: 'B3', name: 'Pause', steps: [{ do: 'press', key: 'Space' }, { do: 'expect_text', text: 'Paused' }] },
    ],
  },
  {
    id: 'markdown', title: 'Markdown previewer',
    request: 'A markdown previewer: a textarea labelled "Markdown" and a live preview next to it that renders headings, bold, italic, lists and links as real HTML elements.',
    tests: [
      { id: 'B1', name: 'Renders', steps: [{ do: 'type', target: 'Markdown', text: '# Hello\n\nSome **bold** words\n\n- one\n- two' }, { do: 'expect_element', target: 'h1', text: 'Hello' }, { do: 'expect_element', target: 'strong', text: 'bold' }, { do: 'expect_count', target: 'li', min: 2 }] },
    ],
  },
  {
    id: 'signup', title: 'Validated sign-up form',
    request: 'A sign-up form with inputs labelled "Name", "Email" and "Password" and a "Sign up" button. On submit: an empty name shows "Name is required", an invalid email shows "Enter a valid email", and a password shorter than 8 characters shows "Password must be at least 8 characters". A valid form shows "Welcome, <name>!" instead of the form.',
    tests: [
      { id: 'B1', name: 'Errors', steps: [{ do: 'click', target: 'Sign up' }, { do: 'expect_text', text: 'Name is required' }] },
      { id: 'B2', name: 'Bad email and password', steps: [{ do: 'type', target: 'Name', text: 'Ada' }, { do: 'type', target: 'Email', text: 'ada-at-example' }, { do: 'type', target: 'Password', text: 'short' }, { do: 'click', target: 'Sign up' }, { do: 'expect_text', text: 'Enter a valid email' }, { do: 'expect_text', text: 'Password must be at least 8 characters' }] },
      { id: 'B3', name: 'Success', steps: [{ do: 'type', target: 'Name', text: 'Ada' }, { do: 'type', target: 'Email', text: 'ada@example.com' }, { do: 'type', target: 'Password', text: 'secret123' }, { do: 'click', target: 'Sign up' }, { do: 'expect_text', text: 'Welcome, Ada!' }] },
    ],
  },
  {
    id: 'tictactoe', title: 'Tic-tac-toe',
    request: 'Tic-tac-toe on a 3x3 grid of buttons with aria-labels "Cell 1" to "Cell 9" (left to right, top to bottom). X moves first, then O. Show "Winner: X", "Winner: O" or "Draw", and a "New game" button that clears the board.',
    tests: [
      { id: 'B1', name: 'X wins the top row', steps: [{ do: 'click', target: 'Cell 1' }, { do: 'click', target: 'Cell 4' }, { do: 'click', target: 'Cell 2' }, { do: 'click', target: 'Cell 5' }, { do: 'click', target: 'Cell 3' }, { do: 'expect_text', text: 'Winner: X' }] },
      { id: 'B2', name: 'New game', steps: [{ do: 'click', target: 'Cell 1' }, { do: 'click', target: 'Cell 4' }, { do: 'click', target: 'Cell 2' }, { do: 'click', target: 'Cell 5' }, { do: 'click', target: 'Cell 3' }, { do: 'expect_text', text: 'Winner: X' }, { do: 'click', target: 'New game' }, { do: 'expect_no_text', text: 'Winner: X' }] },
    ],
  },
  {
    id: 'calculator', title: 'Calculator',
    request: 'A calculator with buttons "0" to "9", "+", "-", "×", "÷", "=" and "C", and a display (an element with class "display") that starts at 0.',
    tests: [
      { id: 'B1', name: 'Add', steps: [{ do: 'click', target: '7' }, { do: 'click', target: '+' }, { do: 'click', target: '8' }, { do: 'click', target: '=' }, { do: 'expect_element', target: '.display', text: '15' }] },
      { id: 'B2', name: 'Multiply and clear', steps: [{ do: 'click', target: 'C' }, { do: 'click', target: '6' }, { do: 'click', target: '×' }, { do: 'click', target: '7' }, { do: 'click', target: '=' }, { do: 'expect_element', target: '.display', text: '42' }, { do: 'click', target: 'C' }, { do: 'expect_element', target: '.display', text: '0' }] },
    ],
  },
  {
    id: 'palette', title: 'Color palette generator',
    request: 'A color palette generator: a "Generate" button creates 5 color swatches (elements with class "swatch"), each showing its hex code such as #A1B2C3. A palette is shown when the page first loads too.',
    tests: [
      { id: 'B1', name: 'Five swatches', steps: [{ do: 'expect_count', target: '.swatch', count: 5 }, { do: 'expect_match', pattern: '#[0-9A-Fa-f]{6}' }] },
      { id: 'B2', name: 'Generate', steps: [{ do: 'click', target: 'Generate' }, { do: 'expect_count', target: '.swatch', count: 5 }] },
    ],
  },
];

const HISTORY_KEY = 'cybeni_benchmark_runs';

export async function benchmarkHistory() {
  return db.getSetting(HISTORY_KEY, []).catch(() => []);
}

async function saveRun(run) {
  const runs = await benchmarkHistory();
  await db.setSetting(HISTORY_KEY, [run, ...runs].slice(0, 30));
}

/**
 * Build every chosen benchmark with the pipeline, then score each with its own
 * fixed tests. hooks: { runModel, verify(files, {tests}), onProgress?(state), isCancelled?() }.
 * Returns the run: { at, mode, roles, results: [...], passed, total, solved, ms }.
 */
export async function runBenchmarks({ ids, mode = 'standard', roles, security = 'hardened', quality = 'strict' }, hooks) {
  const chosen = BENCHMARKS.filter(b => !ids?.length || ids.includes(b.id));
  const started = Date.now();
  const results = [];
  for (const [i, b] of chosen.entries()) {
    if (hooks.isCancelled?.()) break;
    hooks.onProgress?.({ index: i, count: chosen.length, id: b.id, title: b.title, stage: 'building' });
    const t0 = Date.now();
    let built;
    try {
      built = await runPipeline({ request: b.request, files: [], mode, roles, security, quality }, {
        runModel: hooks.runModel,
        verify: hooks.verify,
        isCancelled: hooks.isCancelled,
        onPhase: (phase, patch) => hooks.onProgress?.({ index: i, count: chosen.length, id: b.id, title: b.title, stage: 'building', phase, ...patch }),
      });
    } catch (err) {
      built = { status: 'failed', error: err.message, files: [] };
    }
    if (built.status === 'cancelled') break;
    hooks.onProgress?.({ index: i, count: chosen.length, id: b.id, title: b.title, stage: 'scoring' });
    let score = { errors: [], tests: [] };
    if (built.files?.length) {
      try { score = await hooks.verify(built.files, { tests: b.tests }); } catch (err) { score = { errors: [err.message], tests: [] }; }
    }
    const outcomes = b.tests.map(t => score.tests?.find(r => r.id === t.id) || { id: t.id, name: t.name, passed: false, message: built.error || 'Not run.' });
    results.push({
      id: b.id,
      title: b.title,
      passed: outcomes.filter(r => r.passed).length,
      total: b.tests.length,
      failures: outcomes.filter(r => !r.passed).map(r => `${r.name}: ${r.message}`.slice(0, 300)),
      runtimeErrors: (score.errors || []).length,
      approved: built.approved ?? null,
      ownTests: built.testResults ? `${built.testResults.filter(r => r.passed).length}/${built.tests.length}` : null,
      modelCalls: built.stats?.modelCalls || 0,
      ms: Date.now() - t0,
      status: built.status,
      files: built.files,
    });
    hooks.onProgress?.({ index: i, count: chosen.length, id: b.id, title: b.title, stage: 'done', result: results[results.length - 1] });
  }
  const run = {
    at: Date.now(),
    mode,
    roles,
    results: results.map(({ files: _files, ...r }) => r),
    passed: results.reduce((n, r) => n + r.passed, 0),
    total: results.reduce((n, r) => n + r.total, 0),
    solved: results.filter(r => r.passed === r.total).length,
    count: results.length,
    ms: Date.now() - started,
  };
  if (results.length) await saveRun(run).catch(() => {});
  return { ...run, builds: results.map(r => ({ id: r.id, files: r.files })) };
}
