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
