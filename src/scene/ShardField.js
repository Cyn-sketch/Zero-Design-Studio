import * as THREE from 'three';

/** One irregular triangle: the base "shard" every instance is drawn from. */
export function shardGeometry() {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.32, 0, 0.55, -0.12, 0, 0.02, 0.5, 0], 3));
  return g;
}

/**
 * Ambient field of floating glitch shards filling the whole journey volume.
 * Single instanced draw call; all motion happens in the vertex shader.
 */
export class ShardField {
  constructor({ count, depth = 160, spread = [22, 13] }) {
    const g = shardGeometry();
    const off = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const rnd = new Float32Array(count * 4);
    const c = new THREE.Color();
    const palette = [
      [0.2, '#2a0a5e'],
      [0.45, '#4b14a8'],
      [0.7, '#6a1bd6'],
      [0.86, '#8b3dff'],
      [0.94, '#c32bff'],
      [1.0, '#cfcbd9'], // a few chrome flecks
    ];
    for (let i = 0; i < count; i++) {
      // Keep a clear corridor around the camera path (x≈0,y≈0) so shards frame the view.
      let x, y;
      do {
        x = (Math.random() * 2 - 1) * spread[0];
        y = (Math.random() * 2 - 1) * spread[1];
      } while (Math.abs(x) < 2.2 && Math.abs(y) < 1.4);
      off[i * 3] = x;
      off[i * 3 + 1] = Math.round(y * 4) / 4 + (Math.random() - 0.5) * 0.05; // banded rows = digital feel
      off[i * 3 + 2] = 14 - Math.random() * depth;
      const p = Math.random();
      c.set(palette.find((e) => p <= e[0])[1]);
      col.set([c.r, c.g, c.b], i * 3);
      const sliver = 0; // thin line shards removed
      rnd.set([Math.random(), 0.05 + Math.random() ** 2 * 0.28, sliver, Math.random()], i * 4);
    }
    g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 3));
    g.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3));
    g.setAttribute('aRand', new THREE.InstancedBufferAttribute(rnd, 4));
    g.instanceCount = count;

    this.uniforms = {
      uTime: { value: 0 },
      uGlitch: { value: 0 },
      uTint: { value: new THREE.Color('#6a1bd6') },
      uTintMix: { value: 0 },
      uFogDensity: { value: 0.045 },
      uOpacity: { value: 1 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime, uGlitch;
        attribute vec3 aOffset, aColor;
        attribute vec4 aRand; // x phase, y size, z sliver flag, w speed
        varying vec3 vColor;
        varying float vDepth, vTw;
        mat2 rot(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }
        float hash(float n) { return fract(sin(n) * 43758.5453); }
        void main() {
          vec3 p = aOffset;
          float t = uTime * (0.15 + aRand.w * 0.25);
          p.x += sin(t + aRand.x * 6.28) * 0.35;
          p.y += cos(t * 0.8 + aRand.x * 4.0) * 0.25;
          // Row glitch: whole bands jump sideways briefly.
          float band = floor(aOffset.y * 4.0) + floor(uTime * 10.0) * 3.1;
          float h = hash(band);
          p.x += step(0.985 - 0.2 * uGlitch, h) * (h - 0.5) * 2.5;

          vec3 l = position * aRand.y;
          if (aRand.z > 0.5) { l.x *= 9.0; l.y *= 0.18; } // thin glitch sliver
          else {
            l.xy = rot(uTime * 0.3 * (aRand.w - 0.5) + aRand.x * 6.28) * l.xy;
            l.yz = rot(uTime * 0.4 * aRand.w + aRand.x * 3.0) * l.yz;
          }
          vec4 mv = modelViewMatrix * vec4(p + l, 1.0);
          vDepth = -mv.z;
          vColor = aColor;
          vTw = 0.55 + 0.45 * sin(uTime * (1.0 + aRand.w * 3.0) + aRand.x * 30.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTint;
        uniform float uTintMix, uFogDensity, uOpacity;
        varying vec3 vColor;
        varying float vDepth, vTw;
        void main() {
          float fog = exp(-uFogDensity * uFogDensity * vDepth * vDepth);
          float near = smoothstep(0.4, 2.5, vDepth); // fade shards brushing the lens
          vec3 c = mix(vColor, uTint, uTintMix);
          gl_FragColor = vec4(c * vTw * 0.9, fog * near * uOpacity);
        }
      `,
    });

    this.object = new THREE.Mesh(g, mat);
    this.object.frustumCulled = false;
  }

  update(dt, t) {
    this.uniforms.uTime.value = t;
  }
}
