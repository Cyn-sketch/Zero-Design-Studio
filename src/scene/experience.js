/**
 * The WebGL experience (three.js + post-processing + camera journey).
 * Loaded with a dynamic import from main.js, so the page's HTML, nav, menu and
 * headline reveal never wait for the 3D bundle to download.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { getHomeContent } from '../content/adapter.js';
import { World } from './World.js';
import { ShardField } from './ShardField.js';
import { LogoAssembly } from './LogoAssembly.js';
import { CameraRig } from './CameraRig.js';
import { Journey } from './Journey.js';
import { YouTubeLayer } from './YouTubeLayer.js';

export async function init3D(ctx) {
  const { CFG, mobile, reduced, params, html, scrambleIn } = ctx;
  const content = await getHomeContent();
  const world = new World(document.getElementById('gl'), CFG);
  ctx.setWorld(world);
  const rig = new CameraRig(world.camera, { parallax: mobile || reduced ? 0 : 0.35 });
  world.add({ update: (dt) => rig.update(dt) });

  const field = world.add(new ShardField({ count: CFG.field, depth: CFG.depth }));
  const logo = await LogoAssembly.create({ url: content.brand.logoFull.url, count: CFG.logo, height: CFG.logoH });

  // Place logo: right of the headline on desktop, above it on mobile.
  logo.resize = ({ aspect }) => {
    const vh = 2 * Math.tan(THREE.MathUtils.degToRad(world.camera.fov / 2)) * 10;
    const vw = vh * aspect;
    if (aspect < 0.9) logo.object.position.set(0, vh * 0.2, 0);
    else logo.object.position.set(Math.min(vw * 0.25, 4.6), 0.1, 0);
  };
  world.add(logo);

  /* Intro: shards fly in and lock into the logo, with a glitch spike. */
  const glitchTargets = [world.fx.uGlitch, logo.uniforms.uGlitch, field.uniforms.uGlitch];
  const burst = (s = 1, d = 0.4) =>
    !reduced && glitchTargets.forEach((u) => gsap.fromTo(u, { value: s }, { value: 0, duration: d, ease: 'power2.out' }));

  if (reduced) {
    logo.uniforms.uProgress.value = 1;
    world.fx.uAberration.value = 0.3;
  } else {
    gsap.to(logo.uniforms.uProgress, { value: 1, duration: 3.4, ease: 'power2.out', delay: 0.1 });
    gsap.delayedCall(0.15, () => burst(0.9, 0.6));
    gsap.delayedCall(2.4, () => burst(0.7, 0.35));
    // Occasional subtle glitch while idle.
    const idle = () => gsap.delayedCall(5 + Math.random() * 5, () => { burst(0.45, 0.25); idle(); });
    gsap.delayedCall(4, idle);
  }

  /* Pointer: camera parallax + shard repulsion around the cursor. */
  if (!mobile && !reduced) {
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();
    window.addEventListener('pointermove', (e) => {
      ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      rig.setMouse(ndc.x, ndc.y);
      ray.setFromCamera(ndc, world.camera);
      logo.setMouse(ray.ray.intersectPlane(plane, hit));
    });
  }

  /* Scroll: leaving the hero scatters the logo and starts the camera flight. */
  ScrollTrigger.create({
    trigger: '#hero',
    start: 'top top',
    end: 'bottom top',
    scrub: true,
    onUpdate: (self) => {
      logo.uniforms.uScatter.value = reduced ? 0 : self.progress;
      logo.uniforms.uOpacity.value = reduced ? 1 - self.progress : 1;
    },
    onLeave: () => burst(0.6, 0.3),
    onEnterBack: () => burst(0.6, 0.3),
  });

  /* Work: camera flight from project to project (desktop, motion allowed). */
  let journey = null;
  if (!mobile && !reduced) {
    html.classList.add('flight'); // switch layout first so measurements are right
    // Placeholder posters are drawn with the brand fonts: make sure they're loaded.
    await Promise.all([document.fonts.load('700 78px Barlow'), document.fonts.load('700 22px Lato')]).catch(() => {});
    const projectEls = [...document.querySelectorAll('.stop--project')];
    const exploreEl = document.querySelector('.stop--explore');
    const serviceEls = [...document.querySelectorAll('.stop--service')];
    const contactEl = document.getElementById('contact');
    const hud = {
      label: document.querySelector('[data-hud-label]'),
      num: document.querySelector('[data-hud-num]'),
      total: document.querySelector('[data-hud-total]'),
      bar: document.querySelector('.work-hud__bar'),
    };
    const pad = (n) => String(n).padStart(2, '0');
    const setHud = (label, i, total) => {
      hud.label.textContent = label;
      hud.num.textContent = pad(i + 1);
      hud.total.textContent = pad(total);
      if (hud.bar.children.length !== total) hud.bar.innerHTML = '<i></i>'.repeat(total);
      [...hud.bar.children].forEach((b, k) => b.classList.toggle('is-on', k <= i));
    };
    journey = world.add(
      new Journey({
        world,
        rig,
        content,
        field,
        logo,
        onStop: (i, { projects: P, services: S }) => {
          const s = i - P - 1; // service index
          const isContact = i === P + 1 + S;
          contactEl.classList.toggle('is-active', isContact);
          if (isContact) {
            scrambleIn(contactEl.querySelector('.contact__line'), { duration: 700 });
            burst(0.7, 0.45);
          }
          projectEls.forEach((el, k) => el.classList.toggle('is-active', k === i));
          exploreEl.classList.toggle('is-active', i === P);
          serviceEls.forEach((el, k) => el.classList.toggle('is-active', k === s));
          // HUD only while parked at a project or a service.
          html.classList.toggle('hud-on', (i >= 0 && i < P) || (s >= 0 && s < S));
          if (i >= 0 && i < P) {
            setHud(content.work.heading, i, P);
            scrambleIn(projectEls[i].querySelector('.project__title'), { duration: 520 });
            burst(0.75, 0.4);
          } else if (i === P) {
            burst(0.5, 0.3);
          } else if (s >= 0 && s < S) {
            setHud(content.services.heading, s, S);
            scrambleIn(serviceEls[s].querySelector('.service__title'), { duration: 520 });
            burst(0.8, 0.45); // zone change: stronger glitch with the colour shift
          }
        },
      })
    );
    // YouTube preview follows the plane: update after the journey and objects.
    const ytLayer = new YouTubeLayer(world.camera, journey.objects);
    ytLayer.onShow = (p) => p === journey.objects[journey.active] && burst(0.4, 0.3);
    world.add({ update: () => ytLayer.update() });
    ScrollTrigger.addEventListener('refresh', journey.measure);
  } else {
    // Lite: reveal project cards as they scroll in.
    document.querySelectorAll('.stop--project, .stop--explore').forEach((el) => el.classList.add('is-active'));
  }

  /* Contact close: the logo reassembles from its scattered shards (all modes). */
  ScrollTrigger.create({
    trigger: '#contact',
    start: 'top 55%',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      logo.uniforms.uScatter.value = reduced ? 0 : 1 - self.progress;
      logo.uniforms.uOpacity.value = reduced ? self.progress : 1;
    },
  });

  // Stop rendering once the 3D journey is fully scrolled past (footer).
  new IntersectionObserver(([e]) => (world.offscreen = !e.isIntersecting)).observe(document.querySelector('.journey'));

  // Skip drawing the logo's 22k shards when the camera is far from it (work / services).
  world.add({ update: () => (logo.object.visible = world.camera.position.distanceTo(logo.object.position) < 45) });

  gsap.ticker.add((t, deltaMs) => world.render(Math.min(deltaMs / 1000, 0.05), t, deltaMs));

  // ?stats: small fps / quality meter for the dev team.
  if (params.has('stats')) {
    const el = Object.assign(document.createElement('div'), { className: 'stats-meter' });
    document.body.appendChild(el);
    let frames = 0, last = performance.now();
    gsap.ticker.add(() => {
      frames++;
      const now = performance.now();
      if (now - last >= 500) {
        const fps = Math.round((frames * 1000) / (now - last));
        const q = world.quality;
        el.textContent = `${fps} fps · dpr ${world.renderer.getPixelRatio()} · bloom ${world.bloom.enabled ? 'on' : 'off'} · q${q?.level ?? 0}`;
        frames = 0; last = now;
      }
    });
  }
  html.classList.add('gl-ready');

  // Debug handle for the prototype (inspect counts / fps in DevTools).
  window.__zds = { world, logo, field, rig, journey, CFG };
}
