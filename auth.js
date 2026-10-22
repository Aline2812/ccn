const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const digest = (value) => crypto.createHash('sha256').update(value).digest();

function createAuth({ username = process.env.LOGIN_USER, password = process.env.LOGIN_PASSWORD, now = Date.now } = {}) {
  const configured = typeof username === 'string' && username.trim() && typeof password === 'string' && password.length >= 12;
  const salt = crypto.randomBytes(16);
  const passwordHash = configured ? scrypt(password, salt, 64) : null;
  const sessions = new Set();
  const attempts = new Map();
  const attemptWindow = 15 * 60 * 1000;
  const tokenKey = (token) => digest(token).toString('hex');

  function prune() {
    for (const [ip, entry] of attempts) if (entry.expires <= now()) attempts.delete(ip);
  }

  function bearer(req) {
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.get('Authorization') || '');
    return match ? match[1] : null;
  }

  async function login(req, res) {
    res.set('Cache-Control', 'no-store');
    if (!configured) return res.status(503).json({ error: 'Acesso ainda não configurado. Contate o responsável pelo sistema.' });
    prune();
    const ip = req.ip;
    const entry = attempts.get(ip) || { count: 0, expires: now() + attemptWindow };
    if (entry.count >= 5) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((entry.expires - now()) / 1000))));
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' });
    }
    entry.count += 1;
    if (attempts.size >= 1000 && !attempts.has(ip)) attempts.delete(attempts.keys().next().value);
    attempts.set(ip, entry);
    const suppliedUser = req.body?.username;
    const suppliedPassword = req.body?.password;
    if (typeof suppliedUser !== 'string' || typeof suppliedPassword !== 'string' || suppliedUser.length > 100 || suppliedPassword.length > 256) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }
    try {
      const suppliedHash = await scrypt(suppliedPassword, salt, 64);
      const validPassword = crypto.timingSafeEqual(suppliedHash, await passwordHash);
      const validUser = crypto.timingSafeEqual(digest(suppliedUser.trim()), digest(username.trim()));
      if (!validPassword || !validUser) return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
      attempts.delete(ip);
      if (sessions.size >= 1000) sessions.delete(sessions.values().next().value);
      const token = crypto.randomBytes(32).toString('base64url');
      sessions.add(tokenKey(token));
      return res.json({ token });
    } catch {
      return res.status(503).json({ error: 'Não foi possível entrar. Tente novamente.' });
    }
  }

  function requireLogin(req, res, next) {
    res.set('Cache-Control', 'no-store');
    const token = bearer(req);
    const key = token && tokenKey(token);
    if (!key || !sessions.has(key)) {
      return res.status(401).json({ error: 'Entre com usuário e senha para acessar o sistema.' });
    }
    next();
  }

  function logout(req, res) {
    res.set('Cache-Control', 'no-store');
    const token = bearer(req);
    if (token) sessions.delete(tokenKey(token));
    res.sendStatus(204);
  }

  return { login, requireLogin, logout };
}

module.exports = { createAuth };
