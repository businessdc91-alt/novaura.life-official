import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeTable } from './fakeTable.js';
import { createCatalog } from '../../src/services/aunlock/catalog.js';

function make() {
  return createCatalog({
    jobs: createFakeTable('id'),
    devices: createFakeTable('id'),
    provenance: createFakeTable('jobId'),
    certs: createFakeTable('id'),
    recovered: createFakeTable(['jobId', 'path']),
  });
}

test('a job round-trips and lists', async () => {
  const c = make();
  const job = await c.createJob({ now: () => 1000 });
  assert.match(job.id, /^job_1000_/);
  assert.equal(job.status, 'intake');
  assert.equal(job.createdAt, 1000);
  assert.equal(job.closedAt, null);
  assert.deepEqual(await c.getJob(job.id), job);
  assert.equal(await c.getJob('nope'), null);
  assert.deepEqual((await c.listJobs()).map((j) => j.id), [job.id]);
});

test('devices/provenance/certs/recovered attach to a job and read back by jobId', async () => {
  const c = make();
  const jobId = 'job_x';
  await c.putDevice({ id: 'dev_1', jobId, kind: 'laptop', serial: 'S1', updatedAt: 1 });
  await c.putProvenance({ jobId, authorization: 'receipt #5', operator: 'op' });
  await c.putCert({ id: 'cert_1', jobId, createdAt: 2 });
  await c.putRecovered({ jobId, path: 'photos/a.jpg', size: 100 });
  assert.deepEqual((await c.listDevices(jobId)).map((d) => d.id), ['dev_1']);
  assert.equal((await c.getProvenance(jobId)).authorization, 'receipt #5');
  assert.deepEqual((await c.listCerts(jobId)).map((x) => x.id), ['cert_1']);
  assert.deepEqual((await c.listRecovered(jobId)).map((r) => r.path), ['photos/a.jpg']);
});

test('deleteJobCascade removes the job and all of its attached rows', async () => {
  const c = make();
  const jobId = 'job_y';
  await c.putDevice({ id: 'dev_2', jobId, kind: 'phone', serial: 'S2', updatedAt: 1 });
  await c.putProvenance({ jobId, authorization: 'owner present' });
  await c.putCert({ id: 'cert_2', jobId, createdAt: 1 });
  await c.putRecovered({ jobId, path: 'f.txt', size: 1 });
  await c.putDevice({ id: 'dev_keep', jobId: 'other', kind: 'drive', serial: 'S3', updatedAt: 1 });
  await c.deleteJobCascade(jobId);
  assert.deepEqual(await c.listDevices(jobId), []);
  assert.equal(await c.getProvenance(jobId), null);
  assert.deepEqual(await c.listCerts(jobId), []);
  assert.deepEqual(await c.listRecovered(jobId), []);
  assert.deepEqual((await c.listDevices('other')).map((d) => d.id), ['dev_keep']);
});
