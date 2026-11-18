import './styles/tokens.css';
import './styles/base.css';
import './styles/sections.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { getHomeContent } from './content/adapter.js';
import { youtubeEmbedUrl, watchYouTube } from './ui/youtube.js';
import { initMenu } from './ui/menu.js';
import { scrambleIn, logoGlitch } from './ui/glitch.js';
import { initBrandReel } from './ui/brandReel.js';
import { initShowreel } from './ui/showreel.js';
import { initHashLinks } from './ui/links.js';

gsap.registerPlugin(ScrollTrigger);

/* ---------------- Mode detection ---------------- */
const html = document.documentElement;
const mobile = matchMedia('(max-width: 767px)').matches;
const params = new URLSearchParams(location.search);
// ?reduced forces the reduced-motion experience (handy for QA / demos).
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('reduced');
const webgl = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
})();
html.classList.add(mobile ? 'mode-lite' : 'mode-full');
if (!webgl) html.classList.add('no-webgl');

// Particle budgets: hard caps per device class.
const CFG = mobile
  ? { field: 700, depth: 160, logo: 10000, maxDpr: 1.5, bloom: 0.55, logoH: 3.3 }
  : { field: 4400, depth: 300, logo: 22000, maxDpr: 1.5, bloom: 0.65, logoH: 5.4 };

/* ---------------- Smooth scroll ---------------- */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  window.__lenis = lenis; // debug handle (prototype)
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ---------------- Chrome UI ---------------- */
// Full-screen overlays hide the 3D completely: stop rendering it while they're open.
let overlayTimer = 0;
const overlay = (on) => {
  clearTimeout(overlayTimer);
  if (on) overlayTimer = setTimeout(() => world3D && (world3D.overlay = true), 650);
  else if (world3D) world3D.overlay = false;
  on ? lenis?.stop() : lenis?.start();
};
const menu = initMenu({ onOpen: () => overlay(true), onClose: () => overlay(false) });
initShowreel({ onOpen: () => overlay(true), onClose: () => overlay(false) });
// Same-page links (e.g. Contact from the menu) scroll smoothly instead of jumping.
const hashLinks = initHashLinks({ lenis, menu, reduced });

// Contact copy reveal when there's no camera flight (mobile, reduced motion, no WebGL).
if (mobile || reduced || !webgl) {
  const c = document.getElementById('contact');
  new IntersectionObserver(([e]) => e.isIntersecting && c.classList.add('is-active'), { threshold: 0.25 }).observe(c);
}
logoGlitch(document.querySelector('.site-nav__logo'), reduced);

/* ---------------- Hero copy reveal ---------------- */
function heroCopyIntro() {
  if (reduced) return;
  const words = [...document.querySelectorAll('.hero__word')];
  const [eyebrow, ...rest] = document.querySelectorAll('.stop--hero [data-reveal]');
  gsap.to(eyebrow, { opacity: 1, y: 0, duration: 0.9, delay: 0.3, ease: 'power3.out' });
  words.forEach((w, i) => setTimeout(() => scrambleIn(w, { duration: 600 }), 700 + i * 380));
  gsap.to(rest, { opacity: 1, y: 0, duration: 1, stagger: 0.15, delay: 2.0, ease: 'power3.out' });
}
heroCopyIntro();

/* ---------------- Project cards (mobile): muted YouTube previews, always playing ---------------- */
function initCardPreviews() {
  if (!mobile || reduced) return; // reduced motion keeps the still thumbnail
  const startPlayer = (el) => {
    const f = document.createElement('iframe');
    f.src = youtubeEmbedUrl(el.dataset.yt, Number(el.dataset.ytStart) || 0);
    f.title = 'Project video preview';
    f.allow = 'autoplay; encrypted-media';
    f.tabIndex = -1;
    f.setAttribute('aria-hidden', 'true');
    el._stopYT = watchYouTube(f, (p) => el.classList.toggle('is-playing', p)); // thumbnail whenever it isn't playing
    el.appendChild(f);
  };
  // Start each player a screen ahead of the card, then leave it running:
  // the video is already playing by the time the card scrolls into view.
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach(({ target: el, isIntersecting }) => {
        if (!isIntersecting) return;
        io.unobserve(el);
        startPlayer(el);
      });
    },
    { rootMargin: '100% 0px' }
  );
  document.querySelectorAll('.media--yt[data-yt]').forEach((el) => io.observe(el));
}
initCardPreviews();

/* ---------------- Brand reel (kinetic type) ---------------- */
let world3D = null; // set once WebGL is up, so the reel can pause it while covering the screen
async function initBrands() {
  const section = document.getElementById('brands');
  if (!section) return;
  const content = await getHomeContent();
  const reel = initBrandReel(section, {
    brands: content.brands.items,
    reduced,
    mobile,
    onCover: (covered) => world3D && (world3D.covered = covered),
  });
  if (!reel) return;
  ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: (self) => {
      reel.setProgress(self.progress);
      reel.setVelocity(self.getVelocity() / 40);
    },
  });
}
initBrands();

/* ---------------- 3D ---------------- */

if (!webgl) window.addEventListener('load', () => hashLinks.scrollToHash());
if (webgl)
  import('./scene/experience.js')
    .then(({ init3D }) => init3D({ CFG, mobile, reduced, params, html, scrambleIn, setWorld: (w) => (world3D = w) }))
    // Arriving with a hash (e.g. /#contact from another page): jump once the 3D layout is final.
    .then(() => requestAnimationFrame(() => hashLinks.scrollToHash()))
    .catch((err) => {
  console.error(err);
  html.classList.add('no-webgl');
});
