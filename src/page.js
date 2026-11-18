/**
 * Inner pages (Work, About, Blogs). Same look and chrome as the homepage
 * (menu, glitch, video overlay, smooth scroll) without the three.js journey.
 */
import './styles/tokens.css';
import './styles/base.css';
import './styles/sections.css';
import './styles/pages.css';

import Lenis from 'lenis';
import { initMenu } from './ui/menu.js';
import { initShowreel } from './ui/showreel.js';
import { initHashLinks } from './ui/links.js';
import { scrambleIn, glitchOnce, logoGlitch } from './ui/glitch.js';
import { initBgShards } from './ui/bgShards.js';

const html = document.documentElement;
const params = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('reduced');

/* Smooth scroll */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.9 });
  const raf = (t) => {
    lenis.raf(t);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
  window.__lenis = lenis; // debug handle (prototype)
  // Images and fonts change the page height after load: keep the scroll limit in sync.
  new ResizeObserver(() => lenis.resize()).observe(document.body);
}

/* Chrome */
const menu = initMenu({ onOpen: () => lenis?.stop(), onClose: () => lenis?.start() });
initShowreel({ onOpen: () => lenis?.stop(), onClose: () => lenis?.start() });
logoGlitch(document.querySelector('.site-nav__logo'), reduced);
const links = initHashLinks({ lenis, menu, reduced });
window.addEventListener('load', () => links.scrollToHash());

/* Backdrop */
initBgShards(document.querySelector('.bg-shards'), { reduced, count: window.innerWidth < 768 ? 40 : 70 });

/* Title glitch-in + scroll reveals */
const title = document.querySelector('.phero__title');
if (title && !reduced) scrambleIn(title, { duration: 700 });
else title?.classList.add('is-in');

const reveals = document.querySelectorAll('[data-reveal]');
if (reduced || !('IntersectionObserver' in window)) reveals.forEach((el) => el.classList.add('is-in'));
else {
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }),
    { rootMargin: '0px 0px -8% 0px' }
  );
  reveals.forEach((el) => io.observe(el));
}

/* Glitch on hover for the About values */
if (!reduced) document.querySelectorAll('.values__word').forEach((el) => el.closest('li').addEventListener('mouseenter', () => glitchOnce(el)));

/* Work: category filter for the full list */
const filter = document.querySelector('[data-filter]');
if (filter) {
  const rows = [...document.querySelectorAll('[data-filter-list] .wrow')];
  const count = document.querySelector('[data-filter-count]');
  const apply = (cat) => {
    filter.querySelectorAll('.wtab').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === cat)));
    let n = 0;
    rows.forEach((r) => {
      const show = cat === 'all' || r.dataset.cat === cat;
      r.hidden = !show;
      n += show;
    });
    if (count) count.textContent = `Showing ${n} project${n === 1 ? '' : 's'}`;
    lenis?.resize();
  };
  filter.addEventListener('click', (e) => {
    const b = e.target.closest('.wtab');
    if (b) apply(b.dataset.cat);
  });
  apply('all');
}

html.classList.add('page-ready');
