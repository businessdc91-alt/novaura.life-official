// The additions contract: every novaura v1 method an addition can call, and every
// path that must be refused. Runs against the real bridge in Node (contract.test.mjs)
// and inside a real addition frame in the browser (fixture-app/app.js). If an OS
// change breaks what additions rely on, this fails and the release with it.
// Plain JavaScript with no imports, so it can be published into an addition as is.

export async function runChecks(novaura, { localStorage }) {
  const results = [];
  const check = async (name, fn) => {
    try {
      const detail = await fn();
      results.push({ name, ok: true, detail: detail == null ? '' : String(detail) });
    } catch (err) {
      results.push({ name, ok: false, detail: String((err && err.message) || err) });
    }
  };
  const expect = (cond, message) => {
    if (!cond) throw new Error(message);
  };
  const denied = (name, fn) =>
    check(`${name} is refused without permission`, async () => {
      try {
        await fn();
      } catch (err) {
        expect(err && err.code === 'permission_denied', `rejected with ${err && err.code}`);
        return 'permission_denied';
      }
      throw new Error('it was allowed');
    });

  await check('novaura.version is 1', () => expect(novaura.version === 1, `version is ${novaura.version}`));
  await check('novaura.app has id, name, version and permissions', () => {
    const a = novaura.app;
    expect(a && typeof a.id === 'string' && typeof a.name === 'string' && typeof a.version === 'string' && Array.isArray(a.permissions), JSON.stringify(a));
    return a.id;
  });
  await check('storage.set then storage.get', async () => {
    await novaura.storage.set('contract:value', { n: 1, text: 'héllo' });
    const v = await novaura.storage.get('contract:value');
    expect(v && v.n === 1 && v.text === 'héllo', JSON.stringify(v));
  });
  await check('storage.keys lists it', async () => {
    const keys = await novaura.storage.keys();
    expect(Array.isArray(keys) && keys.includes('contract:value'), JSON.stringify(keys));
  });
  await check('storage.usage counts it', async () => {
    const used = await novaura.storage.usage();
    expect(typeof used === 'number' && used > 0, `usage ${used}`);
    return used;
  });
  await check('storage.remove removes it', async () => {
    await novaura.storage.remove('contract:value');
    expect((await novaura.storage.get('contract:value')) === undefined, 'still there');
  });
  await check('localStorage set and get', () => {
    localStorage.setItem('contract', 'yes');
    expect(localStorage.getItem('contract') === 'yes', localStorage.getItem('contract'));
  });
  await check('ui.theme has a mode', async () => {
    const t = await novaura.ui.theme();
    expect(t && (t.mode === 'light' || t.mode === 'dark'), JSON.stringify(t));
    return t.mode;
  });
  await check('ui.setTitle resolves', () => novaura.ui.setTitle('Contract fixture'));
  await denied('notify', () => novaura.notify({ title: 'Hello', body: 'from the contract fixture' }));
  await denied('ai.chat', () => novaura.ai.chat([{ role: 'user', content: 'hi' }]));
  await denied('files.open', () => novaura.files.open({ accept: '.txt' }));
  await denied('files.save', () => novaura.files.save('contract.txt', 'text'));
  return results;
}
