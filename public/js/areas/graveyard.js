import * as THREE from 'three';
import { M, G, door, mat, addLight, makeLabelSprite } from '../kit.js';
import { RETIRED_SERVICES, pickRandom } from '../humor.js';
import { canvas, toTexture, grassTexture, stoneTexture, fitText, FONT, DISPLAY_FONT } from '../textures.js';
import { newArea } from './common.js';
import { wrapText } from '../kit.js';

function stoneMat() {
  return mat('gravestone', () => new THREE.MeshStandardMaterial({ map: toTexture(stoneTexture()), roughness: 0.9, metalness: 0.05, color: '#b8bcc6' }));
}

function engraving(b, { name, years, epitaph, color = '#1d2026' }) {
  const c = canvas(256, 300);
  const ctx = c.getContext('2d');
  ctx.drawImage(stoneTexture(), 0, 0, 256, 300);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, 0, 256, 300);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `400 40px ${DISPLAY_FONT}`;
  ctx.fillText('R.I.P.', 128, 40);
  ctx.fillText(fitText(ctx, name, 230, 34, 700, FONT), 128, 92);
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText(years, 128, 128);
  ctx.font = `italic 500 21px ${FONT}`;
  wrapText(ctx, epitaph, 128, 170, 220, 25);
  const t = b.track(toTexture(c));
  return b.track(new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
}

function tombstone(b, x, z, ry, spec, { big = false, fresh = false, zombie = false } = {}) {
  const s = big ? 1.5 : 1;
  const tilt = (Math.random() - 0.5) * 0.18;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.set(0, ry + (Math.random() - 0.5) * 0.2, tilt);
  b.add(g);
  const stone = stoneMat();
  const body = new THREE.Mesh(G.box(1.0 * s, 1.0 * s, 0.22), stone);
  body.position.y = 0.5 * s;
  const cap = new THREE.Mesh(G.cyl(0.5 * s, 0.5 * s, 0.22, 24, false), stone);
  cap.rotation.x = Math.PI / 2;
  cap.position.y = 1.0 * s;
  const face = new THREE.Mesh(G.plane(0.92 * s, 1.08 * s), engraving(b, spec));
  face.position.set(0, 0.86 * s, 0.112);
  g.add(body, cap, face);
  if (fresh || zombie) {
    const mound = new THREE.Mesh(G.box(1.0, 0.25, 1.8), M.color(zombie ? '#1f2a14' : '#3a2a1c', 1, 0));
    mound.position.set(0, 0.1, 1.1);
    g.add(mound);
  }
  if (fresh) {
    [-0.25, 0.1, 0.3].forEach((fx, i) => {
      const f = new THREE.Mesh(G.sphere(0.07, 6), M.glow(['#ff5fb0', '#ffd34d', '#ff9900'][i], 1.2));
      f.position.set(fx, 0.3, 0.6 + i * 0.2);
      g.add(f);
    });
  }
  if (zombie) {
    const glow = new THREE.Mesh(G.box(1.3, 0.02, 2.1), M.glow('#7dff6a', 0.5));
    glow.position.set(0, 0.25, 1.1);
    g.add(glow);
    const arm = new THREE.Group();
    const fore = new THREE.Mesh(G.box(0.1, 0.5, 0.1), M.color('#7c9a5a', 0.8, 0));
    fore.position.y = 0.25;
    const hand = new THREE.Mesh(G.box(0.16, 0.14, 0.08), M.color('#7c9a5a', 0.8, 0));
    hand.position.y = 0.55;
    arm.add(fore, hand);
    arm.position.set(0.2, 0.15, 1.3);
    g.add(arm);
    const ph = Math.random() * 6;
    b.update((dt, t) => { arm.rotation.z = Math.sin(t * 3 + ph) * 0.4; arm.position.y = 0.1 + Math.max(0, Math.sin(t * 0.7 + ph)) * 0.1; });
  }
  b.collideRect(x, z, 1.1 * s, 0.4, ry);
  b.mark(x, z, zombie ? '#7dff6a' : fresh ? '#ffb347' : '#aab2c0', 1.5);
  const [ix, iz] = [x + Math.sin(ry) * 1.2, z + Math.cos(ry) * 1.2];
  b.interact({ x: ix, z: iz, y: 1, radius: 2.2, kind: 'grave', title: spec.name, sub: spec.years, item: { name: spec.name, kind: 'grave', sub: spec.years, status: spec.status || 'RETIRED', id: spec.id, info: spec.info || { epitaph: spec.epitaph } } });
}

function tree(b, x, z, s = 1) {
  const bark = M.color('#2a211b', 0.95, 0);
  b.inst(G.cyl(0.12, 0.25, 4, 8), bark, x, 2 * s, z, 0, s, s, s);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + x;
    const g = new THREE.Mesh(G.cyl(0.03, 0.08, 1.8, 6), bark);
    g.position.set(x + Math.cos(a) * 0.5 * s, (2.8 + i * 0.25) * s, z + Math.sin(a) * 0.5 * s);
    g.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    g.scale.setScalar(s);
    b.add(g);
  }
  b.collideRect(x, z, 0.5 * s, 0.5 * s);
}

function ghostTexture() {
  return mat('ghostMat', () => {
    const c = canvas(128, 160);
    const ctx = c.getContext('2d');
    const gr = ctx.createRadialGradient(64, 60, 5, 64, 70, 70);
    gr.addColorStop(0, 'rgba(230,245,255,0.95)');
    gr.addColorStop(1, 'rgba(180,210,255,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(14, 150);
    ctx.quadraticCurveTo(10, 20, 64, 14);
    ctx.quadraticCurveTo(118, 20, 114, 150);
    for (let i = 0; i < 5; i++) ctx.quadraticCurveTo(104 - i * 20, 130, 94 - i * 20, 150);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,30,50,0.9)';
    ctx.beginPath(); ctx.ellipse(48, 60, 8, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(80, 60, 8, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(64, 92, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
    return new THREE.SpriteMaterial({ map: toTexture(c), transparent: true, opacity: 0.55, depthWrite: false, color: new THREE.Color(1.5, 1.6, 1.8) });
  });
}

export async function graveyard(world) {
  const deleted = world.data.graveyard?.deletedStacks || [];
  const zombies = world.data.graveyard?.deprecatedLambdas || [];
  const retired = RETIRED_SERVICES.filter((r) => !r.big);
  const mausoleum = RETIRED_SERVICES.find((r) => r.big);
  const rowsNew = Math.ceil(deleted.length / 6);
  const rowsZ = Math.ceil(zombies.length / 6);
  const W = 70, D = Math.max(64, 40 + Math.max(rowsNew, rowsZ) * 4);

  const b = newArea({
    id: 'graveyard', title: 'Service Graveyard',
    subtitle: `${retired.length + 1} retired services · ${deleted.length} deleted stacks · ${zombies.length} undead functions`,
    color: '#b9c2d6',
  });
  b.ambience = 'outdoor';
  b.background = '#060816';
  b.fog = { color: '#0d1022', near: 6, far: 52 };
  b.lighting = { hemi: 0.35, sun: 0.35, env: 0.12, exposure: 1.15 };
  b.bounds = { minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2 };

  const grass = b.track(toTexture(grassTexture(), { repeat: [W / 6, D / 6] }));
  const ground = b.mesh(G.plane(W + 80, D + 80), b.track(new THREE.MeshStandardMaterial({ map: grass, roughness: 1, metalness: 0 })), 0, 0, 0);
  ground.rotation.x = -Math.PI / 2;
  grass.repeat.set((W + 80) / 6, (D + 80) / 6);

  // Path from gate to mausoleum
  const path = b.mesh(G.plane(2.6, D - 6), M.color('#3b3530', 1, 0), 0, 0.01, 2);
  path.rotation.x = -Math.PI / 2;

  // Iron fence perimeter with a gate gap
  const bar = M.color('#15171c', 0.5, 0.8);
  const fenceLine = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.floor(len / 0.3);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      b.inst(G.cyl(0.025, 0.025, 2, 5), bar, x1 + (x2 - x1) * t, 1, z1 + (z2 - z1) * t);
      b.inst(G.cyl(0.0, 0.05, 0.15, 5), bar, x1 + (x2 - x1) * t, 2.05, z1 + (z2 - z1) * t);
    }
    const ry = Math.atan2(x2 - x1, z2 - z1);
    [0.35, 1.7].forEach((y) => b.inst(G.box(1, 1, 1), bar, (x1 + x2) / 2, y, (z1 + z2) / 2, ry, 0.04, 0.05, len));
    b.collide({ minX: Math.min(x1, x2) - 0.1, maxX: Math.max(x1, x2) + 0.1, minZ: Math.min(z1, z2) - 0.1, maxZ: Math.max(z1, z2) + 0.1 });
    b.wallLine(x1, z1, x2, z2);
  };
  const hw = W / 2 - 1, hd = D / 2 - 1;
  fenceLine(-hw, -hd, hw, -hd);
  fenceLine(-hw, -hd, -hw, hd);
  fenceLine(hw, -hd, hw, hd);
  fenceLine(-hw, hd, -2, hd);
  fenceLine(2, hd, hw, hd);
  door(b, {
    id: 'exit', x: 0, z: hd, ry: Math.PI, width: 3.4, height: 3.2, color: '#ff9900', icon: 'generic', lite: true,
    title: 'Back to the data center', subtitle: 'The living await (and so does your pager)',
    target: { spec: { type: 'lobby' }, spawn: 'door:graveyard' },
  });
  b.spawns.default = b.spawns['door:exit'];

  // Moon, stars
  const moon = new THREE.Mesh(G.sphere(6, 32), M.glow('#f4f1de', 1.6));
  moon.position.set(-40, 45, -90);
  b.add(moon);
  const halo = new THREE.Sprite(b.track(new THREE.SpriteMaterial({ map: haloTexture(b), transparent: true, depthWrite: false, color: new THREE.Color(1.2, 1.2, 1.3), fog: false })));
  halo.scale.set(40, 40, 1);
  halo.position.copy(moon.position);
  b.add(halo);
  moon.material = b.track(new THREE.MeshBasicMaterial({ color: new THREE.Color('#f4f1de').multiplyScalar(1.6), fog: false }));
  const starPos = new Float32Array(1500 * 3);
  for (let i = 0; i < 1500; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.45;
    const r = 180;
    starPos[i * 3] = Math.cos(th) * Math.sin(ph) * r;
    starPos[i * 3 + 1] = Math.cos(ph) * r * 0.6 + 10;
    starPos[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * r;
  }
  const sg = b.track(new THREE.BufferGeometry());
  sg.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  b.add(new THREE.Points(sg, b.track(new THREE.PointsMaterial({ color: '#cfd8ff', size: 0.6, fog: false, sizeAttenuation: true }))));
  const moonLight = new THREE.DirectionalLight('#9fb4ff', 0.8);
  moonLight.position.copy(moon.position);
  b.add(moonLight);

  // Mausoleum for EC2-Classic
  const mz = -D / 2 + 9;
  const stone = stoneMat();
  b.inst(G.box(1, 1, 1), stone, 0, 2, mz, 0, 7, 4, 5);
  b.inst(G.box(1, 1, 1), stone, 0, 0.15, mz + 3, 0, 7.6, 0.3, 1.5);
  [-2.8, -1.4, 1.4, 2.8].forEach((cx) => b.inst(G.cyl(0.22, 0.25, 3.7, 12), stone, cx, 2.15, mz + 3));
  const roof = new THREE.Mesh(G.box(7.6, 2.8, 2.8), stone);
  roof.rotation.x = Math.PI / 4;
  roof.position.set(0, 4, mz);
  b.add(roof);
  b.inst(G.box(1, 1, 1), M.color('#050608', 1, 0), 0, 1.4, mz + 2.52, 0, 1.8, 2.8, 0.05);
  const plaque = new THREE.Mesh(G.plane(4.4, 1.6), engraving(b, { name: mausoleum.name, years: mausoleum.years, epitaph: '' }));
  plaque.position.set(0, 3.55, mz + 2.53);
  b.add(plaque);
  b.collideRect(0, mz, 7.2, 5.2);
  [-2.8, -1.4, 1.4, 2.8].forEach((cx) => b.collideRect(cx, mz + 3, 0.5, 0.5));
  b.interact({ x: 0, z: mz + 4.4, y: 1.4, radius: 2.6, kind: 'grave', title: mausoleum.name, sub: mausoleum.years, item: { name: mausoleum.name, kind: 'grave', sub: mausoleum.years, status: 'RETIRED', info: { epitaph: mausoleum.epitaph, note: 'Retired on 2023-08-15. Every instance now lives in a VPC. Even the ones that did not want to.' } } });
  addLight(b, 0, 2.2, mz + 4, '#ffb35c', 6, 8);

  const signpost = (x, z, text, sub, color) => {
    b.inst(G.box(1, 1, 1), M.color('#3a2a1c', 1, 0), x, 1.1, z, 0, 0.12, 2.2, 0.12);
    const s = makeLabelSprite(text, { sub, accent: color, scale: 1.3 });
    s.position.set(x, 2.5, z);
    b.track(s.material.map, s.material);
    b.add(s);
    b.collideRect(x, z, 0.2, 0.2);
  };

  // Old section: retired AWS services
  signpost(-2.2, mz + 8.5, 'Old Section', 'Retired AWS services', '#b9c2d6');
  retired.forEach((r, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const k = Math.floor(i / 2);
    const col = k % 4, row = Math.floor(k / 4);
    const x = side * (5 + col * 4.2);
    const z = mz - 2 + row * 4.5;
    tombstone(b, x, z, 0, { name: r.name, years: r.years, epitaph: r.epitaph });
  });

  // New arrivals: deleted CloudFormation stacks
  const nz = mz + 22;
  signpost(-6, nz - 3, 'New Arrivals', 'DELETE_COMPLETE stacks (last 90 days)', '#ffb347');
  deleted.forEach((s, i) => {
    const col = i % 6, row = Math.floor(i / 6);
    const when = String(s.info?.DeletionTime || '').slice(0, 10);
    tombstone(b, -6 - col * 3.4, nz + row * 4, 0, {
      name: s.name, years: `${String(s.info?.CreationTime || '?').slice(0, 4)} – ${when.slice(0, 4) || '?'}`,
      epitaph: pickRandom(['DELETE_COMPLETE. At peace.', 'It was only a test.', 'Deleted by someone. Nobody admits it.', 'Gone, but not forgotten in the billing CSV.', 'Its S3 bucket lives on (DeletionPolicy: Retain).', 'rm -rf, but make it cloud.']),
      id: s.id, status: 'DELETE_COMPLETE', info: s.info,
    }, { fresh: true });
  });
  if (!deleted.length) signpost(-10, nz + 2, 'No recent deaths', 'Or ListStacks said no', '#ffb347');

  // The undead: functions on deprecated runtimes
  signpost(6, nz - 3, 'The Undead', 'Lambda functions on deprecated runtimes', '#7dff6a');
  zombies.forEach((f, i) => {
    const col = i % 6, row = Math.floor(i / 6);
    tombstone(b, 6 + col * 3.4, nz + row * 4, 0, {
      name: f.name, years: `${f.sub} · still running`, epitaph: pickRandom(['It\'s alive! (deprecated)', 'Braaaains… and a runtime upgrade.', 'Died in 2023. Still invoked nightly.', 'Cannot be updated. Cannot be stopped.']),
      id: f.id, status: 'DEPRECATED RUNTIME', info: f.info,
    }, { zombie: true });
  });
  if (!zombies.length) signpost(10, nz + 2, 'No zombies', 'All runtimes supported. Suspiciously diligent.', '#7dff6a');
  if (zombies.length) addLight(b, 6 + Math.min(5, zombies.length - 1) * 1.7, 1.5, nz + 1, '#7dff6a', 8, 14);

  // Trees, candles, ghosts
  [[-28, -20], [26, -18], [-30, 6], [29, 10], [-20, 20], [22, 24], [-12, -4], [14, -6]].forEach(([x, z], i) => tree(b, x, Math.min(z, D / 2 - 6), 1 + (i % 3) * 0.2));
  const candles = [];
  [[-3, mz + 3.5], [3, mz + 3.5], [-2.5, nz - 1], [2.5, nz - 1]].forEach(([x, z]) => {
    b.inst(G.cyl(0.05, 0.05, 0.3, 8), M.white(), x, 0.15, z);
    const f = new THREE.Mesh(G.sphere(0.05, 8), M.glow('#ffb347', 4));
    f.position.set(x, 0.36, z);
    b.add(f);
    candles.push(f);
  });
  const flick = [addLight(b, -2.5, 0.6, nz - 1, '#ffb347', 3, 6), addLight(b, 2.5, 0.6, nz - 1, '#ffb347', 3, 6)];
  const ghosts = Array.from({ length: 5 }, (_, i) => {
    const g = new THREE.Sprite(ghostTexture());
    g.scale.set(1.2, 1.5, 1);
    b.add(g);
    return { g, r: 6 + i * 4, s: 0.08 + i * 0.03, ph: i * 1.7 };
  });
  b.update((dt, t) => {
    for (const c of candles) c.scale.setScalar(0.8 + Math.random() * 0.5);
    for (const l of flick) l.intensity = 2 + Math.random() * 2;
    for (const gh of ghosts) {
      gh.g.position.set(Math.cos(t * gh.s + gh.ph) * gh.r, 1.4 + Math.sin(t * 1.3 + gh.ph) * 0.4, Math.sin(t * gh.s * 1.3 + gh.ph) * gh.r * 0.7 + 4);
      gh.g.material.opacity = 0.3 + Math.sin(t + gh.ph) * 0.2;
    }
  });

  b.onEnter = (w) => w.hud.notify('Graveyard keeper', 'Press F at a grave to pay respects. EC2-Classic is in the mausoleum. Mind the zombies.', 'grave');
  return b.finalize();
}

function haloTexture(b) {
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,250,230,0.6)');
  g.addColorStop(0.3, 'rgba(200,210,255,0.15)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return b.track(toTexture(c));
}
