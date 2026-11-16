// Surfaces in Node: the array-backed surface the engine tests run on.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ArraySurface, createSurface, setSurfaceFactory, MAX_SIDE } from '../../src/creative/surface.js';
import { surfaceCases } from './cases/surfaceCases.js';

beforeEach(() => setSurfaceFactory((w, h) => new ArraySurface(w, h)));

for (const [name, fn] of surfaceCases(createSurface, assert)) test(name, fn);

test('MAX_SIDE is 16384', () => assert.equal(MAX_SIDE, 16384));
