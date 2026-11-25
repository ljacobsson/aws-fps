import * as THREE from 'three';
import { AreaBuilder, makeLabelSprite, M, G, toWorld } from '../kit.js';
import { buildPerson } from '../avatar.js';
import { pickRandom } from '../humor.js';
import { canvas, toTexture, fitText, FONT } from '../textures.js';

export function newArea(opts) {
  return new AreaBuilder(opts);
}

/** Exit door on the south wall that leads back to `target`. Use as room() door spec. */
export function exitDoor(target, { title = 'Lobby', subtitle = 'Back to reception', at = 0, icon = 'generic', color = '#ff9900' } = {}) {
  return { side: 's', at, id: 'exit', title, subtitle, icon, color, target };
}

export function useExitSpawn(b) {
  b.spawns.default = b.spawns['door:exit'];
}

export function gridLayout(n, cw, cd, { maxCols = 14, aspect = 1.3 } = {}) {
  const cols = Math.max(1, Math.min(maxCols, Math.ceil(Math.sqrt((n * aspect * cd) / cw))));
  const rows = Math.max(1, Math.ceil(n / cols));
  return { cols, rows, w: cols * cw, d: rows * cd };
}

const TURN_RATE = 4; // rad/s

/** A wandering (or stationary) colleague you can talk to. */
export function npc(b, { name, style, x, z, yaw = 0, lines, wander, speed = 1.2, radius = 2.4 }) {
  const p = buildPerson(style);
  p.position.set(x, 0, z);
  p.rotation.y = yaw;
  b.add(p);
  const tag = makeLabelSprite(name, { accent: '#ffd34d', scale: 0.7 });
  tag.position.y = 2.3;
  p.add(tag);
  b.track(tag.material.map, tag.material);
  const state = { target: null, pause: Math.random() * 3, talk: 0, world: null, v: 0 };
  const it = b.interact({
    x, z, y: 1.6, kind: 'npc', title: name, sub: 'Colleague', npc: true, radius, prompt: 'Talk to',
    onUse: (world) => {
      world.hud.say(name, pickRandom(lines));
      state.talk = 4;
      state.world = world;
    },
  });
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // Turns toward `want` at a capped rate; returns the angle still left to turn.
  const turnToward = (want, dt) => {
    const diff = wrap(want - p.rotation.y);
    p.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), TURN_RATE * dt);
    return wrap(want - p.rotation.y);
  };
  const facePoint = (tx, tz, dt) => turnToward(Math.atan2(-(tx - p.position.x), -(tz - p.position.z)), dt);
  b.update((dt) => {
    let wantV = 0, left = 0;
    if (state.talk > 0) {
      state.talk -= dt;
      const pp = state.world.engine.player.pos;
      left = facePoint(pp.x, pp.z, dt);
    } else if (wander) {
      if (state.pause > 0) state.pause -= dt;
      else {
        if (!state.target) {
          state.target = new THREE.Vector2(
            wander.minX + Math.random() * (wander.maxX - wander.minX),
            wander.minZ + Math.random() * (wander.maxZ - wander.minZ),
          );
          if (wander.avoid?.(state.target.x, state.target.y)) state.target = null;
        }
        if (state.target) {
          const d = Math.hypot(state.target.x - p.position.x, state.target.y - p.position.z);
          if (d < 0.4) { state.target = null; state.pause = 2 + Math.random() * 5; }
          else {
            left = facePoint(state.target.x, state.target.y, dt);
            // Turn on the spot first; only walk once roughly facing the target, slowing on arrival.
            if (Math.abs(left) < 0.5) wantV = speed * Math.cos(left) * Math.min(1, 0.35 + d / 1.2);
          }
        }
      }
    } else {
      left = turnToward(yaw, dt); // stationary colleagues go back to their post after a chat
    }
    state.v += (wantV - state.v) * Math.min(1, dt * 5);
    // Always step along the way they face, never sideways or backwards.
    p.position.x -= Math.sin(p.rotation.y) * state.v * dt;
    p.position.z -= Math.cos(p.rotation.y) * state.v * dt;
    p.userData.animate(dt, Math.max(state.v, Math.abs(left) > 0.05 ? 0.5 : 0));
    it.pos.set(p.position.x, 1.6, p.position.z);
  });
  return p;
}

/** Text written flat on the floor, e.g. zone names. */
export function floorText(b, text, x, z, w, { color = '#ffffff', ry = 0, opacity = 0.55 } = {}) {
  const c = canvas(1024, 160);
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const t = fitText(ctx, text.toUpperCase(), 1000, 120, 700, FONT);
  ctx.fillText(t, 512, 84);
  const tex = b.track(toTexture(c));
  const m = b.track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false, color: new THREE.Color(1.4, 1.4, 1.4) }));
  const mesh = b.mesh(G.plane(w, (w * 160) / 1024), m, x, 0.02, z);
  mesh.rotation.set(-Math.PI / 2, 0, ry);
  return mesh;
}

/** Tinted rectangle on the floor with glowing edges. */
export function floorZone(b, x, z, w, d, color, { opacity = 0.1, edge = 1.4 } = {}) {
  const m = b.track(new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  const p = b.mesh(G.plane(w, d), m, x + w / 2, 0.015, z + d / 2);
  p.rotation.x = -Math.PI / 2;
  const gm = M.glow(color, edge);
  b.inst(G.box(1, 1, 1), gm, x + w / 2, 0.02, z, 0, w, 0.02, 0.06);
  b.inst(G.box(1, 1, 1), gm, x + w / 2, 0.02, z + d, 0, w, 0.02, 0.06);
  b.inst(G.box(1, 1, 1), gm, x, 0.02, z + d / 2, 0, 0.06, 0.02, d);
  b.inst(G.box(1, 1, 1), gm, x + w, 0.02, z + d / 2, 0, 0.06, 0.02, d);
  b.minimap.zones.push({ x, z, w, d, color: hexAlpha(color, 0.22) });
}

export function hexAlpha(hex, a) {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

/** Rotating warning beacons for when things are on fire. */
export function beacons(b, positions, color = '#ff2020') {
  const light = new THREE.PointLight(color, 0, 40, 2);
  light.position.set(positions[0][0], positions[0][1] - 0.5, positions[0][2]);
  b.add(light);
  const heads = positions.map(([x, y, z]) => {
    b.inst(G.cyl(0.25, 0.3, 0.2, 16), M.steel(), x, y - 0.1, z);
    const g = new THREE.Group();
    g.position.set(x, y + 0.15, z);
    const dome = new THREE.Mesh(G.sphere(0.22, 16), M.glow(color, 0.6));
    const refl = new THREE.Mesh(G.box(0.4, 0.15, 0.05), M.glow(color, 4));
    g.add(dome, refl);
    b.add(g);
    return g;
  });
  b.update((dt, t) => {
    for (const h of heads) h.rotation.y += dt * 5;
    light.intensity = 10 + Math.sin(t * 10) * 8;
  });
}

export function sideOf(i) { return i % 2 === 0 ? 'w' : 'e'; }
export { toWorld };
