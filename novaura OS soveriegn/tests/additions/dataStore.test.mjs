import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeTable } from './fakeTable.js';
import { createAdditionData, sizeOf } from '../../src/services/additions/dataStore.js';
import { LOCAL_STORAGE_LIMIT_BYTES } from '../../src/services/additions/limits.js';

const fresh = () => {
  const table = createFakeTable();
  return { table, data: createAdditionData(table) };
};

test("two additions never see each other's data", async () => {
  const { data } = fresh();
  await data.set('user_a', 'notes', 'from a');
  await data.writeLocalStorage('user_a', [{ op: 'set', key: 'theme', value: 'dark' }]);
  assert.equal(await data.get('user_b', 'notes'), undefined);
  assert.deepEqual(await data.keys('user_b'), []);
  assert.deepEqual(await data.snapshotLocalStorage('user_b'), {});
  assert.equal(await data.get('user_a', 'notes'), 'from a');
});

test('the localStorage snapshot holds only localStorage keys', async () => {
  const { data } = fresh();
  await data.set('user_a', 'big', 'stored value');
  await data.writeLocalStorage('user_a', [
    { op: 'set', key: 'theme', value: 'dark' },
    { op: 'set', key: 'count', value: 3 },
  ]);
  assert.deepEqual(await data.snapshotLocalStorage('user_a'), { theme: 'dark', count: '3' });
  assert.deepEqual(await data.keys('user_a'), ['big']);
});

test("clear removes only this app's localStorage keys", async () => {
  const { data } = fresh();
  await data.set('user_a', 'kept', 1);
  await data.writeLocalStorage('user_a', [{ op: 'set', key: 'x', value: '1' }]);
  await data.writeLocalStorage('user_b', [{ op: 'set', key: 'x', value: '2' }]);
  await data.writeLocalStorage('user_a', [{ op: 'clear' }, { op: 'set', key: 'after', value: 'yes' }, { op: 'remove', key: 'nothing' }]);
  assert.deepEqual(await data.snapshotLocalStorage('user_a'), { after: 'yes' });
  assert.deepEqual(await data.snapshotLocalStorage('user_b'), { x: '2' });
  assert.equal(await data.get('user_a', 'kept'), 1);
});

test('a write over the quota is refused and the old value stays', async () => {
  const { data } = fresh();
  await data.set('user_a', 'k', 'small', { quotaBytes: 100 });
  await assert.rejects(data.set('user_a', 'k', 'x'.repeat(200), { quotaBytes: 100 }), (err) => err.code === 'quota_exceeded');
  assert.equal(await data.get('user_a', 'k'), 'small');
  await assert.rejects(
    data.writeLocalStorage('user_a', [{ op: 'set', key: 'ls', value: 'y'.repeat(200) }], { quotaBytes: 100 }),
    (err) => err.code === 'quota_exceeded',
  );
  assert.deepEqual(await data.snapshotLocalStorage('user_a'), {});
});

test('localStorage past its 64 MB limit is refused even under the quota', async () => {
  const { data } = fresh();
  const big = 'z'.repeat(LOCAL_STORAGE_LIMIT_BYTES);
  await assert.rejects(data.writeLocalStorage('user_a', [{ op: 'set', key: 'k', value: big }]), (err) => err.code === 'quota_exceeded');
  assert.deepEqual(await data.snapshotLocalStorage('user_a'), {});
});

test('usage adds up both kinds of data', async () => {
  const { table, data } = fresh();
  assert.equal(await data.usage('user_a'), 0);
  await data.set('user_a', 'blob', new Uint8Array(1000).buffer);
  await data.writeLocalStorage('user_a', [{ op: 'set', key: 'k', value: 'héllo' }]);
  const expected = 1000 + sizeOf('blob') + sizeOf('héllo') + sizeOf('k');
  assert.equal(await data.usage('user_a'), expected);
  await data.remove('user_a', 'blob');
  assert.equal(await data.usage('user_a'), sizeOf('héllo') + sizeOf('k'));
  // A new store over the same table works it out from the rows.
  const again = createAdditionData(table);
  assert.equal(await again.usage('user_a'), sizeOf('héllo') + sizeOf('k'));
});

test('sizeOf counts UTF-8 bytes, binary lengths and blob sizes', () => {
  assert.equal(sizeOf('abc'), 3);
  assert.equal(sizeOf('é'), 2);
  assert.equal(sizeOf('😀'), 4);
  assert.equal(sizeOf(new Uint8Array(7)), 7);
  assert.equal(sizeOf(new Blob(['12345'])), 5);
  assert.equal(sizeOf(null), 0);
});

test('clearApp leaves other additions alone', async () => {
  const { data } = fresh();
  await data.set('user_a', 'k', 'a');
  await data.set('user_b', 'k', 'b');
  await data.clearApp('user_a');
  assert.equal(await data.get('user_a', 'k'), undefined);
  assert.equal(await data.usage('user_a'), 0);
  assert.equal(await data.get('user_b', 'k'), 'b');
});
