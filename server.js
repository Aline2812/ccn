const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const util = require('util');

util.isArray = Array.isArray;
util.isDate = util.isDate || util.types.isDate;
util.isRegExp = util.isRegExp || util.types.isRegExp;

const Datastore = require('nedb');
const { MongoClient } = require('mongodb');
const { Pool } = require('pg');

const DATA_DIR = process.env.CCN_DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'app-state.db');
const POSTGRES_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'ccn';
const STATE_ID = 'app_state';
const DEFAULT_IMEI_CHECK_URL = 'https://www.consultaserialaparelho.com.br/public-web/homeSiga?token=20260618';
const IMEI_CHECK_URL = process.env.IMEI_CHECK_URL || DEFAULT_IMEI_CHECK_URL;

const DEFAULT_STATE = {
  company: {
    name: 'CCN SOLUÇÕES TECNOLÓGICAS',
    phone: '11-2936-2016',
    document: '11-94573-0188',
    address: 'Rua Dr. SÍlvio Dante Bertacchi, 166 - Vila Sonia, São Paulo',
    notes: 'Assistência Técnica Especializada em Celular - Notebook - Computador - Tablet\nHorario de atendimento: das 10hrs as 18hrs de Segunda a Sexta-feira e aos Sábado das 10hrs as 15hrs'
  },
  orders: [],
  cash: [],
  clients: [],
  products: []
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function createDatabase() {
  ensureDataDir();
  const db = new Datastore({ filename: DB_PATH, autoload: true });

  db.findOne({ _id: STATE_ID }, (err, record) => {
    if (err) throw err;
    if (!record) {
      db.insert({ _id: STATE_ID, ...DEFAULT_STATE });
    }
  });

  return db;
}

function cleanState(payload = DEFAULT_STATE) {
  return {
    company: payload.company || DEFAULT_STATE.company,
    orders: Array.isArray(payload.orders) ? payload.orders : [],
    cash: Array.isArray(payload.cash) ? payload.cash : [],
    clients: Array.isArray(payload.clients) ? payload.clients : [],
    products: Array.isArray(payload.products) ? payload.products : []
  };
}

function buildImeiCheckUrl(imei) {
  if (!IMEI_CHECK_URL) return '';
  if (IMEI_CHECK_URL.includes('{imei}')) {
    return IMEI_CHECK_URL.replaceAll('{imei}', encodeURIComponent(imei));
  }

  const url = new URL(IMEI_CHECK_URL);
  if (!url.searchParams.has('imei')) {
    url.searchParams.set('imei', imei);
  }
  return url.toString();
}

function isCaptchaPage(payload = '') {
  return /recaptcha|g-recaptcha|nao sou um robo|não sou um robô/i.test(stripHtml(payload)) || /recaptcha|g-recaptcha/i.test(String(payload));
}

function captchaRequiredError(imei) {
  const error = new Error('O site oficial exige confirmacao reCAPTCHA. Clique em Abrir consulta oficial, confirme o captcha e conclua a consulta no site.');
  error.captchaRequired = true;
  error.queryUrl = buildImeiCheckUrl(imei);
  return error;
}

function htmlDecode(value = '') {
  return String(value)
    .replaceAll('&quot;', '"')
    .replaceAll('&#034;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

function stripHtml(value = '') {
  return htmlDecode(String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function getSetCookies(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const cookie = headers.get('set-cookie');
  return cookie ? [cookie] : [];
}

function mergeCookies(cookieJar, headers) {
  getSetCookies(headers).forEach((cookie) => {
    const [pair] = cookie.split(';');
    const index = pair.indexOf('=');
    if (index > 0) {
      cookieJar.set(pair.slice(0, index), pair.slice(index + 1));
    }
  });
}

function cookieHeader(cookieJar) {
  return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

function matchFirst(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return htmlDecode(match[1]);
  }
  return '';
}

function extractImeiResult(payload) {
  const update = payload.match(/<update[^>]+id="tableTACResult"[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/update>/i);
  const html = update ? update[1] : payload;
  const tbody = html.match(/<tbody[^>]*id=["']tableTACResult_data["'][^>]*>([\s\S]*?)<\/tbody>/i)?.[1] || html;
  const rows = [...tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((row) => [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => stripHtml(cell[1])).filter(Boolean))
    .filter((cells) => cells.length);

  const dataRow = rows.find((cells) => cells.length >= 2 && !cells.join(' ').includes('ui-datatable-empty-message'));
  if (dataRow) {
    const [imei, result, searchDate, accountable] = dataRow;
    return [
      imei ? `IMEI: ${imei}` : '',
      result ? `Resultado: ${result}` : '',
      searchDate ? `Data da consulta: ${searchDate}` : '',
      accountable ? `Responsavel: ${accountable}` : ''
    ].filter(Boolean).join(' | ');
  }

  const messages = [...payload.matchAll(/<message[^>]*>([\s\S]*?)<\/message>/gi)]
    .map((message) => stripHtml(message[1]))
    .filter(Boolean);
  if (messages.length) return messages.join(' | ');

  const text = stripHtml(payload);
  return text || 'Consulta concluida, mas o site nao retornou resultado detalhado.';
}

async function checkImeiOnPublicWeb(imei, signal) {
  const cookieJar = new Map();
  const homeUrl = new URL(IMEI_CHECK_URL);
  const homeResponse = await fetch(homeUrl, {
    method: 'GET',
    headers: { Accept: 'text/html' },
    signal
  });
  mergeCookies(cookieJar, homeResponse.headers);

  const homeHtml = await homeResponse.text();
  if (!homeResponse.ok) {
    throw new Error('Servico de consulta IMEI retornou erro ao abrir a pagina.');
  }
  if (isCaptchaPage(homeHtml)) {
    throw captchaRequiredError(imei);
  }

  const formName = matchFirst(homeHtml, [
    /<form[^>]+id=["']([^"']+)["'][^>]*>\s*<input[^>]+name=["']\1["']/i,
    /<form[^>]+name=["']([^"']+)["']/i
  ]) || 'j_idt8';
  const action = matchFirst(homeHtml, [/<form[^>]+id=["']j_idt8["'][^>]+action=["']([^"']+)["']/i, /<form[^>]+action=["']([^"']+)["']/i]);
  const viewState = matchFirst(homeHtml, [/name=["']javax\.faces\.ViewState["'][^>]+value=["']([^"']+)["']/i]);

  if (!viewState) {
    throw new Error('Nao foi possivel preparar a consulta IMEI no site.');
  }

  const postUrl = action ? new URL(action, homeUrl).toString() : homeUrl.toString();
  const body = new URLSearchParams({
    [formName]: formName,
    imeiInput: imei,
    btnSearchTAC: 'btnSearchTAC',
    'javax.faces.ViewState': viewState,
    'javax.faces.partial.ajax': 'true',
    'javax.faces.source': 'btnSearchTAC',
    'javax.faces.partial.execute': 'imeiInput btnSearchTAC',
    'javax.faces.partial.render': 'tableTACResult imeiInput'
  });

  const searchResponse = await fetch(postUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/xml,text/xml,*/*',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Faces-Request': 'partial/ajax',
      Referer: homeUrl.toString(),
      Cookie: cookieHeader(cookieJar)
    },
    body,
    signal
  });
  mergeCookies(cookieJar, searchResponse.headers);

  const searchPayload = await searchResponse.text();
  if (!searchResponse.ok) {
    throw new Error('Servico de consulta IMEI retornou erro na pesquisa.');
  }
  if (isCaptchaPage(searchPayload)) {
    throw captchaRequiredError(imei);
  }

  return extractImeiResult(searchPayload);
}

async function checkImeiWithConfiguredUrl(imei, signal) {
  const configuredUrl = new URL(IMEI_CHECK_URL);

  if (configuredUrl.hostname.includes('consultaserialaparelho.com.br')) {
    return checkImeiOnPublicWeb(imei, signal);
  }

  const response = await fetch(buildImeiCheckUrl(imei), {
    method: 'GET',
    headers: { Accept: 'application/json,text/plain,text/html' },
    signal
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error('Servico de consulta IMEI retornou erro.');
  }

  return summarizeImeiResult(payload);
}

function summarizeImeiResult(payload) {
  if (payload === null || payload === undefined) return '';

  if (typeof payload === 'string') {
    return payload.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
  }

  const preferredKeys = [
    'result',
    'resultado',
    'status',
    'message',
    'mensagem',
    'restriction',
    'restricao',
    'situation',
    'situacao'
  ];
  const parts = preferredKeys
    .filter((key) => payload[key] !== undefined && payload[key] !== null && payload[key] !== '')
    .map((key) => `${key}: ${typeof payload[key] === 'object' ? JSON.stringify(payload[key]) : payload[key]}`);

  return (parts.length ? parts.join(' | ') : JSON.stringify(payload)).slice(0, 2000);
}

function createLocalStore() {
  const db = createDatabase();

  return {
    type: 'local',
    location: DB_PATH,
    getState() {
      return new Promise((resolve, reject) => {
        db.findOne({ _id: STATE_ID }, (err, record) => {
          if (err) return reject(err);
          return resolve(cleanState(record || DEFAULT_STATE));
        });
      });
    },
    saveState(payload) {
      const clean = cleanState(payload);

      return new Promise((resolve, reject) => {
        db.update(
          { _id: STATE_ID },
          { _id: STATE_ID, ...clean },
          { upsert: true },
          (err) => {
            if (err) return reject(err);
            return resolve(clean);
          }
        );
      });
    },
    resetState() {
      return this.saveState(DEFAULT_STATE);
    }
  };
}

async function createMongoStore() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();

  const collection = client.db(MONGODB_DB).collection('app_state');
  await collection.updateOne(
    { _id: STATE_ID },
    { $setOnInsert: { _id: STATE_ID, ...DEFAULT_STATE } },
    { upsert: true }
  );

  return {
    type: 'mongodb',
    location: `${MONGODB_DB}.app_state`,
    async getState() {
      const record = await collection.findOne({ _id: STATE_ID });
      return cleanState(record || DEFAULT_STATE);
    },
    async saveState(payload) {
      const clean = cleanState(payload);
      await collection.replaceOne(
        { _id: STATE_ID },
        { _id: STATE_ID, ...clean },
        { upsert: true }
      );
      return clean;
    },
    resetState() {
      return this.saveState(DEFAULT_STATE);
    }
  };
}

async function createPostgresStore() {
  const pool = new Pool({
    connectionString: POSTGRES_URL,
    ssl: process.env.POSTGRES_SSL === 'false' ? false : { rejectUnauthorized: false }
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id TEXT PRIMARY KEY,
      state JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(
    `
      INSERT INTO app_state (id, state)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (id) DO NOTHING
    `,
    [STATE_ID, JSON.stringify(DEFAULT_STATE)]
  );

  return {
    type: 'postgresql',
    location: 'app_state',
    async getState() {
      const result = await pool.query('SELECT state FROM app_state WHERE id = $1', [STATE_ID]);
      return cleanState(result.rows[0]?.state || DEFAULT_STATE);
    },
    async saveState(payload) {
      const clean = cleanState(payload);
      await pool.query(
        `
          INSERT INTO app_state (id, state, updated_at)
          VALUES ($1, $2::jsonb, NOW())
          ON CONFLICT (id)
          DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()
        `,
        [STATE_ID, JSON.stringify(clean)]
      );
      return clean;
    },
    resetState() {
      return this.saveState(DEFAULT_STATE);
    }
  };
}

function createStore() {
  if (POSTGRES_URL) {
    return createPostgresStore();
  }

  if (MONGODB_URI) {
    return createMongoStore();
  }

  return Promise.resolve(createLocalStore());
}

function createApp() {
  const app = express();
  const storePromise = createStore();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.static(__dirname));

  app.get('/api/health', async (req, res) => {
    try {
      const store = await storePromise;
      res.json({ status: 'ok', database: store.location, storage: store.type });
    } catch {
      res.status(500).json({ status: 'error', error: 'Erro ao conectar no banco' });
    }
  });

  app.get('/api/state', async (req, res) => {
    try {
      const store = await storePromise;
      return res.json(await store.getState());
    } catch {
      return res.status(500).json({ error: 'Erro ao ler banco' });
    }
  });

  app.put('/api/state', async (req, res) => {
    try {
      const store = await storePromise;
      return res.json(await store.saveState(req.body || DEFAULT_STATE));
    } catch {
      return res.status(500).json({ error: 'Erro ao salvar estado' });
    }
  });

  app.get('/api/imei-check', async (req, res) => {
    const imei = String(req.query.imei || '').replace(/\D/g, '');

    if (!/^\d{15}$/.test(imei)) {
      return res.status(400).json({ error: 'Informe um IMEI com 15 digitos.' });
    }

    if (!IMEI_CHECK_URL) {
      return res.status(501).json({ error: 'Link de consulta IMEI nao configurado.' });
    }

    try {
      new URL(IMEI_CHECK_URL);
    } catch {
      return res.status(500).json({ error: 'Link de consulta IMEI invalido.' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      return res.json({
        imei,
        result: await checkImeiWithConfiguredUrl(imei, controller.signal)
      });
    } catch (error) {
      if (error.captchaRequired) {
        return res.status(409).json({
          error: error.message,
          captchaRequired: true,
          queryUrl: error.queryUrl
        });
      }

      const message = error.name === 'AbortError'
        ? 'Tempo esgotado ao consultar IMEI.'
        : (error.message || 'Nao foi possivel consultar o servico de IMEI.');
      return res.status(502).json({ error: message });
    } finally {
      clearTimeout(timeout);
    }
  });

  app.get('/api/imei-check-page', (req, res) => {
    const imei = String(req.query.imei || '').replace(/\D/g, '');

    if (!/^\d{15}$/.test(imei)) {
      return res.status(400).send('Informe um IMEI com 15 digitos.');
    }

    try {
      return res.redirect(buildImeiCheckUrl(imei));
    } catch {
      return res.status(500).send('Link de consulta IMEI invalido.');
    }
  });

  app.delete('/api/state', async (req, res) => {
    try {
      const store = await storePromise;
      return res.json(await store.resetState());
    } catch {
      return res.status(500).json({ error: 'Erro ao resetar estado' });
    }
  });

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
  });
}

module.exports = { createApp, DEFAULT_STATE };
