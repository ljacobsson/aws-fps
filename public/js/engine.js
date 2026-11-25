import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildPerson } from './avatar.js';

const EYE = 1.65;
const RADIUS = 0.32;
const WALK = 4.2;
const SPRINT = 8.5;

export class Engine {
  constructor(host) {
    this.host = host;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    r.setSize(host.clientWidth, host.clientHeight);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#05070b');
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;

    this.hemi = new THREE.HemisphereLight('#bcd4ff', '#1a1626', 0.55);
    this.sun = new THREE.DirectionalLight('#ffffff', 0.55);
    this.sun.position.set(10, 30, 8);
    this.scene.add(this.hemi, this.sun);

    this.camera = new THREE.PerspectiveCamera(72, host.clientWidth / host.clientHeight, 0.05, 500);
    this.camera.rotation.order = 'YXZ';

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(host.clientWidth, host.clientHeight), 0.42, 0.35, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    // Player state
    this.player = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, speed: 0 };
    this.mode = 'fps';
    this.birdDist = 15;
    this.modeBlend = 0; // seconds remaining of camera smoothing after a mode switch
    this.avatar = buildPerson({ shirt: '#232f3e' });
    this.avatar.visible = false;
    this.scene.add(this.avatar);

    this.colliders = [];
    this.bounds = null;
    this.frozen = true;
    this.keys = new Set();
    this.mouse = { dx: 0, dy: 0 };
    this.updaters = new Set();
    this.listeners = {};
    this.clock = new THREE.Timer();
    this.time = 0;
    this.bobPhase = 0;

    this.#bindInput();
    window.addEventListener('resize', () => this.resize());
    r.setAnimationLoop(() => this.#tick());
  }

  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); }
  emit(evt, ...args) { (this.listeners[evt] || []).forEach((fn) => fn(...args)); }

  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  get locked() { return document.pointerLockElement === this.renderer.domElement; }

  lock() {
    try {
      const p = this.renderer.domElement.requestPointerLock?.();
      p?.catch?.(() => {});
    } catch { /* ignore */ }
  }

  unlock() { if (this.locked) document.exitPointerLock(); }

  #bindInput() {
    const el = this.renderer.domElement;
    el.addEventListener('click', () => { if (!this.frozen) this.lock(); });
    document.addEventListener('pointerlockchange', () => this.emit('lockchange', this.locked));
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
    });
    el.addEventListener('wheel', (e) => {
      if (this.mode === 'bird') this.birdDist = THREE.MathUtils.clamp(this.birdDist * (1 + Math.sign(e.deltaY) * 0.1), 5, 70);
    }, { passive: true });
    window.addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, select, textarea')) return;
      this.keys.add(e.code);
      if (!e.repeat) this.emit('key', e.code, e);
      if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.modeBlend = 0.7;
    this.emit('mode', mode);
  }

  toggleMode() { this.setMode(this.mode === 'fps' ? 'bird' : 'fps'); }

  teleport(x, z, yaw) {
    this.player.pos.set(x, 0, z);
    this.player.vel.set(0, 0, 0);
    this.player.yaw = yaw;
    this.player.pitch = 0;
    this.modeBlend = 0;
    this.#placeCamera(1);
  }

  forward() {
    return new THREE.Vector3(-Math.sin(this.player.yaw), 0, -Math.cos(this.player.yaw));
  }

  #tick() {
    this.clock.update();
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    if (!this.frozen) this.#updatePlayer(dt);
    else this.player.speed = 0;
    this.avatar.visible = this.mode === 'bird' || this.modeBlend > 0.35;
    this.avatar.position.copy(this.player.pos);
    this.avatar.rotation.y = this.player.yaw;
    this.avatar.userData.animate(dt, this.player.speed);
    this.#placeCamera(dt);
    for (const fn of this.updaters) fn(dt, this.time);
    this.composer.render();
  }

  #updatePlayer(dt) {
    const p = this.player;
    const sens = 0.0022;
    p.yaw -= this.mouse.dx * sens;
    if (this.mode === 'fps') p.pitch = THREE.MathUtils.clamp(p.pitch - this.mouse.dy * sens, -1.45, 1.45);
    else this.birdDist = THREE.MathUtils.clamp(this.birdDist + this.mouse.dy * 0.02, 5, 70);
    this.mouse.dx = this.mouse.dy = 0;
    // Arrow keys rotate too, for the trackpad crowd.
    if (this.keys.has('ArrowLeft')) p.yaw += dt * 2.2;
    if (this.keys.has('ArrowRight')) p.yaw -= dt * 2.2;

    const k = this.keys;
    let fx = 0, fz = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) fz += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) fz -= 1;
    if (k.has('KeyA')) fx -= 1;
    if (k.has('KeyD')) fx += 1;
    const fwd = this.forward();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = fwd.multiplyScalar(fz).add(right.multiplyScalar(fx));
    if (wish.lengthSq() > 0) wish.normalize();
    const max = k.has('ShiftLeft') || k.has('ShiftRight') ? SPRINT : WALK;
    wish.multiplyScalar(max);
    p.vel.lerp(wish, 1 - Math.exp(-dt * 12));

    const step = p.vel.clone().multiplyScalar(dt);
    const before = p.pos.clone();
    p.pos.x += step.x;
    this.#collide(p.pos);
    p.pos.z += step.z;
    this.#collide(p.pos);
    if (this.bounds) {
      p.pos.x = THREE.MathUtils.clamp(p.pos.x, this.bounds.minX + RADIUS, this.bounds.maxX - RADIUS);
      p.pos.z = THREE.MathUtils.clamp(p.pos.z, this.bounds.minZ + RADIUS, this.bounds.maxZ - RADIUS);
    }
    p.speed = before.distanceTo(p.pos) / Math.max(dt, 1e-4);
    this.bobPhase += dt * p.speed * 1.9;
    this.emit('move', p, before);
  }

  #collide(pos) {
    for (const c of this.colliders) {
      if (pos.x < c.minX - RADIUS || pos.x > c.maxX + RADIUS || pos.z < c.minZ - RADIUS || pos.z > c.maxZ + RADIUS) continue;
      const cx = THREE.MathUtils.clamp(pos.x, c.minX, c.maxX);
      const cz = THREE.MathUtils.clamp(pos.z, c.minZ, c.maxZ);
      let dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= RADIUS * RADIUS) continue;
      if (d2 < 1e-8) {
        // Centre is inside the box: push out along the shallowest axis.
        const pen = [pos.x - c.minX, c.maxX - pos.x, pos.z - c.minZ, c.maxZ - pos.z];
        const i = pen.indexOf(Math.min(...pen));
        if (i === 0) pos.x = c.minX - RADIUS; else if (i === 1) pos.x = c.maxX + RADIUS;
        else if (i === 2) pos.z = c.minZ - RADIUS; else pos.z = c.maxZ + RADIUS;
        continue;
      }
      const d = Math.sqrt(d2);
      dx /= d; dz /= d;
      pos.x = cx + dx * RADIUS;
      pos.z = cz + dz * RADIUS;
    }
  }

  #placeCamera(dt) {
    const p = this.player;
    const cam = this.camera;
    const targetPos = new THREE.Vector3();
    const targetQuat = new THREE.Quaternion();
    if (this.mode === 'fps') {
      const bob = Math.sin(this.bobPhase) * 0.035 * Math.min(1, p.speed / 4);
      targetPos.set(p.pos.x, EYE + bob, p.pos.z);
      targetQuat.setFromEuler(new THREE.Euler(p.pitch, p.yaw, 0, 'YXZ'));
    } else {
      const tilt = THREE.MathUtils.degToRad(Math.min(84, 66 + this.birdDist * 0.35));
      const d = this.birdDist;
      targetPos.set(
        p.pos.x + Math.sin(p.yaw) * d * Math.cos(tilt),
        1 + d * Math.sin(tilt),
        p.pos.z + Math.cos(p.yaw) * d * Math.cos(tilt),
      );
      const m = new THREE.Matrix4().lookAt(targetPos, new THREE.Vector3(p.pos.x, 1, p.pos.z), new THREE.Vector3(0, 1, 0));
      targetQuat.setFromRotationMatrix(m);
    }
    if (this.modeBlend > 0 || this.mode === 'bird') {
      const a = this.mode === 'bird' && this.modeBlend <= 0 ? 1 - Math.exp(-dt * 10) : 1 - Math.exp(-dt * 7);
      cam.position.lerp(targetPos, a);
      cam.quaternion.slerp(targetQuat, a);
      this.modeBlend = Math.max(0, this.modeBlend - dt);
    } else {
      cam.position.copy(targetPos);
      cam.quaternion.copy(targetQuat);
    }
  }
}
