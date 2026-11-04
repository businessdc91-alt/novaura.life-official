// Hugging Face repo listings -> model choices for the built-in AI (fixtures are real API responses).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groupGgufFiles, hfModelName } from '../../src/services/engines/hfGguf.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));

test('an official repo: one file per quant, vision files apart, speed-up helpers left out', () => {
  const { quants, vision } = groupGgufFiles(fixture('hf-gemma-4-26b-a4b'));
  assert.deepEqual(quants.map(q => q.quant), ['Q4_0', 'Q8_0', 'BF16']); // smallest first
  assert.equal(quants[0].files[0].path, 'gemma-4-26B-A4B-it-Q4_0.gguf');
  assert.equal(quants[0].files[0].sha256, 'd208665ab1cd3a69f7a9a4bc59430e8448c8093d9b06334f566ac59d6d504a03');
  assert.equal(quants[0].bytes, 14_618_145_824);
  assert.deepEqual(vision.map(v => v.path), ['mmproj-gemma-4-26B-A4B-it-Q8_0.gguf', 'mmproj-gemma-4-26B-A4B-it-BF16.gguf']);
  const all = quants.flatMap(q => q.files.map(f => f.path));
  assert.equal(all.some(p => /mtp|dflash/i.test(p)), false);
});

test('a community repo: UD and IQ quants, a split BF16 in a folder, MTP folder skipped', () => {
  const { quants, vision } = groupGgufFiles(fixture('hf-unsloth-gemma-4-31b'));
  const names = quants.map(q => q.quant);
  for (const q of ['Q4_K_M', 'UD-Q4_K_XL', 'IQ4_XS', 'UD-IQ2_XXS', 'Q8_0', 'BF16']) assert.ok(names.includes(q), q);
  const bf16 = quants.find(q => q.quant === 'BF16');
  assert.deepEqual(bf16.files.map(f => f.path), ['BF16/gemma-4-31B-it-BF16-00001-of-00002.gguf', 'BF16/gemma-4-31B-it-BF16-00002-of-00002.gguf']);
  assert.ok(Math.abs(bf16.bytes - 61.5e9) < 1e9);
  assert.equal(quants.some(q => q.files.some(f => /(^|\/)mtp/i.test(f.path))), false);
  assert.deepEqual(vision.map(v => v.path), ['mmproj-F16.gguf', 'mmproj-BF16.gguf', 'mmproj-F32.gguf'].sort((a, b) => vision.find(v => v.path === a).bytes - vision.find(v => v.path === b).bytes));
});

test('a repo of split models only: each quant is one choice with all its parts', () => {
  const { quants } = groupGgufFiles(fixture('hf-unsloth-qwen3-235b'));
  const q4 = quants.find(q => q.quant === 'Q4_0');
  assert.equal(q4.files.length, 3);
  assert.ok(q4.files.every((f, i) => f.path.endsWith(`-0000${i + 1}-of-00003.gguf`)));
  // A split set with a part missing is not offered.
  const tree = fixture('hf-unsloth-qwen3-235b').filter(f => !/Q4_0-00002-of-00003/.test(f.path));
  assert.equal(groupGgufFiles(tree).quants.some(q => q.quant === 'Q4_0'), false);
});

test('folder names for downloaded models', () => {
  assert.equal(hfModelName('unsloth/gemma-4-31B-it-GGUF', 'UD-Q4_K_XL'), 'gemma-4-31B-it-UD-Q4_K_XL');
  assert.equal(hfModelName('ggml-org/gemma-4-E4B-it-GGUF', 'Q4_0'), 'gemma-4-E4B-it-Q4_0');
  assert.equal(hfModelName('someone/My Model (v2)', 'Q8_0'), 'My-Model-v2-Q8_0');
  assert.match(hfModelName('a/.hidden', ''), /^[A-Za-z0-9]/);
  assert.ok(hfModelName('a/' + 'x'.repeat(200), 'Q4').length <= 80);
});
