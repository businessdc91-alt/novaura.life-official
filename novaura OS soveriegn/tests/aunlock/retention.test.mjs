import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jobsToPurge } from '../../src/services/aunlock/retention.js';

const DAY = 864e5;

test('a job older than 10 days is purged', () => {
  const now = () => 100 * DAY;
  const jobs = [{ id: 'old', createdAt: 80 * DAY }, { id: 'new', createdAt: 99 * DAY }];
  assert.deepEqual(jobsToPurge(jobs, { now }), ['old']);
});

test('with four jobs the oldest is purged and three remain', () => {
  const now = () => 1000;
  const jobs = [
    { id: 'a', createdAt: 1 }, { id: 'b', createdAt: 2 }, { id: 'c', createdAt: 3 }, { id: 'd', createdAt: 4 },
  ];
  assert.deepEqual(jobsToPurge(jobs, { now }), ['a']);
});

test('expiry and the 3-job cap combine without double-listing an id', () => {
  const now = () => 100 * DAY;
  const jobs = [
    { id: 'e1', createdAt: 10 * DAY }, // 90 days old -> expired
    { id: 'e2', createdAt: 85 * DAY }, // 15 days old -> expired
    { id: 'k1', createdAt: 95 * DAY },
    { id: 'k2', createdAt: 96 * DAY },
    { id: 'k3', createdAt: 97 * DAY },
    { id: 'k4', createdAt: 98 * DAY },
  ];
  assert.deepEqual(jobsToPurge(jobs, { now }), ['e1', 'e2', 'k1']);
});
