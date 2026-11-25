import * as THREE from 'three';
import { room, M, G, kiosk, addLight, signMesh, toWorld, portalMaterial, mat } from '../kit.js';
import { SERVICES } from '../theme.js';
import { fenceTexture, toTexture } from '../textures.js';
import { buildProp } from '../props.js';
import { newArea, exitDoor, useExitSpawn, floorZone, hexAlpha } from './common.js';
import { esc } from '../hud.js';

let dotTex;
function dotTexture() {
  if (!dotTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    dotTex = toTexture(c);
  }
  return dotTex;
}

export async function vpcTunnel(world) {
  const data = world.data.services.vpc || { items: [] };
  const vpcs = data.items || [];
  const perSide = Math.ceil(vpcs.length / 2);
  const L = Math.max(36, perSide * 8 + 20), W = 9, H = 5.6;
  const doors = vpcs.map((v, i) => ({
    side: i % 2 === 0 ? 'w' : 'e', at: -L / 2 + 10 + Math.floor(i / 2) * 8, id: `vpc-${v.id}`,
    title: v.name, subtitle: `${v.sub}${v.isDefault ? ' · default (here be dragons)' : ''} · ${v.instances.length} EC2`,
    icon: 'vpc', color: v.isDefault ? '#9aa3b5' : '#8C4FFF',
    target: { spec: { type: 'vpc', id: v.id }, spawn: 'default' },
  }));
  const b = newArea({ id: 'vpcTunnel', title: 'VPC Air Tunnel', subtitle: 'Cold aisle containment · authorised VPCs only', color: '#5ad1ff' });
  room(b, {
    w: W, d: L, h: H, accent: '#5ad1ff', floorTint: '#1b2a36', wallTint: '#0f1820', perforated: 0.7, lightRows: false,
    doors: [...doors, exitDoor({ spec: { type: 'lobby' }, spawn: 'door:vpc' })],
  });
  useExitSpawn(b);
  b.ambience = 'tunnel';
  b.fog = { color: '#0a1a26', near: 6, far: 45 };

  // Ribbed arches, skipping door positions
  const doorZ = doors.map((d) => d.at);
  const archMat = M.color('#24313d', 0.4, 0.7);
  for (let z = -L / 2 + 3; z < L / 2 - 2; z += 3) {
    if (doorZ.some((dz) => Math.abs(dz - z) < 2.2) || z > L / 2 - 4) continue;
    [-1, 1].forEach((s) => {
      b.inst(G.box(1, 1, 1), archMat, s * (W / 2 - 0.3), H / 2, z, 0, 0.3, H, 0.35);
      b.collideRect(s * (W / 2 - 0.3), z, 0.3, 0.35);
    });
    b.inst(G.box(1, 1, 1), archMat, 0, H - 0.2, z, 0, W, 0.3, 0.35);
    b.inst(G.box(1, 1, 1), M.glow('#5ad1ff', 2.2), 0, H - 0.37, z, 0, W - 0.8, 0.03, 0.06);
  }
  const ceil = b.mesh(G.plane(W, L), M.color('#0b1219', 0.8, 0.3), 0, H, 0);
  ceil.rotation.x = Math.PI / 2;
  b.ceilings.push(ceil);

  // Giant fans on the far wall
  const fans = [];
  [[-2.2, 1.6], [2.2, 1.6], [-2.2, 3.9], [2.2, 3.9]].forEach(([fx, fy]) => {
    const g = new THREE.Group();
    g.position.set(fx, fy, -L / 2 + 0.35);
    const backlight = new THREE.Mesh(G.cyl(1.05, 1.05, 0.02, 32), M.glow('#5ad1ff', 1.6));
    backlight.rotation.x = Math.PI / 2;
    backlight.position.z = -0.12;
    const housing = new THREE.Mesh(G.torus(1.08, 0.08, 8, 40), M.steel());
    const hub = new THREE.Mesh(G.cyl(0.2, 0.2, 0.2, 16), M.metalDark());
    hub.rotation.x = Math.PI / 2;
    const rotor = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const blade = new THREE.Mesh(G.box(0.3, 0.95, 0.03), M.metalDark());
      blade.position.y = 0.55;
      blade.rotation.y = 0.5;
      const pivot = new THREE.Group();
      pivot.rotation.z = (i * Math.PI) / 3;
      pivot.add(blade);
      rotor.add(pivot);
    }
    g.add(backlight, housing, hub, rotor);
    b.add(g);
    fans.push(rotor);
  });
  b.update((dt) => fans.forEach((f, i) => { f.rotation.z += dt * (9 + i); }));

  // Cold air particles flowing towards you
  const N = 1400;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * (W - 1);
    pos[i * 3 + 1] = Math.random() * (H - 0.5);
    pos[i * 3 + 2] = (Math.random() - 0.5) * L;
  }
  const pg = b.track(new THREE.BufferGeometry());
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pm = b.track(new THREE.PointsMaterial({ map: dotTexture(), alphaTest: 0.01, color: new THREE.Color('#bfefff').multiplyScalar(1.6), size: 0.04, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  const pts = new THREE.Points(pg, pm);
  pts.frustumCulled = false;
  b.add(pts);
  b.update((dt) => {
    for (let i = 0; i < N; i++) {
      pos[i * 3 + 2] += dt * (3 + (i % 7) * 0.4);
      pos[i * 3] += Math.sin(pos[i * 3 + 2] * 0.7 + i) * dt * 0.2;
      if (pos[i * 3 + 2] > L / 2) pos[i * 3 + 2] = -L / 2;
    }
    pg.attributes.position.needsUpdate = true;
  });

  const sign = signMesh(b, { title: 'Cold Aisle Containment', subtitle: 'Authorised VPCs only · mind the gap(ing security group)', icon: 'vpc', color: '#5ad1ff' }, 7.6, 1.9);
  sign.position.set(0, H - 0.6 - 0.95, -L / 2 + 0.25);
  sign.scale.setScalar(0.55);
  sign.position.y = 5.0;
  b.add(sign);

  for (let z = -L / 2 + 8; z < L / 2; z += 14) addLight(b, 0, H - 0.8, z, '#7fd8ff', 18, 18);
  if (!vpcs.length) {
    kiosk(b, 0, -L / 2 + 6, 0, {
      title: 'No VPCs', color: '#5ad1ff',
      lines: data.error ? [data.error.code, String(data.error.message).slice(0, 40)] : ['No VPCs in this region.', 'Truly serverless.', 'Or truly AccessDenied.'],
      interact: { kind: 'vpc', title: 'Tunnel terminal', item: { name: 'VPC scan', kind: 'vpc', info: data.error || { vpcs: 0 } } },
    });
  }
  b.onEnter = (w) => w.hud.notify('Facilities', 'It is 18°C in here. The VPCs like it cold. Mind the fans.', 'vpc');
  return b.finalize();
}

// ---------------------------------------------------------------------------

function fenceMaterial(len, h) {
  const key = `fence:${Math.round(len * 2)}:${h}`;
  return mat(key, () => {
    const t = toTexture(fenceTexture(), { repeat: [Math.max(1, len / 1.2), h / 1.2] });
    return new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, metalness: 0.7, roughness: 0.4 });
  });
}

function fence(b, x1, z1, x2, z2, h = 2.2) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  if (len < 0.05) return;
  const ry = Math.atan2(x2 - x1, z2 - z1) - Math.PI / 2;
  const m = b.mesh(G.plane(len, h), fenceMaterial(len, h), (x1 + x2) / 2, h / 2, (z1 + z2) / 2, ry);
  b.inst(G.box(1, 1, 1), M.steel(), (x1 + x2) / 2, h, (z1 + z2) / 2, ry, len, 0.05, 0.05);
  b.collide({ minX: Math.min(x1, x2) - 0.06, maxX: Math.max(x1, x2) + 0.06, minZ: Math.min(z1, z2) - 0.06, maxZ: Math.max(z1, z2) + 0.06 });
  b.wallLine(x1, z1, x2, z2);
  return m;
}

export async function vpcRoom(world, spec) {
  const vpc = (world.data.services.vpc?.items || []).find((v) => v.id === spec.id);
  if (!vpc) throw new Error(`VPC ${spec.id} vanished (eventually consistent?)`);
  const lambdas = (world.data.services.lambda?.items || []).filter((f) => f.vpcId === vpc.id);
  const contents = new Map(vpc.subnets.map((s) => [s.id, []]));
  const homeless = [];
  for (const i of vpc.instances) (contents.get(i.subnetId) || homeless).push(i);
  for (const n of vpc.natGateways) (contents.get(n.subnetId) || homeless).push(n);
  for (const f of lambdas) (contents.get(f.subnets[0]) || homeless).push(f);

  const azs = [...new Set(vpc.subnets.map((s) => s.az))].sort();
  const columns = azs.map((az) => vpc.subnets.filter((s) => s.az === az).sort((a, b2) => Number(b2.public) - Number(a.public) || a.name.localeCompare(b2.name)));
  const dims = (s) => {
    const n = contents.get(s.id).length;
    const cols = Math.max(2, Math.min(6, Math.ceil(Math.sqrt(n * 1.2))));
    const rows = Math.max(1, Math.ceil(n / cols));
    return { cols, rows, w: Math.max(7, cols * 1.75 + 2.4), d: Math.max(7, rows * 3.4 + 3.4) };
  };
  const colW = columns.map((col) => Math.max(7, ...col.map((s) => dims(s).w)));
  const nRows = Math.max(1, ...columns.map((c) => c.length));
  const rowD = Array.from({ length: nRows }, (_, r) => Math.max(7, ...columns.map((c) => (c[r] ? dims(c[r]).d : 0))));
  const GX = 3, GZ = 3;
  const totalW = colW.reduce((a, c) => a + c, 0) + GX * Math.max(0, colW.length - 1);
  const totalD = rowD.reduce((a, c) => a + c, 0) + GZ * Math.max(0, nRows - 1);
  const W = Math.max(28, totalW + 10), D = Math.max(28, totalD + 20);
  const H = 6;

  const b = newArea({ id: `vpc:${vpc.id}`, title: vpc.name, subtitle: `${vpc.id} · ${vpc.sub} · ${vpc.subnets.length} subnets in ${azs.length} AZs`, color: '#8C4FFF' });
  room(b, {
    w: W, d: D, h: H, accent: '#8C4FFF', floorTint: '#1c1f2b', wallTint: '#12131c', perforated: 0.2,
    doors: [exitDoor({ spec: { type: 'vpcTunnel' }, spawn: `door:vpc-${vpc.id}` }, { title: 'Air Tunnel', subtitle: 'Back to the cold aisle', icon: 'vpc', color: '#5ad1ff' })],
  });
  useExitSpawn(b);

  let x = -totalW / 2;
  columns.forEach((col, ci) => {
    let z = -D / 2 + 9;
    col.forEach((s, ri) => {
      const zw = colW[ci], zd = rowD[ri];
      const color = s.public ? '#2fe37a' : '#3fb6ff';
      floorZone(b, x, z, zw, zd, color, { opacity: 0.08 });
      // fence with a gate on the south side
      const gate = 2.2;
      fence(b, x, z, x + zw, z);
      fence(b, x, z, x, z + zd);
      fence(b, x + zw, z, x + zw, z + zd);
      fence(b, x, z + zd, x + zw / 2 - gate / 2, z + zd);
      fence(b, x + zw / 2 + gate / 2, z + zd, x + zw, z + zd);
      b.inst(G.box(1, 1, 1), M.glow(color, 2), x + zw / 2, 2.5, z + zd, 0, gate, 0.08, 0.08);
      b.label(s.name, x + zw / 2, 3.2, z + zd, { sub: `${s.sub} · ${s.az} · ${s.public ? 'PUBLIC' : 'private'}`, accent: color, icon: 'subnet', scale: 1.1 });
      b.interact({ x: x + zw / 2, z: z + zd + 0.8, y: 1.5, kind: 'subnet', title: s.name, sub: `${s.public ? 'public' : 'private'} subnet · ${s.sub}`, item: { ...s, status: s.public ? 'PUBLIC' : 'PRIVATE' } });
      const d = dims(s);
      const items = contents.get(s.id);
      items.forEach((it, i) => {
        const c = i % d.cols, r = Math.floor(i / d.cols);
        const px = x + (zw - d.cols * 1.75) / 2 + 0.875 + c * 1.75;
        const pz = z + 1.6 + 1.7 + r * 3.4;
        buildProp(b, it.kind === 'nat' ? it : it, px, pz, 0);
      });
      if (!items.length) b.label('(empty subnet)', x + zw / 2, 0.8, z + zd / 2, { accent: color, scale: 0.7 });
      z += zd + GZ;
    });
    x += colW[ci] + GX;
  });
  homeless.forEach((it, i) => buildProp(b, it, -W / 2 + 3 + i * 1.8, D / 2 - 6, 0));

  // Internet gateway: a glowing gate to the wild internet on the north wall
  if (vpc.internetGateways.length) {
    const igw = vpc.internetGateways[0];
    const gw = 7, gh = 4.4;
    const portal = new THREE.Mesh(G.plane(gw, gh), portalMaterial('#7fd8ff'));
    portal.position.set(0, gh / 2, -D / 2 + 0.2);
    b.add(portal);
    [-1, 1].forEach((s2) => b.inst(G.box(1, 1, 1), M.steel(), s2 * (gw / 2 + 0.2), gh / 2, -D / 2 + 0.3, 0, 0.4, gh, 0.5));
    b.inst(G.box(1, 1, 1), M.steel(), 0, gh + 0.2, -D / 2 + 0.3, 0, gw + 0.8, 0.4, 0.5);
    for (let i = 0; i < 9; i++) b.inst(G.cyl(0.04, 0.04, gh, 6), M.metalDark(), -gw / 2 + 0.4 + i * ((gw - 0.8) / 8), gh / 2, -D / 2 + 0.45);
    b.collideRect(0, -D / 2 + 0.45, gw, 0.3);
    b.label('Internet Gateway', 0, gh + 1.0, -D / 2 + 0.8, { sub: `${igw.id} · beyond: bots scanning port 22`, accent: '#7fd8ff', icon: 'igw', scale: 1.5 });
    b.interact({ x: 0, z: -D / 2 + 2, y: 1.6, radius: 3.2, kind: 'igw', title: 'Internet Gateway', sub: 'here be dragons', item: { ...igw, sub: 'Out there: 4 billion IPs, 3.9 billion of them scanning you' } });
    addLight(b, 0, 3, -D / 2 + 2, '#7fd8ff', 30, 18);
  }

  // Security group & route terminal
  const sgs = vpc.securityGroups || [];
  const open22 = sgs.filter((g) => g.ingress.some((r) => /22.*0\.0\.0\.0\/0/.test(r))).length;
  kiosk(b, W / 2 - 3.2, D / 2 - 4, -Math.PI / 3, {
    title: 'Security Groups', color: '#DD344C',
    lines: [`${sgs.length} security groups`, open22 ? [`${open22} allow SSH from 0.0.0.0/0`, '#ff8080'] : ['No SSH from the world. Nice.', '#2fe37a'], '', 'Press E for the rules.'],
    interact: {
      kind: 'iam', title: 'Security group terminal', sub: `${sgs.length} groups`, prompt: 'Read',
      onUse: (w) => w.inspect({ name: `Security groups in ${vpc.name}`, kind: 'iam', sub: `${sgs.length} groups`, id: vpc.id, info: sgs }, {
        extra: sgs.map((g) => `<div class="sub-h">${esc(g.name)} <small>${esc(g.id)}</small></div><div class="muted">${esc(g.description)}</div><table>${g.ingress.map((r) => `<tr><th>in</th><td>${esc(r)}</td></tr>`).join('')}${g.egress.map((r) => `<tr><th>out</th><td>${esc(r)}</td></tr>`).join('')}</table>`).join('') || '<p>No security groups. Impressive. Suspicious.</p>',
      }),
    },
  });
  kiosk(b, -W / 2 + 3.2, D / 2 - 4, Math.PI / 3, {
    title: 'VPC', color: '#8C4FFF',
    lines: [vpc.id, vpc.sub, `${vpc.instances.length} instances · ${vpc.natGateways.length} NAT GW`, `${lambdas.length} Lambda ENIs`, vpc.isDefault ? ['Default VPC. Please don\'t.', '#ffb020'] : ''],
    interact: { kind: 'vpc', title: vpc.name, sub: vpc.sub, item: vpc.info ? { ...vpc, info: vpc.info } : vpc },
  });
  addLight(b, 0, H - 1, 0, '#a88cff', 25, 35);
  b.onEnter = (w) => {
    if (vpc.natGateways.length) w.hud.notify('Finance', `${vpc.natGateways.length} NAT Gateway(s) detected. We can hear the meter running from here.`, 'nat');
    if (vpc.isDefault) w.hud.notify('Security Guard', 'The default VPC. Nobody is supposed to be in here. Nobody ever is. Except prod, somehow.', 'vpc');
  };
  return b.finalize();
}

export { SERVICES, hexAlpha };
