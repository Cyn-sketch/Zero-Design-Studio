import * as THREE from 'three';

/**
 * Camera on a spline. `progress` is a float stop index (0 = first waypoint,
 * 1 = second, ...). Catmull-Rom passes exactly through each waypoint, so a
 * whole number means "parked at that stop". Mouse adds a small parallax.
 */
export class CameraRig {
  constructor(camera, { parallax = 0.35 } = {}) {
    this.camera = camera;
    this.parallax = parallax;
    this.setPath([new THREE.Vector3(0, 0, 10), new THREE.Vector3(0, 0, 9)], [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
    this.progress = 0;
    this.smooth = 0;
    this.mouse = new THREE.Vector2();
    this.mouseS = new THREE.Vector2();
    this._p = new THREE.Vector3();
    this._l = new THREE.Vector3();
  }

  setPath(points, looks) {
    this.count = points.length;
    this.path = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.35);
    this.lookPath = new THREE.CatmullRomCurve3(looks, false, 'catmullrom', 0.35);
  }

  setMouse(nx, ny) {
    this.mouse.set(nx, ny);
  }

  update(dt) {
    const k = 1 - Math.pow(0.0006, dt); // frame-rate independent damping
    this.smooth += (this.progress - this.smooth) * k;
    this.mouseS.lerp(this.mouse, 1 - Math.pow(0.02, dt));
    const t = THREE.MathUtils.clamp(this.smooth / (this.count - 1), 0, 1);
    this.path.getPoint(t, this._p);
    this.lookPath.getPoint(t, this._l);
    this._p.x += this.mouseS.x * this.parallax;
    this._p.y += this.mouseS.y * this.parallax * 0.6;
    this.camera.position.copy(this._p);
    this.camera.lookAt(this._l);
  }
}
