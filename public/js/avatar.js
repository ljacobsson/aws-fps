import * as THREE from 'three';
import { canvas, toTexture, drawAwsLogo } from './textures.js';

// Shared across every person (and every area), so they are never disposed with an area.
const geoCache = new Map();
const geo = (key, make) => {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
};
const matCache = new Map();
function mat(color, extra = {}) {
  const key = `${color}|${JSON.stringify(extra)}`;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.03, ...extra }));
  return matCache.get(key);
}

// The vest wraps around the torso: u = 0.5 is the chest, u = 0 / 1 is the back.
let vestTex;
function vestTexture() {
  if (vestTex) return vestTex;
  const c = canvas(512, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ff8a00';
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = '#e8eef5';
  ctx.fillRect(0, 150, 512, 20);
  ctx.fillRect(0, 196, 512, 20);
  for (const x of [52, 190, 302, 440]) ctx.fillRect(x, 0, 20, 150); // shoulder straps, front and back
  drawAwsLogo(ctx, 226, 40, 60, '#232f3e'); // chest
  drawAwsLogo(ctx, -50, 60, 100, '#232f3e'); // back, split over the seam
  drawAwsLogo(ctx, 462, 60, 100, '#232f3e');
  vestTex = toTexture(c);
  return vestTex;
}

const shadowTex = (() => {
  const c = canvas(64, 64);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return toTexture(c);
})();

export function blobShadow(radius = 0.5) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.015;
  return m;
}

// Deterministic per style, so a colleague looks the same every time you enter the room.
function rngFor(style) {
  let h = 2166136261;
  for (const ch of JSON.stringify(style)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

const SKINS = ['#f2cba8', '#e0b48f', '#c99872', '#a8754f', '#8a5a3b', '#5e3b26'];
const HAIRS = ['#2b1d12', '#111111', '#5a3a22', '#8a5a2b', '#c9a15a', '#8c8c8c'];

function shade(hex, f) {
  return `#${new THREE.Color(hex).multiplyScalar(f).getHexString()}`;
}

/**
 * Low-poly humanoid; forward is -Z. `style`: { shirt, pants, skin, hat, hatOn, hatType: 'hard'|'cap',
 * vest, hair, hairStyle: 'short'|'long'|'bun'|'bald', glasses, beard, sleeves: 'long'|'short' }.
 * Anything left out is picked from a seed derived from the style.
 */
export function buildPerson(style = {}) {
  const rng = rngFor(style);
  const {
    shirt = '#2b3a55', pants = '#1e2633', hat = '#f5f5f5', vest = true, hatOn = true, hatType = 'hard',
    skin = pick(rng, SKINS),
    hair = pick(rng, HAIRS),
    hairStyle = hatOn ? 'short' : pick(rng, ['short', 'short', 'long', 'bun', 'bald']),
    glasses = rng() < 0.3,
    beard = hairStyle !== 'long' && hairStyle !== 'bun' && rng() < 0.25,
    sleeves = vest ? 'long' : pick(rng, ['long', 'short']),
  } = style;
  const height = 0.93 + rng() * 0.08;

  const skinMat = mat(skin, { roughness: 0.6 });
  const shirtMat = mat(shirt);
  const pantsMat = mat(pants, { roughness: 0.85 });
  const hairMat = mat(hair, { roughness: 0.9 });
  const shoeMat = mat('#16181c', { roughness: 0.5 });

  const root = new THREE.Group();
  const body = new THREE.Group(); // bobs while walking
  body.scale.setScalar(height);
  root.add(body);

  const part = (geometry, material, parent, x = 0, y = 0, z = 0, shadow = true) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    parent.add(m);
    return m;
  };
  const pivot = (parent, x, y, z = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };

  // --- legs: hip → knee → shoe (toes forward) ---
  const hips = pivot(body, 0, 0.93);
  part(geo('pelvis', () => new THREE.CylinderGeometry(0.19, 0.17, 0.2, 14).scale(1, 1, 0.7)), pantsMat, hips, 0, 0.05);
  part(geo('belt', () => new THREE.CylinderGeometry(0.193, 0.193, 0.045, 14).scale(1, 1, 0.7)), mat('#1a1a1a', { roughness: 0.4 }), hips, 0, 0.14, 0, false);
  part(geo('buckle', () => new THREE.BoxGeometry(0.05, 0.035, 0.012)), mat('#c9c9c9', { metalness: 0.8, roughness: 0.3 }), hips, 0, 0.14, -0.137, false);
  const legs = [-1, 1].map((side) => {
    const hip = pivot(hips, side * 0.095, 0);
    part(geo('thigh', () => new THREE.CapsuleGeometry(0.083, 0.3, 4, 10)), pantsMat, hip, 0, -0.22);
    const knee = pivot(hip, 0, -0.45);
    part(geo('shin', () => new THREE.CapsuleGeometry(0.07, 0.32, 4, 10)), pantsMat, knee, 0, -0.21);
    const shoe = part(geo('shoe', () => new THREE.CapsuleGeometry(0.062, 0.15, 4, 10).rotateX(Math.PI / 2).scale(1.05, 0.72, 1)), shoeMat, knee, 0, -0.43, -0.045);
    part(geo('sole', () => new THREE.BoxGeometry(0.12, 0.02, 0.26)), mat('#3a3a3a'), shoe, 0, -0.035, 0, false);
    return { hip, knee };
  });

  // --- upper body: leans and counter-rotates while walking ---
  const upper = pivot(hips, 0, 0.12);
  const torsoGeo = geo('torso', () => new THREE.CylinderGeometry(0.235, 0.19, 0.5, 16).scale(1, 1, 0.62));
  part(torsoGeo, shirtMat, upper, 0, 0.28);
  part(geo('shoulders', () => new THREE.SphereGeometry(0.235, 16, 10).scale(1, 0.4, 0.62)), shirtMat, upper, 0, 0.52);
  part(geo('collar', () => new THREE.CylinderGeometry(0.07, 0.095, 0.05, 12)), mat(shade(shirt, 0.8)), upper, 0, 0.59, 0, false);
  part(geo('neck', () => new THREE.CylinderGeometry(0.052, 0.058, 0.12, 10)), skinMat, upper, 0, 0.62, 0, false);
  if (vest) {
    const vm = mat('#ffffff', { map: vestTexture(), emissive: '#ff6a00', emissiveIntensity: 0.15, side: THREE.DoubleSide });
    part(geo('vest', () => new THREE.CylinderGeometry(0.248, 0.203, 0.42, 16, 1, true).scale(1, 1, 0.66)), vm, upper, 0, 0.3);
  }
  // ID badge on a lanyard clip
  const badgeZ = vest ? -0.152 : -0.136;
  part(geo('badge', () => new THREE.BoxGeometry(0.075, 0.1, 0.006)), mat('#f4f6f8', { roughness: 0.3 }), upper, 0.075, 0.25, badgeZ, false);
  part(geo('badgeStripe', () => new THREE.BoxGeometry(0.075, 0.022, 0.007)), mat('#ff9900'), upper, 0.075, 0.285, badgeZ - 0.001, false);
  part(geo('clip', () => new THREE.BoxGeometry(0.02, 0.03, 0.008)), mat('#232f3e'), upper, 0.075, 0.31, badgeZ, false);

  // --- arms: shoulder → elbow → hand ---
  const sleeveFore = sleeves === 'long' ? shirtMat : skinMat;
  const arms = [-1, 1].map((side) => {
    const shoulder = pivot(upper, side * 0.27, 0.5);
    shoulder.rotation.z = side * 0.07;
    part(geo('upperArm', () => new THREE.CapsuleGeometry(0.063, 0.2, 4, 10)), shirtMat, shoulder, 0, -0.15);
    if (sleeves === 'short') part(geo('cuff', () => new THREE.CylinderGeometry(0.072, 0.072, 0.05, 10)), mat(shade(shirt, 0.85)), shoulder, 0, -0.2, 0, false);
    const elbow = pivot(shoulder, 0, -0.29);
    part(geo('forearm', () => new THREE.CapsuleGeometry(0.052, 0.19, 4, 10)), sleeveFore, elbow, 0, -0.13);
    part(geo('hand', () => new THREE.SphereGeometry(0.052, 10, 8).scale(0.75, 1.15, 1)), skinMat, elbow, 0, -0.31);
    return { shoulder, elbow };
  });

  // --- head ---
  const head = pivot(upper, 0, 0.66);
  part(geo('head', () => new THREE.SphereGeometry(0.125, 20, 16).scale(0.9, 1.08, 0.98)), skinMat, head, 0, 0.13);
  for (const side of [-1, 1]) {
    part(geo('ear', () => new THREE.SphereGeometry(0.03, 8, 6).scale(0.45, 1, 0.75)), skinMat, head, side * 0.11, 0.135, 0.005, false);
    part(geo('eyeWhite', () => new THREE.SphereGeometry(0.021, 10, 8).scale(1, 0.8, 0.5)), mat('#f5f2ea', { roughness: 0.3 }), head, side * 0.042, 0.145, -0.106, false);
    part(geo('pupil', () => new THREE.SphereGeometry(0.0115, 8, 6)), mat('#1b1410', { roughness: 0.2 }), head, side * 0.042, 0.145, -0.114, false);
    const brow = part(geo('brow', () => new THREE.BoxGeometry(0.045, 0.011, 0.012)), hairMat, head, side * 0.043, 0.18, -0.106, false);
    brow.rotation.z = side * -0.12;
  }
  part(geo('nose', () => new THREE.SphereGeometry(0.022, 8, 6).scale(0.8, 1, 1)), mat(shade(skin, 0.94), { roughness: 0.6 }), head, 0, 0.12, -0.118, false);
  part(geo('mouth', () => new THREE.BoxGeometry(0.048, 0.009, 0.012)), mat('#6e3530', { roughness: 0.5 }), head, 0, 0.075, beard ? -0.125 : -0.11, false);

  if (hairStyle === 'bald') {
    part(geo('hairRing', () => new THREE.SphereGeometry(0.129, 18, 8, -Math.PI * 0.15, Math.PI * 1.3, Math.PI * 0.38, Math.PI * 0.2).scale(0.9, 1.08, 0.98)), hairMat, head, 0, 0.13, 0.004);
  } else {
    part(geo('hairCap', () => new THREE.SphereGeometry(0.133, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5).rotateX(0.5).scale(0.92, 1.08, 1)), hairMat, head, 0, 0.135, 0.004);
    if (hairStyle === 'long') part(geo('hairBack', () => new THREE.CapsuleGeometry(0.1, 0.16, 4, 10).scale(1.32, 1, 0.62)), hairMat, head, 0, 0.05, 0.045);
    if (hairStyle === 'bun') part(geo('bun', () => new THREE.SphereGeometry(0.055, 10, 8)), hairMat, head, 0, 0.25, 0.08);
  }
  if (beard) {
    part(geo('beard', () => new THREE.SphereGeometry(0.131, 18, 8, Math.PI, Math.PI, Math.PI * 0.55, Math.PI * 0.42).scale(0.92, 1.08, 1)), hairMat, head, 0, 0.13, 0.002);
    part(geo('mustache', () => new THREE.BoxGeometry(0.06, 0.014, 0.014)), hairMat, head, 0, 0.088, -0.125, false);
  }
  if (glasses) {
    const frame = mat('#1d1f24', { roughness: 0.3, metalness: 0.4 });
    for (const side of [-1, 1]) part(geo('lens', () => new THREE.TorusGeometry(0.027, 0.0045, 6, 16)), frame, head, side * 0.043, 0.145, -0.124, false);
    part(geo('bridge', () => new THREE.BoxGeometry(0.026, 0.005, 0.005)), frame, head, 0, 0.15, -0.126, false);
  }

  if (hatOn && hatType === 'cap') {
    const capMat = mat(hat, { roughness: 0.8 });
    part(geo('capDome', () => new THREE.SphereGeometry(0.137, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.95, 0.78, 1)), capMat, head, 0, 0.185, 0.003);
    const visor = part(geo('capVisor', () => new THREE.CylinderGeometry(0.1, 0.1, 0.012, 16, 1, false, Math.PI / 2, Math.PI)), capMat, head, 0, 0.19, -0.105);
    visor.rotation.x = -0.12;
    part(geo('capButton', () => new THREE.SphereGeometry(0.013, 6, 4)), capMat, head, 0, 0.29, 0.003, false);
  } else if (hatOn) {
    const hatMat = mat(hat, { roughness: 0.35 });
    part(geo('hardDome', () => new THREE.SphereGeometry(0.148, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)), hatMat, head, 0, 0.175);
    part(geo('hardBrim', () => new THREE.CylinderGeometry(0.17, 0.17, 0.016, 24).scale(1, 1, 1.12)), hatMat, head, 0, 0.178, -0.018);
    part(geo('hardRidge', () => new THREE.TorusGeometry(0.148, 0.012, 6, 16, Math.PI).rotateY(Math.PI / 2)), hatMat, head, 0, 0.175, 0, false);
  }

  root.add(blobShadow(0.55));

  // --- animation ---
  let phase = 0, cur = 0, t = rng() * 100;
  const lerp = THREE.MathUtils.lerp;
  root.userData.animate = (dt, speed) => {
    t += dt;
    cur += (speed - cur) * Math.min(1, dt * 8);
    const s = Math.max(0, cur);
    const walk = Math.min(1, s / 0.6); // 0 = idle, 1 = full gait
    phase += dt * (1.6 + Math.min(s, 6) * 2.6) * (walk > 0.02 ? 1 : 0);
    const amp = (0.32 + Math.min(s, 6) * 0.07) * walk;
    const sn = Math.sin(phase), cs = Math.cos(phase);

    legs.forEach(({ hip, knee }, i) => {
      const dir = i === 0 ? 1 : -1;
      hip.rotation.x = sn * amp * dir;
      // the knee folds while that leg swings forward
      knee.rotation.x = -(0.04 + Math.max(0, cs * dir) * amp * 1.3);
    });
    arms.forEach(({ shoulder, elbow }, i) => {
      const dir = i === 0 ? -1 : 1; // opposite to the same-side leg
      const idleSway = Math.sin(t * 1.1 + i) * 0.02 * (1 - walk);
      shoulder.rotation.x = sn * amp * 0.85 * dir + idleSway;
      elbow.rotation.x = 0.12 + walk * (0.2 + Math.max(0, sn * dir) * 0.45);
    });

    // keep the planted foot on the floor: straight legs at an angle lift the hips
    body.position.y = -(1 - Math.cos(sn * amp)) * 0.85 + walk * Math.abs(cs) * 0.012;
    hips.rotation.y = sn * 0.07 * walk;
    upper.rotation.y = -sn * 0.14 * walk;
    upper.rotation.x = lerp(upper.rotation.x, -0.05 * walk, 0.15);
    upper.position.y = 0.12 + Math.sin(t * 1.7) * 0.004 * (1 - walk); // breathing
    // idle: look around a little
    head.rotation.y = lerp(head.rotation.y, Math.sin(t * 0.31) * Math.sin(t * 0.13) * 0.55 * (1 - walk), 0.05);
    head.rotation.x = lerp(head.rotation.x, Math.sin(t * 0.23) * 0.06 * (1 - walk) + 0.04 * walk, 0.05);
  };
  return root;
}
