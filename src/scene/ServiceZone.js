import * as THREE from 'three';
import { shardGeometry } from './ShardField.js';

/*
 * One "zone" per service. The camera flies through them; each has its own
 * centrepiece and a soft atmosphere glow in the zone colour. The `visual`
 * key comes from the content file (CMS enum):
 *   frames  : Content Creation       (corridor of glowing screen frames)
 *   portal  : Experience Design      (ring of shards you look through)
 *   cubes   : Experiential Marketing (interactive-installation cube grid)
 *   ledwall : Multimedia Production  (LED pixel wall + laser fan)
 */

const additive = (extra = {}) => ({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...extra });

function atmosphere(color) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color }, uAmt: { value: 0 } },
    ...additive(),
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uAmt; varying vec2 vUv;
      void main(){ float d = length((vUv - 0.5) * vec2(1.0, 1.4)); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(uColor * a * a * 0.32 * uAmt, 1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 11), mat);
  m.position.z = -4;
  return m;
}

/* ---------- 01 frames ---------- */
function buildFrames(color) {
  const g = new THREE.Group();
  const frames = [];
  const shape = (w, h, t) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.lineTo(-w / 2, -h / 2);
    const hole = new THREE.Path();
    hole.moveTo(-w / 2 + t, -h / 2 + t); hole.lineTo(-w / 2 + t, h / 2 - t); hole.lineTo(w / 2 - t, h / 2 - t); hole.lineTo(w / 2 - t, -h / 2 + t); hole.lineTo(-w / 2 + t, -h / 2 + t);
    s.holes.push(hole);
    return new THREE.ShapeGeometry(s);
  };
  const geo = shape(3.9, 2.2, 0.035);
  for (let i = 0; i < 8; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: i % 3 === 2 ? new THREE.Color('#cfcbd9') : color, ...additive({ opacity: 0.8 }) });
    const f = new THREE.Mesh(geo, mat);
    f.position.z = 2.2 - i * 1.0;
    f.userData.phase = i * 0.55;
    g.add(f);
    frames.push(f);
  }
  // A "screen" inside the corridor: scanline gradient plane.
  const screenMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: color } },
    ...additive(),
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        float scan = 0.5 + 0.5 * sin(vUv.y * 140.0);
        float bar = smoothstep(0.08, 0.0, abs(fract(vUv.y - uTime * 0.25) - 0.5));
        float wave = 0.5 + 0.5 * sin(vUv.x * 9.0 + uTime * 1.6 + sin(vUv.y * 5.0 + uTime));
        vec3 c = uColor * (0.18 + 0.32 * wave) * (0.7 + 0.3 * scan) + vec3(0.9, 0.8, 1.0) * bar * 0.35;
        float edge = smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x) * smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.94, vUv.y);
        gl_FragColor = vec4(c * edge, 1.0);
      }`,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 2.05), screenMat);
  screen.position.z = 2.2 - 7 * 1.0 - 0.2;
  g.add(screen);
  return {
    group: g,
    update(t, amt) {
      screenMat.uniforms.uTime.value = t;
      frames.forEach((f) => {
        const p = f.userData.phase;
        f.rotation.z = Math.sin(t * 0.5 + p) * 0.05;
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 - p * 1.6);
        f.material.opacity = (0.25 + 0.65 * pulse) * amt;
        f.scale.setScalar(1 + 0.03 * pulse);
      });
    },
  };
}

/* ---------- 02 portal ---------- */
function buildPortal(color) {
  const n = 1100;
  const g = shardGeometry();
  const a = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const tube = Math.random() * Math.PI * 2;
    const r = 0.18 + Math.random() * 0.42;
    a.set([ang, tube, r, 0.03 + Math.random() * 0.07], i * 4);
  }
  g.setAttribute('aRing', new THREE.InstancedBufferAttribute(a, 4));
  g.instanceCount = n;
  const uniforms = { uTime: { value: 0 }, uColor: { value: color }, uAmt: { value: 1 } };
  const mesh = new THREE.Mesh(
    g,
    new THREE.ShaderMaterial({
      uniforms,
      ...additive({ side: THREE.DoubleSide }),
      vertexShader: /* glsl */ `
        uniform float uTime;
        attribute vec4 aRing; // angle, tube angle, tube radius, size
        varying float vF;
        void main() {
          float R = 2.1;
          float a = aRing.x + uTime * 0.12;
          float tb = aRing.y + uTime * 0.6;
          vec3 c = vec3((R + cos(tb) * aRing.z) * cos(a), (R + cos(tb) * aRing.z) * sin(a), sin(tb) * aRing.z);
          // glitch: some segments jump outward briefly
          float seg = floor(aRing.x * 6.0 / 6.2831);
          float g = step(0.93, fract(sin(seg * 17.0 + floor(uTime * 6.0)) * 4375.85));
          c.xy *= 1.0 + g * 0.12;
          vec3 l = position * aRing.w;
          float s = sin(uTime * 1.5 + aRing.y * 7.0), co = cos(uTime * 1.5 + aRing.y * 7.0);
          l.xy = mat2(co, -s, s, co) * l.xy;
          vF = 0.4 + 0.6 * (0.5 + 0.5 * sin(aRing.x * 3.0 - uTime * 2.0));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(c + l, 1.0);
        }
      `,
      fragmentShader: `uniform vec3 uColor; uniform float uAmt; varying float vF; void main(){ gl_FragColor = vec4(mix(uColor, vec3(0.95,0.9,1.0), vF*vF*0.35) * vF * uAmt, 1.0); }`,
    })
  );
  mesh.frustumCulled = false;
  const ringMat = new THREE.MeshBasicMaterial({ color, ...additive({ opacity: 0.6 }) });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.08, 2.12, 160), ringMat);
  const group = new THREE.Group();
  group.add(mesh, ring);
  return {
    group,
    update(t, amt) {
      uniforms.uTime.value = t;
      uniforms.uAmt.value = amt;
      ringMat.opacity = 0.6 * amt * (0.6 + 0.4 * Math.sin(t * 3.0));
      group.rotation.z = t * 0.05;
    },
  };
}

/* ---------- 03 cubes ---------- */
function buildCubes(color) {
  const N = 11;
  const count = N * N;
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, ...additive({ opacity: 0.9 }) });
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  const base = color.clone();
  const chrome = new THREE.Color('#cfcbd9');
  const group = new THREE.Group();
  group.add(mesh);
  group.rotation.x = -0.55;
  return {
    group,
    update(t, amt) {
      let k = 0;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++, k++) {
          const x = (i - (N - 1) / 2) * 0.36;
          const y = (j - (N - 1) / 2) * 0.36;
          const d = Math.hypot(x, y);
          const w = Math.sin(d * 2.6 - t * 2.2);
          const h = 0.35 + Math.max(0, w) * 2.4;
          p.set(x, y, (h * 0.2) / 2);
          s.set(1, 1, h);
          q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, 0);
          m.compose(p, q, s);
          mesh.setMatrixAt(k, m);
          c.copy(base).lerp(chrome, Math.max(0, w) ** 4 * 0.7).multiplyScalar((0.35 + 0.65 * Math.max(0, w)) * amt);
          mesh.setColorAt(k, c);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      group.rotation.z = Math.sin(t * 0.2) * 0.15;
    },
  };
}

/* ---------- 04 LED wall + lasers ---------- */
function buildLedWall(color) {
  const cols = 64, rows = 36, w = 4.6, h = (w * rows) / cols;
  const pos = new Float32Array(cols * rows * 3);
  let k = 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) pos.set([(i / (cols - 1) - 0.5) * w, (j / (rows - 1) - 0.5) * h, 0], 3 * k++);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const uniforms = { uTime: { value: 0 }, uColor: { value: color }, uAmt: { value: 1 }, uSize: { value: new THREE.Vector2(w, h) } };
  const pts = new THREE.Points(
    g,
    new THREE.ShaderMaterial({
      uniforms,
      ...additive(),
      vertexShader: /* glsl */ `
        uniform float uTime; uniform vec2 uSize;
        varying float vB;
        void main() {
          vec2 uv = position.xy / uSize + 0.5;
          float scan = smoothstep(0.1, 0.0, abs(fract(uv.x * 0.5 - uTime * 0.18) - 0.5) - 0.38);
          float rings = 0.5 + 0.5 * sin(length(uv - vec2(0.5)) * 22.0 - uTime * 3.0);
          float bars = step(0.5, fract(uv.y * 6.0 + uTime * 0.4));
          vB = 0.15 + 0.55 * rings * (0.6 + 0.4 * bars) + scan * 0.6;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 34.0 / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `uniform vec3 uColor; uniform float uAmt; varying float vB;
        void main(){ vec2 d = gl_PointCoord - 0.5; if (max(abs(d.x), abs(d.y)) > 0.42) discard; gl_FragColor = vec4(mix(uColor, vec3(1.0), vB * vB * 0.4) * vB * uAmt, 1.0); }`,
    })
  );
  // Laser fan from below the wall.
  const lasers = new THREE.Group();
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color }, uAmt: { value: 1 } },
    ...additive({ side: THREE.DoubleSide }),
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uAmt; varying vec2 vUv;
      void main(){ float core = smoothstep(0.5, 0.0, abs(vUv.x - 0.5)); gl_FragColor = vec4(mix(uColor, vec3(1.0), core*core*0.6) * core * (1.0 - vUv.y) * 0.9 * uAmt, 1.0); }`,
  });
  const beams = [];
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 9), beamMat);
    b.geometry.translate(0, 4.5, 0);
    b.userData.phase = i;
    beams.push(b);
    lasers.add(b);
  }
  lasers.position.set(0, -h / 2 - 0.6, 0.6);
  const group = new THREE.Group();
  group.add(pts, lasers);
  return {
    group,
    update(t, amt) {
      uniforms.uTime.value = t;
      uniforms.uAmt.value = amt;
      beamMat.uniforms.uAmt.value = amt * (0.6 + 0.4 * Math.sin(t * 5.0));
      beams.forEach((b, i) => {
        b.rotation.z = (i - 3) * 0.22 + Math.sin(t * 0.9 + i * 0.7) * 0.18;
        b.rotation.x = -0.5 + Math.sin(t * 0.6 + i) * 0.1;
      });
    },
  };
}

/* ---------- 05 neural: AI Storytelling ---------- */
// A layered neural network: glowing nodes, faint synapses, and "signals"
// travelling layer to layer, so the zone reads as AI at a glance.
function buildNeural(color) {
  const LAYERS = [5, 8, 10, 8, 5];
  const W = 4.6, H = 2.6;
  const nodes = [];
  LAYERS.forEach((n, li) => {
    const x = (li / (LAYERS.length - 1) - 0.5) * W;
    for (let k = 0; k < n; k++) {
      const y = n === 1 ? 0 : (k / (n - 1) - 0.5) * H * (0.55 + 0.45 * (n / 10));
      nodes.push({ layer: li, p: new THREE.Vector3(x, y, Math.sin(k * 1.7 + li) * 0.35) });
    }
  });
  const byLayer = LAYERS.map((_, li) => nodes.filter((n) => n.layer === li));

  // synapses: every node to every node in the next layer
  const edges = [];
  const linePos = [];
  for (let li = 0; li < LAYERS.length - 1; li++) {
    for (const a of byLayer[li]) for (const b of byLayer[li + 1]) {
      edges.push([a, b]);
      linePos.push(a.p.x, a.p.y, a.p.z, b.p.x, b.p.y, b.p.z);
    }
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
  const lineMat = new THREE.LineBasicMaterial({ color, ...additive({ opacity: 0.12 }) });
  const lines = new THREE.LineSegments(lg, lineMat);

  // nodes as glowing points
  const np = new Float32Array(nodes.length * 3);
  nodes.forEach((n, i) => np.set([n.p.x, n.p.y, n.p.z], i * 3));
  const ng = new THREE.BufferGeometry();
  ng.setAttribute('position', new THREE.BufferAttribute(np, 3));
  const nodeU = { uTime: { value: 0 }, uColor: { value: color }, uAmt: { value: 1 } };
  const nodePts = new THREE.Points(
    ng,
    new THREE.ShaderMaterial({
      uniforms: nodeU,
      ...additive(),
      vertexShader: `uniform float uTime; varying float vB;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0);
          vB = 0.55 + 0.45 * sin(uTime * 2.0 + position.x * 3.0 + position.y * 5.0);
          gl_PointSize = 150.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uAmt; varying float vB;
        void main(){ float d = length(gl_PointCoord - 0.5); float core = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(mix(uColor, vec3(1.0), core * core * 0.7) * core * core * vB * uAmt, 1.0); }`,
    })
  );

  // signals: points travelling along random synapses, layer by layer
  const N = 60;
  const sigPos = new Float32Array(N * 3);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sigPos, 3));
  const sigU = { uColor: { value: new THREE.Color('#f1d9ff') }, uAmt: { value: 1 } };
  const sigs = new THREE.Points(
    sg,
    new THREE.ShaderMaterial({
      uniforms: sigU,
      ...additive(),
      vertexShader: `void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = 70.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uAmt; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(uColor * a * a * uAmt, 1.0); }`,
    })
  );
  const pickEdge = (layer) => {
    const opts = edges.filter(([a]) => a.layer === layer);
    return opts[Math.floor(Math.random() * opts.length)];
  };
  const signals = Array.from({ length: N }, () => ({ edge: pickEdge(Math.floor(Math.random() * (LAYERS.length - 1))), t: Math.random(), speed: 0.5 + Math.random() * 0.7 }));
  const tmp = new THREE.Vector3();

  const group = new THREE.Group();
  group.add(lines, nodePts, sigs);
  let last = 0;
  return {
    group,
    update(t, amt) {
      const dt = Math.min(0.05, Math.max(0, t - last));
      last = t;
      nodeU.uTime.value = t;
      nodeU.uAmt.value = amt;
      sigU.uAmt.value = amt;
      lineMat.opacity = 0.08 + 0.1 * amt;
      signals.forEach((s, i) => {
        s.t += dt * s.speed;
        if (s.t >= 1) {
          const next = s.edge[1].layer < LAYERS.length - 1 ? s.edge[1].layer : 0; // loop back to the input layer
          s.edge = pickEdge(next);
          s.t = 0;
        }
        tmp.lerpVectors(s.edge[0].p, s.edge[1].p, s.t);
        sigPos.set([tmp.x, tmp.y, tmp.z], i * 3);
      });
      sg.attributes.position.needsUpdate = true;
      group.rotation.y = Math.sin(t * 0.25) * 0.18;
    },
  };
}

const BUILDERS = { frames: buildFrames, portal: buildPortal, cubes: buildCubes, ledwall: buildLedWall, neural: buildNeural };

export class ServiceZone {
  constructor(service, index, { camera }) {
    this.camera = camera;
    this.color = new THREE.Color(service.zoneColor || '#8b3dff');
    const build = BUILDERS[service.visual] || BUILDERS.portal;
    this.visual = build(this.color);
    this.atmos = atmosphere(this.color);
    this.object = new THREE.Group();
    this.inner = new THREE.Group();
    this.inner.add(this.atmos, this.visual.group);
    this.object.add(this.inner);
    this.weight = 0;
    this._v = new THREE.Vector3();
    this.phase = index * 1.7;
  }

  /** 0..1: how much this zone "owns" the camera right now (drives lighting shift). */
  update(dt, t) {
    this.object.getWorldPosition(this._v);
    const d = this._v.distanceTo(this.camera.position);
    this.object.visible = d < 80; // distance culling
    if (!this.object.visible) { this.weight = 0; return; }
    const w = THREE.MathUtils.clamp((26 - d) / (26 - 9), 0, 1);
    this.weight += (w * w * (3 - 2 * w) - this.weight) * (1 - Math.pow(0.03, dt));
    const amt = 0.25 + 0.75 * this.weight;
    this.atmos.material.uniforms.uAmt.value = this.weight;
    this.visual.update(t, amt);
    this.inner.position.y = Math.sin(t * 0.5 + this.phase) * 0.1;
  }
}
