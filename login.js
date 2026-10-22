(() => {
  const base = window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;
  const form = document.querySelector('#loginForm');
  const screen = document.querySelector('#loginScreen');
  const app = document.querySelector('#appShell');
  const message = document.querySelector('#loginMessage');
  const submit = document.querySelector('#loginButton');
  let token = null;
  let onLogin = null;
  const sessionKey = 'ccn-login-token';

  // Restore only a refresh of this tab; a new navigation starts at the login screen.
  try {
    const navigation = window.performance?.getEntriesByType?.('navigation')?.[0];
    if (navigation?.type === 'reload') token = sessionStorage.getItem(sessionKey);
    else sessionStorage.removeItem(sessionKey);
  } catch {
    // Login remains available when this browser blocks session storage.
  }

  function revoke(previousToken) {
    if (!previousToken) return Promise.resolve();
    return fetch(`${base}/api/logout`, {
      method: 'POST', headers: { Authorization: `Bearer ${previousToken}` }, keepalive: true
    }).catch(() => {});
  }

  function lock() {
    const previous = token;
    token = null;
    try { sessionStorage.removeItem(sessionKey); } catch {}
    app.hidden = true;
    screen.hidden = false;
    form.reset();
    document.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close());
    return previous;
  }

  window.ccnAuth = {
    onLogin(handler) { onLogin = handler; },
    isAuthenticated() { return Boolean(token); },
    showApp() { screen.hidden = true; app.hidden = false; },
    async fetch(url, options = {}) {
      if (!token) throw new Error('Entre novamente para acessar o sistema.');
      const headers = new Headers(options.headers);
      headers.set('Authorization', `Bearer ${token}`);
      const response = await fetch(url, { ...options, headers, cache: 'no-store' });
      if (response.status === 401) {
        const previous = lock();
        void revoke(previous);
        window.location.reload();
        throw new Error('Sua sessão terminou. Entre novamente.');
      }
      return response;
    },
    async logout() {
      const previous = lock();
      await revoke(previous);
      window.location.reload();
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    submit.textContent = 'Entrando…';
    message.textContent = '';
    try {
      const response = await fetch(`${base}/api/login`, {
        method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.elements.username.value.trim(), password: form.elements.password.value })
      });
      // Clear both credentials immediately after sending, including failed attempts.
      form.reset();
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível entrar.');
      token = result.token;
      try { sessionStorage.setItem(sessionKey, token); } catch {}
      if (!onLogin) throw new Error('A página ainda está carregando. Tente novamente.');
      await onLogin();
    } catch (error) {
      const previous = lock();
      void revoke(previous);
      message.textContent = error.message === 'Failed to fetch'
        ? 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.' : error.message;
      form.elements.username.focus();
    } finally {
      submit.disabled = false;
      submit.textContent = 'Entrar';
    }
  });
  document.querySelector('#logoutButton').addEventListener('click', () => window.ccnAuth.logout());
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) window.location.reload();
  });
})();
