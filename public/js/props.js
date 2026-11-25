import * as THREE from 'three';
import { M, G, mat, geo, toWorld, screen } from './kit.js';
import {
  rackFrontCanvas, rackEmissiveCanvas, iconTexture, toTexture, corrugatedTexture, cardboardCanvas,
  canvas, drawIcon, fitText, FONT, DISPLAY_FONT, fenceTexture,
} from './textures.js';
import { SERVICES } from './theme.js';

// Cell sizes used by room layouts: [cellWidth, cellDepth]
export const CELL = {
  lambda: [1.25, 3.4], dynamodb: [1.3, 3.6], rds: [1.3, 3.6], elasticache: [1.3, 3.6], ec2: [1.25, 3.4],
  ecs: [3.4, 3.8], s3: [2.6, 3.2], sqs: [4.2, 3.4], sns: [2.8, 3.2], eventbridge: [2.6, 3.4], eventbus: [5.6, 4.4], sfn: [2.9, 3.4],
  apigw: [3.8, 3.8], cloudfront: [3.0, 3.4], route53: [2.6, 3.2], iam: [1.05, 3.0], kms: [2.0, 3.2],
  secrets: [1.7, 3.0], logs: [1.05, 2.8], alarm: [1.5, 2.8], generic: [1.7, 2.6], net: [1.7, 2.8], nat: [2.6, 3.4],
  cfnStack: [3.6, 4.2],
};

const rnd = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296);
};

function frontMat(color, variant) {
  return mat(`front:${color}:${variant}`, () => new THREE.MeshStandardMaterial({
    map: toTexture(rackFrontCanvas(color, variant)),
    emissiveMap: toTexture(rackEmissiveCanvas(color, variant)),
    emissive: new THREE.Color(1.6, 1.6, 1.6),
    roughness: 0.4,
    metalness: 0.6,
  }));
}

function iconMat(kind, glow = 1.15) {
  return mat(`icon:${kind}:${glow}`, () => new THREE.MeshBasicMaterial({ map: iconTexture(kind), color: new THREE.Color(glow, glow, glow) }));
}

function glyphMat(kind, color) {
  return mat(`glyph:${kind}:${color}`, () => {
    const c = canvas(256, 256);
    drawIcon(c.getContext('2d'), kind, 0, 0, 256, { bg: false });
    const tex = toTexture(c);
    return new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(color).multiplyScalar(2.4), transparent: true, depthWrite: false });
  });
}

function spin(b, obj, speed = 1, bob = 0) {
  if (!b.spinners) {
    b.spinners = [];
    b.update((dt, t) => {
      for (const s of b.spinners) {
        s.obj.rotation.y += dt * s.speed;
        if (s.bob) s.obj.position.y = s.y0 + Math.sin(t * 2 + s.phase) * s.bob;
      }
    });
  }
  b.spinners.push({ obj, speed, bob, y0: obj.position.y, phase: Math.random() * 6 });
}

function finish(b, item, x, z, ry, { h = 2.2, d = 1.1, w = 1, kind = item.kind, labelSub, accent } = {}) {
  const color = accent || SERVICES[kind]?.color || '#ff9900';
  b.label(item.name, x, h + 0.42, z, { sub: labelSub ?? item.sub, accent: color, scale: 0.55, range: 12 });
  const [ix, iz] = toWorld(x, z, ry, 0, d / 2 + 0.55);
  b.interact({ x: ix, y: 1.2, z: iz, kind, title: item.name, sub: item.sub, item });
  b.collideRect(x, z, w, d, ry);
  b.mark(x, z, color, 1.6);
}

function addPart(b, geometry, material, x, z, ry, lx, y, lz, extraRy = 0, sx = 1, sy = 1, sz = 1, rx = 0) {
  const [wx, wz] = toWorld(x, z, ry, lx, lz);
  b.inst(geometry, material, wx, y, wz, ry + extraRy, sx, sy, sz, rx);
}

function addLeds(b, item, x, z, ry, { w, h, d, color = '#2fe37a', n = 10, off = false }) {
  const r = rnd(item.id || item.name || 'x');
  for (let i = 0; i < n; i++) {
    const lx = (r() - 0.5) * w * 0.6 + w * 0.2;
    const y = 0.25 + r() * (h - 0.6);
    const [wx, wz] = toWorld(x, z, ry, lx, d / 2 + 0.015);
    const c = r() > 0.85 ? '#ffb020' : r() > 0.7 ? '#3fb6ff' : color;
    b.led(wx, y, wz, off ? '#ff2d2d' : c, { blink: r(), on: !off || i === 0 });
  }
}

// ---------------------------------------------------------------------------

export function rack(b, item, x, z, ry, { color, variant = 'server', h = 2.2, w = 0.9, d = 1.1, icon = item.kind, off = false } = {}) {
  color ||= SERVICES[item.kind]?.color || '#ff9900';
  addPart(b, G.box(1, 1, 1), M.metalDark(), x, z, ry, 0, h / 2, 0, 0, w, h, d);
  addPart(b, G.plane(1, 1), frontMat(color, variant), x, z, ry, 0, h / 2, d / 2 + 0.005, 0, w * 0.94, h * 0.97, 1);
  addPart(b, G.box(1, 1, 1), M.glow(color, off ? 0.3 : 1.8), x, z, ry, 0, h + 0.02, 0, 0, w + 0.02, 0.04, d + 0.02);
  addPart(b, G.plane(0.34, 0.34), iconMat(icon), x, z, ry, 0, h - 0.28, d / 2 + 0.012);
  addLeds(b, item, x, z, ry, { w, h, d, off, color: off ? '#ff2d2d' : '#2fe37a' });
  finish(b, item, x, z, ry, { h, d, w });
}

function lambdaCab(b, item, x, z, ry) {
  const zombie = item.deprecated;
  const color = zombie ? '#7dff6a' : SERVICES.lambda.color;
  const h = 2.05, w = 0.78, d = 1.05;
  addPart(b, G.box(1, 1, 1), M.metalDark(), x, z, ry, 0, h / 2, 0, 0, w, h, d);
  addPart(b, G.plane(1, 1), frontMat(color, 'server'), x, z, ry, 0, h / 2, d / 2 + 0.004, 0, w * 0.94, h * 0.97, 1);
  addPart(b, G.plane(0.62, 0.62), glyphMat('lambda', color), x, z, ry, 0, h * 0.58, d / 2 + 0.02);
  addPart(b, G.box(1, 1, 1), M.glow(color, 2), x, z, ry, 0, h + 0.02, 0, 0, w + 0.02, 0.04, d + 0.02);
  if (zombie) addPart(b, G.box(1, 1, 1), M.glow('#7dff6a', 0.6), x, z, ry, 0, 0.03, 0, 0, w + 0.5, 0.02, d + 0.5);
  addLeds(b, item, x, z, ry, { w, h, d, n: 6, color });
  finish(b, item, x, z, ry, { h, d, w, labelSub: zombie ? `${item.sub} · 🧟 deprecated runtime` : `${item.sub} · ${item.info?.MemorySize || '?'} MB` });
}

function dynamoRack(b, item, x, z, ry) {
  const color = SERVICES.dynamodb.color;
  const h = 2.25, w = 0.95, d = 1.15;
  rackBody(b, x, z, ry, w, h, d, color, 'disks');
  // "racks of databases": a holographic DB stack hovering above, sized by table size
  const discs = Math.max(1, Math.min(5, Math.round(Math.log10((item.size || 1e4) + 10) - 3)));
  for (let i = 0; i < discs; i++) {
    addPart(b, G.cyl(0.3, 0.3, 0.1, 24), M.color('#2a1030', 0.3, 0.6), x, z, ry, 0, h + 0.14 + i * 0.16, 0);
    addPart(b, G.cyl(0.305, 0.305, 0.02, 24), M.glow(color, 1.4), x, z, ry, 0, h + 0.2 + i * 0.16, 0);
  }
  addPart(b, G.plane(0.34, 0.34), iconMat('dynamodb'), x, z, ry, 0, h - 0.28, d / 2 + 0.012);
  addLeds(b, item, x, z, ry, { w, h, d, n: 12, color: '#7fb2ff' });
  finish(b, item, x, z, ry, { h: h + discs * 0.16, d, w, labelSub: item.sub ? `${item.sub}${item.info?.ItemCount != null ? ` · ${Number(item.info.ItemCount).toLocaleString()} items` : ''}` : undefined });
}

function rackBody(b, x, z, ry, w, h, d, color, variant) {
  addPart(b, G.box(1, 1, 1), M.metalDark(), x, z, ry, 0, h / 2, 0, 0, w, h, d);
  addPart(b, G.plane(1, 1), frontMat(color, variant), x, z, ry, 0, h / 2, d / 2 + 0.005, 0, w * 0.94, h * 0.97, 1);
  addPart(b, G.box(1, 1, 1), M.glow(color, 1.8), x, z, ry, 0, h + 0.02, 0, 0, w + 0.02, 0.04, d + 0.02);
}

function rdsRack(b, item, x, z, ry) {
  const color = SERVICES.rds.color;
  const cluster = /cluster/.test(item.sub || '');
  const h = cluster ? 2.5 : 2.2, w = cluster ? 1.2 : 0.95, d = 1.15;
  rackBody(b, x, z, ry, w, h, d, color, cluster ? 'disks' : 'server');
  addPart(b, G.plane(0.36, 0.36), iconMat('rds'), x, z, ry, 0, h - 0.3, d / 2 + 0.012);
  const holo = new THREE.Mesh(G.plane(0.7, 0.7), glyphMat('rds', '#d88cff'));
  holo.position.set(x, h + 0.55, z);
  b.add(holo);
  spin(b, holo, 0.8, 0.06);
  addLeds(b, item, x, z, ry, { w, h, d, n: 12, off: /stopped/.test(item.status || ''), color: '#7fb2ff' });
  finish(b, item, x, z, ry, { h: h + 0.6, d, w });
}

function ec2Rack(b, item, x, z, ry) {
  const t = item.sub || '';
  const size = /nano|micro/.test(t) ? 1.2 : /small|medium/.test(t) ? 1.6 : /\.large/.test(t) ? 2.0 : /metal|(\d\d)xlarge/.test(t) ? 2.6 : 2.3;
  rack(b, item, x, z, ry, { h: size, color: SERVICES.ec2.color, off: item.status !== 'running', icon: 'ec2' });
}

function ecsStack(b, item, x, z, ry) {
  const n = Math.max(1, Math.min(6, item.count || item.info?.ActiveServices || 1));
  const colors = ['#c0392b', '#2471a3', '#1e8449', '#b9770e', '#7d3c98', '#566573'];
  for (let i = 0; i < n; i++) {
    const level = Math.floor(i / 2), side = i % 2;
    const c = colors[(i + (item.name || '').length) % colors.length];
    const m = mat(`container:${c}`, () => new THREE.MeshStandardMaterial({ map: toTexture(corrugatedTexture(c)), roughness: 0.6, metalness: 0.4 }));
    addPart(b, G.box(1, 1, 1), m, x, z, ry, side * 1.25 - 0.62, 0.6 + level * 1.22, 0, 0, 1.2, 1.2, 1.1);
  }
  addPart(b, G.plane(0.5, 0.5), iconMat('ecs'), x, z, ry, -0.62, 0.6, 0.56);
  finish(b, item, x, z, ry, { h: Math.ceil(n / 2) * 1.22, d: 1.1, w: 2.6 });
}

function bucket(b, item, x, z, ry) {
  const color = SERVICES.s3.color;
  const bm = M.color('#4f6b2a', 0.35, 0.75);
  addPart(b, G.cyl(0.78, 0.58, 1.3, 32), bm, x, z, ry, 0, 0.65, 0);
  addPart(b, G.cyl(0.74, 0.74, 0.02, 32), M.color('#0c1206', 0.9, 0), x, z, ry, 0, 1.3, 0);
  addPart(b, G.torus(0.7, 0.035, 8, 40), M.glow(color, 1.8), x, z, ry, 0, 1.0, 0, 0, 1, 1, 1, Math.PI / 2);
  addPart(b, G.torus(0.6, 0.03, 8, 40), M.glow(color, 1.8), x, z, ry, 0, 0.3, 0, 0, 1, 1, 1, Math.PI / 2);
  addPart(b, G.torus(0.72, 0.03, 8, 32, Math.PI), M.metal(), x, z, ry, 0, 1.3, 0);
  addPart(b, G.plane(0.5, 0.5), iconMat('s3'), x, z, ry, 0, 0.7, 0.71, 0, 1, 1, 1, -0.15);
  finish(b, item, x, z, ry, { h: 1.9, d: 1.6, w: 1.6 });
}

function conveyor(b, item, x, z, ry) {
  const color = SERVICES.sqs.color;
  const L = 3.2;
  addPart(b, G.box(1, 1, 1), M.steel(), x, z, ry, 0, 0.45, 0, 0, L, 0.12, 1.0);
  addPart(b, G.box(1, 1, 1), M.color('#111418', 0.9, 0.1), x, z, ry, 0, 0.52, 0, 0, L - 0.1, 0.02, 0.9);
  [-1, 1].forEach((s) => addPart(b, G.box(1, 1, 1), M.glow(color, 1.6), x, z, ry, 0, 0.56, s * 0.48, 0, L, 0.05, 0.04));
  [-1.4, 0, 1.4].forEach((lx) => [-0.4, 0.4].forEach((lz) => addPart(b, G.box(0.08, 0.45, 0.08), M.steel(), x, z, ry, lx, 0.22, lz)));
  const fifo = /\.fifo$/.test(item.name);
  const dlq = /dlq|dead/i.test(item.name);
  const n = dlq ? 1 : 4;
  const boxes = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(G.box(0.42, 0.32, 0.42), mat('sqsbox', () => new THREE.MeshStandardMaterial({ map: toTexture(cardboardCanvas('Message')), roughness: 0.8 })));
    b.add(m);
    boxes.push({ m, off: i / n });
  }
  const r = rnd(item.name);
  const speed = dlq ? 0 : 0.18 + r() * 0.15;
  b.update((dt, t) => {
    for (const bx of boxes) {
      const u = dlq ? 0.5 : (bx.off + t * speed) % 1;
      const lx = -L / 2 + 0.25 + u * (L - 0.5);
      const [wx, wz] = toWorld(x, z, ry, lx, 0);
      bx.m.position.set(wx, 0.7, wz);
      bx.m.rotation.y = ry + (fifo ? 0 : Math.sin(u * 20 + bx.off * 9) * 0.2);
    }
  });
  addPart(b, G.plane(0.5, 0.5), iconMat('sqs'), x, z, ry, -L / 2 + 0.3, 0.9, 0.52);
  finish(b, item, x, z, ry, { h: 0.9, d: 1.0, w: L, labelSub: dlq ? 'dead-letter queue · 1 message since 2021' : fifo ? 'FIFO · exactly-once-ish' : item.sub });
}

function antenna(b, item, x, z, ry) {
  const color = SERVICES.sns.color;
  addPart(b, G.cyl(0.5, 0.6, 0.3, 20), M.steel(), x, z, ry, 0, 0.15, 0);
  addPart(b, G.cyl(0.05, 0.12, 2.6, 10), M.metal(), x, z, ry, 0, 1.6, 0);
  addPart(b, G.sphere(0.12, 12), M.glow(color, 3), x, z, ry, 0, 2.95, 0);
  const rings = [0, 1, 2].map((i) => {
    const m = new THREE.Mesh(G.torus(0.3, 0.025, 6, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2), transparent: true, depthWrite: false }));
    m.rotation.x = Math.PI / 2;
    m.position.set(x, 2.9, z);
    b.add(m);
    b.track(m.material);
    return { m, off: i / 3 };
  });
  b.update((dt, t) => {
    for (const r of rings) {
      const u = (t * 0.5 + r.off) % 1;
      r.m.scale.setScalar(0.3 + u * 4);
      r.m.material.opacity = (1 - u) * 0.8;
    }
  });
  addPart(b, G.plane(0.5, 0.5), iconMat('sns'), x, z, ry, 0, 0.15, 0.62, 0, 1, 1, 1, -0.3);
  finish(b, item, x, z, ry, { h: 3.0, d: 1.2, w: 1.2 });
}

function vanSideMat(name) {
  return mat(`vanSide:${name}`, () => {
    const c = canvas(1024, 192);
    const ctx = c.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const t = fitText(ctx, name, 900, 120, 400, DISPLAY_FONT);
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#3a0820';
    ctx.strokeText(t, 512, 82);
    ctx.fillStyle = '#fff6e6';
    ctx.fillText(t, 512, 82);
    ctx.font = `700 34px ${FONT}`;
    ctx.fillStyle = '#ffd1ea';
    ctx.fillText('★ EVENT BUS · ALL EVENTS WELCOME ★', 512, 165);
    return new THREE.MeshBasicMaterial({ map: toTexture(c), transparent: true, depthWrite: false });
  });
}

function vanFrontMat(paint) {
  return mat(`vanFront:${paint}`, () => {
    const c = canvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f3ead8';
    ctx.fillRect(0, 0, 256, 256);
    // windscreen (split, of course)
    ctx.fillStyle = '#0f1a26';
    roundRectPath(ctx, 18, 14, 104, 84, 14); ctx.fill();
    roundRectPath(ctx, 134, 14, 104, 84, 14); ctx.fill();
    ctx.fillStyle = 'rgba(160,210,255,0.25)';
    ctx.fillRect(28, 22, 30, 70);
    // lower paint with the classic V
    ctx.fillStyle = paint;
    ctx.beginPath();
    ctx.moveTo(0, 128); ctx.lineTo(40, 128); ctx.lineTo(128, 210); ctx.lineTo(216, 128); ctx.lineTo(256, 128);
    ctx.lineTo(256, 256); ctx.lineTo(0, 256); ctx.closePath(); ctx.fill();
    // emblem
    ctx.fillStyle = '#f3ead8';
    ctx.beginPath(); ctx.arc(128, 150, 34, 0, Math.PI * 2); ctx.fill();
    drawIcon(ctx, 'eventbridge', 102, 124, 52);
    return new THREE.MeshStandardMaterial({ map: toTexture(c), roughness: 0.35, metalness: 0.3 });
  });
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Event bus = camper van. Length along local X (front at +X), name painted on both sides. */
function camperVan(b, item, x, z, ry) {
  const paint = SERVICES.eventbridge.color;
  const L = 3.9, W = 1.8, Y0 = 0.45, YM = 1.25, YT = 2.05;
  const P = (geometry, material, lx, y, lz, extraRy = 0, sx = 1, sy = 1, sz = 1, rx = 0) => addPart(b, geometry, material, x, z, ry, lx, y, lz, extraRy, sx, sy, sz, rx);
  const box = G.box(1, 1, 1);
  const paintMat = M.color(paint, 0.3, 0.45);
  const cream = M.color('#f3ead8', 0.35, 0.3);
  const chrome = M.metal();
  const glass = M.color('#0f1a26', 0.1, 0.6);
  P(box, paintMat, 0, (Y0 + YM) / 2, 0, 0, L, YM - Y0, W);
  P(box, cream, 0, (YM + YT) / 2, 0, 0, L, YT - YM, W);
  P(box, cream, -0.1, YT + 0.06, 0, 0, L - 0.5, 0.12, W - 0.12);
  P(box, chrome, 0, YM, 0, 0, L + 0.02, 0.05, W + 0.02);
  // side windows
  [-1, 1].forEach((s) => {
    for (let i = 0; i < 3; i++) P(box, glass, -1.15 + i * 0.95, 1.68, s * (W / 2 + 0.006), 0, 0.78, 0.5, 0.02);
    P(geo('van:side', () => new THREE.PlaneGeometry(L - 0.5, 0.64)), vanSideMat(item.name), -0.1, 0.86, s * (W / 2 + 0.012), s > 0 ? 0 : Math.PI);
  });
  // front face (windscreen, V, emblem) and back
  P(geo('van:front', () => new THREE.PlaneGeometry(W, YT - Y0)), vanFrontMat(paint), L / 2 + 0.006, (Y0 + YT) / 2, 0, Math.PI / 2);
  P(box, glass, -L / 2 - 0.006, 1.68, 0, 0, 0.02, 0.45, W - 0.5);
  // bumpers & lights
  P(box, chrome, L / 2 + 0.08, 0.55, 0, 0, 0.12, 0.12, W + 0.1);
  P(box, chrome, -L / 2 - 0.08, 0.55, 0, 0, 0.12, 0.12, W + 0.1);
  const disc = geo('van:light', () => new THREE.CircleGeometry(0.13, 20));
  [-1, 1].forEach((s) => {
    P(disc, M.glow('#fff3c4', 3), L / 2 + 0.012, 0.92, s * (W / 2 - 0.25), Math.PI / 2);
    P(box, M.glow('#ff2020', 2.5), -L / 2 - 0.012, 0.95, s * (W / 2 - 0.2), 0, 0.02, 0.2, 0.14);
  });
  // wheels
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => {
    P(G.cyl(0.38, 0.38, 0.26, 20), M.color('#111317', 0.8, 0.1), sx * (L / 2 - 0.75), 0.38, sz * (W / 2 - 0.08), 0, 1, 1, 1, Math.PI / 2);
    P(G.cyl(0.18, 0.18, 0.28, 16), M.color('#e8e8e8', 0.3, 0.8), sx * (L / 2 - 0.75), 0.38, sz * (W / 2 - 0.08), 0, 1, 1, 1, Math.PI / 2);
  }));
  // roof rack + surfboard
  [-0.9, 0.7].forEach((lx) => P(box, chrome, lx, YT + 0.2, 0, 0, 0.05, 0.05, W - 0.2));
  P(G.sphere(1, 20), M.color('#ffd34d', 0.4, 0.1), -0.1, YT + 0.27, 0, 0, 1.6, 0.05, 0.3);
  P(box, M.color(paint, 0.4, 0.1), -0.1, YT + 0.32, 0, 0, 2.6, 0.012, 0.05);
  // underglow, because it's a party bus
  P(box, M.glow(paint, 1.2), 0, 0.03, 0, 0, L - 0.3, 0.02, W - 0.3);
  finish(b, item, x, z, ry, { h: YT + 0.35, d: W, w: L, kind: 'eventbridge', labelSub: 'event bus · beep beep' });
}

// ---------------------------------------------------------------------------
// EventBridge: buses are camper vans, pattern rules are filter funnels, schedules are timers.

export function isSchedule(item) {
  return Boolean(item.info?.ScheduleExpression) || /schedul/i.test(item.sub || '') || item.info?.ResourceType === 'AWS::Scheduler::Schedule';
}

function eventProp(b, item, x, z, ry) {
  if (isEventBus(item)) return camperVan(b, item, x, z, ry);
  if (isSchedule(item)) return timer(b, item, x, z, ry);
  return funnel(b, item, x, z, ry);
}

function patternSummary(p) {
  if (!p || typeof p !== 'object') return 'pattern: (unknown)';
  const parts = [];
  if (p.source) parts.push(`source=${[].concat(p.source).join('|')}`);
  if (p['detail-type']) parts.push(`type=${[].concat(p['detail-type']).join('|')}`);
  return parts.join(' · ') || `pattern: ${Object.keys(p).join(', ')}`;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const tmpC = new THREE.Color();
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function funnel(b, item, x, z, ry) {
  const disabled = item.status === 'DISABLED';
  const color = disabled ? '#6b7280' : SERVICES.eventbridge.color;
  const TOP = 1.95, BOT = 1.15, R = 0.72;
  // stand: three legs and a rim
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    addPart(b, G.cyl(0.03, 0.03, TOP, 6), M.steel(), x, z, ry, Math.cos(a) * (R - 0.05), TOP / 2, Math.sin(a) * (R - 0.05));
  }
  addPart(b, G.cyl(R, 0.13, TOP - BOT, 28, true), mat('funnelBody', () => new THREE.MeshStandardMaterial({ color: '#3a2a3f', metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide })), x, z, ry, 0, (TOP + BOT) / 2, 0);
  addPart(b, G.cyl(0.13, 0.13, 0.35, 16, true), M.steel(), x, z, ry, 0, BOT - 0.17, 0);
  addPart(b, G.torus(R, 0.035, 8, 40), M.glow(color, 2.2), x, z, ry, 0, TOP, 0, 0, 1, 1, 1, Math.PI / 2);
  // filter mesh across the mouth
  addPart(b, geo('disc:filter', () => new THREE.CircleGeometry(R * 0.97, 32)), mat('filterMesh', () => {
    const t = toTexture(fenceTexture(), { repeat: [3, 3] });
    return new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.35, transparent: true, side: THREE.DoubleSide, metalness: 0.8, roughness: 0.3, alphaMap: null });
  }), x, z, ry, 0, TOP - 0.02, 0, 0, 1, 1, 1, -Math.PI / 2);
  // target bin under the spout
  addPart(b, G.box(1, 1, 1), M.color('#1d1220', 0.5, 0.5), x, z, ry, 0, 0.18, 0, 0, 0.55, 0.36, 0.55);
  addPart(b, G.box(1, 1, 1), M.glow(color, 1.6), x, z, ry, 0, 0.37, 0, 0, 0.57, 0.03, 0.57);
  addPart(b, G.plane(0.3, 0.3), iconMat('eventbridge'), x, z, ry, 0, 0.18, 0.28);

  if (!disabled) {
    const N = 14;
    const im = new THREE.InstancedMesh(G.box(0.15, 0.15, 0.15), mat('eventDot', () => new THREE.MeshBasicMaterial({ color: '#ffffff' })), N);
    im.frustumCulled = false;
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < N; i++) { im.setMatrixAt(i, hidden); im.setColorAt(i, tmpC.set('#ffffff')); }
    b.add(im);
    b.track(im);
    const T = 2.6;
    const seed = (item.name || '').length * 13.37;
    b.update((dt, t, ctx) => {
      const pp = ctx.player.pos;
      if (Math.hypot(pp.x - x, pp.z - z) > 30) return;
      for (let i = 0; i < N; i++) {
        const cyc = t / T + i / N;
        const u = cyc % 1;
        const k = Math.floor(cyc) + seed + i * 7.1;
        const match = hash(k) < 0.45;
        const a0 = hash(k + 1) * Math.PI * 2, r0 = 0.15 + hash(k + 2) * 0.4;
        let lx = Math.cos(a0) * r0, lz = Math.sin(a0) * r0, y, s = 1;
        if (u < 0.35) {
          y = TOP + 0.9 - (u / 0.35) * 0.9;
        } else if (match) {
          const v = (u - 0.35) / 0.4;
          if (v < 1) {
            const rr = r0 * (1 - v) * (1 - v);
            const aa = a0 + v * 4;
            lx = Math.cos(aa) * rr; lz = Math.sin(aa) * rr;
            y = TOP - v * (TOP - BOT + 0.3);
          } else {
            const w = (u - 0.75) / 0.25;
            lx = 0; lz = 0;
            y = BOT - 0.3 - w * (BOT - 0.65);
            s = 1 - Math.max(0, w - 0.8) * 5;
          }
        } else {
          const v = (u - 0.35) / 0.3;
          const rr = r0 + v * 0.9;
          lx = Math.cos(a0) * rr; lz = Math.sin(a0) * rr;
          y = TOP + Math.sin(Math.min(1, v) * Math.PI) * 0.45;
          s = Math.max(0, 1 - v);
        }
        const [wx, wz] = toWorld(x, z, ry, lx, lz);
        tmpP.set(wx, y, wz);
        tmpQ.setFromAxisAngle(tmpS.set(0, 1, 0), t * 2 + i);
        tmpS.setScalar(Math.max(0.001, s));
        im.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
        im.setColorAt(i, tmpC.set(match ? '#ffd34d' : '#ff5a5a').multiplyScalar(match ? 2.6 : 1.2));
      }
      im.instanceMatrix.needsUpdate = true;
      im.instanceColor.needsUpdate = true;
    });
  }
  finish(b, item, x, z, ry, { h: TOP + 0.7, d: R * 2, w: R * 2, kind: 'eventbridge', labelSub: disabled ? 'DISABLED · filter clogged' : patternSummary(item.info?.EventPattern) });
}

function clockFaceMat(item, color, disabled) {
  const expr = item.info?.ScheduleExpression || 'schedule';
  return mat(`clock:${expr}:${color}`, () => {
    const c = canvas(512, 512);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(256, 256, 20, 256, 256, 256);
    g.addColorStop(0, '#1d1023');
    g.addColorStop(1, '#07040a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = color;
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const r1 = i % 5 ? 222 : 196;
      ctx.lineWidth = i % 5 ? 4 : 10;
      ctx.beginPath();
      ctx.moveTo(256 + Math.sin(a) * r1, 256 - Math.cos(a) * r1);
      ctx.lineTo(256 + Math.sin(a) * 240, 256 - Math.cos(a) * 240);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffd1ea';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fitText(ctx, expr, 300, 40, 700, FONT), 256, 330);
    ctx.fillStyle = 'rgba(255,209,234,0.6)';
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText(disabled ? 'DISABLED' : 'next run: soon™', 256, 375);
    return new THREE.MeshBasicMaterial({ map: toTexture(c), color: new THREE.Color(1.2, 1.2, 1.2) });
  });
}

function timer(b, item, x, z, ry) {
  const disabled = item.status === 'DISABLED';
  const color = disabled ? '#6b7280' : SERVICES.eventbridge.color;
  const CY = 1.55, CR = 0.62;
  addPart(b, G.box(1, 1, 1), M.color('#1d1220', 0.45, 0.6), x, z, ry, 0, 0.55, 0, 0, 0.7, 1.1, 0.45);
  addPart(b, G.box(1, 1, 1), M.glow(color, 1.4), x, z, ry, 0, 0.06, 0, 0, 0.74, 0.04, 0.49);
  addPart(b, G.cyl(CR + 0.06, CR + 0.06, 0.14, 48), M.color('#2b2f38', 0.35, 0.8), x, z, ry, 0, CY, 0, 0, 1, 1, 1, Math.PI / 2);
  addPart(b, G.torus(CR + 0.06, 0.03, 8, 48), M.glow(color, 2.2), x, z, ry, 0, CY, 0.075);
  addPart(b, G.plane(CR * 2, CR * 2), clockFaceMat(item, color, disabled), x, z, ry, 0, CY, 0.072);
  // bells on top, like an old alarm clock
  [-1, 1].forEach((s) => addPart(b, G.sphere(0.13, 12), M.color('#c8ccd2', 0.3, 0.9), x, z, ry, s * 0.42, CY + CR + 0.02, 0));
  addPart(b, G.plane(0.28, 0.28), iconMat('eventbridge'), x, z, ry, 0, 0.6, 0.226);

  const [hx, hz] = toWorld(x, z, ry, 0, 0.085);
  const hands = new THREE.Group();
  hands.position.set(hx, CY, hz);
  hands.rotation.y = ry;
  b.add(hands);
  const mkHand = (len, w, m) => {
    const pivot = new THREE.Group();
    const h = new THREE.Mesh(G.box(w, len, 0.02), m);
    h.position.y = len / 2;
    pivot.add(h);
    hands.add(pivot);
    return pivot;
  };
  const hourH = mkHand(CR * 0.5, 0.06, M.color('#ffd1ea', 0.4, 0.3));
  const minH = mkHand(CR * 0.8, 0.04, M.glow(color, 2.5));
  const hub2 = new THREE.Mesh(G.cyl(0.05, 0.05, 0.04, 12), M.metal());
  hub2.rotation.x = Math.PI / 2;
  hands.add(hub2);
  hourH.rotation.z = -1.2;

  if (!disabled) {
    const ring = new THREE.Mesh(G.torus(CR, 0.025, 6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.5), transparent: true, depthWrite: false }));
    b.track(ring.material);
    ring.position.set(hx, CY, hz);
    ring.rotation.y = ry;
    b.add(ring);
    const P = 4 + hash((item.name || '').length) * 3;
    b.update((dt, t) => {
      const u = (t / P) % 1;
      minH.rotation.z = -u * Math.PI * 2;
      hourH.rotation.z = -1.2 - (t / P / 12) * Math.PI * 2;
      // fire! a pulse every full turn of the minute hand
      const f = Math.min(1, u / 0.25);
      ring.scale.setScalar(1 + f * 0.9);
      ring.material.opacity = (1 - f) * 0.9;
    });
  }
  finish(b, item, x, z, ry, { h: CY + CR + 0.25, d: 0.5, w: 1.3, kind: 'eventbridge', labelSub: `${disabled ? 'DISABLED · ' : '⏰ '}${item.info?.ScheduleExpression || 'scheduled'}` });
}

let flowTex;
function flowChartMat() {
  return mat('flowchart', () => {
    const c = canvas(512, 640);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0a0710';
    ctx.fillRect(0, 0, 512, 640);
    ctx.strokeStyle = '#ff5fb0';
    ctx.fillStyle = '#2a0f22';
    ctx.lineWidth = 5;
    const node = (x, y, t) => {
      ctx.fillStyle = '#2a0f22';
      ctx.fillRect(x - 90, y - 32, 180, 64);
      ctx.strokeRect(x - 90, y - 32, 180, 64);
      ctx.fillStyle = '#ffd1ea';
      ctx.font = `700 28px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t, x, y);
    };
    const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
    line(256, 90, 256, 170); line(256, 230, 130, 330); line(256, 230, 382, 330); line(130, 390, 256, 480); line(382, 390, 256, 480); line(256, 540, 256, 600);
    node(256, 60, 'Start'); node(256, 200, 'Choice'); node(130, 360, 'Retry'); node(382, 360, 'Catch'); node(256, 510, 'Retry again');
    ctx.fillStyle = '#ffd1ea';
    ctx.fillText('Succeed (eventually)', 256, 615);
    flowTex = toTexture(c);
    return new THREE.MeshBasicMaterial({ map: flowTex, color: new THREE.Color(1.3, 1.3, 1.3) });
  });
}

function flowBoard(b, item, x, z, ry) {
  addPart(b, G.box(1, 1, 1), M.metalDark(), x, z, ry, 0, 1.3, 0, 0, 2.0, 2.3, 0.12);
  addPart(b, G.plane(1.85, 2.15), flowChartMat(), x, z, ry, 0, 1.3, 0.065);
  [-0.9, 0.9].forEach((lx) => addPart(b, G.box(0.1, 0.25, 0.6), M.steel(), x, z, ry, lx, 0.12, 0));
  addPart(b, G.box(1, 1, 1), M.glow(SERVICES.sfn.color, 2), x, z, ry, 0, 2.47, 0, 0, 2.0, 0.04, 0.14);
  finish(b, item, x, z, ry, { h: 2.5, d: 0.6, w: 2.0 });
}

function gateway(b, item, x, z, ry) {
  const color = SERVICES.apigw.color;
  [-1.25, 1.25].forEach((lx) => {
    addPart(b, G.box(1, 1, 1), M.color('#1b1630', 0.4, 0.6), x, z, ry, lx, 1.4, 0, 0, 0.35, 2.8, 0.6);
    addPart(b, G.box(1, 1, 1), M.glow(color, 2.2), x, z, ry, lx, 1.4, 0.31, 0, 0.06, 2.6, 0.02);
  });
  addPart(b, G.box(1, 1, 1), M.color('#1b1630', 0.4, 0.6), x, z, ry, 0, 2.95, 0, 0, 2.9, 0.35, 0.6);
  addPart(b, G.plane(0.5, 0.5), iconMat('apigw'), x, z, ry, 0, 2.95, 0.31);
  // turnstile
  addPart(b, G.cyl(0.12, 0.12, 1.0, 12), M.metal(), x, z, ry, 0, 0.5, 0);
  const arms = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = new THREE.Mesh(G.box(0.7, 0.05, 0.05), M.metal());
    a.position.x = 0.35;
    const pivot = new THREE.Group();
    pivot.rotation.y = (i * Math.PI * 2) / 3;
    pivot.add(a);
    arms.add(pivot);
  }
  arms.position.set(x, 0.95, z);
  b.add(arms);
  spin(b, arms, 1.5);
  // 429 sign
  const s = screen(b, 0.8, 0.3, { px: 256 });
  s.ctx.fillStyle = '#100018'; s.ctx.fillRect(0, 0, 256, 96);
  s.ctx.fillStyle = '#ff4d6d'; s.ctx.font = `700 50px ${FONT}`; s.ctx.textAlign = 'center'; s.ctx.textBaseline = 'middle';
  s.ctx.fillText('429', 128, 50);
  s.redraw();
  const [sx, sz] = toWorld(x, z, ry, 0.75, 0.32);
  s.mesh.position.set(sx, 2.2, sz);
  s.mesh.rotation.y = ry;
  b.add(s.mesh);
  b.collideRect(...toWorld(x, z, ry, -1.25, 0), 0.4, 0.6, ry);
  b.collideRect(...toWorld(x, z, ry, 1.25, 0), 0.4, 0.6, ry);
  b.collideRect(x, z, 0.3, 0.3, ry);
  b.label(item.name, x, 3.55, z, { sub: item.sub, accent: color, scale: 0.6, range: 14 });
  const [ix, iz] = toWorld(x, z, ry, 0, 0.9);
  b.interact({ x: ix, y: 1.2, z: iz, kind: 'apigw', title: item.name, sub: item.sub, item });
  b.mark(x, z, color, 1.6);
}

function globe(b, item, x, z, ry) {
  const color = SERVICES.cloudfront.color;
  addPart(b, G.cyl(0.55, 0.7, 0.9, 24), M.color('#18142b', 0.4, 0.6), x, z, ry, 0, 0.45, 0);
  const g = new THREE.Group();
  g.position.set(x, 1.75, z);
  const wire = new THREE.Mesh(G.sphere(0.75, 18), mat('globeWire', () => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), wireframe: true })));
  const core = new THREE.Mesh(G.sphere(0.7, 24), M.color('#0d0a1c', 0.3, 0.5));
  g.add(wire, core);
  const r = rnd(item.name);
  for (let i = 0; i < 14; i++) {
    const p = new THREE.Mesh(G.sphere(0.04, 6), M.glow('#ffd34d', 3));
    const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
    p.position.setFromSphericalCoords(0.76, ph, th);
    g.add(p);
  }
  b.add(g);
  spin(b, g, 0.4);
  addPart(b, G.plane(0.4, 0.4), iconMat('cloudfront'), x, z, ry, 0, 0.5, 0.64, 0, 1, 1, 1, -0.17);
  finish(b, item, x, z, ry, { h: 2.6, d: 1.4, w: 1.4 });
}

function dnsPillar(b, item, x, z, ry) {
  const color = SERVICES.route53.color;
  addPart(b, G.box(1, 1, 1), M.color('#17132a', 0.5, 0.5), x, z, ry, 0, 1.3, 0, 0, 0.9, 2.6, 0.9);
  for (let i = 0; i < 4; i++) {
    const [lx, lz] = [[0, 0.456], [0.456, 0], [0, -0.456], [-0.456, 0]][i];
    addPart(b, G.plane(0.6, 0.6), iconMat('route53'), x, z, ry, lx, 1.9, lz, (i * Math.PI) / 2);
  }
  addPart(b, G.box(1, 1, 1), M.glow(color, 2), x, z, ry, 0, 2.62, 0, 0, 0.95, 0.05, 0.95);
  addPart(b, G.box(1, 1, 1), M.glow(color, 1.2), x, z, ry, 0, 0.05, 0, 0, 1.3, 0.05, 1.3);
  finish(b, item, x, z, ry, { h: 2.6, d: 0.9, w: 0.9, labelSub: `${item.sub} · ${item.info?.RecordSetCount ?? '?'} records` });
}

function locker(b, item, x, z, ry) {
  const user = item.sub === 'user';
  const slr = /service-linked/.test(item.sub || '');
  const color = user ? '#ff5a5a' : slr ? '#8b95a7' : SERVICES.iam.color;
  const h = 2.0, w = 0.82, d = 0.6;
  addPart(b, G.box(1, 1, 1), M.color(user ? '#3a2a2e' : '#2c333d', 0.45, 0.7), x, z, ry, 0, h / 2, 0, 0, w, h, d);
  for (let i = 0; i < 5; i++) addPart(b, G.box(1, 1, 1), M.black(), x, z, ry, 0, 1.6 + i * 0.06, d / 2 + 0.003, 0, 0.45, 0.02, 0.01);
  addPart(b, G.box(1, 1, 1), M.metal(), x, z, ry, 0.28, 1.0, d / 2 + 0.02, 0, 0.04, 0.22, 0.03);
  addPart(b, G.plane(0.3, 0.3), iconMat(user ? 'iam' : 'kms'), x, z, ry, -0.1, 1.15, d / 2 + 0.005);
  addPart(b, G.box(1, 1, 1), M.glow(color, 1.6), x, z, ry, 0, h + 0.015, 0, 0, w, 0.03, d);
  finish(b, item, x, z, ry, { h, d, w, accent: color });
}

function vault(b, item, x, z, ry) {
  const color = SERVICES.kms.color;
  addPart(b, G.box(1, 1, 1), M.color('#3b414b', 0.3, 0.9), x, z, ry, 0, 0.7, 0, 0, 1.3, 1.4, 1.0);
  addPart(b, G.cyl(0.45, 0.45, 0.1, 32), M.metal(), x, z, ry, 0, 0.72, 0.52, 0, 1, 1, 1, Math.PI / 2);
  addPart(b, G.cyl(0.12, 0.12, 0.12, 16), M.glow(color, 2), x, z, ry, 0, 0.72, 0.58, 0, 1, 1, 1, Math.PI / 2);
  for (let i = 0; i < 3; i++) addPart(b, G.box(1, 1, 1), M.metal(), x, z, ry, 0, 0.72, 0.6, (i * Math.PI) / 3, 0.7, 0.04, 0.04);
  addPart(b, G.plane(0.3, 0.3), iconMat('kms'), x, z, ry, 0.45, 1.25, 0.505);
  finish(b, item, x, z, ry, { h: 1.5, d: 1.0, w: 1.3 });
}

function safe(b, item, x, z, ry) {
  const color = SERVICES.secrets.color;
  addPart(b, G.box(1, 1, 1), M.color('#4a1d24', 0.35, 0.8), x, z, ry, 0, 0.6, 0, 0, 1.0, 1.2, 0.9);
  addPart(b, G.cyl(0.16, 0.16, 0.06, 20), M.metal(), x, z, ry, 0.2, 0.7, 0.47, 0, 1, 1, 1, Math.PI / 2);
  addPart(b, G.plane(0.3, 0.3), iconMat('secrets'), x, z, ry, -0.22, 0.75, 0.455);
  addPart(b, G.box(1, 1, 1), M.glow(color, 1.6), x, z, ry, 0, 1.22, 0, 0, 1.0, 0.03, 0.9);
  finish(b, item, x, z, ry, { h: 1.3, d: 0.9, w: 1.0, labelSub: 'value: •••••••• (not even we looked)' });
}

function cabinet(b, item, x, z, ry) {
  const color = SERVICES.logs.color;
  addPart(b, G.box(1, 1, 1), M.color('#59616d', 0.45, 0.7), x, z, ry, 0, 0.72, 0, 0, 0.75, 1.44, 0.7);
  for (let i = 0; i < 4; i++) {
    addPart(b, G.box(1, 1, 1), M.color('#6d7581', 0.4, 0.7), x, z, ry, 0, 0.2 + i * 0.34, 0.355, 0, 0.68, 0.3, 0.02);
    addPart(b, G.box(1, 1, 1), M.metal(), x, z, ry, 0, 0.27 + i * 0.34, 0.375, 0, 0.22, 0.04, 0.03);
  }
  addPart(b, G.box(1, 1, 1), M.glow(color, 1.2), x, z, ry, 0, 1.45, 0, 0, 0.75, 0.02, 0.7);
  finish(b, item, x, z, ry, { h: 1.45, d: 0.7, w: 0.75 });
}

const ALARM_LOOK = {
  ALARM: { color: '#ff2a2a', label: 'ALARM', panel: '#3a0505' },
  OK: { color: '#2fe37a', label: 'OK', panel: '#041a0d' },
  INSUFFICIENT_DATA: { color: '#ffb020', label: 'NO DATA', panel: '#1f1503' },
  UNKNOWN: { color: '#8b95a7', label: 'UNKNOWN', panel: '#0d1117' },
};

/** The alarm's CloudWatch state (not its CloudFormation resource status). */
export function alarmState(item) {
  const s = item.info?.StateValue || item.status;
  return ALARM_LOOK[s] ? s : 'UNKNOWN';
}

function drawBell(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.45, cy + s * 0.3);
  ctx.quadraticCurveTo(cx - s * 0.36, cy + s * 0.18, cx - s * 0.34, cy - s * 0.1);
  ctx.quadraticCurveTo(cx - s * 0.3, cy - s * 0.48, cx, cy - s * 0.5);
  ctx.quadraticCurveTo(cx + s * 0.3, cy - s * 0.48, cx + s * 0.34, cy - s * 0.1);
  ctx.quadraticCurveTo(cx + s * 0.36, cy + s * 0.18, cx + s * 0.45, cy + s * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.4, s * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - s * 0.05, cy - s * 0.62, s * 0.1, s * 0.14);
  ctx.restore();
}

function annunciatorMat(state) {
  return mat(`annunciator:${state}`, () => {
    const look = ALARM_LOOK[state];
    const c = canvas(256, 192);
    const ctx = c.getContext('2d');
    ctx.fillStyle = look.panel;
    ctx.fillRect(0, 0, 256, 192);
    ctx.strokeStyle = look.color;
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 244, 180);
    if (state === 'ALARM') {
      // hazard stripes along the bottom
      ctx.save();
      ctx.beginPath();
      ctx.rect(10, 150, 236, 32);
      ctx.clip();
      for (let i = -2; i < 12; i++) {
        ctx.fillStyle = i % 2 ? '#111' : '#ffcc00';
        ctx.beginPath();
        ctx.moveTo(i * 26, 182); ctx.lineTo(i * 26 + 26, 150); ctx.lineTo(i * 26 + 52, 150); ctx.lineTo(i * 26 + 26, 182);
        ctx.fill();
      }
      ctx.restore();
    }
    drawBell(ctx, 128, 62, 70, look.color);
    ctx.fillStyle = look.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const t = fitText(ctx, look.label, 220, 64, 400, DISPLAY_FONT);
    ctx.fillText(t, 128, state === 'ALARM' ? 125 : 140);
    return new THREE.MeshBasicMaterial({ map: toTexture(c), color: new THREE.Color(1.15, 1.15, 1.15) });
  });
}

/** An alarm unit: post, annunciator panel with a bell, and a siren beacon on top. */
function alarmUnit(b, item, x, z, ry) {
  const state = alarmState(item);
  const look = ALARM_LOOK[state];
  const firing = state === 'ALARM';
  // base + post
  addPart(b, G.cyl(0.28, 0.32, 0.06, 16), M.steel(), x, z, ry, 0, 0.03, 0);
  addPart(b, G.cyl(0.045, 0.045, 1.5, 8), M.steel(), x, z, ry, 0, 0.78, 0);
  // annunciator box
  addPart(b, G.box(1, 1, 1), M.color('#c8ccd2', 0.4, 0.6), x, z, ry, 0, 1.25, 0, 0, 0.62, 0.5, 0.2);
  addPart(b, G.plane(0.54, 0.405), annunciatorMat(state), x, z, ry, 0, 1.25, 0.101);
  // siren: base, glowing dome, rotating reflector
  addPart(b, G.cyl(0.16, 0.18, 0.1, 16), M.black(), x, z, ry, 0, 1.55, 0);
  const dome = new THREE.Mesh(G.sphere(0.15, 16), M.glow(look.color, firing ? 1.6 : 0.7));
  dome.scale.set(1, 1.25, 1);
  dome.position.set(x, 1.72, z);
  b.add(dome);
  if (firing) {
    const refl = new THREE.Mesh(G.box(0.26, 0.09, 0.04), M.glow(look.color, 5));
    refl.position.set(x, 1.72, z);
    b.add(refl);
    spin(b, refl, 7);
    b.update((dt, t) => { dome.visible = Math.sin(t * 9 + x) > -0.3; });
  } else if (state === 'INSUFFICIENT_DATA') {
    b.update((dt, t) => { dome.visible = Math.sin(t * 2 + x) > -0.6; });
  }
  // floor ring in the state colour
  addPart(b, G.torus(0.42, 0.02, 6, 32), M.glow(look.color, firing ? 2 : 1), x, z, ry, 0, 0.02, 0, 0, 1, 1, 1, Math.PI / 2);
  const metric = item.info?.MetricName ? `${item.info.Namespace || ''} ${item.info.MetricName}`.trim() : null;
  finish(b, { ...item, status: state }, x, z, ry, {
    h: 1.9, d: 0.35, w: 0.65, kind: 'alarm', accent: look.color,
    labelSub: `${look.label}${metric ? ` · ${metric}` : ''}`,
  });
}

function amazonBox(b, item, x, z, ry) {
  const type = item.info?.ResourceType || item.sub || 'Resource';
  const m = mat(`cardboard:${type}`, () => new THREE.MeshStandardMaterial({ map: toTexture(cardboardCanvas(type)), roughness: 0.85 }));
  const r = rnd(item.name || type);
  const s = 0.8 + r() * 0.35;
  addPart(b, G.box(1, 1, 1), m, x, z, ry, 0, (s * 0.8) / 2, 0, (r() - 0.5) * 0.4, s, s * 0.8, s);
  if (r() > 0.5) addPart(b, G.box(1, 1, 1), m, x, z, ry, 0.1, s * 0.8 + 0.25, 0, (r() - 0.5) * 0.8, 0.6, 0.5, 0.6);
  finish(b, item, x, z, ry, { h: s * 0.8 + 0.4, d: s, w: s, kind: 'generic', accent: '#d9a45a' });
}

function switchBox(b, item, x, z, ry) {
  const color = SERVICES.net.color;
  addPart(b, G.box(1, 1, 1), M.steel(), x, z, ry, 0, 0.35, 0, 0, 0.12, 0.7, 0.12);
  addPart(b, G.box(1, 1, 1), M.metalDark(), x, z, ry, 0, 0.9, 0, 0, 1.2, 0.4, 0.8);
  for (let i = 0; i < 16; i++) {
    const [wx, wz] = toWorld(x, z, ry, -0.5 + (i % 8) * 0.14, 0.405);
    b.led(wx, 0.84 + Math.floor(i / 8) * 0.12, wz, '#2fe37a', { blink: 0.8 });
  }
  addPart(b, G.plane(0.24, 0.24), iconMat('net'), x, z, ry, 0.45, 1.13, 0.2, 0, 1, 1, 1, -Math.PI / 2);
  addPart(b, G.box(1, 1, 1), M.glow(color, 1.5), x, z, ry, 0, 1.11, 0, 0, 1.2, 0.02, 0.8);
  finish(b, item, x, z, ry, { h: 1.2, d: 0.8, w: 1.2, kind: 'net' });
}

function natBooth(b, item, x, z, ry) {
  const color = SERVICES.nat.color;
  addPart(b, G.box(1, 1, 1), M.color('#231d3a', 0.4, 0.6), x, z, ry, 0, 1.1, 0, 0, 1.3, 2.2, 1.3);
  addPart(b, G.box(1, 1, 1), M.glass(), x, z, ry, 0, 1.4, 0.66, 0, 1.0, 0.9, 0.02);
  addPart(b, G.box(1, 1, 1), M.color('#ffcc00', 0.5, 0.2), x, z, ry, 1.4, 1.0, 0.3, 0, 1.6, 0.08, 0.08);
  const dollar = new THREE.Mesh(G.plane(0.8, 0.8), mat('dollar', () => {
    const c = canvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffd34d'; ctx.font = `700 220px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('$', 128, 138);
    return new THREE.MeshBasicMaterial({ map: toTexture(c), color: new THREE.Color(2.5, 2.5, 2.5), transparent: true, side: THREE.DoubleSide, depthWrite: false });
  }));
  dollar.position.set(x, 2.75, z);
  b.add(dollar);
  spin(b, dollar, 2.5, 0.08);
  addPart(b, G.plane(0.4, 0.4), iconMat('nat'), x, z, ry, -0.35, 2.0, 0.655);
  finish(b, item, x, z, ry, { h: 3.0, d: 1.3, w: 1.3, labelSub: '$0.045/hr + $0.045/GB of pure regret' });
}

const BUILDERS = {
  lambda: lambdaCab, dynamodb: dynamoRack, rds: rdsRack, ec2: ec2Rack,
  elasticache: (b, it, x, z, ry) => rack(b, it, x, z, ry, { color: '#ff5a5a', variant: 'disks', icon: 'elasticache' }),
  ecs: ecsStack, s3: bucket, sqs: conveyor, sns: antenna, eventbridge: eventProp, sfn: flowBoard, apigw: gateway,
  cloudfront: globe, route53: dnsPillar, iam: locker, kms: vault, secrets: safe, logs: cabinet, alarm: alarmUnit,
  generic: amazonBox, net: switchBox, nat: natBooth, igw: switchBox, subnet: switchBox, vpc: switchBox,
};

export function buildProp(b, item, x, z, ry = 0) {
  (BUILDERS[item.kind] || amazonBox)(b, item, x, z, ry);
}

export function cellFor(kind) {
  return CELL[kind] || CELL.generic;
}

export function isEventBus(item) {
  return item.kind === 'eventbridge' && (/bus/i.test(item.sub || '') || item.info?.ResourceType === 'AWS::Events::EventBus');
}

/** Cell size for a specific item (event buses are vans, so they need more room than rules). */
export function cellForItem(item) {
  return isEventBus(item) ? CELL.eventbus : cellFor(item.kind);
}
