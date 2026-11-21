import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeJobs } from '../../src/services/aunlock/panelModel.js';

test('describeJobs shows at most 3 tabs, newest first, each with its status', () => {
  const jobs = [
    { id: 'job_1_aaa', status: 'intake', createdAt: 1 },
    { id: 'job_2_bbb', status: 'recovered', createdAt: 2 },
    { id: 'job_3_ccc', status: 'done', createdAt: 3 },
    { id: 'job_4_ddd', status: 'intake', createdAt: 4 },
  ];
  const { tabs } = describeJobs(jobs);
  assert.equal(tabs.length, 3);
  assert.deepEqual(tabs.map((t) => t.id), ['job_4_ddd', 'job_3_ccc', 'job_2_bbb']);
  assert.equal(tabs[0].status, 'intake');
  assert.ok(tabs.every((t) => typeof t.title === 'string' && t.title.length > 0));
});

test('an empty catalog yields no tabs', () => {
  assert.deepEqual(describeJobs([]).tabs, []);
  assert.deepEqual(describeJobs().tabs, []);
});
