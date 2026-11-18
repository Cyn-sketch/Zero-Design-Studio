/**
 * Lightweight backdrop for the inner pages: a few dozen purple glitch shards
 * drifting on a 2D canvas, with a little scroll parallax, so Work / About /
 * Blogs feel like the same space as the homepage without loading three.js.
 * Draws once (static) for reduced motion; pauses when the tab is hidden.
 */
export function initBgShards(canvas, { reduced = false, count = 70 } = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const colors = ['#2a0a5e', '#4b14a8', '#6a1bd6', '#8b3dff', '#c32bff', '#cfcbd9'];
  let W = 0, H = 0, dpr = 1, raf = 0;
  const shards = Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    z: 0.2 + Math.random() * 0.8, // depth: size, speed, parallax
    r: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.4,
    c: colors[Math.floor(Math.random() ** 1.6 * colors.length)],
    s: 4 + Math.random() * 12,
  }));

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
  };

  const draw = (t) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const sy = window.scrollY;
    for (const s of shards) {
      const x = ((s.x * W + Math.sin(t * 0.0002 * s.z + s.r) * 30) % W + W) % W;
      const y = (((s.y * H - sy * 0.15 * s.z - t * 0.01 * s.z) % H) + H) % H;
      const size = s.s * s.z;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(s.r + t * 0.0003 * s.vr);
      ctx.globalAlpha = 0.25 + 0.5 * s.z;
      ctx.fillStyle = s.c;
      ctx.beginPath();
      ctx.moveTo(-size * 0.5, -size * 0.3);
      ctx.lineTo(size * 0.55, -size * 0.1);
      ctx.lineTo(0, size * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  };

  const loop = (t) => {
    raf = requestAnimationFrame(loop);
    draw(t);
  };

  resize();
  window.addEventListener('resize', () => {
    resize();
    if (reduced) draw(0);
  });
  if (reduced) return draw(0);
  raf = requestAnimationFrame(loop);
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) raf = requestAnimationFrame(loop);
  });
}
