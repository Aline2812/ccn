const STORAGE_KEY = "assistencia_os_caixa_v1";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const state = loadState();
let editingOrderId = null;

const els = {
  pageTitle: document.querySelector("#pageTitle"),
  navButtons: document.querySelectorAll(".nav-button"),
  viewLinks: document.querySelectorAll("[data-view-link]"),
  views: {
    dashboard: document.querySelector("#dashboardView"),
    orders: document.querySelector("#ordersView"),
    cash: document.querySelector("#cashView"),
    settings: document.querySelector("#settingsView")
  },
  openOrdersCount: document.querySelector("#openOrdersCount"),
  metricOpen: document.querySelector("#metricOpen"),
  metricWaiting: document.querySelector("#metricWaiting"),
  metricToday: document.querySelector("#metricToday"),
  metricBalance: document.querySelector("#metricBalance"),
  recentOrdersTable: document.querySelector("#recentOrdersTable"),
  cashTimeline: document.querySelector("#cashTimeline"),
  ordersGrid: document.querySelector("#ordersGrid"),
  orderSearch: document.querySelector("#orderSearch"),
  statusFilter: document.querySelector("#statusFilter"),
  cashForm: document.querySelector("#cashForm"),
  cashType: document.querySelector("#cashType"),
  cashCategory: document.querySelector("#cashCategory"),
  cashOrderLabel: document.querySelector("#cashOrderLabel"),
  cashOrderSelect: document.querySelector("#cashOrderSelect"),
  cashClientLabel: document.querySelector("#cashClientLabel"),
  cashClientName: document.querySelector("#cashClientName"),
  cashMethod: document.querySelector("#cashMethod"),
  cashPaymentMode: document.querySelector("#cashPaymentMode"),
  cashInstallments: document.querySelector("#cashInstallments"),
  cashPaymentModeLabel: document.querySelector("#cashPaymentModeLabel"),
  cashInstallmentsLabel: document.querySelector("#cashInstallmentsLabel"),
  cashDescription: document.querySelector("#cashDescription"),
  cashAmount: document.querySelector("#cashAmount"),
  cashDate: document.querySelector("#cashDate"),
  cashTable: document.querySelector("#cashTable"),
  cashTotal: document.querySelector("#cashTotal"),
  companyForm: document.querySelector("#companyForm"),
  companyName: document.querySelector("#companyName"),
  companyPhone: document.querySelector("#companyPhone"),
  companyDocument: document.querySelector("#companyDocument"),
  companyAddress: document.querySelector("#companyAddress"),
  companyNotes: document.querySelector("#companyNotes"),
  orderDialog: document.querySelector("#orderDialog"),
  orderForm: document.querySelector("#orderForm"),
  orderCodeLabel: document.querySelector("#orderCodeLabel"),
  closeOrderDialog: document.querySelector("#closeOrderDialog"),
  newOrderButton: document.querySelector("#newOrderButton"),
  deleteOrderButton: document.querySelector("#deleteOrderButton"),
  printOrderButton: document.querySelector("#printOrderButton"),
  addItemButton: document.querySelector("#addItemButton"),
  itemsList: document.querySelector("#itemsList"),
  itemTemplate: document.querySelector("#itemTemplate"),
  orderTotal: document.querySelector("#orderTotal"),
  backupButton: document.querySelector("#backupButton"),
  restoreInput: document.querySelector("#restoreInput"),
  receiptPrintArea: document.querySelector("#receiptPrintArea"),
  clientName: document.querySelector("#clientName"),
  clientPhone: document.querySelector("#clientPhone"),
  clientCpf: document.querySelector("#clientCpf"),
  clientMessagePhone: document.querySelector("#clientMessagePhone"),
  clientAddress: document.querySelector("#clientAddress"),
  deviceType: document.querySelector("#deviceType"),
  deviceModel: document.querySelector("#deviceModel"),
  deviceSerial: document.querySelector("#deviceSerial"),
  devicePassword: document.querySelector("#devicePassword"),
  reportedIssue: document.querySelector("#reportedIssue"),
  diagnosis: document.querySelector("#diagnosis"),
  orderStatus: document.querySelector("#orderStatus"),
  dueDate: document.querySelector("#dueDate"),
  depositAmount: document.querySelector("#depositAmount"),
  entryDateDisplay: document.querySelector("#entryDateDisplay"),
  warrantyEnabled: document.querySelector("#warrantyEnabled"),
  warrantyDays: document.querySelector("#warrantyDays"),
  pickupDays: document.querySelector("#pickupDays"),
  storageFee: document.querySelector("#storageFee"),
  pickupNotice: document.querySelector("#pickupNotice")
};

boot();

function boot() {
  els.cashDate.valueAsDate = new Date();
  bindEvents();
  syncCreditFields();
  syncCashContext();
  fillCompanyForm();
  render();
}

function bindEvents() {
  els.navButtons.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  els.viewLinks.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.viewLink));
  });

  els.newOrderButton.addEventListener("click", () => openOrderDialog());
  els.closeOrderDialog.addEventListener("click", () => els.orderDialog.close());
  els.addItemButton.addEventListener("click", () => addItemRow());
  els.itemsList.addEventListener("input", calculateDialogTotal);
  els.itemsList.addEventListener("click", handleItemRemove);
  els.orderForm.addEventListener("submit", saveOrderFromForm);
  els.deleteOrderButton.addEventListener("click", deleteCurrentOrder);
  els.printOrderButton.addEventListener("click", printCurrentOrder);
  els.dueDate.addEventListener("input", maskBrazilianDate);
  els.orderSearch.addEventListener("input", renderOrders);
  els.statusFilter.addEventListener("change", renderOrders);
  els.cashType.addEventListener("change", syncCashCategory);
  els.cashCategory.addEventListener("change", syncCashContext);
  els.cashOrderSelect.addEventListener("change", fillCashFromOrder);
  els.cashMethod.addEventListener("change", syncCreditFields);
  els.cashPaymentMode.addEventListener("change", syncCreditFields);
  els.cashForm.addEventListener("submit", saveCashMovement);
  els.companyForm.addEventListener("submit", saveCompany);
  els.backupButton.addEventListener("click", exportBackup);
  els.restoreInput.addEventListener("change", importBackup);
}

function syncCashCategory() {
  els.cashCategory.value = els.cashType.value === "saida" ? "Despesa" : "Venda";
  syncCashContext();
}

function syncCashContext() {
  const isMaintenance = els.cashCategory.value === "Manutencao/OS";
  const isExpense = els.cashCategory.value === "Despesa";

  els.cashOrderLabel.classList.toggle("visible", isMaintenance);
  els.cashClientLabel.classList.toggle("hidden-field", isExpense);
  els.cashClientLabel.classList.toggle("visible", !isExpense);

  if (isExpense) {
    els.cashClientName.value = "";
    els.cashOrderSelect.value = "";
  }
}

function fillCashFromOrder() {
  const order = state.orders.find((item) => item.id === els.cashOrderSelect.value);
  if (!order) return;

  const balance = orderBalance(order);
  els.cashClientName.value = order.clientName;
  els.cashDescription.value = `Pagamento ${order.code} - ${order.clientName} - ${order.deviceType} ${order.deviceModel}`;
  els.cashAmount.value = balance.toFixed(2);
}

function syncCreditFields() {
  const isCredit = els.cashMethod.value === "Cartao credito";
  const isInstallment = isCredit && els.cashPaymentMode.value === "parcelado";
  els.cashPaymentModeLabel.classList.toggle("visible", isCredit);
  els.cashInstallmentsLabel.classList.toggle("visible", isInstallment);

  if (!isCredit) {
    els.cashPaymentMode.value = "avista";
    els.cashInstallments.value = "1";
  } else if (isInstallment && els.cashInstallments.value === "1") {
    els.cashInstallments.value = "2";
  }
}

function loadState() {
  const fallback = {
    company: {
      name: "Minha Assistencia Tecnica",
      phone: "",
      document: "",
      address: "",
      notes: "Garantia conforme servico descrito na ordem."
    },
    orders: [],
    cash: []
  };

  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || fallback;
  } catch {
    return fallback;
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setView(view) {
  Object.entries(els.views).forEach(([name, element]) => {
    element.classList.toggle("active", name === view);
  });

  els.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  const titles = {
    dashboard: "Painel",
    orders: "Ordens de servico",
    cash: "Caixa",
    settings: "Empresa"
  };
  els.pageTitle.textContent = titles[view];
}

function render() {
  renderDashboard();
  renderOrders();
  renderCash();
}

function renderDashboard() {
  const openOrders = state.orders.filter((order) => !["Finalizado", "Cancelado"].includes(order.status));
  const waitingOrders = state.orders.filter((order) => order.status === "Aguardando retirada");
  const today = toDateInput(new Date());
  const todayIncome = state.cash
    .filter((item) => item.type === "entrada" && item.date === today)
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const balance = cashBalance();

  els.metricOpen.textContent = openOrders.length;
  els.metricWaiting.textContent = waitingOrders.length;
  els.metricToday.textContent = money.format(todayIncome);
  els.metricBalance.textContent = money.format(balance);
  els.openOrdersCount.textContent = `${openOrders.length} abertas`;

  const recent = [...state.orders]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);

  els.recentOrdersTable.innerHTML = recent.length
    ? recent.map((order) => `
      <tr>
        <td>${escapeHtml(order.code)}</td>
        <td>${escapeHtml(order.clientName)}</td>
        <td>${escapeHtml(order.deviceType)} ${escapeHtml(order.deviceModel)}</td>
        <td><span class="chip ${statusClass(order.status)}">${escapeHtml(order.status)}</span></td>
        <td>${money.format(orderTotal(order))}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="5">Nenhuma ordem cadastrada.</td></tr>`;

  const recentCash = [...state.cash].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  els.cashTimeline.innerHTML = recentCash.length
    ? recentCash.map((item) => `
      <div class="timeline-item">
        <strong>
          <span>${escapeHtml(item.description)}</span>
          <span>${item.type === "entrada" ? "+" : "-"} ${money.format(Number(item.amount))}</span>
        </strong>
        <small>${formatDate(item.date)} · ${escapeHtml(item.category || "Movimento")} · ${escapeHtml(paymentLabel(item))}</small>
      </div>
    `).join("")
    : `<div class="empty-state">Nenhum movimento de caixa.</div>`;
}

function renderOrders() {
  const query = normalize(els.orderSearch.value);
  const status = els.statusFilter.value;

  const filtered = state.orders
    .filter((order) => !status || order.status === status)
    .filter((order) => {
      const haystack = normalize([
        order.code,
        order.clientName,
        order.clientPhone,
        order.clientCpf,
        order.clientMessagePhone,
        order.clientAddress,
        order.deviceType,
        order.deviceModel,
        order.deviceSerial,
        order.reportedIssue
      ].join(" "));
      return haystack.includes(query);
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  els.ordersGrid.innerHTML = filtered.length
    ? filtered.map((order) => `
      <article class="order-card">
        <header>
          <div>
            <h3>${escapeHtml(order.code)} · ${escapeHtml(order.clientName)}</h3>
            <span class="chip ${statusClass(order.status)}">${escapeHtml(order.status)}</span>
          </div>
          <strong>${money.format(orderTotal(order))}</strong>
        </header>
        <div class="order-meta">
          <span>${escapeHtml(order.deviceType)} ${escapeHtml(order.deviceModel)}</span>
          <span>Telefone: ${escapeHtml(order.clientPhone)}</span>
          ${order.clientMessagePhone ? `<span>Recado: ${escapeHtml(order.clientMessagePhone)}</span>` : ""}
          ${Number(order.depositAmount || 0) > 0 ? `<span>Sinal: ${money.format(Number(order.depositAmount))}</span>` : ""}
          <span>Entrada: ${formatDate(order.createdDate)}${order.dueDate ? ` · Previsao: ${formatDate(order.dueDate)}` : ""}</span>
        </div>
        <p>${escapeHtml(order.reportedIssue)}</p>
        <button class="ghost-button" type="button" data-edit-order="${order.id}">Abrir OS</button>
      </article>
    `).join("")
    : `<div class="empty-state">Nenhuma ordem encontrada.</div>`;

  document.querySelectorAll("[data-edit-order]").forEach((button) => {
    button.addEventListener("click", () => openOrderDialog(button.dataset.editOrder));
  });
}

function renderCash() {
  const sorted = [...state.cash].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  renderCashOrderOptions();
  els.cashTotal.textContent = money.format(cashBalance());
  els.cashTable.innerHTML = sorted.length
    ? sorted.map((item) => `
      <tr>
        <td>${formatDate(item.date)}</td>
        <td>${escapeHtml(item.category || "Movimento")}</td>
        <td>${escapeHtml(item.clientName || "-")}</td>
        <td>${escapeHtml(item.description)}</td>
        <td>${escapeHtml(paymentLabel(item))}</td>
        <td>${item.type === "entrada" ? "+" : "-"} ${money.format(Number(item.amount))}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="6">Nenhum movimento cadastrado.</td></tr>`;
}

function renderCashOrderOptions() {
  const currentValue = els.cashOrderSelect.value;
  const options = [...state.orders]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((order) => {
      const balance = orderBalance(order);
      return `
        <option value="${escapeHtml(order.id)}">
          ${escapeHtml(order.code)} - ${escapeHtml(order.clientName)} - ${escapeHtml(order.deviceType)} ${escapeHtml(order.deviceModel)} - saldo ${money.format(balance)}
        </option>
      `;
    })
    .join("");

  els.cashOrderSelect.innerHTML = `<option value="">Selecione uma OS</option>${options}`;
  els.cashOrderSelect.value = currentValue;
}

function openOrderDialog(id = null) {
  editingOrderId = id;
  els.orderForm.reset();
  els.itemsList.innerHTML = "";

  if (id) {
    const order = state.orders.find((item) => item.id === id);
    if (!order) return;
    els.orderCodeLabel.textContent = order.code;
    els.clientName.value = order.clientName;
    els.clientPhone.value = order.clientPhone;
    els.clientCpf.value = order.clientCpf || "";
    els.clientMessagePhone.value = order.clientMessagePhone || "";
    els.clientAddress.value = order.clientAddress || "";
    els.deviceType.value = order.deviceType;
    els.deviceModel.value = order.deviceModel;
    els.deviceSerial.value = order.deviceSerial;
    els.devicePassword.value = order.devicePassword;
    els.reportedIssue.value = order.reportedIssue;
    els.diagnosis.value = order.diagnosis;
    els.orderStatus.value = order.status;
    els.dueDate.value = formatDateForInput(order.dueDate);
    els.depositAmount.value = order.depositAmount ?? 0;
    els.entryDateDisplay.value = formatDate(order.createdDate);
    els.warrantyEnabled.value = order.warrantyEnabled || "sim";
    els.warrantyDays.value = order.warrantyDays ?? 90;
    els.pickupDays.value = order.pickupDays ?? 90;
    els.storageFee.value = order.storageFee ?? 0;
    els.pickupNotice.value = order.pickupNotice || defaultPickupNotice();
    order.items.forEach(addItemRow);
    els.deleteOrderButton.hidden = false;
    els.printOrderButton.hidden = false;
  } else {
    els.orderCodeLabel.textContent = "Nova OS";
    els.entryDateDisplay.value = formatDate(toDateInput(new Date()));
    els.orderStatus.value = "Entrada";
    els.depositAmount.value = 0;
    els.warrantyEnabled.value = "sim";
    els.warrantyDays.value = 90;
    els.pickupDays.value = 90;
    els.storageFee.value = 0;
    els.pickupNotice.value = defaultPickupNotice();
    addItemRow({ description: "Mao de obra", qty: 1, price: 0 });
    els.deleteOrderButton.hidden = true;
    els.printOrderButton.hidden = true;
  }

  calculateDialogTotal();
  els.orderDialog.showModal();
}

function addItemRow(item = { description: "", qty: 1, price: 0 }) {
  const fragment = els.itemTemplate.content.cloneNode(true);
  fragment.querySelector(".item-description").value = item.description || "";
  fragment.querySelector(".item-qty").value = item.qty || 1;
  fragment.querySelector(".item-price").value = item.price || 0;
  els.itemsList.append(fragment);
  calculateDialogTotal();
}

function handleItemRemove(event) {
  const button = event.target.closest(".remove-item");
  if (!button) return;
  button.closest(".item-row").remove();
  if (!els.itemsList.children.length) addItemRow();
  calculateDialogTotal();
}

function calculateDialogTotal() {
  const total = readItemsFromDialog().reduce((sum, item) => sum + item.qty * item.price, 0);
  els.orderTotal.textContent = money.format(total);
}

function saveOrderFromForm(event) {
  event.preventDefault();
  const now = new Date();
  const items = readItemsFromDialog();
  const previousOrder = state.orders.find((item) => item.id === editingOrderId);
  const order = {
    id: previousOrder?.id || crypto.randomUUID(),
    code: previousOrder?.code || nextOrderCode(),
    createdAt: previousOrder?.createdAt || now.toISOString(),
    createdDate: previousOrder?.createdDate || toDateInput(now),
    updatedAt: now.toISOString(),
    clientName: els.clientName.value.trim(),
    clientPhone: els.clientPhone.value.trim(),
    clientCpf: els.clientCpf.value.trim(),
    clientMessagePhone: els.clientMessagePhone.value.trim(),
    clientAddress: els.clientAddress.value.trim(),
    deviceType: els.deviceType.value,
    deviceModel: els.deviceModel.value.trim(),
    deviceSerial: els.deviceSerial.value.trim(),
    devicePassword: els.devicePassword.value.trim(),
    reportedIssue: els.reportedIssue.value.trim(),
    diagnosis: els.diagnosis.value.trim(),
    status: els.orderStatus.value,
    dueDate: parseBrazilianDate(els.dueDate.value),
    depositAmount: Number(els.depositAmount.value || 0),
    warrantyEnabled: els.warrantyEnabled.value,
    warrantyDays: Number(els.warrantyDays.value || 0),
    pickupDays: Number(els.pickupDays.value || 0),
    storageFee: Number(els.storageFee.value || 0),
    pickupNotice: els.pickupNotice.value.trim(),
    items
  };

  if (previousOrder) {
    state.orders = state.orders.map((item) => item.id === order.id ? order : item);
  } else {
    state.orders.push(order);
  }

  persist();
  els.orderDialog.close();
  render();
}

function deleteCurrentOrder() {
  if (!editingOrderId) return;
  const order = state.orders.find((item) => item.id === editingOrderId);
  const confirmed = confirm(`Excluir ${order.code}? Movimentos de caixa vinculados tambem serao removidos.`);
  if (!confirmed) return;
  state.orders = state.orders.filter((item) => item.id !== editingOrderId);
  state.cash = state.cash.filter((item) => item.orderId !== editingOrderId);
  persist();
  els.orderDialog.close();
  render();
}

function printCurrentOrder() {
  const order = state.orders.find((item) => item.id === editingOrderId);
  if (!order) return;

  els.receiptPrintArea.innerHTML = buildReceiptHtml(order);
  requestAnimationFrame(() => window.print());
}

function buildReceiptHtml(order) {
  return `
    <img class="receipt-logo" src="logo.png.jpeg" alt="">
    <h1>${escapeHtml(state.company.name)}</h1>
    ${state.company.document ? `<p class="receipt-center">${escapeHtml(state.company.document)}</p>` : ""}
    ${state.company.phone ? `<p class="receipt-center">Tel: ${escapeHtml(state.company.phone)}</p>` : ""}
    ${state.company.address ? `<p class="receipt-center">${escapeHtml(state.company.address)}</p>` : ""}
    <div class="receipt-line"></div>
    <h2>ORDEM DE SERVICO</h2>
    <p class="receipt-center">${escapeHtml(order.code)}</p>
    <div class="receipt-line"></div>
    <p><span class="receipt-label">Entrada:</span> ${formatDate(order.createdDate)}</p>
    <p><span class="receipt-label">Status:</span> ${escapeHtml(order.status)}</p>
    ${order.dueDate ? `<p><span class="receipt-label">Previsao:</span> ${formatDate(order.dueDate)}</p>` : ""}
    <div class="receipt-line"></div>
    <p><span class="receipt-label">Cliente:</span> ${escapeHtml(order.clientName)}</p>
    ${order.clientCpf ? `<p><span class="receipt-label">CPF:</span> ${escapeHtml(order.clientCpf)}</p>` : ""}
    <p><span class="receipt-label">Telefone:</span> ${escapeHtml(order.clientPhone)}</p>
    ${order.clientMessagePhone ? `<p><span class="receipt-label">Recado:</span> ${escapeHtml(order.clientMessagePhone)}</p>` : ""}
    ${order.clientAddress ? `<p><span class="receipt-label">Endereco:</span> ${escapeHtml(order.clientAddress)}</p>` : ""}
    <div class="receipt-line"></div>
    <p><span class="receipt-label">Equip.:</span> ${escapeHtml(order.deviceType)} ${escapeHtml(order.deviceModel)}</p>
    ${order.deviceSerial ? `<p><span class="receipt-label">Serial/IMEI:</span> ${escapeHtml(order.deviceSerial)}</p>` : ""}
    ${order.devicePassword ? `<p><span class="receipt-label">Senha:</span> ${escapeHtml(order.devicePassword)}</p>` : ""}
    <div class="receipt-line"></div>
    <p><span class="receipt-label">Defeito:</span></p>
    <p>${escapeHtml(order.reportedIssue)}</p>
    ${order.diagnosis ? `
      <div class="receipt-line"></div>
      <p><span class="receipt-label">Diagnostico/servico:</span></p>
      <p>${escapeHtml(order.diagnosis)}</p>
    ` : ""}
    <div class="receipt-line"></div>
    <table class="receipt-items">
      <thead>
        <tr>
          <th>Item</th>
          <th class="qty">Qtd</th>
          <th class="value">Total</th>
        </tr>
      </thead>
      <tbody>
        ${order.items.map((item) => `
          <tr>
            <td>${escapeHtml(item.description)}</td>
            <td class="qty">${item.qty}</td>
            <td class="value">${money.format(item.qty * item.price)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <p class="receipt-total">TOTAL ${money.format(orderTotal(order))}</p>
    <p class="receipt-total">SINAL ${money.format(Number(order.depositAmount || 0))}</p>
    <p class="receipt-total">SALDO ${money.format(Math.max(orderTotal(order) - Number(order.depositAmount || 0), 0))}</p>
    <div class="receipt-line"></div>
    <p><span class="receipt-label">Garantia:</span> ${warrantyLabel(order)}</p>
    <p><span class="receipt-label">Retirada:</span> ate ${order.pickupDays ?? 90} dias apos aviso.</p>
    ${Number(order.storageFee || 0) > 0 ? `<p><span class="receipt-label">Guarda:</span> ${money.format(Number(order.storageFee))}/dia apos prazo.</p>` : ""}
    ${state.company.notes ? `
      <div class="receipt-line"></div>
      <p>${escapeHtml(state.company.notes)}</p>
    ` : ""}
    ${order.pickupNotice ? `
      <div class="receipt-line"></div>
      <p>${escapeHtml(order.pickupNotice)}</p>
    ` : ""}
    <div class="receipt-sign">Assinatura do cliente</div>
    <div class="receipt-line"></div>
    <p class="receipt-center">Obrigado pela preferencia</p>
  `;
}

function readItemsFromDialog() {
  return [...els.itemsList.querySelectorAll(".item-row")]
    .map((row) => ({
      description: row.querySelector(".item-description").value.trim(),
      qty: Number(row.querySelector(".item-qty").value || 1),
      price: Number(row.querySelector(".item-price").value || 0)
    }))
    .filter((item) => item.description || item.price > 0);
}

function saveCashMovement(event) {
  event.preventDefault();
  state.cash.push({
    id: crypto.randomUUID(),
    type: els.cashType.value,
    category: els.cashCategory.value,
    orderId: els.cashCategory.value === "Manutencao/OS" ? els.cashOrderSelect.value : "",
    clientName: els.cashClientName.value.trim(),
    method: els.cashMethod.value,
    paymentMode: els.cashMethod.value === "Cartao credito" ? els.cashPaymentMode.value : "avista",
    installments: els.cashMethod.value === "Cartao credito" && els.cashPaymentMode.value === "parcelado"
      ? Number(els.cashInstallments.value)
      : 1,
    description: els.cashDescription.value.trim(),
    amount: Number(els.cashAmount.value),
    date: els.cashDate.value,
    createdAt: new Date().toISOString()
  });
  persist();
  els.cashForm.reset();
  els.cashDate.valueAsDate = new Date();
  syncCashCategory();
  syncCreditFields();
  render();
}

function fillCompanyForm() {
  els.companyName.value = state.company.name;
  els.companyPhone.value = state.company.phone;
  els.companyDocument.value = state.company.document;
  els.companyAddress.value = state.company.address;
  els.companyNotes.value = state.company.notes;
}

function saveCompany(event) {
  event.preventDefault();
  state.company = {
    name: els.companyName.value.trim(),
    phone: els.companyPhone.value.trim(),
    document: els.companyDocument.value.trim(),
    address: els.companyAddress.value.trim(),
    notes: els.companyNotes.value.trim()
  };
  persist();
  alert("Dados da empresa salvos.");
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `backup-assistencia-${toDateInput(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported.orders || !imported.cash || !imported.company) {
        throw new Error("Formato invalido");
      }
      state.company = imported.company;
      state.orders = imported.orders;
      state.cash = imported.cash;
      persist();
      fillCompanyForm();
      render();
      alert("Backup importado com sucesso.");
    } catch {
      alert("Nao foi possivel importar este arquivo.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function orderTotal(order) {
  return order.items.reduce((sum, item) => sum + Number(item.qty) * Number(item.price), 0);
}

function orderBalance(order) {
  return Math.max(orderTotal(order) - Number(order.depositAmount || 0), 0);
}

function cashBalance() {
  return state.cash.reduce((sum, item) => {
    const amount = Number(item.amount);
    return item.type === "entrada" ? sum + amount : sum - amount;
  }, 0);
}

function paymentLabel(item) {
  if (item.method !== "Cartao credito") return item.method;
  if (item.paymentMode === "parcelado" && Number(item.installments) > 1) {
    return `${item.method} - ${item.installments}x`;
  }
  return `${item.method} - a vista`;
}

function warrantyLabel(order) {
  if (order.warrantyEnabled === "nao") return "Sem garantia";
  const days = Number(order.warrantyDays ?? 90);
  return `${days} dias`;
}

function defaultPickupNotice() {
  return "O prazo para retirada e de ate 90 dias apos o cliente ser informado que o aparelho esta pronto para retirada, caso o cliente nao retire no tempo combinado e passar esses 90 dias sem entrar em contato, a empresa entrara em contato com o cliente informando que o aparelho sera descartado, vendido, desmontado ou usado para cobrir os custos.";
}

function nextOrderCode() {
  const year = new Date().getFullYear();
  const numbers = state.orders
    .map((order) => Number(order.code.match(/OS-\d{4}-(\d+)/)?.[1] || 0));
  const number = Math.max(0, ...numbers) + 1;
  return `OS-${year}-${String(number).padStart(4, "0")}`;
}

function toDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function formatDateForInput(value) {
  if (!value) return "";
  if (value.includes("/")) return value;
  return formatDate(value);
}

function maskBrazilianDate(event) {
  const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
  const parts = [];

  if (digits.length > 0) parts.push(digits.slice(0, 2));
  if (digits.length > 2) parts.push(digits.slice(2, 4));
  if (digits.length > 4) parts.push(digits.slice(4, 8));

  event.target.value = parts.join("/");
}

function parseBrazilianDate(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function normalize(value) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function statusClass(status) {
  if (["Finalizado"].includes(status)) return "ok";
  if (["Cancelado"].includes(status)) return "danger";
  if (["Aguardando peca", "Aguardando retirada"].includes(status)) return "warn";
  return "info";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
