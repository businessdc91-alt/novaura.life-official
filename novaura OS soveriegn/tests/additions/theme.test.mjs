import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentTheme, subscribeTheme } from '../../src/services/additions/theme.js';

function fakeDocument(vars, theme = 'default') {
  const observers = [];
  const root = {
    attrs: { 'data-theme': theme },
    getAttribute(name) { return this.attrs[name] ?? null; },
    setAttribute(name, value) {
      this.attrs[name] = value;
      for (const o of observers) if (!o.off) o.fn([{ type: 'attributes', attributeName: name }]);
    },
  };
  class FakeObserver {
    constructor(fn) { this.fn = fn; observers.push(this); }
    observe(target, opts) { this.target = target; this.opts = opts; }
    disconnect() { this.off = true; }
  }
  return {
    vars,
    observers,
    documentElement: root,
    defaultView: {
      MutationObserver: FakeObserver,
      getComputedStyle: () => ({ getPropertyValue: (name) => (vars[name] != null ? ` ${vars[name]}` : '') }),
    },
  };
}

const DARK = {
  '--background': '0 0% 4%', '--foreground': '0 0% 98%', '--primary': '190 100% 50%', '--primary-foreground': '0 0% 4%',
  '--secondary': '270 70% 60%', '--accent': '320 80% 60%', '--card': '0 0% 7%', '--card-foreground': '0 0% 98%',
  '--muted': '0 0% 15%', '--muted-foreground': '0 0% 64%', '--border': '0 0% 18%', '--ring': '190 100% 50%',
  '--destructive': '0 84% 60%', '--success': '140 85% 45%', '--warning': '45 100% 50%',
};

test('the theme is read from the OS variables', () => {
  const t = currentTheme(fakeDocument(DARK, 'blue-night'));
  assert.equal(t.name, 'blue-night');
  assert.equal(t.mode, 'dark');
  assert.equal(t.colors.background, 'hsl(0 0% 4%)');
  assert.equal(t.colors.primaryForeground, 'hsl(0 0% 4%)');
  assert.equal(t.colors.warning, 'hsl(45 100% 50%)');
  assert.deepEqual(Object.keys(t.colors), [
    'background', 'foreground', 'primary', 'primaryForeground', 'secondary', 'accent', 'card', 'cardForeground',
    'muted', 'mutedForeground', 'border', 'ring', 'destructive', 'success', 'warning',
  ]);
  assert.equal(currentTheme(fakeDocument({ ...DARK, '--background': '0 0% 98%' }, 'light')).mode, 'light');
  assert.equal(currentTheme(fakeDocument({}, null)).mode, 'dark');
});

test('changes reach subscribers', () => {
  const doc = fakeDocument({ ...DARK });
  const seen = [];
  const off = subscribeTheme((t) => seen.push([t.name, t.mode]), doc);
  assert.deepEqual(doc.observers[0].opts.attributeFilter.includes('data-theme'), true);
  doc.vars['--background'] = '0 0% 96%';
  doc.documentElement.setAttribute('data-theme', 'light');
  assert.deepEqual(seen, [['light', 'light']]);
  off();
  doc.documentElement.setAttribute('data-theme', 'void');
  assert.equal(seen.length, 1);
});
