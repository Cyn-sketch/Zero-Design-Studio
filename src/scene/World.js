import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FinalShader } from './shaders/final.js';

export const BG = new THREE.Color('#07050c');

/**
 * Owns renderer, scene, camera, post-processing and the update list.
 * Rendering is skipped while the tab is hidden or the canvas is off-screen
 * (e.g. user is reading the footer).
 */
export class World {
  constructor(canvas, cfg) {
    this.cfg = cfg;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, cfg.maxDpr));
    this.renderer.setClearColor(BG, 1);

    this.scene = new THREE.Scene();
    this.scene.background = BG.clone(); // own copy: Journey tints it per service zone
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 220);
    this.camera.position.set(0, 0, 10);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), cfg.bloom, 0.5, 0.42);
    if (cfg.bloom > 0) this.composer.addPass(this.bloom);
    this.final = new ShaderPass(FinalShader);
    this.composer.addPass(this.final);
    this.composer.addPass(new OutputPass());

    /** Post-fx levels other modules can tween. */
    this.fx = this.final.uniforms;

    this.updatables = [];
    this.paused = false;
    this.offscreen = false;

    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();

    document.addEventListener('visibilitychange', () => {
      this.paused = document.hidden;
    });
  }

  add(thing) {
    if (thing.object) this.scene.add(thing.object);
    if (thing.update) this.updatables.push(thing);
    if (thing.resize) thing.resize(this.size);
    return thing;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.size = { w, h, aspect: w / h };
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    // Bloom at reduced resolution: big perf win, visually identical for soft glow.
    this.bloom.resolution.set(w * 0.5, h * 0.5);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fx.uResolution.value.set(w, h);
    this.updatables.forEach((u) => u.resize && u.resize(this.size));
  }

  /**
   * Adaptive quality: if the real frame interval averages over ~22ms (< 45fps)
   * for 2 seconds, step down once: DPR 1.5 → 1.25 → 1.0, then bloom off.
   * Throttled/background frames (> 100ms) are ignored so a hidden tab never
   * degrades quality. It only ever steps down, so there's no oscillation.
   */
  adapt(frameMs) {
    const q = (this.quality ??= { level: 0, sum: 0, n: 0, steps: [1.25, 1.0, 'nobloom'] });
    if (frameMs < 4 || frameMs > 100 || q.level >= q.steps.length) return;
    q.sum += frameMs;
    q.n += 1;
    if (q.n < 120) return;
    const avg = q.sum / q.n;
    q.sum = 0;
    q.n = 0;
    q.avg = avg;
    if (avg <= 22) return;
    const step = q.steps[q.level++];
    if (step === 'nobloom') this.bloom.enabled = false;
    else if (this.renderer.getPixelRatio() > step) {
      this.renderer.setPixelRatio(step);
      this.composer.setPixelRatio(step);
      this.resize();
    }
    this.onQuality?.(q.level, step, avg);
  }

  render(dt, t, frameMs = 0) {
    // overlay = full-screen menu / showreel on top: nothing to draw underneath.
    if (this.paused || this.offscreen || this.covered || this.overlay) return;
    this.adapt(frameMs);
    for (const u of this.updatables) u.update(dt, t);
    this.fx.uTime.value = t;
    this.composer.render(dt);
  }
}
