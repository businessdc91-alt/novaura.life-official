import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanNetworkOrigin, originOf } from '../../src/services/additions/network.js';

const CASES = readFileSync(new URL('./network-origins.cases.txt', import.meta.url), 'utf8');

test('every shared case is cleaned the same way as in Rust', () => {
  let checked = 0;
  for (const line of CASES.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    if (line.startsWith('ok ')) {
      const [input, clean] = line.slice(3).split(' => ');
      assert.equal(cleanNetworkOrigin(input), clean, line);
    } else if (line.startsWith('bad ')) {
      assert.equal(cleanNetworkOrigin(line.slice(4)), null, line);
    } else {
      assert.fail(`unreadable case line: ${line}`);
    }
    checked++;
  }
  assert.ok(checked >= 25, `only ${checked} cases read`);
});

test('originOf gives the origin of a blocked URL', () => {
  assert.equal(originOf('https://api.weather.gov/points?x=1'), 'https://api.weather.gov');
  assert.equal(originOf('wss://stream.example.org/live'), 'wss://stream.example.org');
  assert.equal(originOf('about:blank'), null);
  assert.equal(originOf('not a url'), null);
});

test('the inline (development) copy of ADDITION_CSP matches the golden file Rust is held to', async () => {
  const { additionCsp } = await import('../../src/services/additions/network.js');
  const golden = readFileSync(new URL('./addition-csp.golden.txt', import.meta.url), 'utf8');
  let network = null;
  let blocks = 0;
  for (const line of golden.split(/\r?\n/)) {
    if (line.startsWith('network:')) network = line.slice('network:'.length).trim().split(/\s+/).filter(Boolean);
    else if (line.startsWith('csp: ')) { assert.equal(additionCsp(network), line.slice(5)); blocks++; }
  }
  assert.equal(blocks, 2);
  assert.throws(() => additionCsp(['https://ok.example', 'http://bad']), /http:\/\/bad/);
});
