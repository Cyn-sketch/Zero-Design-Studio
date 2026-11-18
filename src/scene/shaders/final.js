import { Vector2 } from 'three';

/**
 * Final screen pass: radial chromatic aberration, horizontal block glitch,
 * subtle scanlines and vignette. `uGlitch` is 0 at rest and spiked briefly
 * on transitions; `uAberration` is the always-on edge fringe.
 */
export const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAberration: { value: 0.6 },
    uGlitch: { value: 0 },
    uVignette: { value: 1.0 },
    uResolution: { value: new Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uAberration, uGlitch, uVignette;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float hash(float n) { return fract(sin(n) * 43758.5453123); }

    void main() {
      vec2 uv = vUv;

      // Block glitch: random horizontal bands shift sideways while uGlitch > 0.
      float rows = 28.0;
      float band = floor(uv.y * rows);
      float tick = floor(uTime * 18.0);
      float r = hash(band * 13.1 + tick * 7.7);
      float on = step(1.0 - 0.22 * uGlitch, r);
      uv.x += on * (hash(band + tick) - 0.5) * 0.08 * uGlitch;

      // Radial chromatic aberration, stronger toward the edges, boosted by glitch.
      vec2 dir = uv - 0.5;
      float d = dot(dir, dir);
      vec2 off = dir * (0.006 * uAberration * d * 4.0 + 0.012 * uGlitch * on + 0.0025 * uGlitch);
      float cr = texture2D(tDiffuse, uv + off).r;
      vec4 cg = texture2D(tDiffuse, uv);
      float cb = texture2D(tDiffuse, uv - off).b;
      vec3 col = vec3(cr, cg.g, cb);

      // Scanlines (very light)
      col *= 0.97 + 0.03 * sin(vUv.y * uResolution.y * 1.4);

      // Vignette
      float v = smoothstep(0.95, 0.2, length(vUv - 0.5) * 1.25);
      col *= mix(1.0, v, 0.75 * uVignette);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
