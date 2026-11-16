// The Nexus Arcade and Creator Storefront website templates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MULTIPAGE_TEMPLATES } from '../../src/services/templates/websiteTemplates.js';
import { ARCADE_GAMES, ARCADE_CATEGORIES } from '../../src/services/templates/arcadeManifest.js';
import { ARCADE_CORE_JS } from '../../src/services/templates/arcadeGamesEngine.js';
import { ARCADE_GAMES_IMPL_JS } from '../../src/services/templates/arcadeGamesImpl.js';
import { ARCADE_GAMES_PART2_JS } from '../../src/services/templates/arcadeGamesPart2.js';
import { ARCADE_GAMES_ACTION_JS } from '../../src/services/templates/arcadeGamesAction.js';
import { ARCADE_GAMES_EXTRA_JS } from '../../src/services/templates/arcadeGamesExtra.js';
import { extractTemplateFields, applyBuilderEdit } from '../../src/services/templates/builderEditBridge.js';

const arcade = MULTIPAGE_TEMPLATES.find(t => t.id === 'arcade');
const store = MULTIPAGE_TEMPLATES.find(t => t.id === 'storefront');

test('every game in the list has a starter, and every starter is in the list', () => {
  const ids = ARCADE_GAMES.map(g => g.id);
  assert.equal(new Set(ids).size, ids.length, 'game ids are unique');
  const starters = [...arcade.js.matchAll(/STARTERS\.(\w+) = function/g)].map(m => m[1]);
  assert.deepEqual([...starters].sort(), [...ids].sort());
  const cats = new Set(ARCADE_CATEGORIES.map(c => c.id));
  for (const g of ARCADE_GAMES) {
    assert.ok(cats.has(g.category), g.id + ' has a known category');
    for (const field of ['title', 'subtitle', 'icon', 'goal', 'controls', 'tip']) assert.ok(String(g[field] || '').trim(), g.id + ' has ' + field);
    assert.ok(Array.isArray(g.keywords) && g.keywords.length, g.id + ' has chat keywords');
  }
  assert.ok(ARCADE_GAMES.length >= 21);
  assert.match(arcade.name, new RegExp(String(ARCADE_GAMES.length)));
});

test('every element the arcade script looks up by id exists in the page', () => {
  const looked = new Set([...arcade.js.matchAll(/\$\('([\w-]+)'\)/g)].map(m => m[1]));
  assert.ok(looked.size > 10);
  for (const id of looked) assert.match(arcade.html, new RegExp('id="' + id + '"'), 'missing #' + id);
  for (const cls of ['page-section', 'nav-btn', 'cat-pill', 'chan-btn', 'av-option']) assert.match(arcade.html, new RegExp('class="' + cls), cls);
  for (const m of arcade.html.matchAll(/data-page="([\w-]+)"/g)) assert.match(arcade.html, new RegExp('id="page-' + m[1] + '"'), 'nav to ' + m[1]);
  for (const m of arcade.html.matchAll(/launchArcadeGame\('(\w+)'\)/g)) assert.ok(ARCADE_GAMES.some(g => g.id === m[1]), 'button launches ' + m[1]);
  for (const m of arcade.html.matchAll(/data-cat="(\w+)"/g)) assert.ok(m[1] === 'all' || ARCADE_CATEGORIES.some(c => c.id === m[1]), m[1]);
});

test('the script parts stay safe inside template strings', () => {
  // A backslash, backtick or dollar-brace inside these strings is eaten by the outer
  // template literal and quietly changes the page script.
  for (const [name, src] of Object.entries({ ARCADE_CORE_JS, ARCADE_GAMES_IMPL_JS, ARCADE_GAMES_PART2_JS, ARCADE_GAMES_ACTION_JS, ARCADE_GAMES_EXTRA_JS })) {
    assert.doesNotMatch(src, /[\\`]|\$\{/, name);
  }
  assert.doesNotThrow(() => new Function(arcade.js));
  assert.doesNotMatch(arcade.js, /<\/script|<!--/i);
  assert.match(arcade.js, /'use strict'/);
});

test('games use original names, not names of existing games', () => {
  const visible = ARCADE_GAMES.map(g => [g.title, g.subtitle, g.goal, g.controls, g.tip].join(' ')).join(' ') + ' ' + arcade.html + ' ' + arcade.name + ' ' + arcade.description;
  assert.doesNotMatch(visible, /galaga|arkanoid|frogger|pac-?man|space invaders|asteroids|tetris|connect ?4|connect four|centipede|othello|mastermind|wordle|minesweeper/i);
});

test('the lounge does not pretend other people are there', () => {
  // No made-up players, scores or conversations: the only other voices are the
  // labelled Arcade Guide bot and the arcade's own system notices.
  assert.doesNotMatch(arcade.js, /Valkyrie_Zero|Aura_Seeker|Cipher_Seven|Nova_Architect|Dr_Kaelen/);
  assert.match(arcade.js, /kind: 'bot'/);
  assert.match(arcade.html, /saved in this browser/);
});

test('game sessions are torn down: listeners go through S.on and the loop is cancelled', () => {
  const games = [ARCADE_GAMES_IMPL_JS, ARCADE_GAMES_PART2_JS, ARCADE_GAMES_ACTION_JS, ARCADE_GAMES_EXTRA_JS].join('\n');
  assert.doesNotMatch(games, /window\.addEventListener|requestAnimationFrame|setInterval/);
  assert.match(ARCADE_CORE_JS, /cancelAnimationFrame\(S\.raf\)/);
  assert.match(ARCADE_CORE_JS, /S\.cleanups\.forEach/);
});

test('the Quick Fill drawer can find and fill every blank and photo spot', () => {
  const fields = extractTemplateFields(arcade.html);
  assert.ok(fields.textFields.length >= 10, 'editable text');
  assert.ok(fields.imageSlots.length >= 3, 'photo spots');
  const patched = applyBuilderEdit(arcade.html, 't0', 'My Arcade');
  assert.match(patched, /contenteditable="true">My Arcade<\/div>/);
  const storeFields = extractTemplateFields(store.html);
  assert.ok(storeFields.imageSlots.length >= 7, 'hero plus one photo per product');
});

test('the storefront never claims an order went through', () => {
  assert.doesNotMatch(store.js + store.html + store.description, /order confirmed|receipt #|payment (received|complete)/i);
  assert.match(store.js, /no order has been placed/);
  assert.match(store.js, /function esc\(s\)/);
  // Products live in the page, so the shop owner can edit them in place.
  assert.equal((store.html.match(/class="shop-card"/g) || []).length, 6);
  assert.equal((store.html.match(/class="shop-price" contenteditable="true"/g) || []).length, 6);
  assert.doesNotThrow(() => new Function(store.js));
});
