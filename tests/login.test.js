const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../login.js'), 'utf8');
const sessionKey = 'ccn-login-token';

function page({ storage = new Map(), navigation = 'navigate', blocked = false } = {}) {
  const elements = new Map();
  const events = new Map();
  const requests = [];
  let reloads = 0;
  const element = (selector) => {
    if (!elements.has(selector)) elements.set(selector, {
      hidden: selector === '#appShell', textContent: '',
      handlers: {},
      addEventListener(event, handler) { this.handlers[event] = handler; }
    });
    return elements.get(selector);
  };
  const form = element('#loginForm');
  form.elements = { username: { value: 'test-user', focus() {} }, password: { value: 'test-password-only-123' } };
  form.reset = () => { form.elements.username.value = ''; form.elements.password.value = ''; };
  const window = {
    location: { protocol: 'http:', origin: 'http://localhost', reload() { reloads++; } },
    performance: { getEntriesByType: () => [{ type: navigation }] },
    addEventListener: (event, handler) => events.set(event, handler)
  };
  const sessionStorage = {
    getItem(key) { if (blocked) throw Error('blocked'); return storage.get(key) || null; },
    setItem(key, value) { if (blocked) throw Error('blocked'); storage.set(key, value); },
    removeItem(key) { if (blocked) throw Error('blocked'); storage.delete(key); }
  };
  vm.runInNewContext(source, {
    window, sessionStorage, Headers,
    document: { querySelector: element, querySelectorAll: () => [] },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ token: 'a'.repeat(43) }) };
    }
  });
  window.ccnAuth.onLogin(async () => window.ccnAuth.showApp());
  return { auth: window.ccnAuth, storage, requests, events, element,
    reloads: () => reloads,
    login: () => form.handlers.submit({ preventDefault() {} }) };
}

test('login mantém somente token na aba e atualização restaura acesso autenticado', async () => {
  const original = page();
  await original.login();
  assert.equal(original.auth.isAuthenticated(), true);
  assert.equal(original.storage.size, 1);
  assert.equal(original.storage.get(sessionKey), 'a'.repeat(43));
  assert.equal(original.element('#loginForm').elements.password.value, '');
  // pagehide also occurs on refresh and must not revoke the session.
  original.events.get('pagehide')?.({ persisted: false });
  assert.equal(original.requests.some(({ url }) => url.endsWith('/api/logout')), false);
  const refreshed = page({ storage: original.storage, navigation: 'reload' });
  assert.equal(refreshed.auth.isAuthenticated(), true);
  await refreshed.auth.fetch('/api/state');
  assert.equal(refreshed.requests[0].options.headers.get('Authorization'), `Bearer ${'a'.repeat(43)}`);
});

test('nova abertura e aba duplicada exigem login mesmo com armazenamento copiado', async () => {
  const original = page();
  await original.login();
  for (const navigation of ['navigate', 'back_forward']) {
    const reopened = page({ storage: new Map(original.storage), navigation });
    assert.equal(reopened.auth.isAuthenticated(), false);
    assert.equal(reopened.storage.has(sessionKey), false);
    await assert.rejects(reopened.auth.fetch('/api/state'), /Entre novamente/);
  }
  const closedAndOpened = page({ navigation: 'navigate' });
  assert.equal(closedAndOpened.auth.isAuthenticated(), false);
  assert.equal(original.auth.isAuthenticated(), true);
});

test('Sair remove token da aba e revoga sessão antes de recarregar', async () => {
  const current = page();
  await current.login();
  await current.auth.logout();
  assert.equal(current.auth.isAuthenticated(), false);
  assert.equal(current.storage.size, 0);
  assert.equal(current.requests.at(-1).url, 'http://localhost/api/logout');
  assert.equal(current.reloads(), 1);
  assert.equal(page({ storage: current.storage, navigation: 'reload' }).auth.isAuthenticated(), false);
});

test('armazenamento bloqueado permite login e saída sem falhar', async () => {
  const current = page({ blocked: true });
  await current.login();
  assert.equal(current.auth.isAuthenticated(), true);
  await current.auth.logout();
  assert.equal(current.auth.isAuthenticated(), false);
});
