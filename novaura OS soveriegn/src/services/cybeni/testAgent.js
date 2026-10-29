// testAgent.js — Acceptance tests that run inside the Cybeni preview.
//
// Tests are plain JSON steps that act the way a person would: find things by
// their label, placeholder, button text or title, click, type, press keys, then
// check what is on screen. The architect writes them from the requirements
// before any code exists, the developer builds against them, and the preview
// runs them after every build, so "approved" means "it actually works".
//
// The agent below is injected into the preview page (its own origin, isolated
// from the OS) as source text, so it must stay self-contained: no imports and
// no references to anything outside the function.
//
// Step reference (the architect is told the same):
//   {"do":"click","target":"Add"}                  click a button, link or element
//   {"do":"type","target":"New task","text":"Milk"} replace an input's value
//   {"do":"press","key":"Enter","target":"New task"} key press (target optional)
//   {"do":"select","target":"Category","value":"Food"}
//   {"do":"wait","ms":500}                         up to 5000 ms
//   {"do":"expect_text","text":"Milk"}             visible somewhere on the page
//   {"do":"expect_no_text","text":"Milk"}
//   {"do":"expect_match","pattern":"Total: \\$?\\d+"} regular expression on page text
//   {"do":"expect_element","target":"h1","text":"Hello"} element exists (optionally with text)
//   {"do":"expect_value","target":"Result","text":"42"} an input's value contains text
//   {"do":"expect_count","target":".card","count":3} (or "min": 1)
//   {"do":"expect_canvas"}                         a canvas has been drawn on
// A target is matched against aria-label, placeholder, label text, title, name,
// button/link text and then any element text; a target starting with # . [ or
// a tag name like "h1" or "canvas" is used as a CSS selector first.

export const STEP_TYPES = ['click', 'type', 'press', 'select', 'wait', 'expect_text', 'expect_no_text', 'expect_match', 'expect_element', 'expect_value', 'expect_count', 'expect_canvas'];

/** JSON schema for a test list (used for structured output). */
export const TESTS_SCHEMA = {
  type: 'object',
  properties: {
    requirements: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, text: { type: 'string' } },
        required: ['id', 'text'],
        additionalProperties: false,
      },
    },
    tests: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          requirement: { type: 'string' },
          name: { type: 'string' },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                do: { type: 'string', enum: STEP_TYPES },
                target: { type: 'string' },
                text: { type: 'string' },
                key: { type: 'string' },
                value: { type: 'string' },
                pattern: { type: 'string' },
                ms: { type: 'number' },
                count: { type: 'number' },
                min: { type: 'number' },
              },
              required: ['do'],
              additionalProperties: false,
            },
          },
        },
        required: ['id', 'name', 'steps'],
        additionalProperties: false,
      },
    },
  },
  required: ['requirements', 'tests'],
  additionalProperties: false,
};

// The fields each step uses; anything else a model adds is dropped.
const STEP_FIELDS = {
  click: ['target'], type: ['target', 'text'], press: ['key', 'target'], select: ['target', 'value'], wait: ['ms'],
  expect_text: ['text'], expect_no_text: ['text'], expect_match: ['pattern'], expect_element: ['target', 'text'],
  expect_value: ['target', 'text'], expect_count: ['target', 'count', 'min'], expect_canvas: [],
};
const NUMERIC = new Set(['ms', 'count', 'min']);
const present = (v) => v !== undefined && v !== null && String(v).trim() !== '';

/** A cleaned step, or null when it could never mean anything (blank text, no target, bad pattern). */
function cleanStep(s) {
  if (!s || !STEP_TYPES.includes(s.do)) return null;
  const step = { do: s.do };
  for (const k of STEP_FIELDS[s.do]) {
    if (NUMERIC.has(k)) { if (present(s[k]) && Number.isFinite(Number(s[k]))) step[k] = Number(s[k]); }
    else if (k === 'text' && s.do === 'type' && s[k] !== undefined && s[k] !== null) step[k] = String(s[k]).slice(0, 300);
    else if (present(s[k])) step[k] = String(s[k]).slice(0, 300);
  }
  const needs = { click: ['target'], type: ['target'], select: ['target', 'value'], expect_text: ['text'], expect_no_text: ['text'], expect_match: ['pattern'], expect_element: ['target'], expect_value: ['target'], expect_count: ['target'] }[s.do] || [];
  if (needs.some(k => step[k] === undefined)) return null;
  if (step.pattern) { try { new RegExp(step.pattern); } catch { return null; } }
  return step;
}

/** Clean up a model-written test list: meaningful steps only, sane limits, unique ids. */
export function normalizeTests(raw) {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.tests) ? raw.tests : [];
  const out = [];
  const seen = new Set();
  for (const [i, t] of list.entries()) {
    if (!t || typeof t !== 'object' || !Array.isArray(t.steps)) continue;
    const steps = t.steps.map(cleanStep).filter(Boolean).slice(0, 30);
    // A test that checks nothing cannot tell a working app from a broken one.
    if (!steps.some(s => s.do.startsWith('expect_'))) continue;
    let id = String(t.id || `T${i + 1}`).slice(0, 12);
    while (seen.has(id)) id += "'";
    seen.add(id);
    out.push({ id, requirement: t.requirement ? String(t.requirement).slice(0, 12) : '', name: String(t.name || id).slice(0, 120), steps });
  }
  return out.slice(0, 25);
}

export function normalizeRequirements(raw) {
  const list = Array.isArray(raw?.requirements) ? raw.requirements : Array.isArray(raw) ? raw : [];
  return list
    .filter(r => r && r.text)
    .slice(0, 40)
    .map((r, i) => ({ id: String(r.id || `R${i + 1}`).slice(0, 12), text: String(r.text).slice(0, 400) }));
}

/** One line per step, for prompts and failure reports. */
export function describeStep(s) {
  const parts = [s.do];
  if (s.target) parts.push(`target "${s.target}"`);
  if (s.text !== undefined) parts.push(`text "${s.text}"`);
  if (s.key) parts.push(`key ${s.key}`);
  if (s.value !== undefined) parts.push(`value "${s.value}"`);
  if (s.pattern) parts.push(`pattern /${s.pattern}/`);
  if (s.count !== undefined) parts.push(`count ${s.count}`);
  if (s.min !== undefined) parts.push(`min ${s.min}`);
  if (s.ms !== undefined) parts.push(`${s.ms} ms`);
  return parts.join(' ');
}

// ── The in-page agent ───────────────────────────────────────────────────────

function cybeniTestAgent() {
  var w = window;
  var doc = document;
  var norm = function (s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var frame = function () { return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); }); };
  var settle = function () { return sleep(60).then(frame); };

  function visible(el) {
    if (!el || !el.getClientRects || !el.getClientRects().length) return false;
    var st = w.getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && Number(st.opacity) !== 0;
  }
  function pageText() {
    var t = doc.body ? doc.body.innerText : '';
    var vals = [];
    doc.querySelectorAll('input, textarea, select').forEach(function (el) {
      if (el.type !== 'password' && el.value) vals.push(el.value);
    });
    return norm(t + ' ' + vals.join(' '));
  }
  function labelText(el) {
    var out = [];
    if (el.id) {
      var l = doc.querySelector('label[for="' + (w.CSS && CSS.escape ? CSS.escape(el.id) : el.id) + '"]');
      if (l) out.push(l.innerText);
    }
    var wrap = el.closest && el.closest('label');
    if (wrap) out.push(wrap.innerText);
    var by = el.getAttribute && el.getAttribute('aria-labelledby');
    if (by) by.split(/\s+/).forEach(function (id) { var n = doc.getElementById(id); if (n) out.push(n.innerText); });
    return out.map(norm);
  }
  function names(el) {
    var n = [];
    ['aria-label', 'placeholder', 'title', 'name', 'alt', 'data-testid', 'id', 'value'].forEach(function (a) {
      var v = el.getAttribute && el.getAttribute(a);
      if (v && !(a === 'value' && /^(text|email|number|search|password|tel|url)?$/.test(el.type || '') && el.tagName === 'INPUT')) n.push(norm(v));
    });
    return n.concat(labelText(el));
  }
  var INTERACTIVE = 'button, a, input, textarea, select, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="menuitem"], [role="option"], [contenteditable="true"], summary, label, [onclick], [tabindex]';
  // "#id", ".class", "[attr]", or a lowercase element name ("strong", "li.item", "h1"):
  // a capitalised word ("Search", "Title") is a label, even if an element shares its name.
  var looksLikeSelector = function (t) {
    if (/^[#.[]/.test(t)) return true;
    var m = /^([a-z][a-z0-9]*)([\s.#[:>].*)?$/.exec(t);
    return Boolean(m) && !(doc.createElement(m[1]) instanceof HTMLUnknownElement);
  };

  // Generic control words: "checkbox", "the first checkbox", "slider", "dropdown".
  var CONTROL_WORDS = { checkbox: 'input[type="checkbox"], [role="checkbox"]', 'check box': 'input[type="checkbox"], [role="checkbox"]', radio: 'input[type="radio"], [role="radio"]', 'radio button': 'input[type="radio"], [role="radio"]', slider: 'input[type="range"], [role="slider"]', dropdown: 'select, [role="combobox"]', textbox: 'input:not([type]), input[type="text"], textarea', 'text field': 'input:not([type]), input[type="text"], textarea' };

  function find(target, opts) {
    opts = opts || {};
    var t = String(target || '').trim();
    if (!t) return null;
    var word = t.toLowerCase().replace(/^(the |a |an )?(first )?/, '');
    if (CONTROL_WORDS[word]) {
      var controls = [].slice.call(doc.querySelectorAll(CONTROL_WORDS[word])).filter(visible);
      if (controls.length) return controls[0];
    }
    if (looksLikeSelector(t)) {
      try {
        var all = [].slice.call(doc.querySelectorAll(t)).filter(visible);
        if (all.length) return all[0];
      } catch { /* not a selector after all */ }
    }
    var want = norm(t);
    var candidates = [].slice.call(doc.querySelectorAll(opts.field ? 'input, textarea, select, [contenteditable="true"]' : INTERACTIVE)).filter(visible);
    var exact = null, partial = null, textExact = null, textPartial = null;
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      var ns = names(el);
      if (!exact && ns.indexOf(want) >= 0) exact = el;
      if (!partial && ns.some(function (n) { return n && n.indexOf(want) >= 0; })) partial = el;
      if (!opts.field) {
        var txt = norm(el.innerText || el.textContent);
        if (!textExact && txt === want) textExact = el;
        if (!textPartial && txt && txt.indexOf(want) >= 0 && txt.length < want.length + 40) textPartial = el;
      }
    }
    var hit = exact || textExact || partial || textPartial;
    if (hit) return hit;
    if (opts.field) {
      // A field named by nearby text ("Amount" next to an input).
      var labels = [].slice.call(doc.querySelectorAll('label, span, div, p, td, th')).filter(function (n) { return visible(n) && norm(n.innerText) === want; });
      for (var j = 0; j < labels.length; j++) {
        var near = labels[j].parentElement && labels[j].parentElement.querySelector('input, textarea, select');
        if (near && visible(near)) return near;
      }
      return null;
    }
    // Any visible element whose own text matches (cards, cells, list items).
    var any = [].slice.call(doc.body.querySelectorAll('*')).filter(function (n) {
      return visible(n) && norm(n.innerText) === want;
    });
    if (any.length) return any[any.length - 1];
    return null;
  }

  function describeTargets() {
    var out = [];
    [].slice.call(doc.querySelectorAll('button, a, input, textarea, select, [role="button"]')).filter(visible).slice(0, 25).forEach(function (el) {
      var tag = el.tagName.toLowerCase();
      var label = el.getAttribute('aria-label') || el.getAttribute('placeholder') || (el.innerText || '').trim().slice(0, 30) || el.getAttribute('title') || el.getAttribute('name') || '';
      out.push(tag + (label ? ' "' + label.replace(/\s+/g, ' ') + '"' : ''));
    });
    return out.join(', ');
  }

  function setValue(el, value) {
    if (el.isContentEditable) {
      el.focus();
      el.textContent = value;
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      return;
    }
    var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    var setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    el.focus();
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function key(el, name) {
    var codes = { Enter: 13, Escape: 27, Tab: 9, Space: 32, ' ': 32, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Backspace: 8, Delete: 46 };
    var k = name === 'Space' ? ' ' : name;
    var init = { key: k, code: name.length === 1 ? 'Key' + name.toUpperCase() : name, keyCode: codes[name] || (name.length === 1 ? name.toUpperCase().charCodeAt(0) : 0), which: codes[name] || 0, bubbles: true, cancelable: true };
    var target = el || doc.activeElement || doc.body;
    var down = new KeyboardEvent('keydown', init);
    var allowed = target.dispatchEvent(down);
    if (k === 'Enter' || name.length === 1) target.dispatchEvent(new KeyboardEvent('keypress', init));
    target.dispatchEvent(new KeyboardEvent('keyup', init));
    // Browsers submit a form on Enter in a text field; synthetic events do not, so do it here.
    if (allowed && k === 'Enter' && target.form && /^(INPUT)$/.test(target.tagName)) {
      if (target.form.requestSubmit) target.form.requestSubmit(); else target.form.submit();
    }
  }

  function click(el) {
    if (el.disabled) throw new Error('"' + (el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40) + '" is disabled');
    if (el.scrollIntoView) el.scrollIntoView({ block: 'center' });
    var r = el.getBoundingClientRect();
    var opts = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach(function (type) {
      var E = type.indexOf('pointer') === 0 && w.PointerEvent ? PointerEvent : MouseEvent;
      el.dispatchEvent(new E(type, opts));
    });
    el.click();
  }

  function canvasDrawn() {
    var canvases = [].slice.call(doc.querySelectorAll('canvas')).filter(visible);
    for (var i = 0; i < canvases.length; i++) {
      var c = canvases[i];
      try {
        var ctx = c.getContext('2d');
        if (!ctx) return true; // a WebGL canvas: assume drawn if present and sized
        var data = ctx.getImageData(0, 0, c.width, c.height).data;
        var first = data[0] + ',' + data[1] + ',' + data[2] + ',' + data[3];
        var step = Math.max(4, Math.floor(data.length / 4 / 4000) * 4);
        for (var p = 0; p < data.length; p += step) {
          if (data[p] + ',' + data[p + 1] + ',' + data[p + 2] + ',' + data[p + 3] !== first) return true;
        }
      } catch { return true; }
    }
    return false;
  }

  // Poll an expectation: UI updates land a little after the event that caused them.
  function until(check, timeout) {
    var end = Date.now() + (timeout || 2500);
    return new Promise(function (resolve) {
      (function loop() {
        var r;
        try { r = check(); } catch (e) { r = { ok: false, why: e.message }; }
        if (r.ok || Date.now() > end) return resolve(r);
        setTimeout(loop, 100);
      })();
    });
  }

  async function step(s) {
    var d = s.do;
    if (d === 'wait') { await sleep(Math.min(5000, Math.max(0, Number(s.ms) || 300))); return; }
    if (d === 'click' || d === 'type' || d === 'select' || (d === 'press' && s.target)) {
      var field = d === 'type' || d === 'select';
      var found = await until(function () { var el = find(s.target, { field: field }); return el ? { ok: true, el: el } : { ok: false }; }, 2500);
      if (!found.ok) throw new Error('No ' + (field ? 'field' : 'element') + ' matching "' + s.target + '". On screen: ' + describeTargets());
      var el = found.el;
      if (d === 'click') click(el);
      else if (d === 'type') setValue(el, String(s.text == null ? '' : s.text));
      else if (d === 'select') {
        var want = norm(s.value);
        var opt = [].slice.call(el.options || []).find(function (o) { return norm(o.value) === want || norm(o.text) === want; });
        if (!opt) throw new Error('"' + s.target + '" has no option "' + s.value + '"');
        setValue(el, opt.value);
      } else { el.focus(); key(el, String(s.key || 'Enter')); }
      await settle();
      return;
    }
    if (d === 'press') { key(null, String(s.key || 'Enter')); await settle(); return; }
    var r;
    if (d === 'expect_text') r = await until(function () { return { ok: pageText().indexOf(norm(s.text)) >= 0, why: 'the text "' + s.text + '" is not on the page' }; });
    else if (d === 'expect_no_text') r = await until(function () { return { ok: pageText().indexOf(norm(s.text)) < 0, why: 'the text "' + s.text + '" is still on the page' }; });
    else if (d === 'expect_match') {
      var re;
      try { re = new RegExp(s.pattern, 'i'); } catch { throw new Error('Invalid pattern /' + s.pattern + '/'); }
      r = await until(function () { return { ok: re.test((doc.body.innerText || '').replace(/\s+/g, ' ')), why: 'nothing on the page matches /' + s.pattern + '/' }; });
    } else if (d === 'expect_element') {
      r = await until(function () {
        var el = find(s.target);
        if (!el) return { ok: false };
        return { ok: s.text == null || norm(el.innerText || el.value).indexOf(norm(s.text)) >= 0 };
      });
    } else if (d === 'expect_value') {
      r = await until(function () {
        var el = find(s.target, { field: true }) || find(s.target);
        if (!el) return { ok: false, why: 'no field "' + s.target + '"' };
        var v = 'value' in el && el.tagName !== 'BUTTON' ? el.value : el.innerText;
        return { ok: norm(v).indexOf(norm(s.text)) >= 0, why: 'value is "' + String(v).slice(0, 60) + '"' };
      });
    } else if (d === 'expect_count') {
      r = await until(function () {
        var n;
        try { n = [].slice.call(doc.querySelectorAll(s.target)).filter(visible).length; } catch { n = -1; }
        if (n < 0) {
          var want = norm(s.target);
          n = [].slice.call(doc.body.querySelectorAll('*')).filter(function (el) { return visible(el) && norm(el.innerText) === want; }).length;
        }
        var ok = s.count != null ? n === Number(s.count) : n >= Number(s.min == null ? 1 : s.min);
        return { ok: ok, why: 'found ' + n };
      });
    } else if (d === 'expect_canvas') r = await until(function () { return { ok: canvasDrawn(), why: 'no canvas has anything drawn on it' }; }, 3000);
    else throw new Error('Unknown step "' + d + '"');
    if (!r.ok) {
      var seen = (doc.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300);
      throw new Error((r.why ? r.why + '. ' : '') + 'Page shows: "' + seen + '"');
    }
  }

  async function runTests(tests) {
    var results = [];
    for (var i = 0; i < tests.length; i++) {
      var t = tests[i];
      var res = { id: t.id, requirement: t.requirement || '', name: t.name, passed: true, failedStep: -1, message: '' };
      var errors = [];
      var onErr = function (e) { errors.push(String(e.message || e.reason || e)); };
      w.addEventListener('error', onErr);
      w.addEventListener('unhandledrejection', onErr);
      try {
        for (var j = 0; j < t.steps.length; j++) {
          res.failedStep = j;
          await step(t.steps[j]);
          if (errors.length) throw new Error('The app threw an error: ' + errors[0]);
        }
        res.failedStep = -1;
      } catch (e) {
        res.passed = false;
        res.message = String(e && e.message || e).slice(0, 600);
      }
      w.removeEventListener('error', onErr);
      w.removeEventListener('unhandledrejection', onErr);
      results.push(res);
    }
    return results;
  }

  w.__cybeniRunTests = runTests;
  w.addEventListener('message', function (e) {
    if (e.source !== w.parent || !e.data || !e.data.__cybeniTests) return;
    runTests(e.data.tests || []).then(function (results) {
      if (w.__cybeniRestoreStorage) w.__cybeniRestoreStorage();
      w.parent.postMessage({ __cybeni: true, type: 'test-results', results: results }, '*');
    });
  });
}

export const TEST_AGENT_SOURCE = `(${cybeniTestAgent.toString()})();`;

// Runs first in a verification run: the app starts from empty storage, as a new
// user would see it, and the person's own preview data is put back afterwards.
export const STORAGE_ISOLATION_SOURCE = `(function(){
  if(!/[?&]cybeni-isolate=1/.test(location.search))return;
  try{
    var snap=function(s){var o={};for(var i=0;i<s.length;i++){var k=s.key(i);o[k]=s.getItem(k);}return o;};
    var keep={l:snap(localStorage),s:snap(sessionStorage)};
    localStorage.clear();sessionStorage.clear();
    var done=false;
    window.__cybeniRestoreStorage=function(){
      if(done)return;done=true;
      try{localStorage.clear();sessionStorage.clear();
        Object.keys(keep.l).forEach(function(k){localStorage.setItem(k,keep.l[k]);});
        Object.keys(keep.s).forEach(function(k){sessionStorage.setItem(k,keep.s[k]);});}catch(e){}
    };
    window.addEventListener('pagehide',window.__cybeniRestoreStorage);
  }catch(e){}
})();`;

/** Summaries of failed tests, written for the developer who has to fix them. */
export function failureProblems(results, tests) {
  return results.filter(r => !r.passed).map(r => {
    const t = tests.find(x => x.id === r.id);
    const s = t?.steps[r.failedStep];
    return `Acceptance test ${r.id}${r.requirement ? ` (${r.requirement})` : ''} "${r.name}" failed at step ${r.failedStep + 1}${s ? ` (${describeStep(s)})` : ''}: ${r.message}`;
  });
}
