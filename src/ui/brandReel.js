/**
 * Brand reel: kinetic-type marquee of client names on black.
 *
 * - Rows of giant names loop horizontally, alternating direction; scroll
 *   velocity speeds them up.
 * - A travelling wave makes individual letters morph (wide / condensed /
 *   italic / backslant / tall). Advances are recomputed every frame, so
 *   neighbours reflow around a morphing letter.
 * - Morphing letters get a subtle RGB glitch split (ZDS identity).
 * - Scrolling in: letters assemble in a wipe. Scrolling out: they blow up
 *   into huge distorted shapes and fade.
 * - Cursor proximity distorts letters on desktop.
 *
 * Drawn on a single 2D canvas (cheap: ~300–500 fillText per frame, only while
 * the section is on screen). The real brand list stays in the HTML <ul>.
 */

const TYPES = ['wide', 'italic', 'condensed', 'tall', 'backslant', 'wide', 'condensed', 'italic'];
const SEP = '◆';

const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function splitRows(names, n) {
  const rows = Array.from({ length: n }, () => []);
  names.forEach((name, i) => rows[i % n].push(name));
  return rows;
}

export function initBrandReel(section, { brands, reduced = false, mobile = false, onCover } = {}) {
  const canvas = section.querySelector('.brands__reel');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const names = brands.map((b) => b.name.toUpperCase());
  const rowNames = splitRows(names, mobile ? 7 : 4);

  const state = {
    W: 0, H: 0, dpr: 1, fs: 100, rowH: 80, top: 0,
    rows: [], // { glyphs:[{ch,w,sep}], tileW, offset, dir, speed }
    pEnter: 0, pExit: 0,
    vel: 0,
    mouse: { x: -9999, y: -9999, on: false },
    visible: false,
    raf: 0,
    t0: performance.now(),
  };

  function layout() {
    const r = canvas.getBoundingClientRect();
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.W = r.width;
    state.H = r.height;
    canvas.width = Math.round(r.width * state.dpr);
    canvas.height = Math.round(r.height * state.dpr);

    const n = rowNames.length;
    // Rows fill ~74% of the height with very tight leading, like a poster.
    let rowH = (state.H * (mobile ? 0.66 : 0.74)) / n;
    let fs = rowH * 1.3;
    fs = Math.min(fs, state.W * (mobile ? 0.17 : 0.095));
    rowH = fs / 1.3;
    state.fs = fs;
    state.rowH = rowH;
    state.top = (state.H - rowH * n) / 2 + rowH * 0.06;

    ctx.font = `800 ${fs}px Unbounded, "Arial Black", sans-serif`;
    const cache = {};
    const wOf = (ch) => (cache[ch] ??= ch === SEP ? fs * 0.45 : ch === ' ' ? fs * 0.2 : ctx.measureText(ch).width);
    const track = -fs * 0.03;

    state.rows = rowNames.map((list, ri) => {
      const glyphs = [];
      list.forEach((name) => {
        for (const ch of name) glyphs.push({ ch, w: wOf(ch) + track, sep: false });
        glyphs.push({ ch: ' ', w: wOf(' '), sep: false });
        glyphs.push({ ch: SEP, w: wOf(SEP), sep: true });
        glyphs.push({ ch: ' ', w: wOf(' '), sep: false });
      });
      const tileW = glyphs.reduce((a, g) => a + g.w, 0);
      const prev = state.rows[ri];
      return {
        glyphs,
        tileW,
        offset: prev ? prev.offset : hash(ri + 3) * tileW,
        dir: ri % 2 ? 1 : -1,
        speed: fs * (0.42 + hash(ri) * 0.25),
      };
    });
  }

  /** Per-glyph morph transform. m = 0..1 */
  function morph(type, m) {
    switch (type) {
      case 'wide': return { sx: 1 + 0.75 * m, sy: 1 - 0.08 * m, k: 0 };
      case 'condensed': return { sx: 1 - 0.5 * m, sy: 1 + 0.12 * m, k: 0 };
      case 'italic': return { sx: 1 + 0.15 * m, sy: 1, k: -0.55 * m };
      case 'backslant': return { sx: 1 + 0.1 * m, sy: 1, k: 0.4 * m };
      case 'tall': return { sx: 1 - 0.2 * m, sy: 1 + 0.32 * m, k: 0 };
      default: return { sx: 1, sy: 1, k: 0 };
    }
  }

  function drawGlyph(g, x, baseY, sx, sy, k, alpha, glitch, accent) {
    const { fs } = state;
    ctx.save();
    ctx.translate(x, baseY);
    ctx.transform(1, 0, k, 1, 0, 0); // skew around the baseline
    ctx.scale(sx, sy);
    if (g.sep) {
      // Brand separator: small purple diamond.
      const s = fs * 0.13;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#c32bff';
      ctx.translate(0, -fs * 0.36);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
      return;
    }
    if (glitch > 0.02) {
      const d = fs * 0.035 * glitch;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * 0.85 * glitch;
      ctx.fillStyle = '#ff2a6d';
      ctx.fillText(g.ch, -d, 0);
      ctx.fillStyle = '#3a1cff';
      ctx.fillText(g.ch, d, 0);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = accent > 0.01 ? mixColor(accent) : '#f4f0ff';
    ctx.fillText(g.ch, 0, 0);
    ctx.restore();
  }

  // White → ZDS violet as a letter morphs.
  function mixColor(a) {
    const r = Math.round(244 + (176 - 244) * a);
    const g = Math.round(240 + (70 - 240) * a);
    const b = Math.round(255 + (255 - 255) * a);
    return `rgb(${r},${g},${b})`;
  }

  function frame(now) {
    state.raf = requestAnimationFrame(frame);
    const t = (now - state.t0) / 1000;
    const dt = Math.min((now - (state.last || now)) / 1000, 0.05);
    state.last = now;
    const { W, H, fs, rowH, top, dpr, pEnter, pExit, mouse } = state;

    state.vel *= Math.pow(0.04, dt); // decay scroll boost

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.font = `800 ${fs}px Unbounded, "Arial Black", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    const enter = reduced ? 1 : pEnter;
    const exit = pExit;
    const morphAmt = reduced ? 0 : 1;

    state.rows.forEach((row, ri) => {
      if (!reduced) row.offset += (row.speed + Math.abs(state.vel) * fs * 0.012) * row.dir * dt;
      const baseY = top + rowH * (ri + 1);
      const tw = row.tileW;
      const n = row.glyphs.length;
      // Start a little left of the screen, aligned to the tile.
      const o = ((row.offset % tw) + tw) % tw;
      let x = -o - fs;
      let gi = 0;
      // Skip to the glyph that sits at x (approx; widths vary while morphing).
      while (x < -fs * 1.2) { x += row.glyphs[gi % n].w; gi++; }

      while (x < W + fs) {
        const g = row.glyphs[gi % n];
        const id = gi % n + ri * 997;
        const h = hash(id);
        const nx = x / W;

        // Morph wave travelling across each row + cursor distortion.
        let m = 0;
        if (morphAmt && !g.sep && g.ch !== ' ' && h > 0.35) {
          const wave = t * 1.5 - nx * 5.5 + ri * 1.9 + h * 0.8;
          m = Math.pow(Math.max(0, Math.sin(wave)), 10);
        }
        if (mouse.on && !g.sep) {
          const dx = x - mouse.x;
          const dy = baseY - fs * 0.36 - mouse.y;
          m = Math.max(m, smooth(fs * 1.25, fs * 0.15, Math.hypot(dx, dy)));
        }
        const type = TYPES[Math.floor(h * TYPES.length * 7.3) % TYPES.length];
        let { sx, sy, k } = morph(type, m);

        // Enter: wipe in from the left, letters grow from the baseline.
        let alpha = 1;
        const e = easeOut(clamp01(enter * 1.9 - nx * 0.7 - ri * 0.06 - h * 0.15));
        if (e < 1) {
          sy *= e;
          k += (1 - e) * (h - 0.5) * 1.6;
          alpha *= clamp01(e * 1.5);
        }

        const adv = g.w * sx;
        let cx = x + adv / 2;
        let cy = baseY;

        // Exit: letters blow up into huge distorted shapes and scatter.
        if (exit > 0 && !reduced) {
          const q = easeOut(clamp01(exit * 1.6 - h * 0.6));
          sx *= 1 + q * (1.5 + h * 3.5);
          sy *= 1 + q * (0.8 + hash(id + 1) * 2.5);
          k += q * (hash(id + 2) - 0.5) * 2.2;
          cx += (x / W - 0.5) * q * W * 0.9;
          cy += (hash(id + 3) - 0.6) * q * H * 0.9;
          alpha *= Math.pow(1 - q, 1.4);
        } else if (exit > 0) {
          alpha *= 1 - exit;
        }

        if (alpha > 0.01 && sy > 0.01) drawGlyph(g, cx, cy, sx, sy, k, alpha, m * 0.9, m * m * 0.9);
        x += adv;
        gi++;
      }
    });
  }

  function start() {
    if (!state.raf) {
      state.last = 0;
      state.raf = requestAnimationFrame(frame);
    }
  }
  function stop() {
    cancelAnimationFrame(state.raf);
    state.raf = 0;
  }

  // Run only while the section is on screen.
  new IntersectionObserver(([e]) => {
    state.visible = e.isIntersecting;
    state.visible && !document.hidden ? start() : stop();
  }).observe(section);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : state.visible && start()));

  if (!mobile && !reduced) {
    const sticky = section.querySelector('.brands__sticky');
    sticky.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      state.mouse.x = e.clientX - r.left;
      state.mouse.y = e.clientY - r.top;
      state.mouse.on = true;
    });
    sticky.addEventListener('pointerleave', () => (state.mouse.on = false));
  }

  window.addEventListener('resize', layout);
  (document.fonts?.load(`800 40px Unbounded`) ?? Promise.resolve()).then(layout, layout);
  layout();
  section.classList.add('is-live');

  return {
    /** p: 0..1 over the whole time the section is on screen. */
    setProgress(p) {
      // Section slides in during the first ~28%, holds pinned, then explodes.
      state.pEnter = clamp01(p / 0.3);
      state.pExit = clamp01((p - 0.6) / 0.16);
      onCover?.(p > 0.3 && p < 0.72);
    },
    setVelocity(v) {
      state.vel = Math.max(Math.abs(state.vel), Math.min(Math.abs(v), 120));
    },
  };
}
