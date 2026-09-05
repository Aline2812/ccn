const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.CCN_DATA_DIR = path.join(os.tmpdir(), `ccn-api-test-${process.pid}`);

const { createApp } = require('../server');

const app = createApp();
let server;

test.before(() => {
  server = app.listen(4100, '127.0.0.1');
});

test.after(() => {
  server.close();
  fs.rmSync(process.env.CCN_DATA_DIR, { recursive: true, force: true });
});

test('GET /api/health retorna status ok', async () => {
  const response = await fetch('http://127.0.0.1:4100/api/health', { method: 'GET' });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, 'ok');
});

test('PUT /api/state salva os dados no banco', async () => {
  const payload = {
    company: {
      name: 'CCN SOLUÇÕES TECNOLÓGICAS',
      phone: '11-2936-2016',
      document: '11-94573-0188',
      address: 'Rua Exemplo, 123',
      notes: 'Assistência Técnica Especializada'
    },
    orders: [
      {
        id: 'os-1',
        code: 'OS-2026-0001',
        clientName: 'Cliente Teste',
        clientPhone: '11999999999',
        clientCpf: '12345678900',
        clientMessagePhone: '',
        clientAddress: 'Endereco teste',
        deviceType: 'Celular',
        deviceModel: 'Samsung A10',
        deviceSerial: 'ABC123',
        devicePassword: '',
        reportedIssue: 'Tela quebrada',
        diagnosis: 'Troca de tela',
        status: 'Entrada',
        dueDate: '2026-08-31',
        depositAmount: 100,
        warrantyEnabled: 'sim',
        warrantyDays: 90,
        pickupDays: 90,
        storageFee: 0,
        pickupNotice: 'Aviso de retirada',
        createdAt: '2026-08-31T10:00:00.000Z',
        createdDate: '2026-08-31',
        updatedAt: '2026-08-31T10:00:00.000Z',
        items: [{ description: 'Tela', qty: 1, price: 500 }]
      }
    ],
    cash: [
      {
        id: 'cash-1',
        type: 'entrada',
        category: 'Venda',
        orderId: '',
        clientName: 'Cliente Teste',
        method: 'Dinheiro',
        paymentMode: 'avista',
        installments: 1,
        description: 'Pagamento de OS',
        amount: 100,
        date: '2026-08-31',
        createdAt: '2026-08-31T10:00:00.000Z'
      }
    ]
  };

  const response = await fetch('http://127.0.0.1:4100/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.company.name, 'CCN SOLUÇÕES TECNOLÓGICAS');
  assert.equal(body.orders.length, 1);
});
