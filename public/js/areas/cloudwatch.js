import * as THREE from 'three';
import { room, M, G, screen, addLight, toWorld, signMesh } from '../kit.js';
import { SERVICES, statusColor } from '../theme.js';
import { NPC_LINES, pickRandom } from '../humor.js';
import { canvas, toTexture, fitText, FONT, DISPLAY_FONT, MONO } from '../textures.js';
import { newArea, exitDoor, useExitSpawn, npc, beacons } from './common.js';
import { esc } from '../hud.js';

const GROUP_COLORS = {
  Lambda: '#ff9900', DynamoDB: '#5b8cff', EC2: '#ffb347', RDS: '#3fb6ff', 'API Gateway': '#b77cff',
  SQS: '#ff5fb0', 'Step Functions': '#ff5fb0',
};

function niceMax(v) {
  if (!v || v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function fmt(v, unit = '') {
  if (v == null || Number.isNaN(v)) return '—';
  const u = /Percent/.test(unit) ? '%' : /Milliseconds/.test(unit) ? ' ms' : '';
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M${u}`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}k${u}`;
  return `${v >= 100 ? Math.round(v) : Number(v.toFixed(2))}${u}`;
}

export function drawGraph(ctx, W, H, g, { live = false, cursor = 1, big = false } = {}) {
  const color = GROUP_COLORS[g.group] || (g.MetricName === 'Errors' || g.MetricName === 'Throttles' ? '#ff4d4d' : '#2fe3c0');
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#07131f');
  bg.addColorStop(1, '#030810');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const pad = { l: W * 0.1, r: W * 0.04, t: H * 0.24, b: H * 0.14 };
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
  const vals = g.points || [];
  const nums = vals.filter((v) => v != null);
  const max = niceMax(Math.max(0, ...nums) * 1.1);
  // grid
  ctx.strokeStyle = 'rgba(80,140,200,0.18)';
  ctx.lineWidth = 1;
  ctx.font = `600 ${H * 0.055}px ${MONO}`;
  ctx.fillStyle = 'rgba(150,190,230,0.6)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (ph * i) / 4;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    ctx.fillText(fmt(max * (1 - i / 4)), pad.l - 6, y);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ['-6h', '-4h', '-2h', 'now'].forEach((l, i) => ctx.fillText(l, pad.l + (pw * i) / 3, H - pad.b + 4));
  // series
  const n = vals.length;
  const xy = (i, v) => [pad.l + (pw * i) / Math.max(1, n - 1), pad.t + ph * (1 - v / max)];
  const visible = Math.max(2, Math.round(n * cursor));
  if (nums.length) {
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < visible; i++) {
      if (vals[i] == null) continue;
      const [x, y] = xy(i, vals[i]);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    const last = xy(visible - 1, 0);
    ctx.save();
    ctx.lineTo(last[0], pad.t + ph);
    ctx.lineTo(pad.l, pad.t + ph);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph);
    fill.addColorStop(0, `${color}66`);
    fill.addColorStop(1, `${color}05`);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    started = false;
    for (let i = 0; i < visible; i++) {
      if (vals[i] == null) continue;
      const [x, y] = xy(i, vals[i]);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = big ? 4 : 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  // title & value
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#e8f2ff';
  ctx.fillText(fitText(ctx, g.title, W * 0.68, H * 0.085, 700, FONT), W * 0.03, H * 0.035);
  ctx.fillStyle = 'rgba(150,190,230,0.75)';
  ctx.font = `500 ${H * 0.05}px ${MONO}`;
  ctx.fillText(`${g.Namespace || ''} · ${g.Statistic || ''} · 5m`, W * 0.03, H * 0.13);
  const lastVal = [...nums].pop();
  ctx.textAlign = 'right';
  ctx.fillStyle = color;
  ctx.font = `400 ${H * 0.13}px ${DISPLAY_FONT}`;
  ctx.fillText(fmt(lastVal, g.unit), W * 0.97, H * 0.03);
  if (live) {
    ctx.fillStyle = '#ff3b3b';
    ctx.beginPath();
    ctx.arc(W * 0.72, H * 0.08, H * 0.022, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `700 ${H * 0.05}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('LIVE', W * 0.74, H * 0.055);
  }
  if (!g.hasData) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(pad.l, pad.t, pw, ph);
    ctx.fillStyle = '#7f93ad';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `400 ${H * 0.12}px ${DISPLAY_FONT}`;
    ctx.fillText('NO DATAPOINTS', W / 2, pad.t + ph / 2);
    ctx.font = `600 ${H * 0.05}px ${FONT}`;
    ctx.fillText('(very quiet… too quiet)', W / 2, pad.t + ph / 2 + H * 0.1);
  }
}

function drawAlarmBoard(ctx, W, H, alarms, page, pages) {
  ctx.fillStyle = '#050a12';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e8f2ff';
  ctx.font = `400 ${H * 0.1}px ${DISPLAY_FONT}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(`ALARMS ${page}/${pages}`, W * 0.03, H * 0.03);
  const rowH = (H * 0.82) / 8;
  alarms.forEach((a, i) => {
    const y = H * 0.16 + i * rowH;
    const c = statusColor(a.status);
    ctx.fillStyle = a.status === 'ALARM' ? 'rgba(255,40,40,0.25)' : 'rgba(255,255,255,0.03)';
    ctx.fillRect(W * 0.02, y + 2, W * 0.96, rowH - 4);
    ctx.fillStyle = c;
    ctx.fillRect(W * 0.02, y + 2, 8, rowH - 4);
    ctx.fillStyle = '#e8f2ff';
    ctx.font = `600 ${rowH * 0.55}px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(fitText(ctx, a.name, W * 0.66, rowH * 0.55, 600), W * 0.05, y + rowH / 2);
    ctx.fillStyle = c;
    ctx.textAlign = 'right';
    ctx.fillText(a.status === 'INSUFFICIENT_DATA' ? 'NO DATA' : a.status, W * 0.96, y + rowH / 2);
    ctx.textAlign = 'left';
  });
}

const FILLERS = [
  ['COST EXPLORER', ['[REDACTED]', 'Each request costs $0.01.', 'We said no-cost. We meant it.'], '#ffd34d'],
  ['LOGS INSIGHTS', ['Query running since 2021…', '██████████░░░░░ 67%', 'Scanned 4.2 PB. Found: "null"'], '#9fd6ff'],
  ['AWS HEALTH', ['All systems operational.', '(according to the status page)', 'Source: trust me bro'], '#2fe37a'],
  ['TRUSTED ADVISOR', ['14 recommendations', '0 read', '1 ignored with prejudice'], '#ff9900'],
  ['X-RAY', ['Trace 1-5f8a…', 'Segment depth: ∞', 'It is microservices all the way down'], '#b77cff'],
  ['SLA', ['99.99%', '(rounded up)', '(from 97.2%)'], '#2fe37a'],
  ['ON-CALL ROTA', ['Mon: you', 'Tue: you', 'Wed–Sun: also you'], '#ff5fb0'],
  ['us-east-1', ['STATUS: 🟢', 'Confidence: low', 'Have a fallback region ready'], '#ff9900'],
];

function drawFiller(ctx, W, H, [title, lines, color], extra) {
  ctx.fillStyle = '#04080e';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, W - 12, H - 12);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `400 ${H * 0.16}px ${DISPLAY_FONT}`;
  ctx.fillText(title, W / 2, H * 0.22);
  ctx.fillStyle = '#d6e4f5';
  ctx.font = `600 ${H * 0.085}px ${FONT}`;
  (extra || lines).forEach((l, i) => ctx.fillText(fitText(ctx, l, W * 0.9, H * 0.085, 600), W / 2, H * (0.46 + i * 0.15)));
}

function drawStatic(ctx, W, H) {
  const img = ctx.createImageData(W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 180;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, H * 0.4, W, H * 0.2);
  ctx.fillStyle = '#fff';
  ctx.font = `400 ${H * 0.13}px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('NO SIGNAL', W / 2, H / 2);
}

let scanTex;
function scanlineMaterial() {
  if (!scanTex) {
    const c = canvas(4, 64);
    const ctx = c.getContext('2d');
    for (let y = 0; y < 64; y++) {
      ctx.fillStyle = y % 4 < 2 ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0)';
      ctx.fillRect(0, y, 4, 1);
    }
    ctx.fillStyle = 'rgba(160,220,255,0.08)';
    ctx.fillRect(0, 20, 4, 10);
    scanTex = toTexture(c, { repeat: [1, 8] });
  }
  return new THREE.MeshBasicMaterial({ map: scanTex, transparent: true, depthWrite: false });
}

export async function cloudwatchRoom(world) {
  const svc = SERVICES.alarm;
  let metrics = world.cache.get('metrics');
  if (!metrics) {
    try {
      metrics = await world.api.metrics();
      world.cache.set('metrics', metrics);
    } catch (e) {
      metrics = { graphs: [], errors: [e.message] };
    }
  }
  const graphs = metrics.graphs || [];
  const alarms = [...(world.data.services.alarm?.items || [])].sort((a, b) => (a.status === 'ALARM' ? -1 : 0) - (b.status === 'ALARM' ? -1 : 0));
  const firing = alarms.filter((a) => a.status === 'ALARM').length;

  const W = 54, D = 42, H = 10;
  const b = newArea({
    id: 'cloudwatch', title: svc.room,
    subtitle: `${graphs.length} live graphs · ${alarms.length} alarms · ${firing} in ALARM`,
    color: firing ? '#ff3b3b' : '#3fb6ff',
  });
  room(b, {
    w: W, d: D, h: H, accent: '#3fb6ff', floorTint: '#141a24', wallTint: '#0a0d13', perforated: 0.05, lightRows: false,
    doors: [exitDoor({ spec: { type: 'lobby' }, spawn: 'door:cloudwatch' })],
  });
  useExitSpawn(b);
  b.lighting = { hemi: 0.22, sun: 0.12, env: 0.18, exposure: 1.0 };
  b.fog = { color: '#03060a', near: 20, far: 90 };

  // --- video walls -------------------------------------------------------
  const SW = 3.6, SH = 2.05, GAP = 0.22, ROWS = [2.25, 4.55, 6.85];
  const slots = [];
  const colsN = Math.floor((W - 3) / (SW + GAP));
  for (let c = 0; c < colsN; c++) {
    const x = -((colsN - 1) * (SW + GAP)) / 2 + c * (SW + GAP);
    slots.push({ x, z: -D / 2 + 0.22, ry: 0, col: `N${c + 1}` });
  }
  const sideN = Math.floor((D - 10) / (SW + GAP));
  for (const side of [-1, 1]) {
    for (let c = 0; c < sideN; c++) {
      const z = -D / 2 + 3 + SW / 2 + c * (SW + GAP);
      slots.push({ x: side * (W / 2 - 0.22), z, ry: side < 0 ? Math.PI / 2 : -Math.PI / 2, col: `${side < 0 ? 'W' : 'E'}${c + 1}` });
    }
  }

  // Content queue: graphs (account-level ones go on the jumbotron too), alarm boards, fillers.
  const content = [];
  graphs.forEach((g) => content.push({ type: 'graph', g }));
  for (let i = 0; i < alarms.length; i += 8) content.push({ type: 'alarms', list: alarms.slice(i, i + 8), page: i / 8 + 1, pages: Math.ceil(alarms.length / 8) });
  content.push({ type: 'filler', f: ['BUDGET', [], '#ffd34d'], extra: [`GetMetricStatistics this session:`, `${metrics.callsUsed ?? 0} calls${metrics.cached ? ' (cached)' : ''}`, `${metrics.budgetLeft ?? '?'} left of the free-tier-safe cap`] });
  if (metrics.errors?.length) content.push({ type: 'filler', f: ['METRIC ERRORS', [], '#ff4d4d'], extra: metrics.errors.slice(0, 3) });
  let fi = 0;
  const total = slots.length * ROWS.length;
  while (content.length < total) {
    content.push(fi % 3 === 2 ? { type: 'static' } : { type: 'filler', f: FILLERS[fi % FILLERS.length] });
    fi++;
  }

  const scan = scanlineMaterial();
  b.track(scan);
  const liveScreens = [];
  const staticScreens = [];
  const columns = [];
  slots.forEach((s, si) => {
    const colContent = [];
    ROWS.forEach((y, ri) => {
      const ci = ri * slots.length + si;
      const item = content[ci];
      const scr = screen(b, SW, SH, { px: 512, glow: 1.25 });
      const draw = (opts) => {
        const { ctx, canvas: cv } = scr;
        if (item.type === 'graph') drawGraph(ctx, cv.width, cv.height, item.g, opts);
        else if (item.type === 'alarms') drawAlarmBoard(ctx, cv.width, cv.height, item.list, item.page, item.pages);
        else if (item.type === 'static') drawStatic(ctx, cv.width, cv.height);
        else drawFiller(ctx, cv.width, cv.height, item.f, item.extra);
        scr.redraw();
      };
      draw({ live: true });
      const [wx, wz] = toWorld(s.x, s.z, s.ry, 0, 0.06);
      scr.mesh.position.set(wx, y, wz);
      scr.mesh.rotation.y = s.ry;
      b.add(scr.mesh);
      const sl = new THREE.Mesh(G.plane(SW, SH), scan);
      const [lx, lz] = toWorld(s.x, s.z, s.ry, 0, 0.075);
      sl.position.set(lx, y, lz);
      sl.rotation.y = s.ry;
      b.add(sl);
      b.inst(G.box(1, 1, 1), M.black(), s.x, y, s.z, s.ry, SW + 0.14, SH + 0.14, 0.1);
      if (item.type === 'graph') liveScreens.push({ draw, item, scr });
      if (item.type === 'static') staticScreens.push({ draw });
      colContent.push({ item, scr });
    });
    columns.push(colContent);
    // one interactable per column of screens
    const [ix, iz] = toWorld(s.x, s.z, s.ry, 0, 1.4);
    b.interact({
      x: ix, z: iz, y: 2, radius: 2.6, kind: 'alarm', title: `Video wall ${s.col}`, sub: colContent.map((c) => c.item.g?.title || c.item.type).filter(Boolean).join(' · ').slice(0, 70),
      onUse: (w) => showColumn(w, colContent, s.col),
    });
  });
  // wall top glow strips
  b.inst(G.box(1, 1, 1), M.glow('#3fb6ff', 1.5), 0, 8.15, -D / 2 + 0.25, 0, W - 2, 0.05, 0.05);

  // --- the jumbotron -----------------------------------------------------
  const jumbo = new THREE.Group();
  jumbo.position.set(0, 6.6, 0);
  b.add(jumbo);
  const JW = 5.2, JH = 2.9;
  const jBody = new THREE.Mesh(G.box(JW + 0.2, JH + 0.3, JW + 0.2), M.color('#05070a', 0.95, 0));
  jumbo.add(jBody);
  const jumboGraphs = graphs.slice(0, 4);
  for (let i = 0; i < 4; i++) {
    const g = jumboGraphs[i] || { title: 'Account health', points: [], hasData: false, group: 'Lambda' };
    const scr = screen(b, JW, JH, { px: 768, glow: 1.35 });
    drawGraph(scr.ctx, scr.canvas.width, scr.canvas.height, g, { live: true, big: true });
    scr.redraw();
    const a = (i * Math.PI) / 2;
    scr.mesh.position.set(Math.sin(a) * (JW / 2 + 0.11), 0, Math.cos(a) * (JW / 2 + 0.11));
    scr.mesh.rotation.y = a;
    jumbo.add(scr.mesh);
    if (g.points?.length) liveScreens.push({ draw: (o) => { drawGraph(scr.ctx, scr.canvas.width, scr.canvas.height, g, { ...o, big: true }); scr.redraw(); }, item: { g } });
  }
  const trim = M.glow(firing ? '#ff3b3b' : '#3fb6ff', 2);
  [-1, 1].forEach((s) => [0, 1, 2, 3].forEach((i) => {
    const bar = new THREE.Mesh(G.box(JW + 0.34, 0.08, 0.08), trim);
    const a = (i * Math.PI) / 2;
    bar.position.set(Math.sin(a) * (JW / 2 + 0.13), s * (JH / 2 + 0.17), Math.cos(a) * (JW / 2 + 0.13));
    bar.rotation.y = a;
    jumbo.add(bar);
  }));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => b.inst(G.cyl(0.03, 0.03, H - 8.2, 6), M.steel(), sx * 2, 8.1 + (H - 8.1) / 2, sz * 2));
  b.update((dt) => { jumbo.rotation.y += dt * 0.12; });

  // --- mission-control desks --------------------------------------------
  const centre = [0, -27];
  const deskAlarms = alarms.slice(0, 80);
  let ai = 0;
  [19, 24, 29].forEach((r, ri) => {
    const span = 0.62 - ri * 0.06;
    const n = Math.floor((2 * span * r) / 2.7);
    for (let k = 0; k < n; k++) {
      const phi = -span + ((k + 0.5) * 2 * span) / n;
      const x = centre[0] + Math.sin(phi) * r, z = centre[1] + Math.cos(phi) * r;
      const ry = phi;
      b.inst(G.box(1, 1, 1), M.color('#1d2430', 0.4, 0.5), x, 0.75, z, ry, 2.4, 0.06, 0.95);
      b.inst(G.box(1, 1, 1), M.metalDark(), x, 0.37, z, ry, 2.3, 0.72, 0.85);
      const [gx, gz] = toWorld(x, z, ry, 0, 0.48);
      b.inst(G.box(1, 1, 1), M.glow('#3fb6ff', 1.4), gx, 0.76, gz, ry, 2.4, 0.03, 0.02);
      b.collideRect(x, z, 2.4, 0.95, ry);
      // chair
      const [cx, cz] = toWorld(x, z, ry, 0.3, 1.1);
      b.inst(G.box(1, 1, 1), M.color('#2a2f38', 0.6, 0.2), cx, 0.5, cz, ry, 0.55, 0.08, 0.55);
      const [bx, bz] = toWorld(x, z, ry, 0.3, 1.36);
      b.inst(G.box(1, 1, 1), M.color('#2a2f38', 0.6, 0.2), bx, 0.85, bz, ry, 0.55, 0.65, 0.07);
      b.inst(G.cyl(0.04, 0.04, 0.45, 6), M.steel(), cx, 0.25, cz);
      // two monitors per desk, facing the operator
      [-0.55, 0.55].forEach((lx) => {
        const alarm = deskAlarms[ai++];
        const [mx, mz] = toWorld(x, z, ry, lx, -0.15);
        b.inst(G.box(1, 1, 1), M.black(), mx, 1.12, mz, ry, 0.95, 0.58, 0.05);
        const scr = screen(b, 0.88, 0.5, { px: 256, glow: 1.2 });
        const { ctx, canvas: cv } = scr;
        if (alarm) {
          const c = statusColor(alarm.status);
          ctx.fillStyle = alarm.status === 'ALARM' ? '#3a0606' : '#04120a';
          ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.fillStyle = c;
          ctx.font = `400 46px ${DISPLAY_FONT}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(alarm.status === 'INSUFFICIENT_DATA' ? 'NO DATA' : alarm.status, 128, 52);
          ctx.fillStyle = '#e8f2ff';
          ctx.fillText(fitText(ctx, alarm.name, 240, 24, 700), 128, 110);
        } else {
          const g = graphs[(ai * 7) % Math.max(1, graphs.length)];
          if (g) drawGraph(ctx, cv.width, cv.height, g);
          else drawStatic(ctx, cv.width, cv.height);
        }
        scr.redraw();
        const [sx, sz] = toWorld(x, z, ry, lx, -0.12);
        scr.mesh.position.set(sx, 1.12, sz);
        scr.mesh.rotation.y = ry;
        b.add(scr.mesh);
        if (alarm?.status === 'ALARM') b.update((dt, t) => scr.mesh.material.color.setScalar(Math.sin(t * 7) > 0 ? 1.8 : 0.6));
        if (alarm) {
          const [ix, iz] = toWorld(x, z, ry, lx, 0.9);
          b.interact({ x: ix, z: iz, y: 1.1, radius: 1.6, kind: 'alarm', title: alarm.name, sub: alarm.status, item: alarm });
        }
      });
    }
  });

  const s1 = signMesh(b, { title: 'CloudWatch Surveillance Center', subtitle: 'We are watching. Mostly the 5xx graph.', icon: 'alarm', color: firing ? '#ff3b3b' : '#3fb6ff' }, 12, 3);
  s1.position.set(0, 8.95, -D / 2 + 0.2);
  s1.scale.setScalar(0.62);
  b.add(s1);

  npc(b, { name: 'On-call Engineer', style: { shirt: '#3b3f4a', vest: false, hatOn: false, hair: '#2b1d12' }, x: -3, z: -6.5, yaw: Math.PI, lines: NPC_LINES['On-call Engineer'] });
  npc(b, { name: 'On-call Engineer (backup)', style: { shirt: '#5a2a3a', vest: false, hatOn: false, hair: '#111' }, x: 6, z: 0, yaw: Math.PI, lines: NPC_LINES['On-call Engineer'], wander: { minX: -15, maxX: 15, minZ: 6, maxZ: 14 } });

  if (firing) {
    beacons(b, [[-W / 2 + 2, H - 0.6, -D / 2 + 2], [W / 2 - 2, H - 0.6, -D / 2 + 2], [-W / 2 + 2, H - 0.6, D / 2 - 2], [W / 2 - 2, H - 0.6, D / 2 - 2]]);
  }
  addLight(b, 0, 5, -D / 2 + 4, '#3fb6ff', 40, 30);
  addLight(b, 0, 4, 10, '#6a8cff', 15, 25);

  // "Live" refresh: redraw a graph every so often with the cursor sweeping
  let acc = 0, k = 0;
  b.update((dt, t) => {
    acc += dt;
    if (acc > 0.5 && liveScreens.length) {
      acc = 0;
      const s = liveScreens[k++ % liveScreens.length];
      s.draw({ live: Math.floor(t * 2) % 2 === 0 });
    }
    if (staticScreens.length && Math.floor(t * 10) % 3 === 0) staticScreens[Math.floor(Math.random() * staticScreens.length)].draw();
  });

  b.onEnter = (w) => {
    if (metrics.demo) w.hud.notify('CloudWatch', 'Demo mode: these graphs are simulated. Real accounts get real GetMetricStatistics data.', 'alarm');
    else w.hud.notify('CloudWatch', `${graphs.length} graphs via GetMetricStatistics (${metrics.cached ? 'cached, 0 new calls' : `${metrics.callsUsed} calls`}; ${metrics.budgetLeft} left this session).`, 'alarm');
    if (firing) setTimeout(() => w.hud.notify('PagerDuty', `${firing} alarm(s) firing. Wanted level: ${'★'.repeat(Math.min(5, firing))}`, 'alarm'), 2500);
  };
  return b.finalize();
}

function showColumn(world, col, name) {
  const parts = col.map(({ item, scr }) => {
    const img = scr.canvas.toDataURL();
    let detail = '';
    if (item.type === 'graph') {
      const nums = item.g.points.filter((v) => v != null);
      const avg = nums.length ? nums.reduce((a, b2) => a + b2, 0) / nums.length : null;
      detail = `<table><tr><th>Metric</th><td>${esc(item.g.Namespace)} ${esc(item.g.MetricName)}</td></tr>
        <tr><th>Dimensions</th><td>${esc((item.g.Dimensions || []).map((d) => `${d.Name}=${d.Value}`).join(', ') || '(account level)')}</td></tr>
        <tr><th>Min / Avg / Max</th><td>${nums.length ? `${fmt(Math.min(...nums))} / ${fmt(avg)} / ${fmt(Math.max(...nums))} ${esc(item.g.unit || '')}` : '—'}</td></tr>
        <tr><th>Datapoints</th><td>${nums.length} (5-minute periods, last 6 hours)</td></tr></table>`;
    } else if (item.type === 'alarms') {
      detail = `<table>${item.list.map((a) => `<tr><th style="color:${statusColor(a.status)}">${esc(a.status)}</th><td>${esc(a.name)}</td></tr>`).join('')}</table>`;
    }
    return `<div class="screen-shot"><img src="${img}">${detail}</div>`;
  }).join('');
  world.inspect({ name: `Video wall ${name}`, kind: 'alarm', sub: 'Three screens, zero context', info: {} }, { extra: parts });
}
