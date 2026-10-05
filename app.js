const STORAGE_KEY = "assistencia_os_caixa_v1";
const LOCAL_API_BASE = "http://localhost:3000";
const API_BASE = window.location.protocol === "file:" ? LOCAL_API_BASE : window.location.origin;
const OFFICIAL_IMEI_CHECK_URL = "https://www.consultaserialaparelho.com.br/public-web/homeSiga?token=20260618&lang=pt_BR&locale=pt_BR&hl=pt-BR";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

let state = {
  company: defaultCompany(),
  orders: [],
  cash: [],
  clients: [],
  products: []
};
let editingOrderId = null;
let editingCashId = null;

const els = {
  pageTitle: document.querySelector("#pageTitle"),
  navButtons: document.querySelectorAll(".nav-button"),
  viewLinks: document.querySelectorAll("[data-view-link]"),
  views: {
    dashboard: document.querySelector("#dashboardView"),
    orders: document.querySelector("#ordersView"),
    cash: document.querySelector("#cashView"),
    clients: document.querySelector("#clientsView"),
    products: document.querySelector("#productsView"),
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
  cashClientCpfLabel: document.querySelector("#cashClientCpfLabel"),
  cashClientCpf: document.querySelector("#cashClientCpf"),
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
  saveCashButton: document.querySelector("#saveCashButton"),
  cancelCashEditButton: document.querySelector("#cancelCashEditButton"),
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
  newOrderButtonToolbar: document.querySelector("#newOrderButtonToolbar"),
  deleteOrderButton: document.querySelector("#deleteOrderButton"),
  printOrderButton: document.querySelector("#printOrderButton"),
  sendWhatsAppButton: document.querySelector("#sendWhatsAppButton"),
  addItemButton: document.querySelector("#addItemButton"),
  itemsList: document.querySelector("#itemsList"),
  itemTemplate: document.querySelector("#itemTemplate"),
  orderTotal: document.querySelector("#orderTotal"),
  backupButton: document.querySelector("#backupButton"),
  restoreInput: document.querySelector("#restoreInput"),
  historyButton: document.querySelector("#historyButton"),
  historyDialog: document.querySelector("#historyDialog"),
  closeHistoryDialog: document.querySelector("#closeHistoryDialog"),
  clientForm: document.querySelector("#clientForm"),
  clientNameCatalog: document.querySelector("#clientNameCatalog"),
  clientList: document.querySelector("#clientList"),
  productForm: document.querySelector("#productForm"),
  productList: document.querySelector("#productList"),
  clientNameInput: document.querySelector("#clientNameInput"),
  clientPhoneInput: document.querySelector("#clientPhoneInput"),
  clientCpfInput: document.querySelector("#clientCpfInput"),
  clientAddressInput: document.querySelector("#clientAddressInput"),
  clientMessagePhoneInput: document.querySelector("#clientMessagePhoneInput"),
  productNameInput: document.querySelector("#productNameInput"),
  productCategoryInput: document.querySelector("#productCategoryInput"),
  productBrandInput: document.querySelector("#productBrandInput"),
  productPriceInput: document.querySelector("#productPriceInput"),
  productCodeInput: document.querySelector("#productCodeInput"),
  productStockInput: document.querySelector("#productStockInput"),
  historyTabs: document.querySelectorAll(".history-tab"),
  ordersHistoryTable: document.querySelector("#ordersHistoryTable"),
  cashHistoryTable: document.querySelector("#cashHistoryTable"),
  downloadOrdersHistory: document.querySelector("#downloadOrdersHistory"),
  downloadCashHistory: document.querySelector("#downloadCashHistory"),
  receiptPrintArea: document.querySelector("#receiptPrintArea"),
  clientName: document.querySelector("#clientName"),
  clientPhone: document.querySelector("#clientPhone"),
  clientCpf: document.querySelector("#clientCpf"),
  clientMessagePhone: document.querySelector("#clientMessagePhone"),
  clientAddress: document.querySelector("#clientAddress"),
  deviceType: document.querySelector("#deviceType"),
  deviceModel: document.querySelector("#deviceModel"),
  deviceSerial: document.querySelector("#deviceSerial"),
  imeiCheckResult: document.querySelector("#imeiCheckResult"),
  openImeiCheckButton: document.querySelector("#openImeiCheckButton"),
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

async function boot() {
  state = await loadState();
  els.cashDate.valueAsDate = new Date();
  bindEvents();
  syncCreditFields();
  syncCashContext();
  fillCompanyForm();
  setView("dashboard");
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
  els.sendWhatsAppButton.addEventListener("click", sendCurrentOrderWhatsApp);
  els.dueDate.addEventListener("input", maskBrazilianDate);
  els.dueDate.addEventListener("blur", normalizeBrazilianDateInput);
  els.deviceSerial.addEventListener("input", handleImeiInput);
  els.openImeiCheckButton.addEventListener("click", openOfficialImeiCheck);
  els.orderSearch.addEventListener("input", renderOrders);
  els.statusFilter.addEventListener("change", renderOrders);
  els.cashType.addEventListener("change", syncCashCategory);
  els.cashCategory.addEventListener("change", syncCashContext);
  if (els.cashOrderSelect) {
    els.cashOrderSelect.addEventListener("change", fillCashFromOrder);
  }
  if (els.cashClientCpf) {
    els.cashClientCpf.addEventListener("input", handleCashClientCpfLookup);
    els.cashClientCpf.addEventListener("blur", handleCashClientCpfLookup);
  }
  els.cashMethod.addEventListener("change", syncCreditFields);
  els.cashPaymentMode.addEventListener("change", syncCreditFields);
  els.cashForm.addEventListener("submit", saveCashMovement);
  if (els.cancelCashEditButton) {
    els.cancelCashEditButton.addEventListener("click", resetCashEditor);
  }
  els.cashTable.addEventListener("click", handleCashTableClick);
  if (els.cashHistoryTable) {
    els.cashHistoryTable.addEventListener("click", handleCashHistoryTableClick);
  }
  els.companyForm.addEventListener("submit", saveCompany);
  els.clientForm.addEventListener("submit", saveClient);
  els.productForm.addEventListener("submit", saveProduct);
  els.backupButton.addEventListener("click", exportBackup);
  els.restoreInput.addEventListener("change", importBackup);
  if (els.clientNameInput) {
    els.clientNameInput.addEventListener("input", updateClientSuggestions);
  }
  if (els.clientCpfInput) {
    els.clientCpfInput.addEventListener("blur", lookupClientByCpf);
  }
  if (els.clientName) {
    els.clientName.addEventListener("input", updateClientSuggestions);
    els.clientName.addEventListener("blur", lookupClientByName);
  }
  if (els.clientCpf) {
    els.clientCpf.addEventListener("blur", lookupClientByCpf);
  }
  if (els.historyButton) {
    els.historyButton.addEventListener("click", () => openHistoryDialog());
  }
  if (els.closeHistoryDialog) {
    els.closeHistoryDialog.addEventListener("click", () => els.historyDialog.close());
  }
  els.historyTabs.forEach((button) => {
    button.addEventListener("click", () => setHistoryTab(button.dataset.historyTarget));
  });
  if (els.downloadOrdersHistory) {
    els.downloadOrdersHistory.addEventListener("click", () => exportHistoryExcel("orders"));
  }
  if (els.downloadCashHistory) {
    els.downloadCashHistory.addEventListener("click", () => exportHistoryExcel("cash"));
  }
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
  els.cashClientCpfLabel.classList.toggle("hidden-field", !isMaintenance);
  els.cashClientCpfLabel.classList.toggle("visible", isMaintenance);

  if (isExpense) {
    els.cashClientName.value = "";
    els.cashClientCpf.value = "";
    els.cashOrderSelect.value = "";
  }
}

function fillCashFromOrder() {
  const order = state.orders.find((item) => item.id === els.cashOrderSelect.value);
  if (!order) return;

  const balance = orderBalance(order);
  els.cashClientName.value = order.clientName;
  els.cashClientCpf.value = order.clientCpf || els.cashClientCpf.value || "";
  els.cashDescription.value = `Pagamento ${order.code} - ${order.clientName} - ${order.deviceType} ${order.deviceModel}`;
  els.cashAmount.value = balance.toFixed(2);
}

function handleCashClientCpfLookup() {
  if (els.cashCategory.value !== "Manutencao/OS") return;
  const cpf = (els.cashClientCpf.value || "").trim();
  if (!cpf) return;

  const order = state.orders.find((item) => normalize(item.clientCpf || "") === normalize(cpf));
  if (!order) return;

  els.cashOrderSelect.value = order.id;
  fillCashFromOrder();
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

async function loadState() {
  const fallback = {
    company: defaultCompany(),
    orders: [],
    cash: [],
    clients: [],
    products: []
  };

  if (API_BASE) {
    try {
      const response = await fetch(`${API_BASE}/api/state`);
      if (response.ok) {
        const remote = await response.json();
        return {
          company: { ...defaultCompany(), ...remote.company },
          orders: Array.isArray(remote.orders) ? remote.orders : [],
          cash: Array.isArray(remote.cash) ? remote.cash : [],
          clients: Array.isArray(remote.clients) ? remote.clients : [],
          products: Array.isArray(remote.products) ? remote.products : []
        };
      }
    } catch {
      // Fallback para localStorage quando a API não estiver disponível.
    }
  }

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return fallback;

    return {
      company: { ...defaultCompany(), ...saved.company },
      orders: Array.isArray(saved.orders) ? saved.orders : [],
      cash: Array.isArray(saved.cash) ? saved.cash : [],
      clients: Array.isArray(saved.clients) ? saved.clients : [],
      products: Array.isArray(saved.products) ? saved.products : []
    };
  } catch {
    return fallback;
  }
}

function defaultCompany() {
  return {
    name: "CCN SOLUÇÕES TECNOLÓGICAS",
    phone: "11-2936-2016",
    document: "11-94573-0188",
    address: "Rua Dr. SÍlvio Dante Bertacchi, 166 - Vila Sonia, São Paulo",
    notes: "Assistência Técnica Especializada em Celular - Notebook - Computador - Tablet\nHorario de atendimento: das 10hrs as 18hrs de Segunda a Sexta-feira e aos Sábado das 10hrs as 15hrs"
  };
}

async function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  if (!API_BASE) return;

  try {
    const response = await fetch(`${API_BASE}/api/state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state)
    });

    if (!response.ok) {
      throw new Error("API indisponivel");
    }
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

function setView(view) {
  Object.entries(els.views).forEach(([name, element]) => {
    element.classList.toggle("active", name === view);
  });

  els.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  const titles = {
    dashboard: "ACOMPANHAMENTO DE CONTROLE",
    orders: "ORDEM DE SERVIÇO",
    cash: "CAIXA",
    clients: "CADASTRO DE CLIENTES",
    products: "CADASTRO DE PRODUTOS",
    settings: "Empresa"
  };
  els.pageTitle.textContent = titles[view];

  const showHistory = ["orders", "cash"].includes(view);
  const showNewOrder = view === "orders";

  if (els.historyButton) els.historyButton.hidden = !showHistory;
  if (els.newOrderButton) els.newOrderButton.hidden = !showNewOrder;
}

function render() {
  renderDashboard();
  renderOrders();
  renderCash();
  renderHistoryTables();
  renderClientCatalog();
  renderProductCatalog();
  syncAutocompleteLists();
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
        order.imeiCheckResult,
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
          ${order.deviceSerial ? `<span>IMEI: ${escapeHtml(order.deviceSerial)}</span>` : ""}
          ${order.imeiCheckResult ? `<span>Consulta IMEI: ${escapeHtml(shortText(order.imeiCheckResult, 90))}</span>` : ""}
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
        <td><button class="ghost-button" type="button" data-edit-cash="${item.id}">Editar</button></td>
      </tr>
    `).join("")
    : `<tr><td colspan="7">Nenhum movimento cadastrado.</td></tr>`;
}

function handleCashTableClick(event) {
  const button = event.target.closest("[data-edit-cash]");
  if (!button) return;

  const item = state.cash.find((entry) => entry.id === button.dataset.editCash);
  if (!item) return;

  openCashEditor(item);
}

function openCashEditor(item) {
  editingCashId = item.id;
  els.cashType.value = item.type || "entrada";
  els.cashCategory.value = item.category || "Venda";
  els.cashMethod.value = item.method || "Dinheiro";
  els.cashDescription.value = item.description || "";
  els.cashAmount.value = Number(item.amount || 0);
  els.cashDate.value = item.date || toDateInput(new Date());
  els.cashClientName.value = item.clientName || "";
  els.cashClientCpf.value = item.clientCpf || "";
  els.cashOrderSelect.value = item.orderId || "";
  els.cashPaymentMode.value = item.paymentMode || "avista";
  els.cashInstallments.value = String(item.installments || 1);
  syncCashContext();
  syncCreditFields();

  const button = els.cashForm.querySelector("#saveCashButton");
  if (button) button.textContent = "Salvar edição";

  const cancelButton = els.cashForm.querySelector("#cancelCashEditButton");
  if (cancelButton) cancelButton.hidden = false;
}

function resetCashEditor() {
  editingCashId = null;
  els.cashForm.reset();
  els.cashDate.valueAsDate = new Date();
  syncCashCategory();
  syncCreditFields();

  const button = els.cashForm.querySelector("#saveCashButton");
  if (button) button.textContent = "Salvar movimento";

  const cancelButton = els.cashForm.querySelector("#cancelCashEditButton");
  if (cancelButton) cancelButton.hidden = true;
}

function renderHistoryTables() {
  const orders = [...state.orders].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const cash = [...state.cash].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  els.ordersHistoryTable.innerHTML = orders.length
    ? orders.map((order) => {
        const balance = Math.max(orderTotal(order) - Number(order.depositAmount || 0), 0);
        return `
          <tr>
            <td>${escapeHtml(order.code)}</td>
            <td>${escapeHtml(order.clientName)}</td>
            <td>${escapeHtml(`${order.deviceType} ${order.deviceModel}`)}</td>
            <td><span class="chip ${statusClass(order.status)}">${escapeHtml(order.status)}</span></td>
            <td>${formatDate(order.createdDate)}</td>
            <td>${order.dueDate ? formatDate(order.dueDate) : "-"}</td>
            <td>${money.format(orderTotal(order))}</td>
            <td>${money.format(Number(order.depositAmount || 0))}</td>
            <td>${money.format(balance)}</td>
          </tr>
        `;
      }).join("")
    : `<tr><td colspan="9">Nenhuma ordem no historico.</td></tr>`;

  els.cashHistoryTable.innerHTML = cash.length
    ? cash.map((item) => `
      <tr>
        <td>${formatDate(item.date)} <button class="ghost-button" type="button" data-edit-cash-history="${item.id}" style="margin-left: 8px;">Editar</button></td>
        <td>${escapeHtml(item.type === "entrada" ? "Entrada" : "Saida")}</td>
        <td>${escapeHtml(item.category || "Movimento")}</td>
        <td>${escapeHtml(item.description)}</td>
        <td>${escapeHtml(paymentLabel(item))}</td>
        <td>${escapeHtml(item.clientName || item.orderId || "-")}</td>
        <td>${item.type === "entrada" ? "+" : "-"} ${money.format(Number(item.amount))}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="7">Nenhum movimento de caixa no historico.</td></tr>`;
}

function handleCashHistoryTableClick(event) {
  const button = event.target.closest("[data-edit-cash-history]");
  if (!button) return;

  const item = state.cash.find((entry) => entry.id === button.dataset.editCashHistory);
  if (!item) return;

  openCashEditor(item);
  setView("cash");
  els.historyDialog.close();
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

function renderClientCatalog() {
  if (!els.clientList) return;
  els.clientList.innerHTML = state.clients.length
    ? state.clients.map((client) => `
      <tr>
        <td>${escapeHtml(client.name || "-")}</td>
        <td>${escapeHtml(client.phone || "-")}</td>
        <td>${escapeHtml(client.cpf || "-")}</td>
        <td>${escapeHtml(client.address || "-")}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="4">Nenhum cliente cadastrado.</td></tr>`;
}

function renderProductCatalog() {
  if (!els.productList) return;
  els.productList.innerHTML = state.products.length
    ? state.products.map((product) => `
      <tr>
        <td>${escapeHtml(product.code || "-")}</td>
        <td>${escapeHtml(product.name || "-")}</td>
        <td>${escapeHtml(product.category || "-")}</td>
        <td>${escapeHtml(product.brand || "-")}</td>
        <td>${money.format(Number(product.price || 0))}</td>
        <td>${escapeHtml(product.stock || "0")}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="6">Nenhum produto cadastrado.</td></tr>`;
}

function syncAutocompleteLists() {
  const clientOptions = state.clients.map((client) => `<option value="${escapeHtml(client.name)}"></option>`).join("");
  if (document.querySelector("#clientSuggestions")) {
    document.querySelector("#clientSuggestions").innerHTML = clientOptions;
  }

  const productOptions = state.products.map((product) => `<option value="${escapeHtml(product.name)}"></option>`).join("");
  if (document.querySelector("#productSuggestions")) {
    document.querySelector("#productSuggestions").innerHTML = productOptions;
  }
}

function saveClient(event) {
  event.preventDefault();
  const payload = {
    id: crypto.randomUUID(),
    name: els.clientNameInput.value.trim(),
    phone: els.clientPhoneInput.value.trim(),
    cpf: els.clientCpfInput.value.trim(),
    messagePhone: els.clientMessagePhoneInput.value.trim(),
    address: els.clientAddressInput.value.trim()
  };

  if (!payload.name) {
    alert("Informe o nome do cliente.");
    return;
  }

  const existing = state.clients.find((client) => client.cpf && client.cpf === payload.cpf);
  if (existing) {
    state.clients = state.clients.map((client) => client.id === existing.id ? { ...existing, ...payload } : client);
  } else {
    state.clients.push(payload);
  }

  persist();
  els.clientForm.reset();
  render();
}

function saveProduct(event) {
  event.preventDefault();
  const payload = {
    id: crypto.randomUUID(),
    code: els.productCodeInput.value.trim(),
    name: els.productNameInput.value.trim(),
    category: els.productCategoryInput.value.trim(),
    brand: els.productBrandInput.value.trim(),
    price: Number(els.productPriceInput.value || 0),
    stock: Number(els.productStockInput.value || 0)
  };

  if (!payload.name) {
    alert("Informe o nome do produto.");
    return;
  }

  const existing = state.products.find((product) => product.code && product.code === payload.code);
  if (existing) {
    state.products = state.products.map((product) => product.id === existing.id ? { ...existing, ...payload } : product);
  } else {
    state.products.push(payload);
  }

  persist();
  els.productForm.reset();
  render();
}

function updateClientSuggestions() {
  if (!els.clientName) return;
  const value = normalize(els.clientName.value);
  const matches = !value ? state.clients : state.clients.filter((client) => normalize(client.name).includes(value) || normalize(client.cpf).includes(value));
  if (document.querySelector("#clientSuggestions")) {
    document.querySelector("#clientSuggestions").innerHTML = matches.map((client) => `<option value="${escapeHtml(client.name)}"></option>`).join("");
  }
}

function lookupClientByCpf() {
  const cpf = (els.clientCpf || {}).value || "";
  if (!cpf) return;
  const client = state.clients.find((item) => normalize(item.cpf || "") === normalize(cpf));
  if (!client) return;
  if (els.clientName) els.clientName.value = client.name || "";
  if (els.clientPhone) els.clientPhone.value = client.phone || "";
  if (els.clientMessagePhone) els.clientMessagePhone.value = client.messagePhone || "";
  if (els.clientAddress) els.clientAddress.value = client.address || "";
}

function lookupClientByName() {
  const name = (els.clientName || {}).value || "";
  if (!name) return;
  const client = state.clients.find((item) => normalize(item.name || "") === normalize(name));
  if (!client) return;
  if (els.clientCpf) els.clientCpf.value = client.cpf || "";
  if (els.clientPhone) els.clientPhone.value = client.phone || "";
  if (els.clientMessagePhone) els.clientMessagePhone.value = client.messagePhone || "";
  if (els.clientAddress) els.clientAddress.value = client.address || "";
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
    els.imeiCheckResult.value = order.imeiCheckResult || "";
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
    els.imeiCheckResult.value = "";
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
  const descriptionInput = fragment.querySelector(".item-description");
  const quantityInput = fragment.querySelector(".item-qty");
  const priceInput = fragment.querySelector(".item-price");

  descriptionInput.value = item.description || "";
  quantityInput.value = item.qty || 1;
  priceInput.value = item.price || 0;

  descriptionInput.addEventListener("input", () => {
    const product = findProductByNameOrCode(descriptionInput.value);
    if (!product) return;
    descriptionInput.value = product.name;
    priceInput.value = Number(product.price || 0).toFixed(2);
    calculateDialogTotal();
  });

  els.itemsList.append(fragment);
  calculateDialogTotal();
}

function findProductByNameOrCode(value) {
  const query = normalize((value || "").trim());
  if (!query) return null;

  return state.products.find((product) => {
    const name = normalize(product.name || "");
    const code = normalize(product.code || "");
    const category = normalize(product.category || "");
    return name.includes(query) || code.includes(query) || category.includes(query);
  }) || null;
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

function handleImeiInput() {
  els.deviceSerial.value = normalizeImei(els.deviceSerial.value);
}

function openOfficialImeiCheck() {
  window.open(OFFICIAL_IMEI_CHECK_URL, "_blank", "noopener");
}

async function saveOrderFromForm(event) {
  event.preventDefault();
  const now = new Date();
  const items = readItemsFromDialog();
  const previousOrder = state.orders.find((item) => item.id === editingOrderId);
  const previousStatus = previousOrder?.status || "";
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
    imeiCheckResult: els.imeiCheckResult.value.trim(),
    imeiCheckedAt: els.imeiCheckResult.value.trim() ? new Date().toISOString() : "",
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

  await persist();
  await notifyOrderStatusChange(order, previousStatus);
  els.orderDialog.close();
  render();
}

async function notifyOrderStatusChange(order, previousStatus) {
  if (!previousStatus || previousStatus === order.status || !API_BASE) return;

  const whatsapp = order.clientMessagePhone || order.clientPhone;
  if (!whatsapp) {
    alert("OS salva, mas o cliente nao tem WhatsApp cadastrado para receber a atualizacao.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/whatsapp/status-update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order: {
          code: order.code,
          clientName: order.clientName,
          clientWhatsapp: whatsapp,
          deviceType: order.deviceType,
          deviceModel: order.deviceModel,
          status: order.status,
          previousStatus
        }
      })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.enabled === false) {
      if (payload.whatsappWebUrl) {
        window.open(payload.whatsappWebUrl, "_blank", "noopener");
        return;
      }

      alert(payload.error || "OS salva, mas o WhatsApp da loja ainda nao esta configurado para envio automatico.");
    }
  } catch {
    openWhatsAppWebForOrder(order);
  }
}

function readOrderDraftFromForm() {
  return {
    code: document.querySelector("#orderCodeLabel")?.textContent || "OS",
    clientName: els.clientName.value.trim(),
    clientPhone: els.clientPhone.value.trim(),
    clientWhatsapp: els.clientMessagePhone.value.trim() || els.clientPhone.value.trim(),
    deviceType: els.deviceType.value,
    deviceModel: els.deviceModel.value.trim(),
    status: els.orderStatus.value
  };
}

function sendCurrentOrderWhatsApp() {
  openWhatsAppWebForOrder(readOrderDraftFromForm());
}

function openWhatsAppWebForOrder(order) {
  const phone = normalizeWhatsappPhone(order.clientWhatsapp || order.clientMessagePhone || order.clientPhone);

  if (!phone) {
    alert("Informe o WhatsApp do cliente antes de enviar a mensagem.");
    return;
  }

  window.open(whatsappWebUrl(phone, orderStatusMessage(order)), "_blank", "noopener");
}

function whatsappWebUrl(phone, message) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function normalizeWhatsappPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function orderStatusMessage(order) {
  const statusMessages = {
    Entrada: "Sua ordem de servico foi registrada e esta em analise.",
    Orcamento: "Sua ordem de servico esta em orcamento.",
    Aprovado: "Seu conserto foi aprovado e seguira para atendimento.",
    "Em reparo": "Seu aparelho esta em reparo.",
    "Aguardando peca": "Sua ordem de servico esta aguardando peca.",
    "Aguardando retirada": "Seu aparelho esta aguardando retirada.",
    Finalizado: "Seu conserto foi finalizado.",
    Cancelado: "O conserto foi cancelado."
  };
  const device = [order.deviceType, order.deviceModel].filter(Boolean).join(" ");

  return [
    `Ola, ${order.clientName || "cliente"}!`,
    "",
    `Atualizacao da ${order.code || "OS"}: ${order.status || ""}.`,
    statusMessages[order.status] || "Sua ordem de servico foi atualizada.",
    device ? `Aparelho: ${device}.` : "",
    "",
    "CCN Solucoes Tecnologicas"
  ].filter((line) => line !== "").join("\n");
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
  const companyDescription = (state.company.notes || "").split("\n")[0] || "Assistência Técnica Especializada em Celular - Notebook - Computador - Tablet";
  const companyHours = (state.company.notes || "").split("\n").slice(1).join(" ") || "";

  return `
    <img class="receipt-logo" src="logo.png.jpeg" alt="">
    <h1>${escapeHtml(state.company.name)}</h1>
    <p class="receipt-center">${escapeHtml(companyDescription)}</p>
    ${state.company.address ? `<p class="receipt-center">Endereço: ${escapeHtml(state.company.address)}</p>` : ""}
    ${state.company.phone ? `<p class="receipt-center">${escapeHtml(state.company.phone)}</p>` : ""}
    ${state.company.document ? `<p class="receipt-center">${escapeHtml(state.company.document)}</p>` : ""}
    ${companyHours ? `<p class="receipt-center">${escapeHtml(companyHours)}</p>` : ""}
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
    ${order.deviceSerial ? `<p><span class="receipt-label">IMEI DO CELULAR:</span> ${escapeHtml(order.deviceSerial)}</p>` : ""}
    ${order.imeiCheckResult ? `<p><span class="receipt-label">Consulta IMEI:</span> ${escapeHtml(order.imeiCheckResult)}</p>` : ""}
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
    .map((row) => {
      const descriptionInput = row.querySelector(".item-description");
      const qtyInput = row.querySelector(".item-qty");
      const priceInput = row.querySelector(".item-price");
      const description = (descriptionInput?.value || "").trim();
      const qty = Number(qtyInput?.value || 1);
      const price = Number(priceInput?.value || 0);

      return {
        description,
        qty,
        price
      };
    })
    .filter((item) => item.description || item.price > 0);
}

function saveCashMovement(event) {
  event.preventDefault();
  const payload = {
    id: editingCashId || crypto.randomUUID(),
    type: els.cashType.value,
    category: els.cashCategory.value,
    orderId: els.cashCategory.value === "Manutencao/OS" ? els.cashOrderSelect.value : "",
    clientName: els.cashClientName.value.trim(),
    clientCpf: els.cashClientCpf.value.trim(),
    method: els.cashMethod.value,
    paymentMode: els.cashMethod.value === "Cartao credito" ? els.cashPaymentMode.value : "avista",
    installments: els.cashMethod.value === "Cartao credito" && els.cashPaymentMode.value === "parcelado"
      ? Number(els.cashInstallments.value)
      : 1,
    description: els.cashDescription.value.trim(),
    amount: Number(els.cashAmount.value),
    date: els.cashDate.value,
    createdAt: editingCashId ? (state.cash.find((item) => item.id === editingCashId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
  };

  if (editingCashId) {
    state.cash = state.cash.map((item) => item.id === editingCashId ? payload : item);
  } else {
    state.cash.push(payload);
  }

  persist();
  resetCashEditor();
  render();
}

function fillCompanyForm() {
  const company = { ...defaultCompany(), ...state.company };
  state.company = company;

  els.companyName.value = company.name;
  els.companyPhone.value = company.phone;
  els.companyDocument.value = company.document;
  els.companyAddress.value = company.address;
  els.companyNotes.value = company.notes;
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

function openHistoryDialog() {
  setHistoryTab("ordersHistoryPanel");
  els.historyDialog.showModal();
}

function setHistoryTab(targetId) {
  els.historyTabs.forEach((button) => {
    const isActive = button.dataset.historyTarget === targetId;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  document.querySelectorAll(".history-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === targetId);
  });
}

function exportHistoryExcel(type) {
  if (!window.XLSX) {
    alert("A biblioteca de Excel nao foi carregada. Tente novamente em instantes.");
    return;
  }

  if (type === "orders") {
    const rows = [...state.orders]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((order) => ({
        OS: order.code,
        Cliente: order.clientName,
        Equipamento: `${order.deviceType} ${order.deviceModel}`,
        Status: order.status,
        Entrada: order.createdDate || "-",
        Previsao: order.dueDate || "-",
        Total: orderTotal(order),
        Sinal: Number(order.depositAmount || 0),
        Saldo: Math.max(orderTotal(order) - Number(order.depositAmount || 0), 0),
        Telefone: order.clientPhone || "-",
        CPF: order.clientCpf || "-"
      }));

    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "HistoricoOS");
    XLSX.writeFile(workbook, "historico_ordens_servico.xlsx");
    return;
  }

  const rows = [...state.cash]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((item) => ({
      Data: item.date,
      Tipo: item.type === "entrada" ? "Entrada" : "Saida",
      Categoria: item.category || "Movimento",
      Descricao: item.description,
      Forma: paymentLabel(item),
      Cliente_OS: item.clientName || item.orderId || "-",
      Valor: Number(item.amount)
    }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "HistoricoCaixa");
  XLSX.writeFile(workbook, "historico_caixa.xlsx");
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

function normalizeBrazilianDateInput(event) {
  const value = event.target.value.trim();
  if (!value) return;

  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length !== 8) return;

  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  event.target.value = `${day}/${month}/${year}`;
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

function normalizeImei(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 15);
}

function shortText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
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
