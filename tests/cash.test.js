const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadApp() {
  const elements = new Map();
  function element(selector) {
    if (!elements.has(selector)) elements.set(selector, {
      value: '', textContent: '', disabled: false,
      classList: { toggle() {} }, setAttribute() {},
      reportValidity: () => true
    });
    return elements.get(selector);
  }
  const context = vm.createContext({
    window: { location: { protocol: 'http:', origin: 'http://localhost' } },
    document: { querySelector: element, querySelectorAll: () => [] },
    Intl, Date, crypto: { randomUUID: () => 'new-movement' }
  });
  const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  vm.runInContext(source.replace(/^boot\(\);$/m, ''), context);
  return { run: (code) => vm.runInContext(code, context), element };
}

test('troca de tela: cobrança de 380 e peça de 120 geram lucro de 260', () => {
  const { run } = loadApp();
  run('state.cash = [{type: "entrada", amount: 380, cost: 120}]');
  assert.equal(run('cashTotals().income'), 380);
  assert.equal(run('cashTotals().costs'), 120);
  assert.equal(run('cashTotals().profit'), 260);
  assert.equal(run('cashBalance()'), 260);
});

test('despesas fixas são descontadas uma única vez do resultado', () => {
  const { run } = loadApp();
  run(`state.cash = [
    {type: "entrada", amount: 380, cost: 120},
    ...FIXED_EXPENSES.map(category => ({type: "saida", category, amount: 50, cost: 999}))
  ]`);
  assert.equal(run('cashTotals().expenses'), 200);
  assert.equal(run('cashTotals().profit'), 60);
  assert.equal(run('cashTotals().costs'), 120);
});

test('itens de OS consideram quantidade e aceitam registros antigos sem custo', () => {
  const { run } = loadApp();
  run('state.orders = [{items: [{qty: 2, price: 380, cost: 120}, {qty: 1, price: 50}]}]');
  assert.equal(run('orderCost(state.orders[0])'), 240);
  assert.equal(run('orderTotal(state.orders[0])'), 810);
  run('state.cash = [{type: "entrada", amount: 100}, {type: "saida", amount: 20}]');
  assert.equal(run('cashBalance()'), 80);
});

test('OS vinculada preenche custo e evita repetir custo já lançado', () => {
  const { run, element } = loadApp();
  run(`state.orders = [{id: "os1", code: "OS-1", clientName: "Cliente", depositAmount: 0,
    items: [{description: "Tela", qty: 1, price: 380, cost: 120}]}]`);
  element('#cashOrderSelect').value = 'os1';
  run('fillCashFromOrder()');
  assert.equal(element('#cashAmount').value, '380.00');
  assert.equal(element('#cashCost').value, '120.00');
  run('state.cash = [{id: "payment1", orderId: "os1", type: "entrada", amount: 200, cost: 120}]');
  run('fillCashFromOrder()');
  assert.equal(element('#cashCost').value, '0.00');
  run('editingCashId = "payment1"; fillCashFromOrder()');
  assert.equal(element('#cashCost').value, '120.00');
});

test('categorias fixas forçam saída e desativam custo', () => {
  const { run, element } = loadApp();
  for (const category of ['Aluguel', 'Luz', 'Água', 'Internet']) {
    element('#cashType').value = 'entrada';
    element('#cashCategory').value = category;
    run('syncCashContext()');
    assert.equal(element('#cashType').value, 'saida');
    assert.equal(element('#cashCost').disabled, true);
  }
});

test('salvar e editar mantém custo e recalcula lucro sem duplicar movimento', async () => {
  const { run, element } = loadApp();
  run('persist = () => {}; resetCashEditor = () => {}; render = () => {}');
  element('#cashType').value = 'entrada';
  element('#cashCategory').value = 'Venda';
  element('#cashAmount').value = '380';
  element('#cashCost').value = '120';
  element('#cashDescription').value = 'Troca da tela Samsung A80';
  await run('saveCashMovement({preventDefault() {}})');
  assert.equal(run('state.cash[0].cost'), 120);
  assert.equal(run('cashBalance()'), 260);
  run('editingCashId = state.cash[0].id');
  element('#cashCost').value = '150';
  await run('saveCashMovement({preventDefault() {}})');
  assert.equal(run('state.cash.length'), 1);
  assert.equal(run('cashBalance()'), 230);
});

test('caixa permite prejuízo quando o custo supera o recebido', () => {
  const { run } = loadApp();
  run('state.cash = [{type: "entrada", amount: 100, cost: 120}]');
  assert.equal(run('cashBalance()'), -20);
});

test('cadastro salva custo separado do preço de venda', async () => {
  const { run, element } = loadApp();
  run('persist = () => {}; render = () => {}');
  element('#productForm').reset = () => {};
  element('#productCodeInput').value = 'TELA-A80';
  element('#productNameInput').value = 'Tela Samsung A80';
  element('#productCostInput').value = '120';
  element('#productPriceInput').value = '380';
  await run('saveProduct({preventDefault() {}})');
  assert.equal(run('state.products[0].cost'), 120);
  assert.equal(run('state.products[0].price'), 380);
});

test('buscar peça aceita nome completo ou código sem selecionar outro produto durante digitação', () => {
  const { run } = loadApp();
  run(`state.products = [
    { name: 'Tela Samsung A80', code: 'A80', category: 'Tela' },
    { name: 'Tela Motorola G20', code: 'G20', category: 'Tela' }
  ]`);
  assert.equal(run('findProductByNameOrCode("tela")'), null);
  assert.equal(run('findProductByNameOrCode("tela motorola g20").code'), 'G20');
  assert.equal(run('findProductByNameOrCode(" g20 ").name'), 'Tela Motorola G20');
});

test('item de OS preenche custo ao digitar ou selecionar, preservando valores de itens já salvos', () => {
  const { run, element } = loadApp();
  const fields = new Map();
  const listeners = new Map();
  for (const selector of ['.item-description', '.item-qty', '.item-price', '.item-cost']) {
    fields.set(selector, { value: '', addEventListener: (event, listener) => listeners.set(event, listener) });
  }
  element('#itemTemplate').content = { cloneNode: () => ({ querySelector: selector => fields.get(selector) }) };
  element('#itemsList').append = () => {};
  run(`calculateDialogTotal = () => {};
    state.products = [{name: 'Tela Samsung A80', code: 'A80', price: 380, cost: 120},
      {name: 'Serviço de limpeza', code: 'LIMPEZA', price: 80, cost: 0},
      {name: 'Tela Motorola G20', code: 'G20', price: 80}];
    addItemRow({description: 'Tela Samsung A80', qty: 1, price: 350, cost: 100});`);
  assert.equal(fields.get('.item-cost').value, 100);
  fields.get('.item-description').value = 'A80';
  listeners.get('input')();
  assert.equal(fields.get('.item-cost').value, '120.00');
  assert.equal(fields.get('.item-price').value, 350);
  fields.get('.item-description').value = 'Serviço de limpeza';
  listeners.get('change')();
  assert.equal(fields.get('.item-cost').value, '0.00');
  assert.equal(fields.get('.item-price').value, 350);
  fields.get('.item-price').value = '260';
  fields.get('.item-description').value = 'G20';
  listeners.get('input')();
  assert.equal(fields.get('.item-cost').value, '80.00');
  assert.equal(fields.get('.item-price').value, '260');
  run('addItemRow()');
  fields.get('.item-description').value = 'G20';
  listeners.get('change')();
  assert.equal(fields.get('.item-cost').value, '80.00');
  assert.equal(fields.get('.item-price').value, 0);
});

test('falha ao carregar dados bloqueia a abertura sem usar dados antigos do navegador', async () => {
  const { run } = loadApp();
  run(`globalThis.fetch = async () => ({ok: false});
    globalThis.localStorage = {getItem() {throw new Error('Cache não deve ser usado');}};`);
  await assert.rejects(run('loadState()'), /Não foi possível carregar/);
});

test('falha ao salvar avisa o usuário e restaura o último estado confirmado', async () => {
  const { run } = loadApp();
  run(`state.clients = [{name: 'Cliente salvo'}];
    savedStateJson = JSON.stringify(state);
    state.clients.push({name: 'Cliente não salvo'});
    globalThis.fetch = async () => ({ok: false});
    globalThis.messages = [];
    globalThis.alert = message => messages.push(message);`);
  assert.equal(await run('persist()'), false);
  assert.equal(run('state.clients.length'), 1);
  assert.match(run('messages[0]'), /Não foi possível confirmar/);
});

test('chamadas de dados usam o acesso autenticado', async () => {
  const { run } = loadApp();
  run(`window.ccnAuth = {fetch: async (url, options) => ({url, method: options.method})};`);
  assert.equal((await run('apiFetch("/api/state", {method: "PUT"})')).method, 'PUT');
});

test('restauração de backup recupera clientes e produtos junto com ordens e caixa', async () => {
  const { run } = loadApp();
  run(`globalThis.backup = { company: {name: 'Empresa'}, orders: [], cash: [],
      clients: [{name: 'Cliente restaurado'}], products: [{name: 'Tela', cost: 80}] };
    globalThis.FileReader = class {
      readAsText() { this.result = JSON.stringify(backup); globalThis.importDone = this.onload(); }
    };
    globalThis.alert = () => {};
    persist = async () => true; fillCompanyForm = () => {}; render = () => {};
    importBackup({target: {files: [{}]}});`);
  await run('importDone');
  assert.equal(run('state.clients[0].name'), 'Cliente restaurado');
  assert.equal(run('state.products[0].cost'), 80);
});

test('CPF no caixa busca cadastro com ou sem pontuação, inclusive em vendas', () => {
  const { run, element } = loadApp();
  run(`state.clients = [{name: 'Cliente teste', cpf: '123.456.789-01', phone: '11999990000', address: 'Rua A'}]`);
  element('#cashCategory').value = 'Venda';
  element('#cashClientCpf').value = '12345678901';
  run('handleCashClientCpfLookup()');
  assert.equal(element('#cashClientName').value, 'Cliente teste');
  assert.equal(element('#cashClientPhone').value, '11999990000');
  assert.equal(element('#cashClientAddress').value, 'Rua A');
  element('#cashClientCpf').value = '00000000000';
  run('handleCashClientCpfLookup()');
  assert.equal(element('#cashClientName').value, '');
});

function prepareOrderPayment() {
  const app = loadApp();
  app.run(`state.orders = [{id: 'os1', code: 'OS-1', clientName: 'Cliente', clientCpf: '12345678901',
    clientPhone: '11999990000', clientAddress: 'Rua A', status: 'Aguardando retirada', updatedAt: '2026-10-22',
    diagnosis: 'Troca de tela realizada', depositAmount: 50,
    items: [{description: 'Tela', qty: 1, price: 380, cost: 120}]}];
    globalThis.actualPersist = persist;
    persist = async () => true; resetCashEditor = () => {}; render = () => {};`);
  app.element('#cashType').value = 'entrada';
  app.element('#cashCategory').value = 'Manutencao/OS';
  app.element('#cashOrderSelect').value = 'os1';
  app.run('fillCashFromOrder()');
  return app;
}

test('OS preenche serviço, cliente e saldo descontando sinal e pagamentos anteriores', () => {
  const { run, element } = prepareOrderPayment();
  assert.match(element('#cashDescription').value, /Troca de tela realizada; Tela/);
  assert.equal(element('#cashClientCpf').value, '12345678901');
  assert.equal(element('#cashClientPhone').value, '11999990000');
  assert.equal(element('#cashAmount').value, '330.00');
  run(`state.cash = [{id: 'p1', orderId: 'os1', type: 'entrada', amount: 100}]; fillCashFromOrder()`);
  assert.equal(element('#cashAmount').value, '230.00');
  run(`editingCashId = 'p1'; fillCashFromOrder()`);
  assert.equal(element('#cashAmount').value, '330.00');
});

test('CPF seleciona a única OS pendente e exige escolha quando há várias', () => {
  const { run, element } = prepareOrderPayment();
  element('#cashOrderSelect').value = '';
  element('#cashClientCpf').value = '123.456.789-01';
  run('handleCashClientCpfLookup()');
  assert.equal(element('#cashOrderSelect').value, 'os1');
  run(`state.orders.push({...state.orders[0], id: 'os2', code: 'OS-2'});`);
  element('#cashOrderSelect').value = '';
  run('handleCashClientCpfLookup()');
  assert.equal(element('#cashOrderSelect').value, '');
  element('#cashOrderSelect').value = 'os1';
  element('#cashClientCpf').value = '00000000000';
  run('handleCashClientCpfLookup()');
  assert.equal(element('#cashOrderSelect').value, '');
  assert.equal(element('#cashAmount').value, '');
});

test('pagamento parcial mantém OS aberta; quitação finaliza e edição menor reabre', async () => {
  const { run, element } = prepareOrderPayment();
  element('#cashAmount').value = '100';
  await run('saveCashMovement({preventDefault() {}})');
  assert.equal(run('state.orders[0].status'), 'Aguardando retirada');
  assert.equal(run('orderBalance(state.orders[0])'), 230);
  run('editingCashId = state.cash[0].id');
  element('#cashAmount').value = '330';
  await run('saveCashMovement({preventDefault() {}})');
  assert.equal(run('state.orders[0].status'), 'Finalizado e retirado');
  assert.equal(run('orderBalance(state.orders[0])'), 0);
  assert.equal(run('state.cash.length'), 1);
  element('#cashAmount').value = '200';
  await run('saveCashMovement({preventDefault() {}})');
  assert.equal(run('state.orders[0].status'), 'Aguardando retirada');
  assert.equal(run('orderBalance(state.orders[0])'), 130);
});

test('pagamentos acumulados quitam OS sem contar novamente o movimento editado', async () => {
  const { run, element } = prepareOrderPayment();
  run(`state.cash = [{id: 'anterior', orderId: 'os1', type: 'entrada', amount: 100, cost: 120}]; fillCashFromOrder()`);
  assert.equal(element('#cashAmount').value, '230.00');
  await run('saveCashMovement({preventDefault() {}})');
  assert.equal(run('state.orders[0].status'), 'Finalizado e retirado');
  assert.equal(run('state.cash.length'), 2);
  assert.equal(run('cashTotals().costs'), 120);
});

test('manutenção exige OS válida e não aceita ordem cancelada', async () => {
  const { run, element } = prepareOrderPayment();
  run('globalThis.alert = () => {}');
  element('#cashOrderSelect').value = '';
  await run('saveCashMovement({preventDefault() {}})');
  assert.equal(run('state.cash.length'), 0);
  element('#cashOrderSelect').value = 'os1';
  run(`state.orders[0].status = 'Cancelado'`);
  await run('saveCashMovement({preventDefault() {}})');
  assert.equal(run('state.cash.length'), 0);
});

test('falha ao salvar pagamento restaura também status e saldo da OS', async () => {
  const { run } = prepareOrderPayment();
  run(`savedStateJson = JSON.stringify(state); persist = actualPersist;
    globalThis.fetch = async () => ({ok: false}); globalThis.alert = () => {};`);
  await run('saveCashMovement({preventDefault() {}})');
  assert.equal(run('state.cash.length'), 0);
  assert.equal(run('state.orders[0].status'), 'Aguardando retirada');
  assert.equal(run('orderBalance(state.orders[0])'), 330);
});
