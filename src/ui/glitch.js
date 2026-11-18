const GLYPHS = 'ZDS0#/<>_-=+*01ΞΔ';

/** Briefly overlays RGB-split slices on an element that has data-glitch-text. */
export function glitchOnce(el) {
  if (!el) return;
  el.classList.remove('is-glitching');
  void el.offsetWidth; // restart animation
  el.classList.add('is-glitching');
  setTimeout(() => el.classList.remove('is-glitching'), 450);
}

/**
 * Scrambles an element's text and resolves it left to right. The real text
 * is already in the HTML (SEO) and is restored exactly at the end.
 */
export function scrambleIn(el, { duration = 650 } = {}) {
  return new Promise((resolve) => {
    const final = el.textContent;
    el.setAttribute('aria-label', final);
    const t0 = performance.now();
    el.classList.add('is-in');
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      const n = Math.floor(p * final.length);
      let s = final.slice(0, n);
      for (let i = n; i < final.length; i++) s += final[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      el.textContent = s;
      if (p < 1) requestAnimationFrame(tick);
      else {
        el.textContent = final;
        el.removeAttribute('aria-label');
        glitchOnce(el);
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}

/** Occasional micro-glitch on the nav logo; also on hover/focus. */
export function logoGlitch(link, reduced) {
  if (!link) return;
  const fire = () => {
    link.classList.add('is-glitching-logo');
    setTimeout(() => link.classList.remove('is-glitching-logo'), 380);
  };
  link.addEventListener('mouseenter', fire);
  link.addEventListener('focus', fire);
  if (reduced) return;
  const loop = () => setTimeout(() => { if (!document.hidden) fire(); loop(); }, 6000 + Math.random() * 6000);
  loop();
}
