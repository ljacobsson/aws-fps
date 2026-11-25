import * as THREE from 'three';
import {
  canvas, toTexture, roundRect, fitText, drawIcon, drawAwsLogo, FONT, DISPLAY_FONT, MONO,
  floorTileTexture, wallTexture,
} from './textures.js';
import { SERVICES, AWS_ORANGE } from './theme.js';

// ---------------------------------------------------------------------------
// Shared materials & geometry
// ---------------------------------------------------------------------------

const matCache = new Map();
export function mat(key, make) {
  if (!matCache.has(key)) matCache.set(key, make());
  return matCache.get(key);
}

export const M = {
  metalDark: () => mat('metalDark', () => new THREE.MeshStandardMaterial({ color: '#1a1e25', roughness: 0.45, metalness: 0.7 })),
  metal: () => mat('metal', () => new THREE.MeshStandardMaterial({ color: '#8a929e', roughness: 0.35, metalness: 0.85 })),
  steel: () => mat('steel', () => new THREE.MeshStandardMaterial({ color: '#4a525e', roughness: 0.4, metalness: 0.8 })),
  black: () => mat('black', () => new THREE.MeshStandardMaterial({ color: '#07090c', roughness: 0.6, metalness: 0.3 })),
  white: () => mat('white', () => new THREE.MeshStandardMaterial({ color: '#e9edf2', roughness: 0.5, metalness: 0.1 })),
  yellow: () => mat('yellow', () => new THREE.MeshStandardMaterial({ color: '#f2c200', roughness: 0.5, metalness: 0.2 })),
  color: (c, rough = 0.5, metal = 0.2) => mat(`c:${c}:${rough}:${metal}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal })),
  glow: (c, k = 2) => mat(`g:${c}:${k}`, () => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) })),
  glass: (c = '#9fd6ff') => mat(`glass:${c}`, () => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: 0.18, depthWrite: false })),
};

const geoCache = new Map();
export function geo(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}
export const G = {
  box: (w, h, d) => geo(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d)),
  cyl: (rt, rb, h, s = 24, open = false) => geo(`cyl:${rt}:${rb}:${h}:${s}:${open}`, () => new THREE.CylinderGeometry(rt, rb, h, s, 1, open)),
  sphere: (r, s = 24) => geo(`sph:${r}:${s}`, () => new THREE.SphereGeometry(r, s, Math.round(s * 0.66))),
  plane: (w, h) => geo(`pl:${w}:${h}`, () => new THREE.PlaneGeometry(w, h)),
  torus: (r, t, rs = 12, ts = 32, arc = Math.PI * 2) => geo(`tor:${r}:${t}:${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc)),
};

// A single time uniform shared by all animated shader materials.
export const sharedTime = { value: 0 };

const portalShader = {
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
    void main(){
      vec2 p = vUv - 0.5; p.x *= 0.75;
      float r = length(p); float a = atan(p.y, p.x);
      float swirl = sin(a * 5.0 + r * 22.0 - uTime * 3.2) * 0.5 + 0.5;
      float glow = smoothstep(0.7, 0.0, r);
      vec3 col = mix(uColor * 0.5, vec3(1.0), pow(glow, 3.5));
      col *= 0.55 + 0.9 * swirl * glow;
      gl_FragColor = vec4(col * 1.5, 1.0);
    }`,
};

export function portalMaterial(color) {
  return mat(`portal:${color}`, () => new THREE.ShaderMaterial({
    uniforms: { uTime: sharedTime, uColor: { value: new THREE.Color(color) } },
    vertexShader: portalShader.vertexShader,
    fragmentShader: portalShader.fragmentShader,
    side: THREE.DoubleSide,
  }));
}

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

/** Local (lx, lz) in a frame at (x, z) rotated by ry → world [x, z]. */
export function toWorld(x, z, ry, lx, lz) {
  const c = Math.cos(ry), s = Math.sin(ry);
  return [x + lx * c + lz * s, z - lx * s + lz * c];
}

export function toLocal(x, z, ry, wx, wz) {
  const dx = wx - x, dz = wz - z;
  const c = Math.cos(ry), s = Math.sin(ry);
  return [dx * c - dz * s, dx * s + dz * c];
}

export function aabb(cx, cz, w, d, ry = 0) {
  const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
  const hw = (w * c + d * s) / 2, hd = (w * s + d * c) / 2;
  return { minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd };
}

// ---------------------------------------------------------------------------
// Area builder
// ---------------------------------------------------------------------------

const ledGeo = new THREE.BoxGeometry(0.035, 0.035, 0.02);
const ledMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });

export class AreaBuilder {
  constructor({ id, title, subtitle, color = AWS_ORANGE }) {
    Object.assign(this, { id, title, subtitle, color });
    this.group = new THREE.Group();
    this.colliders = [];
    this.interactables = [];
    this.portals = [];
    this.spawns = {};
    this.updaters = [];
    this.minimap = { walls: [], zones: [], marks: [] };
    this.disposables = [];
    this.instances = new Map();
    this.leds = [];
    this.labels = [];
    this.ceilings = [];
    this.bounds = null;
    this.fog = { color: '#06080d', near: 12, far: 70 };
    this.background = '#05070b';
    this.lighting = { hemi: 0.55, sun: 0.55, env: 0.35, exposure: 1.05 };
    this.onEnter = null;
  }

  add(obj) { this.group.add(obj); return obj; }

  /** Everything instanced inside fn() is hidden in bird's-eye view (ceilings, trays, rails). */
  overheadOnly(fn) {
    this.overhead = true;
    try { fn(); } finally { this.overhead = false; }
  }
  track(...d) { this.disposables.push(...d); return d[0]; }

  mesh(geometry, material, x = 0, y = 0, z = 0, ry = 0) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    return this.add(m);
  }

  /** Queue an instanced copy of (geometry, material). Instanced at finalize(). */
  inst(geometry, material, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0) {
    const key = `${geometry.uuid}|${material.uuid}|${this.overhead ? 'o' : ''}`;
    if (!this.instances.has(key)) this.instances.set(key, { geometry, material, mats: [], overhead: this.overhead });
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')),
      new THREE.Vector3(sx, sy, sz),
    );
    this.instances.get(key).mats.push(m);
  }

  /** Like inst(), but returns a handle that can hide/show this one instance after finalize(). */
  instRef(geometry, material, x, y, z, ry = 0) {
    this.inst(geometry, material, x, y, z, ry);
    const key = `${geometry.uuid}|${material.uuid}|${this.overhead ? 'o' : ''}`;
    const entry = this.instances.get(key);
    const i = entry.mats.length - 1;
    const original = entry.mats[i].clone();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    return {
      setVisible: (v) => {
        const im = entry.mesh;
        if (!im) return;
        im.setMatrixAt(i, v ? original : zero);
        im.instanceMatrix.needsUpdate = true;
      },
    };
  }

  collide(box) { this.colliders.push(box); return box; }
  collideRect(cx, cz, w, d, ry = 0) { return this.collide(aabb(cx, cz, w, d, ry)); }

  led(x, y, z, color, { blink = 0.5, on = true } = {}) {
    this.leds.push({ x, y, z, color: new THREE.Color(color), blink, on });
  }

  /** Floating name tag. Created lazily when the player is near (see World), so big rooms stay cheap. */
  label(text, x, y, z, opts = {}) {
    const l = { text, opts, x, y, z, sprite: null };
    this.labels.push(l);
    return l;
  }

  /** Always-present label (for things that move or must be seen from afar). */
  fixedLabel(text, x, y, z, opts = {}) {
    const sprite = makeLabelSprite(text, opts);
    sprite.position.set(x, y, z);
    this.track(sprite.material.map, sprite.material);
    return this.add(sprite);
  }

  interact(spec) {
    const it = { radius: 2.6, ...spec, pos: new THREE.Vector3(spec.x, spec.y ?? 1.2, spec.z) };
    this.interactables.push(it);
    return it;
  }

  spawn(name, x, z, yaw) { this.spawns[name] = { x, z, yaw }; }
  update(fn) { this.updaters.push(fn); }
  wallLine(x1, z1, x2, z2) { this.minimap.walls.push([x1, z1, x2, z2]); }
  mark(x, z, color, size = 3) { this.minimap.marks.push({ x, z, color, size }); }

  finalize() {
    for (const entry of this.instances.values()) {
      const { geometry, material, mats, overhead } = entry;
      const im = new THREE.InstancedMesh(geometry, material, mats.length);
      entry.mesh = im;
      if (overhead) this.ceilings.push(im);
      mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      this.add(im);
      this.track(im);
    }
    if (this.leds.length) {
      const im = new THREE.InstancedMesh(ledGeo, ledMat, this.leds.length);
      const m = new THREE.Matrix4();
      const tmp = new THREE.Color();
      this.leds.forEach((l, i) => {
        m.makeTranslation(l.x, l.y, l.z);
        im.setMatrixAt(i, m);
        im.setColorAt(i, tmp.copy(l.color).multiplyScalar(l.on ? 3 : 0.08));
      });
      im.instanceMatrix.needsUpdate = true;
      im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      this.add(im);
      this.track(im);
      const leds = this.leds;
      let acc = 0;
      this.update((dt) => {
        acc += dt;
        if (acc < 0.06) return;
        acc = 0;
        const n = Math.max(1, Math.floor(leds.length * 0.04));
        for (let k = 0; k < n; k++) {
          const i = Math.floor(Math.random() * leds.length);
          const l = leds[i];
          if (!l.on) continue;
          const lit = Math.random() > l.blink * 0.6;
          im.setColorAt(i, tmp.copy(l.color).multiplyScalar(lit ? 3.2 : 0.25));
        }
        im.instanceColor.needsUpdate = true;
      });
    }
    return this;
  }
}

// ---------------------------------------------------------------------------
// Labels, signs, screens
// ---------------------------------------------------------------------------

export function makeLabelSprite(text, { sub, color = '#ffffff', accent = AWS_ORANGE, scale = 1, icon } = {}) {
  const W = 512, H = sub ? 150 : 104;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(8,12,18,0.82)';
  roundRect(ctx, 4, 4, W - 8, H - 8, 18);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.stroke();
  let x0 = 24;
  if (icon) {
    drawIcon(ctx, icon, 18, (H - 72) / 2, 72);
    x0 = 104;
  }
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const t = fitText(ctx, text, W - x0 - 20, 50, 700);
  ctx.fillText(t, x0, sub ? 52 : H / 2 + 2);
  if (sub) {
    ctx.fillStyle = '#9fb0c6';
    const s = fitText(ctx, sub, W - x0 - 20, 34, 600);
    ctx.fillText(s, x0, 106);
  }
  const tex = toTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(2.2 * scale, (2.2 * scale * H) / W, 1);
  sprite.renderOrder = 2;
  return sprite;
}

/** Flat sign texture: icon + title + subtitle. */
export function signTexture({ title, subtitle, icon, color = AWS_ORANGE, w = 1024, h = 256, bg = '#0b0f16' }) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, bg);
  g.addColorStop(1, '#04060a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(0, h - 10, w, 10);
  ctx.fillRect(0, 0, w, 4);
  let x0 = 40;
  if (icon) {
    drawIcon(ctx, icon, 30, (h - 170) / 2 - 4, 170);
    x0 = 230;
  }
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const t = fitText(ctx, title.toUpperCase(), w - x0 - 30, subtitle ? 100 : 120, 400, DISPLAY_FONT);
  ctx.fillText(t, x0, subtitle ? h * 0.38 : h / 2);
  if (subtitle) {
    ctx.fillStyle = '#a9b8cc';
    const s = fitText(ctx, subtitle, w - x0 - 30, 50, 600);
    ctx.fillText(s, x0, h * 0.76);
  }
  return toTexture(c);
}

export function signMesh(b, opts, width, height) {
  const tex = b.track(signTexture(opts));
  const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.92, 0.92, 0.92) });
  b.track(m);
  return new THREE.Mesh(G.plane(width, height), m);
}

/** A canvas-backed screen: returns { mesh, ctx, canvas, texture, redraw() }. */
export function screen(b, w, h, { px = 512, glow = 1.3 } = {}) {
  const c = canvas(px, Math.round((px * h) / w));
  const ctx = c.getContext('2d');
  const tex = b.track(toTexture(c));
  const m = b.track(new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(glow, glow, glow) }));
  const mesh = new THREE.Mesh(G.plane(w, h), m);
  return { mesh, ctx, canvas: c, texture: tex, redraw: () => { tex.needsUpdate = true; } };
}

export function textPanel(b, lines, { w = 6, h = 3.4, title, color = AWS_ORANGE, px = 1024, font = MONO, size = 26 } = {}) {
  const s = screen(b, w, h, { px });
  const { ctx, canvas: c } = s;
  ctx.fillStyle = '#060a10';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, c.width - 6, c.height - 6);
  let y = 20;
  if (title) {
    ctx.fillStyle = color;
    ctx.font = `400 ${size * 2}px ${DISPLAY_FONT}`;
    ctx.textBaseline = 'top';
    ctx.fillText(fitText(ctx, title.toUpperCase(), c.width - 50, size * 2, 400, DISPLAY_FONT), 26, y);
    y += size * 2.6;
  }
  ctx.font = `500 ${size}px ${font}`;
  ctx.textBaseline = 'top';
  for (const line of lines) {
    if (y > c.height - size - 10) break;
    const [txt, col] = Array.isArray(line) ? line : [line, '#cfe3ff'];
    ctx.fillStyle = col;
    ctx.fillText(fitText(ctx, txt, c.width - 52, size, 500, font), 26, y);
    y += size * 1.35;
  }
  s.redraw();
  return s.mesh;
}

export function posterTexture(title, tagline, color = AWS_ORANGE) {
  const c = canvas(512, 720);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 720);
  g.addColorStop(0, '#232f3e');
  g.addColorStop(1, '#0d131b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 720);
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.strokeRect(18, 18, 476, 684);
  drawAwsLogo(ctx, 176, 60, 160);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const words = title.split(' ');
  let y = 330;
  for (const w of words) {
    ctx.fillText(fitText(ctx, w, 440, 92, 400, DISPLAY_FONT), 256, y);
    y += 92;
  }
  ctx.fillStyle = '#c3cfdd';
  ctx.font = `600 32px ${FONT}`;
  wrapText(ctx, tagline, 256, y + 30, 420, 38);
  return toTexture(c);
}

export function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = w;
      y += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
  return y;
}

// ---------------------------------------------------------------------------
// Rooms & doors
// ---------------------------------------------------------------------------

const SIDE_ROT = { n: 0, s: Math.PI, w: Math.PI / 2, e: -Math.PI / 2 };

/**
 * Rectangular room centred on (cx, cz). Doors: [{ side, at, ...doorOpts }], `at` is the
 * offset along the wall from the wall's centre.
 */
export function room(b, {
  cx = 0, cz = 0, w, d, h = 5, floorTint = '#232a35', wallTint = '#151a22', accent = AWS_ORANGE,
  doors = [], ceiling = true, perforated = 0.25, lightRows = true, trim = true,
}) {
  const floorTex = b.track(toTexture(floorTileTexture(floorTint, perforated), { repeat: [w / 2.4, d / 2.4] }));
  const floor = b.mesh(G.plane(w, d), b.track(new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.32, metalness: 0.35 })), cx, 0, cz);
  floor.rotation.x = -Math.PI / 2;

  const wallTexBase = b.track(toTexture(wallTexture(wallTint), { repeat: [1, 1] }));
  const wallMatFor = (sl, hh) => {
    const tex = b.track(wallTexBase.clone());
    tex.repeat.set(Math.max(1, Math.round(sl / 3)), Math.max(1, hh / 5));
    tex.needsUpdate = true;
    return b.track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.25 }));
  };
  const T = 0.3;
  const trimMat = M.glow(accent, 1.6);
  const sides = {
    n: { x1: cx - w / 2, x2: cx + w / 2, z: cz - d / 2, horiz: true },
    s: { x1: cx - w / 2, x2: cx + w / 2, z: cz + d / 2, horiz: true },
    w: { z1: cz - d / 2, z2: cz + d / 2, x: cx - w / 2, horiz: false },
    e: { z1: cz - d / 2, z2: cz + d / 2, x: cx + w / 2, horiz: false },
  };
  for (const [side, s] of Object.entries(sides)) {
    const len = s.horiz ? w : d;
    const ds = doors.filter((dd) => dd.side === side).map((dd) => ({ ...dd, width: dd.width || 2.6 })).sort((a, b2) => a.at - b2.at);
    // Build segments between door gaps along the wall (t from -len/2 to len/2).
    let t = -len / 2;
    const segs = [];
    for (const dd of ds) {
      const g1 = dd.at - dd.width / 2 - 0.25, g2 = dd.at + dd.width / 2 + 0.25;
      if (g1 > t) segs.push([t, g1]);
      t = g2;
    }
    if (t < len / 2) segs.push([t, len / 2]);
    const place = (t1, t2, y0, y1) => {
      const mid = (t1 + t2) / 2, sl = t2 - t1, hh = y1 - y0;
      if (sl <= 0.01 || hh <= 0.01) return;
      const [x, z] = s.horiz ? [cx + mid, s.z] : [s.x, cz + mid];
      const [gw, gd] = s.horiz ? [sl, T] : [T, sl];
      const m = b.mesh(new THREE.BoxGeometry(gw, hh, gd), wallMatFor(sl, hh), x, y0 + hh / 2, z);
      b.track(m.geometry);
      return m;
    };
    for (const [t1, t2] of segs) {
      place(t1, t2, 0, h);
      const [x1, z1] = s.horiz ? [cx + t1, s.z] : [s.x, cz + t1];
      const [x2, z2] = s.horiz ? [cx + t2, s.z] : [s.x, cz + t2];
      b.collide({ minX: Math.min(x1, x2) - T / 2, maxX: Math.max(x1, x2) + T / 2, minZ: Math.min(z1, z2) - T / 2, maxZ: Math.max(z1, z2) + T / 2 });
      b.wallLine(x1, z1, x2, z2);
      if (trim) {
        const mid = (t1 + t2) / 2, sl = t2 - t1;
        const inset = side === 'n' || side === 'w' ? T / 2 + 0.02 : -T / 2 - 0.02;
        const [x, z] = s.horiz ? [cx + mid, s.z + inset] : [s.x + inset, cz + mid];
        b.inst(G.box(1, 1, 1), trimMat, x, 0.12, z, 0, s.horiz ? sl : 0.04, 0.05, s.horiz ? 0.04 : sl);
        b.inst(G.box(1, 1, 1), trimMat, x, h - 0.3, z, 0, s.horiz ? sl : 0.04, 0.03, s.horiz ? 0.04 : sl);
      }
    }
    // lintels above doors
    for (const dd of ds) {
      const dh = dd.height || 3.2;
      place(dd.at - dd.width / 2 - 0.25, dd.at + dd.width / 2 + 0.25, dh + 0.2, h);
    }
    // doors themselves
    for (const dd of ds) {
      const [x, z] = s.horiz ? [cx + dd.at, s.z] : [s.x, cz + dd.at];
      door(b, { ...dd, x, z, ry: SIDE_ROT[side], wall: true });
    }
  }

  if (ceiling) {
    const cm = b.mesh(G.plane(w, d), M.color('#0b0e13', 0.9, 0.1), cx, h, cz);
    cm.rotation.x = Math.PI / 2;
    b.ceilings.push(cm);
    if (lightRows) {
      const strip = M.glow('#dfefff', 0.75);
      for (let x = cx - w / 2 + 3; x <= cx + w / 2 - 2; x += 6) {
        const lm = b.mesh(G.box(0.25, 0.06, d - 3), strip, x, h - 0.04, cz);
        b.ceilings.push(lm);
      }
    }
  }
  b.bounds = { minX: cx - w / 2 - 1, maxX: cx + w / 2 + 1, minZ: cz - d / 2 - 1, maxZ: cz + d / 2 + 1 };
  return { cx, cz, w, d, h };
}

/**
 * A door that is a portal. Faces local +Z. `target` is an area spec to enter.
 * Registers spawn point `door:<id>` in front of it, so returning puts you here.
 */
export function door(b, {
  id, x, z, ry = 0, width = 2.6, height = 3.2, color = AWS_ORANGE, title = '', subtitle = '', icon,
  target, locked = false, lockedReason, wall = false, signScale = 1, lite = false, onEnterMsg,
}) {
  const tint = locked ? '#ff2d2d' : color;
  const postW = 0.22;
  const part = (geometry, material, lx, y, lz, sx = 1, sy = 1, sz = 1) => {
    const [wx, wz] = toWorld(x, z, ry, lx, lz);
    b.inst(geometry, material, wx, y, wz, ry, sx, sy, sz);
  };
  const box = G.box(1, 1, 1);
  const frameMat = M.steel();
  part(box, frameMat, -width / 2 - postW / 2, (height + 0.2) / 2, 0, postW, height + 0.2, 0.5);
  part(box, frameMat, width / 2 + postW / 2, (height + 0.2) / 2, 0, postW, height + 0.2, 0.5);
  part(box, frameMat, 0, height + 0.11, 0, width + postW * 2, 0.22, 0.5);
  const stripMat = M.glow(tint, 2.4);
  [1, -1].forEach((side) => {
    if (side === -1 && wall) return;
    const fz = 0.26 * side;
    part(box, stripMat, -width / 2 - 0.01, height / 2, fz, 0.05, height, 0.06);
    part(box, stripMat, width / 2 + 0.01, height / 2, fz, 0.05, height, 0.06);
    part(box, stripMat, 0, height + 0.01, fz, width, 0.05, 0.06);
  });
  part(box, M.glow(tint, 1.2), 0, 0.01, 0.7, width, 0.02, 0.4);

  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  b.add(g);
  // Lite doors (big stack halls) are a single instanced slab until you get close.
  const slab = lite ? b.instRef(G.box(width, height, 0.08), M.color('#2a313c', 0.35, 0.8), x, height / 2, z, ry) : null;
  if (lite) g.visible = false;
  const portal = new THREE.Mesh(G.plane(width, height), locked ? M.color('#1a0505') : portalMaterial(color));
  portal.position.set(0, height / 2, wall ? -0.12 : 0);
  g.add(portal);

  const panelMat = M.color('#2a313c', 0.35, 0.8);
  const windowMat = M.glow(tint, 0.9);
  const panels = [-1, 1].map((sgn) => {
    const p = new THREE.Group();
    p.add(new THREE.Mesh(G.box(width / 2, height, 0.08), panelMat));
    const win = new THREE.Mesh(G.box(width / 2 - 0.4, 0.12, 0.1), windowMat);
    win.position.y = 0.4;
    p.add(win);
    p.position.set((sgn * width) / 4, height / 2, 0);
    g.add(p);
    return { p, sgn };
  });

  if (title) {
    if (lite) {
      b.label(title, x, height + 0.75, z, { sub: subtitle, accent: tint, icon, scale: 1.25 });
    } else {
      const sw = Math.max(width + 1.4, 3.6) * signScale, sh = 0.95 * signScale;
      const sign = signMesh(b, { title, subtitle, icon, color: tint }, sw, sh);
      sign.position.set(0, height + 0.25 + sh / 2 + 0.05, 0.27);
      g.add(sign);
      if (!wall) {
        const back = sign.clone();
        back.rotation.y = Math.PI;
        back.position.z = -0.27;
        g.add(back);
      }
    }
  }

  const [sx, sz] = toWorld(x, z, ry, 0, 2.4);
  if (id) b.spawn(`door:${id}`, sx, sz, ry + Math.PI);
  b.mark(...toWorld(x, z, ry, 0, 0.4), tint, 4);

  [[-width / 2 - postW / 2, 0], [width / 2 + postW / 2, 0]].forEach(([lx, lz]) => {
    const [wx, wz] = toWorld(x, z, ry, lx, lz);
    b.collideRect(wx, wz, postW + 0.05, 0.5, ry);
  });
  if (wall || locked) {
    const [wx, wz] = toWorld(x, z, ry, 0, locked ? 0 : -0.75);
    b.collideRect(wx, wz, width, 0.2, ry);
  }

  const state = { open: 0, id, x, z, ry, width, height, target, locked, title, onEnterMsg, twoSided: !wall };
  if (!locked) b.portals.push(state);
  if (locked) {
    const [ix, iz] = toWorld(x, z, ry, 0, 0.8);
    b.interact({
      x: ix, y: 1.6, z: iz, kind: icon || 'iam',
      title: `${title} — locked`, sub: lockedReason || 'AccessDenied',
      item: { name: title, kind: icon, status: 'ACCESS_DENIED', info: { reason: lockedReason } },
      prompt: 'Read the access-denied notice',
    });
  }

  b.update((dt, t, ctx) => {
    if (locked) return;
    const pp = ctx.player.pos;
    const dist = Math.hypot(pp.x - x, pp.z - z);
    if (slab) {
      const near = dist < 24;
      if (near !== state.near) {
        state.near = near;
        g.visible = near;
        slab.setVisible(!near);
      }
    }
    if (dist > 12 && state.open < 0.01) return;
    const want = dist < 4.2 ? 1 : 0;
    state.open = THREE.MathUtils.lerp(state.open, want, 1 - Math.exp(-dt * 6));
    for (const { p, sgn } of panels) p.position.x = sgn * (width / 4 + (state.open * width) / 2);
  });
  return state;
}

// ---------------------------------------------------------------------------
// Decor
// ---------------------------------------------------------------------------

export function cableTray(b, x1, z1, x2, z2, y = 3.6, color = '#f2c200') {
  b.overheadOnly(() => cableTrayInner(b, x1, z1, x2, z2, y, color));
}

function cableTrayInner(b, x1, z1, x2, z2, y, color) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const ry = Math.atan2(x2 - x1, z2 - z1);
  const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
  const trayMat = M.color(color, 0.5, 0.2);
  b.inst(G.box(1, 1, 1), trayMat, mx, y, mz, ry, 0.5, 0.04, len);
  const [ax, az] = toWorld(mx, mz, ry, -0.24, 0);
  const [bx, bz] = toWorld(mx, mz, ry, 0.24, 0);
  b.inst(G.box(1, 1, 1), trayMat, ax, y + 0.08, az, ry, 0.03, 0.16, len);
  b.inst(G.box(1, 1, 1), trayMat, bx, y + 0.08, bz, ry, 0.03, 0.16, len);
  // cables
  const cableColors = ['#1e6bff', '#e7157b', '#7aa116', '#ff9900'];
  cableColors.forEach((c, i) => {
    const [cx2, cz2] = toWorld(mx, mz, ry, -0.15 + i * 0.1, 0);
    b.inst(G.cyl(0.025, 0.025, 1, 6), M.color(c, 0.6, 0), cx2, y + 0.06, cz2, ry, 1, len, 1, Math.PI / 2);
  });
}

export function pillar(b, x, z, h, accent = AWS_ORANGE) {
  b.inst(G.box(1, 1, 1), M.color('#1c222c', 0.5, 0.6), x, h / 2, z, 0, 0.9, h, 0.9);
  b.inst(G.box(1, 1, 1), M.glow(accent, 2), x, 1.2, z, 0, 0.94, 0.06, 0.94);
  b.inst(G.box(1, 1, 1), M.glow(accent, 2), x, h - 0.6, z, 0, 0.94, 0.06, 0.94);
  b.collideRect(x, z, 0.9, 0.9);
}

export function plant(b, x, z, s = 1) {
  b.inst(G.cyl(0.32, 0.24, 0.6, 16), M.color('#e9edf2', 0.4, 0.1), x, 0.3 * s, z, 0, s, s, s);
  b.inst(G.sphere(0.5, 10), M.color('#2f7d3a', 0.8, 0), x, 0.95 * s, z, 0, s, s * 1.1, s);
  b.inst(G.sphere(0.35, 10), M.color('#3d9a48', 0.8, 0), x + 0.15 * s, 1.35 * s, z - 0.1 * s, 0, s, s, s);
  b.collideRect(x, z, 0.7 * s, 0.7 * s);
}

export function poster(b, x, y, z, ry, title, tagline, color) {
  const tex = b.track(posterTexture(title, tagline, color));
  const m = b.track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.25 }));
  const p = b.mesh(G.plane(1.5, 2.1), m, x, y, z, ry);
  b.interact({ x, y, z, kind: 'generic', title: `Poster: ${title}`, sub: tagline, radius: 2.2, item: { name: title, kind: 'poster', info: { says: tagline } }, prompt: 'Read poster' });
  return p;
}

/** Terminal kiosk: pedestal with angled screen. Faces local +Z. */
export function kiosk(b, x, z, ry, { title, lines = [], color = '#3fb6ff', interact }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  b.add(g);
  const base = new THREE.Mesh(G.box(0.8, 1.05, 0.5), M.metalDark());
  base.position.y = 0.52;
  g.add(base);
  const head = new THREE.Mesh(G.box(1.1, 0.75, 0.12), M.metalDark());
  head.position.set(0, 1.35, 0.05);
  head.rotation.x = -0.45;
  g.add(head);
  const scr = textPanel(b, lines, { w: 1.0, h: 0.66, title, color, px: 512, size: 22 });
  scr.position.set(0, 1.35, 0.115);
  scr.rotation.x = -0.45;
  g.add(scr);
  const glowStrip = new THREE.Mesh(G.box(0.82, 0.04, 0.52), M.glow(color, 2));
  glowStrip.position.y = 0.06;
  g.add(glowStrip);
  b.collideRect(x, z, 0.9, 0.6, ry);
  const [ix, iz] = toWorld(x, z, ry, 0, 0.6);
  if (interact) b.interact({ x: ix, y: 1.3, z: iz, radius: 2.4, ...interact });
  b.mark(x, z, color, 2.5);
  return g;
}

export function addLight(b, x, y, z, color, intensity = 20, distance = 20) {
  const l = new THREE.PointLight(color, intensity, distance, 2);
  l.position.set(x, y, z);
  b.add(l);
  return l;
}

export { SERVICES };
