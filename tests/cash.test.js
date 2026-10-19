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

test('salvar e editar mantém custo e recalcula lucro sem duplicar movimento', () => {
  const { run, element } = loadApp();
  run('persist = () => {}; resetCashEditor = () => {}; render = () => {}');
  element('#cashType').value = 'entrada';
  element('#cashCategory').value = 'Manutencao/OS';
  element('#cashAmount').value = '380';
  element('#cashCost').value = '120';
  element('#cashDescription').value = 'Troca da tela Samsung A80';
  run('saveCashMovement({preventDefault() {}})');
  assert.equal(run('state.cash[0].cost'), 120);
  assert.equal(run('cashBalance()'), 260);
  run('editingCashId = state.cash[0].id');
  element('#cashCost').value = '150';
  run('saveCashMovement({preventDefault() {}})');
  assert.equal(run('state.cash.length'), 1);
  assert.equal(run('cashBalance()'), 230);
});

test('caixa permite prejuízo quando o custo supera o recebido', () => {
  const { run } = loadApp();
  run('state.cash = [{type: "entrada", amount: 100, cost: 120}]');
  assert.equal(run('cashBalance()'), -20);
});

test('cadastro salva custo separado do preço de venda', () => {
  const { run, element } = loadApp();
  run('persist = () => {}; render = () => {}');
  element('#productForm').reset = () => {};
  element('#productCodeInput').value = 'TELA-A80';
  element('#productNameInput').value = 'Tela Samsung A80';
  element('#productCostInput').value = '120';
  element('#productPriceInput').value = '380';
  run('saveProduct({preventDefault() {}})');
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
