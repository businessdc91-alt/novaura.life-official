// Desktop layout: bubbles, the tray drawer, migration and pruning.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../../src/services/desktopLayout.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
}

const APPS = [
  { id: 'files', category: 'core' }, { id: 'terminal', category: 'core' },
  { id: 'music', category: 'creator' }, { id: 'forge', category: 'creator' }, { id: 'resume', category: 'creator' },
  { id: 'crypto', category: 'finance' },
];
const REFS = APPS.map(a => `app:${a.id}`);

test('old icon positions migrate into the new layout', () => {
  const storage = memoryStorage({ 'novaura-desktop-icon-positions': JSON.stringify({ files: { x: 10, y: 20 }, junk: 'x' }) });
  const layout = L.loadLayout(storage);
  assert.deepEqual(layout.positions, { 'app:files': { x: 10, y: 20 } });
  assert.equal(layout.corner, 'bottom-right');
  L.saveLayout(layout, storage);
  assert.deepEqual(L.loadLayout(storage), layout);
});

test('a broken saved layout falls back to an empty one', () => {
  const layout = L.loadLayout(memoryStorage({ 'novaura-desktop-layout': '{not json' }));
  assert.deepEqual(layout, L.emptyLayout());
  const odd = L.loadLayout(memoryStorage({ 'novaura-desktop-layout': JSON.stringify({ groups: [{ id: 'g', items: ['a', 'a'] }], corner: 'nowhere' }) }));
  assert.deepEqual(odd.groups[0].items, ['a']);
  assert.equal(odd.corner, 'bottom-right');
});

test('an item lives in exactly one place: desktop, a bubble, or the tray', () => {
  let l = L.emptyLayout();
  const made = L.createGroup(l, { name: 'Core', items: ['app:files', 'app:terminal'] });
  l = made.layout;
  assert.deepEqual(L.placementOf(l, 'app:files'), { where: 'group', groupId: made.id });
  assert.deepEqual(L.looseRefs(l, REFS), ['app:music', 'app:forge', 'app:resume', 'app:crypto']);

  l = L.moveRefs(l, 'app:files', { to: 'drawer' });
  assert.deepEqual(L.placementOf(l, 'app:files'), { where: 'drawer' });
  assert.deepEqual(l.groups[0].items, ['app:terminal']);

  l = L.moveRefs(l, 'app:files', { to: 'desktop', x: 300, y: 40 });
  assert.deepEqual(L.placementOf(l, 'app:files'), { where: 'desktop' });
  assert.deepEqual(l.positions['app:files'], { x: 300, y: 40 });
  assert.equal(l.drawer.length, 0);

  l = L.moveRefs(l, 'app:music', { to: 'group', id: made.id, index: 0 });
  assert.deepEqual(l.groups[0].items, ['app:music', 'app:terminal']);
  assert.equal(L.moveRefs(l, 'app:music', { to: 'group', id: 'missing' }), l, 'unknown bubble leaves the layout alone');
});

test('dissolving a bubble returns its icons to the desktop', () => {
  let { layout: l, id } = L.createGroup(L.emptyLayout(), { name: 'Tmp', items: ['app:files'] });
  l = L.setPosition(l, 'app:files', 1, 2);
  l = L.dissolveGroup(l, id);
  assert.equal(l.groups.length, 0);
  assert.deepEqual(L.placementOf(l, 'app:files'), { where: 'desktop' });
  assert.equal(l.positions['app:files'], undefined, 'auto-placed again');
});

test('grouping by category makes collapsed bubbles for categories with 2+ loose apps', () => {
  let l = L.moveRefs(L.emptyLayout(), 'app:resume', { to: 'drawer' });
  l = L.groupAppsByCategory(l, APPS, { core: 'Core OS', creator: 'Creator Studio' });
  assert.deepEqual(l.groups.map(g => [g.name, g.items, g.collapsed]), [
    ['Core OS', ['app:files', 'app:terminal'], true],
    ['Creator Studio', ['app:music', 'app:forge'], true],
  ]);
  assert.deepEqual(L.looseRefs(l, REFS), ['app:crypto'], 'single-app categories stay loose');
  assert.deepEqual(l.drawer, ['app:resume'], 'tray items are left alone');
  // Running it again fills existing bubbles instead of duplicating them.
  l = L.moveRefs(l, 'app:files', { to: 'desktop' });
  l = L.moveRefs(l, 'app:terminal', { to: 'desktop' });
  l = L.groupAppsByCategory(l, APPS, { core: 'Core OS', creator: 'Creator Studio' });
  assert.equal(l.groups.filter(g => g.name === 'Core OS').length, 1);
});

test('pruning drops refs to documents that left the desktop', () => {
  let { layout: l } = L.createGroup(L.emptyLayout(), { items: ['doc:a', 'app:files'] });
  l = L.moveRefs(l, 'doc:b', { to: 'drawer' });
  l = L.setPosition(l, 'doc:c', 5, 5);
  l = L.pruneRefs(l, r => !r.startsWith('doc:') || r === 'doc:b');
  assert.deepEqual(l.groups[0].items, ['app:files']);
  assert.deepEqual(l.drawer, ['doc:b']);
  assert.deepEqual(l.positions, {});
});
