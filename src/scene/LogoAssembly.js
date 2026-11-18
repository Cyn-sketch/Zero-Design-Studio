import * as THREE from 'three';
import { shardGeometry } from './ShardField.js';

function loadImage(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

/**
 * Samples the logo bitmap and turns every kept pixel into a shard target.
 * Shards start scattered in glitchy horizontal bands and fly into the logo
 * as `uProgress` goes 0 → 1. `uScatter` blows them back out (used when the
 * camera leaves the hero). Colours come straight from the logo pixels, so the
 * purple ring and chrome half are preserved.
 */
export class LogoAssembly {
  static async create(opts) {
    const img = await loadImage(opts.url);
    return new LogoAssembly(img, opts);
  }

  constructor(img, { count, height = 5.4, sampleWidth = 400 }) {
    const sw = sampleWidth;
    const sh = Math.round((sw * img.naturalHeight) / img.naturalWidth);
    const cv = document.createElement('canvas');
    cv.width = sw;
    cv.height = sh;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, sw, sh);
    const px = ctx.getImageData(0, 0, sw, sh).data;

    const cand = [];
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const i = (y * sw + x) * 4;
        const a = px[i + 3], r = px[i], g = px[i + 1], b = px[i + 2];
        if (a < 140) continue;
        if (r > 228 && g > 228 && b > 228) continue; // white background / highlights
        cand.push(x, y, r, g, b);
      }
    }
    const nCand = cand.length / 5;
    const n = Math.min(count, nCand);
    const scale = height / sh;

    const g = shardGeometry();
    const target = new Float32Array(n * 3);
    const start = new Float32Array(n * 3);
    const color = new Float32Array(n * 3);
    const rand = new Float32Array(n * 4);
    const c = new THREE.Color();

    for (let k = 0; k < n; k++) {
      const j = Math.floor(Math.random() * nCand) * 5;
      const x = (cand[j] - sw / 2 + Math.random() - 0.5) * scale;
      const y = -(cand[j + 1] - sh / 2 + Math.random() - 0.5) * scale;
      target.set([x, y, (Math.random() - 0.5) * 0.12], k * 3);

      // Scattered start: wide, deep, snapped into horizontal bands.
      const sy = (Math.random() * 2 - 1) * 7;
      start.set(
        [(Math.random() * 2 - 1) * 14, Math.round(sy * 2.5) / 2.5, -4 - Math.random() * 26],
        k * 3
      );

      c.setRGB(cand[j + 2] / 255, cand[j + 3] / 255, cand[j + 4] / 255, THREE.SRGBColorSpace);
      color.set([c.r, c.g, c.b], k * 3);
      rand.set([Math.random(), (0.02 + Math.random() * 0.022) * Math.min(1, height / 5.4) * (height < 4 ? 0.85 : 1), Math.random(), Math.random()], k * 4);
    }
    g.setAttribute('aTarget', new THREE.InstancedBufferAttribute(target, 3));
    g.setAttribute('aStart', new THREE.InstancedBufferAttribute(start, 3));
    g.setAttribute('aColor', new THREE.InstancedBufferAttribute(color, 3));
    g.setAttribute('aRand', new THREE.InstancedBufferAttribute(rand, 4));
    g.instanceCount = n;

    this.uniforms = {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uScatter: { value: 0 },
      uGlitch: { value: 0 },
      uMouse: { value: new THREE.Vector2(99, 99) },
      uOpacity: { value: 1 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        uniform float uTime, uProgress, uScatter, uGlitch;
        uniform vec2 uMouse;
        attribute vec3 aTarget, aStart, aColor;
        attribute vec4 aRand; // x delay, y size, z spin, w phase
        varying vec3 vColor;
        varying float vAlpha, vHot;
        mat2 rot(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }
        float hash(float n) { return fract(sin(n) * 43758.5453); }
        void main() {
          float delay = aRand.x * 0.5;
          float p = clamp((uProgress - delay) / 0.5, 0.0, 1.0);
          float e = 1.0 - pow(1.0 - p, 4.0);
          // Digital snapping as shards lock in.
          e = mix(e, floor(e * 6.0) / 6.0, 0.35 * (1.0 - e));

          vec3 pos = mix(aStart, aTarget, e);
          pos.x += sin(p * 3.14159) * (aRand.w - 0.5) * 4.0; // sideways streak while flying

          // Idle life once assembled.
          pos.z += sin(uTime * 0.9 + aRand.w * 6.28 + aTarget.y * 1.7) * 0.05 * e;

          // Row glitch on the logo.
          float band = floor(aTarget.y * 5.0) + floor(uTime * 14.0) * 7.0;
          float h = hash(band);
          pos.x += step(1.0 - 0.18 * uGlitch, h) * (h - 0.5) * 1.6 * e;

          // Scatter out (camera leaving hero): push toward and past camera.
          vec3 away = normalize(aTarget + vec3(0.0, 0.0, 0.6)) * (2.0 + aRand.w * 10.0);
          away.z = 4.0 + aRand.x * 10.0;
          pos += away * uScatter * uScatter;

          // Cursor repulsion.
          vec2 d = pos.xy - uMouse;
          float dist = length(d);
          pos.xy += d / max(dist, 1e-3) * smoothstep(1.1, 0.0, dist) * 0.45 * e;

          vec3 l = position * aRand.y;
          float spin = (1.0 - e) * (uTime * (1.0 + aRand.z * 3.0) + aRand.w * 20.0) + aRand.w * 1.5;
          l.xy = rot(spin) * l.xy;
          l.yz = rot((1.0 - e) * aRand.z * 6.0 + uScatter * aRand.z * 8.0) * l.yz;
          float streak = p * (1.0 - p) * 4.0;
          l.x *= 1.0 + streak * 6.0 + uScatter * 3.0;

          vec4 mv = modelViewMatrix * vec4(pos + l, 1.0);
          gl_Position = projectionMatrix * mv;
          vColor = aColor;
          vAlpha = (0.2 + 0.8 * e) * (1.0 - uScatter * 0.85);
          vHot = streak + step(0.985, hash(aRand.w * 100.0 + floor(uTime * 3.0))) * e;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vAlpha, vHot;
        void main() {
          vec3 c = vColor * 0.92 + vec3(0.55, 0.15, 0.85) * vHot * 0.6;
          gl_FragColor = vec4(c, vAlpha * uOpacity);
        }
      `,
    });

    this.object = new THREE.Group();
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.object.add(this.mesh);
    this.mouseWorld = new THREE.Vector2(99, 99);
    this._inv = new THREE.Matrix4();
    this._v = new THREE.Vector3();
  }

  /** Mouse position already projected onto the logo plane (world space). */
  setMouse(v3) {
    if (!v3) return this.uniforms.uMouse.value.set(99, 99);
    this._inv.copy(this.object.matrixWorld).invert();
    this._v.copy(v3).applyMatrix4(this._inv);
    this.uniforms.uMouse.value.lerp(new THREE.Vector2(this._v.x, this._v.y), 0.2);
  }

  update(dt, t) {
    this.uniforms.uTime.value = t;
  }
}
