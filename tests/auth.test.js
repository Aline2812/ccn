const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createAuth } = require('../auth');

async function fixture(t, options = {}) {
  let time = 1000;
  const credentials = { username: 'test-user', password: 'test-password-only-123' };
  const auth = createAuth({ ...credentials, now: () => time, ...options });
  const app = express();
  app.use(express.json());
  app.post('/login', auth.login);
  app.post('/logout', auth.logout);
  app.get('/private', auth.requireLogin, (req, res) => res.json({ protected: true }));
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    request: (route, options) => fetch(base + route, options),
    advance: (milliseconds) => { time += milliseconds; },
    login: (payload = credentials) => fetch(base + '/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    })
  };
}

test('login válido cria sessão sem cookies e logout revoga o token', async t => {
  const f = await fixture(t);
  const response = await f.login();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const { token } = await response.json();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  const headers = { Authorization: `Bearer ${token}` };
  assert.equal((await f.request('/private', { headers })).status, 200);
  assert.equal((await f.request('/logout', { method: 'POST', headers })).status, 204);
  assert.equal((await f.request('/private', { headers })).status, 401);
});

test('senha ou usuário incorreto não cria sessão', async t => {
  const f = await fixture(t);
  for (const payload of [
    { username: 'test-user', password: 'incorrect' },
    { username: 'other-user', password: 'test-password-only-123' },
    { username: {}, password: [] }
  ]) {
    const response = await f.login(payload);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).token, undefined);
  }
});

test('sem credenciais configuradas ou senha curta o acesso fica bloqueado', async t => {
  for (const options of [{ username: '', password: '' }, { password: 'short' }]) {
    const f = await fixture(t, options);
    assert.equal((await f.login()).status, 503);
    assert.equal((await f.request('/private')).status, 401);
  }
});

test('sessão expira após quatro horas e nova abertura sem token exige login', async t => {
  const f = await fixture(t);
  const { token } = await (await f.login()).json();
  const headers = { Authorization: `Bearer ${token}` };
  assert.equal((await f.request('/private')).status, 401);
  assert.equal((await f.request(`/private?token=${token}`)).status, 401);
  assert.equal((await f.request('/private', { headers: { Cookie: `session=${token}` } })).status, 401);
  assert.equal((await f.request('/private', { headers })).status, 200);
  f.advance(4 * 60 * 60 * 1000);
  assert.equal((await f.request('/private', { headers })).status, 401);
});

test('tentativas incorretas são limitadas e liberadas após quinze minutos', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 5; i++) {
    assert.equal((await f.login({ username: 'test-user', password: 'incorrect' })).status, 401);
  }
  const limited = await f.login();
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  f.advance(15 * 60 * 1000);
  assert.equal((await f.login()).status, 200);
});

test('sair de uma página não encerra a sessão independente de outro aparelho', async t => {
  const f = await fixture(t);
  const first = await (await f.login()).json();
  const second = await (await f.login()).json();
  assert.notEqual(first.token, second.token);
  await f.request('/logout', { method: 'POST', headers: { Authorization: `Bearer ${first.token}` } });
  assert.equal((await f.request('/private', { headers: { Authorization: `Bearer ${second.token}` } })).status, 200);
});
