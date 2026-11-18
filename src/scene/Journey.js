import * as THREE from 'three';
import { ProjectObject } from './ProjectObject.js';
import { ServiceZone } from './ServiceZone.js';
import { BG } from './World.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * The scroll-driven flight. Owns the waypoints, the project objects, the
 * service zones and the mapping from page scroll (real DOM sections) to camera
 * stop index.
 *
 * Stops, in order: hero · 4 projects · "Explore all work" · 4 service zones.
 * Each project / service <article> is ~180vh tall with a sticky copy panel. The
 * camera "parks" while its copy is pinned on screen, then flies to the next
 * stop in the scroll gap between them.
 *
 * onStop(index, info) is called when the active stop changes:
 *   index 0..P-1 projects, P = explore, P+1.. services, -1 = none.
 */
export class Journey {
  constructor({ world, rig, content, field, logo, onStop }) {
    this.world = world;
    this.rig = rig;
    this.field = field;
    this.logo = logo;
    this.onStop = onStop;
    this.projects = content.work.projects;
    this.services = content.services.items;
    this.active = -1;

    this.stopsEl = {
      projects: [...document.querySelectorAll('.stop--project')],
      explore: document.querySelector('.stop--explore'),
      services: [...document.querySelectorAll('.stop--service')],
      brands: document.getElementById('brands'),
      contact: document.getElementById('contact'),
    };

    // ---- Projects
    const D = 26, Z0 = -26;
    const points = [new THREE.Vector3(0, 0, 10)];
    const looks = [new THREE.Vector3(0, 0, 0)];
    this.objects = this.projects.map((p, i) => {
      const side = i % 2 === 0 ? 1 : -1; // +1: object on the right, copy on the left
      const obj = world.add(new ProjectObject(p, i, { camera: world.camera }));
      obj.object.position.set(side * 2.9, i % 2 ? -0.2 : 0.25, Z0 - i * D);
      obj.object.rotation.y = -side * 0.3;
      const o = obj.object.position;
      points.push(new THREE.Vector3(o.x - side * 2.7, o.y * 0.5 + 0.1, o.z + 9.4));
      looks.push(new THREE.Vector3(o.x - side * 1.35, o.y * 0.5, o.z));
      return obj;
    });
    const lastZ = Z0 - (this.projects.length - 1) * D;

    // ---- Explore all work
    points.push(new THREE.Vector3(0, 0.3, lastZ - 18));
    looks.push(new THREE.Vector3(0, 0, lastZ - 60));

    // ---- Service zones
    const SZ0 = lastZ - 52, SD = 30;
    this.zones = this.services.map((s, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      const z = world.add(new ServiceZone(s, i, { camera: world.camera }));
      z.object.position.set(side * 2.4, 0, SZ0 - i * SD);
      z.object.rotation.y = -side * 0.35;
      const o = z.object.position;
      points.push(new THREE.Vector3(o.x - side * 2.9, 0.15, o.z + 9.6));
      looks.push(new THREE.Vector3(o.x - side * 1.3, 0, o.z));
      return z;
    });
    this.basePoints = points;
    this.baseLooks = looks;
    this.S = this.services.length;
    this.buildPath();

    // Lighting shift state
    this.baseBloom = world.bloom.strength;
    this._tint = new THREE.Color();
    this._bg = new THREE.Color();

    this.measure = this.measure.bind(this);
    window.addEventListener('resize', this.measure);
    window.addEventListener('load', this.measure);
    document.fonts?.ready.then(this.measure);
    this.measure();
  }

  /**
   * Contact close: the camera is teleported (while the brand reel covers the
   * screen) to just inside the scattered logo, then pulls back as it reassembles.
   * A "pre" point right behind keeps the Catmull-Rom tangents local, so the
   * pull-back doesn't swing out toward the far-away service zones.
   */
  buildPath() {
    const L = this.logo?.object.position || new THREE.Vector3();
    const near = new THREE.Vector3(L.x, L.y - 1.2, 7.5);
    const far = new THREE.Vector3(L.x, L.y - 3.3, 18.5);
    const pre = near.clone().add(new THREE.Vector3(0, 0, -0.6));
    const lookNear = new THREE.Vector3(L.x, L.y - 1.2, 0);
    const lookFar = new THREE.Vector3(L.x, L.y - 3.3, 0);
    this.kPre = this.basePoints.length; // index of "pre"
    this.kNear = this.kPre + 1;
    this.kFar = this.kPre + 2;
    this.rig.setPath([...this.basePoints, pre, near, far], [...this.baseLooks, lookNear.clone().add(new THREE.Vector3(0, 0, -0.6)), lookNear, lookFar]);
  }

  /** Scroll anchors: [scrollY, stopIndex]. Equal-index pairs = dwell. */
  measure() {
    if (this.basePoints) this.buildPath(); // logo position depends on viewport
    const vh = window.innerHeight;
    const top = (el) => el.getBoundingClientRect().top + window.scrollY;
    const a = [[0, 0]];
    this.ranges = [];
    const parked = (el, k) => {
      const t = top(el);
      const h = el.offsetHeight;
      a.push([t + vh * 0.05, k], [t + h - vh * 1.1, k]);
      this.ranges.push([t - vh * 0.05, t + h - vh * 1.06]);
    };
    this.stopsEl.projects.forEach((el, i) => parked(el, i + 1));
    const P = this.projects.length;
    const ex = this.stopsEl.explore;
    const et = top(ex) + ex.offsetHeight / 2 - vh / 2;
    a.push([et, P + 1]);
    this.ranges.push([et - vh * 0.4, et + vh * 0.5]);
    this.stopsEl.services.forEach((el, i) => parked(el, P + 2 + i));

    // Brands cover the screen: hold the last zone, then jump (hidden) to the logo.
    const lastSvc = P + 1 + this.S;
    const bt = top(this.stopsEl.brands);
    a.push([bt, lastSvc], [bt + 1, this.kNear]);
    // Contact: pull back while the copy is pinned.
    const c = this.stopsEl.contact;
    const ct = top(c);
    a.push([ct - vh * 0.55, this.kNear], [ct + c.offsetHeight - vh * 1.05, this.kFar]);
    this.ranges.push([ct - vh * 0.45, ct + c.offsetHeight]);
    this.jumpY = bt;
    this.anchors = a;
  }

  progressAt(y) {
    const a = this.anchors;
    if (y <= a[0][0]) return a[0][1];
    for (let i = 0; i < a.length - 1; i++) {
      const [y0, k0] = a[i];
      const [y1, k1] = a[i + 1];
      if (y <= y1) {
        if (k0 === k1) return k0;
        return k0 + (k1 - k0) * ease((y - y0) / Math.max(1, y1 - y0));
      }
    }
    return a[a.length - 1][1];
  }

  /** Blend colour/lighting toward whichever service zone owns the camera. */
  lighting() {
    let sum = 0;
    this._tint.setRGB(0, 0, 0);
    for (const z of this.zones) {
      this._tint.r += z.color.r * z.weight;
      this._tint.g += z.color.g * z.weight;
      this._tint.b += z.color.b * z.weight;
      sum += z.weight;
    }
    const w = Math.min(sum, 1);
    if (sum > 0.001) this._tint.multiplyScalar(1 / sum);
    if (this.field) {
      this.field.uniforms.uTint.value.copy(this._tint);
      this.field.uniforms.uTintMix.value = w * 0.45;
    }
    this._bg.copy(BG).lerp(this._tint.clone().multiplyScalar(0.12), w * 0.4);
    this.world.scene.background.copy(this._bg);
    this.world.bloom.strength = this.baseBloom * (1 + 0.2 * w);
  }

  update() {
    const y = window.scrollY;
    this.rig.progress = this.progressAt(y);
    // Snap across the hidden jump so the camera never visibly flies the whole
    // space backwards (rendering is paused while the brand reel covers it).
    const lastSvc = this.projects.length + 1 + this.S;
    const r = this.rig;
    if ((r.progress >= this.kNear && r.smooth < this.kNear - 0.5) || (r.progress <= lastSvc && r.smooth > lastSvc + 0.5)) r.smooth = r.progress;
    let active = -1;
    this.ranges.forEach(([s, e], i) => {
      if (y >= s && y <= e) active = i;
    });
    if (active !== this.active) {
      this.active = active;
      this.onStop?.(active, { projects: this.projects.length, services: this.services.length });
    }
    this.lighting();
  }
}
