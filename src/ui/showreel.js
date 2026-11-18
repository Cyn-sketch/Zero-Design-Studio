/**
 * "Watch Showreel": full-screen glitch overlay with the YouTube showreel
 * (sound on, controls, since the visitor asked for it). Esc / close button /
 * clicking outside the video closes it; focus is trapped while open and
 * returned to the button afterwards. The player is removed on close so the
 * video stops.
 */
export function initShowreel({ onOpen, onClose } = {}) {
  const modal = document.querySelector('[data-showreel-modal]');
  if (!modal) return;
  const html = document.documentElement;
  const player = modal.querySelector('[data-showreel-player]');
  const closeBtn = modal.querySelector('[data-showreel-close]');
  const defaultId = modal.dataset.yt;
  const defaultTitle = modal.getAttribute('aria-label') || 'Video';
  let lastFocus = null;
  let hideTimer = 0;

  // Any trigger can carry its own video: data-yt="<id>" data-title="…" [data-vertical]
  const open = (e) => {
    const t = e?.currentTarget;
    const id = t?.dataset?.yt || defaultId;
    if (!id) return;
    e?.preventDefault();
    clearTimeout(hideTimer);
    lastFocus = document.activeElement;
    const title = t?.dataset?.title || defaultTitle;
    modal.setAttribute('aria-label', title);
    modal.classList.toggle('is-vertical', !!t?.hasAttribute?.('data-vertical'));
    modal.hidden = false;
    html.classList.add('showreel-open');
    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('is-open')));
    const f = document.createElement('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
    f.title = title;
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    player.replaceChildren(f);
    closeBtn.focus({ preventScroll: true });
    onOpen?.();
  };

  const close = () => {
    if (modal.hidden) return;
    modal.classList.remove('is-open');
    player.replaceChildren(); // stops playback
    html.classList.remove('showreel-open');
    hideTimer = setTimeout(() => (modal.hidden = true), 550);
    lastFocus?.focus?.({ preventScroll: true });
    onClose?.();
  };

  document.querySelectorAll('[data-showreel]').forEach((b) => b.addEventListener('click', open));
  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (!e.target.closest('.showreel__frame, [data-showreel-close]')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const items = [closeBtn, player.querySelector('iframe')].filter(Boolean);
      const i = items.indexOf(document.activeElement);
      e.preventDefault();
      items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
    }
  });
}
