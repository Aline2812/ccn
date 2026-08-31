const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Datastore = require('nedb');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'app-state.db');

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

  db.findOne({ _id: 'app_state' }, (err, record) => {
    if (err) throw err;
    if (!record) {
      db.insert({ _id: 'app_state', ...DEFAULT_STATE });
    }
  });

  return db;
}

function createApp() {
  const app = express();
  const db = createDatabase();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.static(__dirname));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: DB_PATH });
  });

  app.get('/api/state', (req, res) => {
    db.findOne({ _id: 'app_state' }, (err, record) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao ler banco' });
      }
      const state = record || DEFAULT_STATE;
      return res.json({
        company: state.company || DEFAULT_STATE.company,
        orders: Array.isArray(state.orders) ? state.orders : [],
        cash: Array.isArray(state.cash) ? state.cash : [],
        clients: Array.isArray(state.clients) ? state.clients : [],
        products: Array.isArray(state.products) ? state.products : []
      });
    });
  });

  app.put('/api/state', (req, res) => {
    const payload = req.body || DEFAULT_STATE;
    const clean = {
      company: payload.company || DEFAULT_STATE.company,
      orders: Array.isArray(payload.orders) ? payload.orders : [],
      cash: Array.isArray(payload.cash) ? payload.cash : [],
      clients: Array.isArray(payload.clients) ? payload.clients : [],
      products: Array.isArray(payload.products) ? payload.products : []
    };

    db.update(
      { _id: 'app_state' },
      { _id: 'app_state', ...clean },
      { upsert: true },
      (err) => {
        if (err) {
          return res.status(500).json({ error: 'Erro ao salvar estado' });
        }
        return res.json(clean);
      }
    );
  });

  app.delete('/api/state', (req, res) => {
    db.update(
      { _id: 'app_state' },
      { _id: 'app_state', ...DEFAULT_STATE },
      { upsert: true },
      (err) => {
        if (err) {
          return res.status(500).json({ error: 'Erro ao resetar estado' });
        }
        return res.json(DEFAULT_STATE);
      }
    );
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
