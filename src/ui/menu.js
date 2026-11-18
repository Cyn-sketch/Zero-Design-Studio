/** Full-screen glitch menu: focus trap, Esc to close, restores focus. */
export function initMenu({ onOpen, onClose } = {}) {
  const btn = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-menu]');
  if (!btn || !menu) return;
  let open = false;
  let closeTimer;

  const focusables = () => [btn, ...menu.querySelectorAll('a[href]')];

  const set = (v) => {
    open = v;
    btn.setAttribute('aria-expanded', String(v));
    btn.setAttribute('aria-label', v ? 'Close menu' : 'Open menu');
    clearTimeout(closeTimer);
    if (v) {
      menu.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
      document.documentElement.classList.add('menu-open');
      setTimeout(() => menu.querySelector('a')?.focus({ preventScroll: true }), 300);
      onOpen?.();
    } else {
      menu.classList.remove('is-open');
      document.documentElement.classList.remove('menu-open');
      closeTimer = setTimeout(() => (menu.hidden = true), 600);
      btn.focus({ preventScroll: true });
      onClose?.();
    }
  };

  btn.addEventListener('click', () => set(!open));
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) set(false);
  });
  document.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') set(false);
    if (e.key === 'Tab') {
      const f = focusables();
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  return { close: () => open && set(false) };
}
