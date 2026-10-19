// Shared dropdown for selects and editable suggestion fields, including new OS rows.
(() => {
  const selector = 'select, input[list], input[data-suggestion-list]';
  const menu = document.createElement('div');
  menu.id = 'fieldDropdown';
  menu.className = 'field-dropdown';
  // Reset the browser's centered popover layout even when an older stylesheet is cached.
  Object.assign(menu.style, { position: 'fixed', inset: 'auto', margin: '0', boxSizing: 'border-box' });
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  const supportsPopover = typeof menu.showPopover === 'function';
  if (supportsPopover) menu.setAttribute('popover', 'manual');
  let field = null;
  let options = [];
  let selected = -1;
  let search = '';
  let lastKeyTime = 0;

  function prepare(input) {
    if (input.hasAttribute('list')) {
      input.dataset.suggestionList = input.getAttribute('list');
      input.removeAttribute('list');
      input.autocomplete = 'off';
    }
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-haspopup', 'listbox');
    input.setAttribute('aria-controls', menu.id);
    if (!input.hasAttribute('aria-expanded')) input.setAttribute('aria-expanded', 'false');
    if (input.tagName === 'INPUT') input.setAttribute('aria-autocomplete', 'list');
  }

  function close() {
    if (supportsPopover && menu.matches(':popover-open')) menu.hidePopover();
    menu.hidden = true;
    if (field) {
      field.setAttribute('aria-expanded', 'false');
      field.removeAttribute('aria-activedescendant');
    }
    field = null;
  }

  function position() {
    if (!field || !field.isConnected || !field.getClientRects().length) return close();
    const rect = field.getBoundingClientRect();
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.width = `${rect.width}px`;
    menu.style.maxHeight = `${Math.max(40, Math.min(240, window.innerHeight - rect.bottom - 12))}px`;
  }

  function highlight(index) {
    selected = index;
    [...menu.children].forEach((option, i) => {
      option.classList.toggle('highlighted', i === index);
      option.setAttribute('aria-selected', String(i === index));
    });
    if (index >= 0) {
      field.setAttribute('aria-activedescendant', menu.children[index].id);
      const option = menu.children[index];
      if (option.offsetTop < menu.scrollTop) menu.scrollTop = option.offsetTop;
      else if (option.offsetTop + option.offsetHeight > menu.scrollTop + menu.clientHeight) {
        menu.scrollTop = option.offsetTop + option.offsetHeight - menu.clientHeight;
      }
    } else {
      field.removeAttribute('aria-activedescendant');
    }
  }

  function renderOptions() {
    const isSelect = field.tagName === 'SELECT';
    const source = isSelect ? field : document.getElementById(field.dataset.suggestionList);
    const query = isSelect ? '' : field.value.trim().toLocaleLowerCase('pt-BR');
    options = [...(source?.options || [])].filter(option =>
      !option.disabled && !option.hidden && !option.parentElement?.disabled &&
      (!query || option.value.toLocaleLowerCase('pt-BR').includes(query))
    );
    menu.replaceChildren();
    options.forEach((option, index) => {
      const row = document.createElement('div');
      row.id = `fieldDropdownOption${index}`;
      row.setAttribute('role', 'option');
      row.dataset.index = index;
      row.textContent = option.label || option.textContent || option.value;
      menu.append(row);
    });
    if (!options.length) {
      const empty = document.createElement('div');
      empty.className = 'dropdown-empty';
      empty.textContent = 'Nenhuma opção encontrada';
      menu.append(empty);
    }
    highlight(isSelect ? options.findIndex(option => option.value === field.value) : -1);
  }

  function open(input) {
    if (input.disabled || input.readOnly) return;
    prepare(input);
    if (field !== input) {
      close();
      field = input;
      // Keep the menu in the dialog's layer when the field belongs to a modal.
      (input.closest('dialog') || document.body).append(menu);
    }
    menu.hidden = false;
    field.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-label', input.getAttribute('aria-label') || input.labels?.[0]?.textContent.trim() || 'Opções');
    if (supportsPopover && !menu.matches(':popover-open')) menu.showPopover();
    position();
    renderOptions();
    position();
  }

  function choose(index) {
    if (!field || !options[index]) return;
    const input = field;
    input.value = options[index].value;
    close();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  document.querySelectorAll(selector).forEach(prepare);
  // Prepare dynamically added item rows before their native suggestions can open.
  new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      if (node.matches(selector)) prepare(node);
      node.querySelectorAll(selector).forEach(prepare);
    }));
  }).observe(document.body, { childList: true, subtree: true });

  document.addEventListener('pointerdown', event => {
    if (menu.contains(event.target)) {
      event.preventDefault();
      const row = event.target.closest('[data-index]');
      if (row) choose(Number(row.dataset.index));
      return;
    }
    const input = event.target.closest(selector);
    if (!input) return close();
    prepare(input);
    if (input.tagName === 'SELECT') {
      event.preventDefault();
      input.focus();
      if (field === input) close();
      else open(input);
    } else {
      open(input);
    }
  });
  // Suppress the browser-managed select popup; the original select keeps its value and validation.
  document.addEventListener('mousedown', event => {
    if (event.target.matches('select')) event.preventDefault();
  });
  document.addEventListener('click', event => {
    if (event.target.matches('select')) event.preventDefault();
  });
  document.addEventListener('focusin', event => {
    if (event.target.matches('input[list], input[data-suggestion-list]')) open(event.target);
    else if (event.target !== field && !menu.contains(event.target)) close();
  });
  document.addEventListener('input', event => {
    if (event.target === field) queueMicrotask(() => {
      if (field === event.target) { renderOptions(); position(); }
    });
  });
  document.addEventListener('keydown', event => {
    const input = event.target.closest(selector);
    if (!input || input.disabled || input.readOnly) return;
    if (event.key === 'Escape' && field) {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      close();
    } else if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      if (field !== input) open(input);
      if (options.length) highlight((selected + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    } else if (event.key === 'Enter' && field === input) {
      event.preventDefault();
      if (selected >= 0) choose(selected);
      else if (options.length === 1) choose(0);
    } else if (input.tagName === 'SELECT' && event.key === ' ') {
      event.preventDefault();
      if (field !== input) open(input);
      else if (selected >= 0) choose(selected);
    } else if (input.tagName === 'SELECT' && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (field !== input) open(input);
      search = Date.now() - lastKeyTime < 700 ? search + event.key : event.key;
      lastKeyTime = Date.now();
      const index = options.findIndex(option => option.label.toLocaleLowerCase('pt-BR').startsWith(search.toLocaleLowerCase('pt-BR')));
      if (index >= 0) highlight(index);
    }
  });
  document.addEventListener('scroll', event => {
    if (field && !menu.contains(event.target)) position();
  }, true);
  document.addEventListener('close', close, true);
  window.addEventListener('resize', () => { if (field) position(); });
})();
