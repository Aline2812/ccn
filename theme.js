(() => {
  const root = document.documentElement;
  let theme = 'light';
  try {
    const saved = localStorage.getItem('ccn-theme');
    if (saved === 'light' || saved === 'dark') theme = saved;
  } catch {
    // The theme still works when browser storage is unavailable.
  }
  root.dataset.theme = theme;

  function updateButtons() {
    const label = root.dataset.theme === 'dark' ? 'Tema claro' : 'Tema escuro';
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      button.textContent = label;
      button.setAttribute('aria-label', `Ativar ${label.toLowerCase()}`);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      button.addEventListener('click', () => {
        const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
        root.dataset.theme = nextTheme;
        try {
          localStorage.setItem('ccn-theme', nextTheme);
        } catch {
          // Keep the selected theme for this page even without storage.
        }
        updateButtons();
      });
    });
    updateButtons();
  });
})();
