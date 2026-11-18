import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { youtubeEmbedUrl, onYouTubePlaying, watchYouTube } from '../ui/youtube.js';

export { youtubeEmbedUrl, onYouTubePlaying };

const FRAME_W = 1280;
const FRAME_H = 720;

/**
 * Muted, looping YouTube previews playing *on* the projects' 3D planes.
 *
 * A YouTube player can't be drawn into WebGL (cross-origin iframe), so each one
 * lives in a CSS3DRenderer layer that shares the WebGL camera: the iframe gets
 * the exact same perspective transform as its plane and sits right on top of it.
 *
 * Every project's player is created up front and keeps playing the whole time,
 * so the video is already running as you fly in, and keeps running as you fly on.
 * A player is visible whenever its plane has resolved and faces the camera
 * (until then the thumbnail tiles show underneath).
 */
export class YouTubeLayer {
  constructor(camera, projects = []) {
    this.camera = camera;
    this.scene = new THREE.Scene();
    this.renderer = new CSS3DRenderer();
    const el = this.renderer.domElement;
    el.className = 'yt-layer';
    el.setAttribute('aria-hidden', 'true');
    document.querySelector('.gl').after(el);
    this._q = new THREE.Quaternion();
    this._n = new THREE.Vector3();
    this._to = new THREE.Vector3();
    this._ndc = new THREE.Vector3();
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.entries = projects.filter((p) => p.media?.youtubeId).map((p) => this.create(p));
  }

  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  create(project) {
    const id = project.media.youtubeId;
    const wrap = document.createElement('div');
    wrap.className = 'yt-frame';
    wrap.style.width = `${FRAME_W}px`;
    wrap.style.height = `${FRAME_H}px`;
    const iframe = document.createElement('iframe');
    iframe.src = youtubeEmbedUrl(id, project.media.youtubeStart);
    iframe.title = 'Project video preview';
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
    iframe.tabIndex = -1;
    iframe.setAttribute('frameborder', '0');
    const inner = document.createElement('div'); // animated part (CSS3D owns the wrapper's transform)
    inner.className = 'yt-frame__inner';
    inner.appendChild(iframe);
    wrap.appendChild(inner);
    const entry = { project, wrap, obj: new CSS3DObject(wrap), playing: false, shown: false };
    // Only reveal a player once it's really playing (never a black/loading frame).
    watchYouTube(iframe, (p) => (entry.playing = p)); // live: hides on pause / end / buffering
    entry.obj.scale.setScalar(project.width / FRAME_W);
    this.scene.add(entry.obj);
    return entry;
  }

  update() {
    const cam = this.camera;
    for (const e of this.entries) {
      const { project, obj, wrap } = e;
      // Follow the plane (it floats/bobs) with the same world transform.
      project.inner.getWorldPosition(obj.position);
      project.inner.getWorldQuaternion(this._q);
      obj.quaternion.copy(this._q);

      // Visible when resolved, in front of the camera and facing it (no edge-on / backside artefacts).
      this._n.set(0, 0, 1).applyQuaternion(this._q);
      this._to.copy(cam.position).sub(obj.position).normalize();
      const facing = this._n.dot(this._to);
      this._ndc.copy(obj.position).project(cam);
      const onScreen = this._ndc.z < 1 && Math.abs(this._ndc.x) < 1.8 && Math.abs(this._ndc.y) < 1.8;
      const r = project.resolve;
      const k = THREE.MathUtils.clamp((r - 0.55) / 0.3, 0, 1);
      const alpha = e.playing && onScreen && facing > 0.2 ? k * k * (3 - 2 * k) : 0;

      const show = alpha > 0.02;
      wrap.style.opacity = alpha.toFixed(3);
      if (show && !e.shown) {
        wrap.classList.remove('is-in');
        void wrap.offsetWidth; // restart the glitch-in
        wrap.classList.add('is-in');
        this.onShow?.(project);
      }
      e.shown = show;
    }
    this.renderer.render(this.scene, cam);
  }
}
