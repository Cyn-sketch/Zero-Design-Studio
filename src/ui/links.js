/**
 * Same-page links (e.g. "/#contact" on the homepage, "#main", "#all") scroll
 * smoothly to their target instead of jumping. Works from inside the open
 * menu: the menu is closed first (it locks scrolling while open), then we
 * scroll. Links to other pages navigate normally.
 *
 * Also handles arriving with a hash (e.g. /#contact from the Work page):
 * call `scrollToHash()` once the layout is final.
 */
export function initHashLinks({ lenis = null, menu = null, reduced = false } = {}) {
  const offsetFor = (el) => {
    // Pinned sections: land where the content is fully in place.
    if (el.hasAttribute('data-scroll-end')) return Math.max(0, el.offsetHeight - window.innerHeight);
    if (document.documentElement.classList.contains('flight') && el.matches('.stop--project, .stop--service')) {
      return window.innerHeight * 0.3; // camera parked, copy pinned
    }
    return 0;
  };

  const scrollToId = (id, { immediate = false } = {}) => {
    const el = id && document.getElementById(id);
    if (!el) return false;
    const y = el.getBoundingClientRect().top + window.scrollY + offsetFor(el);
    if (lenis) lenis.scrollTo(y, { immediate: immediate || reduced, duration: 1.8, force: true });
    else window.scrollTo({ top: y, behavior: immediate || reduced ? 'auto' : 'smooth' });
    // Move keyboard focus to the target for screen-reader / keyboard users.
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
    return true;
  };

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('data-showreel') || a.classList.contains('skip-link')) return;
    const url = new URL(a.getAttribute('href'), window.location.href);
    if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || !url.hash) return;
    const id = decodeURIComponent(url.hash.slice(1));
    if (!document.getElementById(id)) return;
    e.preventDefault();
    menu?.close();
    if (window.location.hash !== url.hash) history.pushState(null, '', url.hash);
    // Let the menu release its scroll lock first.
    setTimeout(() => scrollToId(id), menu ? 80 : 0);
  });

  return {
    scrollToId,
    scrollToHash: (opts) => window.location.hash && scrollToId(decodeURIComponent(window.location.hash.slice(1)), { immediate: true, ...opts }),
  };
}
