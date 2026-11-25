import * as THREE from 'three';
import { room, M, G, pillar, plant, poster, kiosk, textPanel, addLight, cableTray, signMesh, toWorld } from '../kit.js';
import { SERVICES } from '../theme.js';
import { POSTERS, NPC_LINES, TIPS, pickRandom } from '../humor.js';
import { canvas, toTexture, drawAwsLogo } from '../textures.js';
import { buildProp, cellFor, cellForItem } from '../props.js';
import { newArea, exitDoor, useExitSpawn, gridLayout, npc } from './common.js';

// Lobby door layout. Keys are service registry keys; specials get their own areas.
const NORTH = ['lambda', 'ecs', 'dynamodb', '@vpc', '@cfn', '@cloudwatch', 'rds', 'elasticache', 's3'];
const WEST = ['sqs', 'sns', 'eventbridge', 'sfn', 'apigw', 'cloudfront'];
const EAST = ['route53', 'iam', 'kms', 'secrets', 'logs'];

function serviceDoor(world, key, side, at) {
  const svc = SERVICES[key];
  const data = world.data.services[key];
  const n = data?.items?.length ?? 0;
  const denied = data?.error?.code === 'ACCESS_DENIED';
  let subtitle = `${n} ${n === 1 ? 'resource' : 'resources'}${data?.viaCloudFormation ? ' · via CloudFormation' : ''}`;
  if (data?.error && !denied) subtitle = `⚠ ${data.error.code}`;
  return {
    side, at, id: `svc-${key}`, title: svc.short, subtitle, icon: key, color: svc.color,
    locked: denied, lockedReason: denied ? `403 AccessDenied — your role cannot list ${svc.title}. Your badge does not open this door.` : undefined,
    target: { spec: { type: 'service', key }, spawn: 'default' },
  };
}

function specialDoor(world, key, side, at) {
  const S = {
    '@cfn': { id: 'cfn', title: 'CloudFormation Stacks', subtitle: `${world.data.services.cfn?.items?.length ?? 0} stacks`, icon: 'cfn', color: SERVICES.cfn.color, spec: { type: 'cfnHall' }, width: 3.4, height: 3.6 },
    '@vpc': { id: 'vpc', title: 'VPC Air Tunnel', subtitle: `${world.data.services.vpc?.items?.length ?? 0} VPCs · cold aisle`, icon: 'vpc', color: '#5ad1ff', spec: { type: 'vpcTunnel' } },
    '@cloudwatch': { id: 'cloudwatch', title: 'CloudWatch', subtitle: `Surveillance center · ${world.alarmCount} in ALARM`, icon: 'alarm', color: SERVICES.alarm.color, spec: { type: 'cloudwatch' } },
  }[key];
  return { side, at, ...S, target: { spec: S.spec, spawn: 'default' } };
}

function spread(list, len, margin = 5) {
  if (list.length === 1) return [0];
  const span = len - margin * 2;
  return list.map((_, i) => -span / 2 + (span * i) / (list.length - 1));
}

function awsLogoMaterial() {
  const c = canvas(1024, 512);
  drawAwsLogo(c.getContext('2d'), 112, 40, 800);
  const t = toTexture(c);
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false, color: new THREE.Color(1.05, 1.05, 1.05) });
}

export async function lobby(world) {
  const W = 64, D = 44, H = 8;
  const b = newArea({ id: 'lobby', title: 'Data Center Lobby', subtitle: `${world.data.meta.region} · Availability Zone "Reception-1a"`, color: '#ff9900' });
  const doors = [
    ...NORTH.map((k, i) => (k.startsWith('@') ? specialDoor(world, k, 'n', spread(NORTH, W, 5)[i]) : serviceDoor(world, k, 'n', spread(NORTH, W, 5)[i]))),
    ...WEST.map((k, i) => serviceDoor(world, k, 'w', spread(WEST, D, 6)[i])),
    ...EAST.map((k, i) => serviceDoor(world, k, 'e', spread(EAST, D, 6)[i])),
    { side: 's', at: 24, id: 'graveyard', title: 'Service Graveyard', subtitle: 'Emergency exit · RIP', icon: 'grave', color: '#9aa3b5', target: { spec: { type: 'graveyard' }, spawn: 'default' } },
    { side: 's', at: 0, id: 'main-exit', title: 'Exit', subtitle: 'You can check out any time you like…', icon: 'generic', color: '#ff2d2d', locked: true, lockedReason: '…but you can never leave. (Hotel us-east-1. Also: your on-call shift is not over.)' },
  ];
  room(b, { w: W, d: D, h: H, doors, floorTint: '#20252e', wallTint: '#151a22', accent: '#ff9900', perforated: 0 });
  b.spawn('default', 0, 15, 0);

  // Reception desk arc around the security guard
  const deskC = [0, -3];
  for (let i = 0; i <= 6; i++) {
    const th = THREE.MathUtils.degToRad(30 + i * 20);
    const x = deskC[0] + Math.cos(th) * 3, z = deskC[1] + Math.sin(th) * 3;
    const ry = -th - Math.PI / 2;
    b.inst(G.box(1, 1, 1), M.color('#e9edf2', 0.25, 0.3), x, 0.55, z, ry, 1.15, 1.1, 0.6);
    b.inst(G.box(1, 1, 1), M.glow('#ff9900', 2), x, 1.12, z, ry, 1.15, 0.04, 0.62);
    b.inst(G.box(1, 1, 1), M.color('#232f3e', 0.4, 0.4), x, 0.55, z, ry, 1.0, 0.6, 0.62);
    b.collideRect(x, z, 1.1, 1.1);
  }
  npc(b, { name: 'Security Guard', style: { shirt: '#1b2a44', vest: false, hat: '#1b2a44', hatType: 'cap', pants: '#141b28' }, x: 0, z: -3.6, yaw: Math.PI, lines: NPC_LINES['Security Guard'], radius: 5.2 });
  b.collideRect(0, -3.6, 0.8, 0.8);

  // Floating AWS logo
  const logo = new THREE.Mesh(G.plane(7, 3.5), awsLogoMaterial());
  logo.position.set(0, 5.6, -3);
  b.add(logo);
  b.track(logo.material.map, logo.material);
  b.update((dt, t) => { logo.rotation.y = Math.sin(t * 0.3) * 0.6; logo.position.y = 5.6 + Math.sin(t * 0.8) * 0.12; });
  const ring = new THREE.Mesh(G.torus(6, 0.05, 6, 80), M.glow('#ff9900', 2.2));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.03, -3);
  b.add(ring);
  addLight(b, 0, 6, -3, '#ffb35c', 60, 26);

  [[-16, -8], [16, -8], [-16, 8], [16, 8]].forEach(([x, z]) => pillar(b, x, z, H));
  [[-29, 19], [29, 19], [-29, -19], [29, -19], [-8, 19], [8, 19]].forEach(([x, z]) => plant(b, x, z, 1.1));

  // Account dashboard on the south wall
  const s = world.data.services;
  const count = (k) => s[k]?.items?.length ?? 0;
  const dash = textPanel(b, [
    [`Account   ${world.data.meta.accountId}`, '#ffd28a'],
    [`Profile   ${world.data.meta.profile}   Region ${world.data.meta.region}`, '#cfe3ff'],
    [`Identity  ${String(world.data.meta.arn || '').split('/').slice(-2).join('/')}`, '#9fb0c6'],
    '',
    `Lambda ${count('lambda')}   DynamoDB ${count('dynamodb')}   RDS ${count('rds')}   ECS ${count('ecs')}`,
    `VPCs ${count('vpc')}   Stacks ${count('cfn')}   IAM ${count('iam')}   APIs ${count('apigw')}`,
    `Alarms ${count('alarm')}   in ALARM: ${world.alarmCount}`,
    '',
    ['Uptime: 99.99% (rounded up)', '#2fe37a'],
    ['Days since last "it\'s DNS": 0', '#ff8080'],
  ], { w: 9, h: 4.6, title: 'Account status board', color: '#ff9900', size: 30 });
  dash.position.set(-14, 3.6, D / 2 - 0.17);
  dash.rotation.y = Math.PI;
  b.add(dash);
  b.interact({ x: -14, z: D / 2 - 2, y: 2, kind: 'generic', title: 'Account status board', radius: 3.5, item: { name: 'Account status board', kind: 'generic', id: world.data.meta.accountId, info: world.data.meta } });

  // Posters
  const posters = [...POSTERS].sort(() => Math.random() - 0.5);
  let pi = 0;
  [-27, -21.5, -6.5, 6.5, 11.5, 16.5].forEach((x) => poster(b, x, 2.4, D / 2 - 0.17, Math.PI, ...posters[pi++ % posters.length]));
  [-12.8, 0, 12.8].forEach((z) => poster(b, -W / 2 + 0.17, 2.2, z, Math.PI / 2, ...posters[pi++ % posters.length]));
  [-12, 12].forEach((z) => poster(b, W / 2 - 0.17, 2.2, z, -Math.PI / 2, ...posters[pi++ % posters.length]));

  // Elastic Coffee Service
  kiosk(b, 22, 15, -Math.PI / 2 - 0.4, {
    title: 'Elastic Coffee', color: '#c27a3b',
    lines: ['Spot pricing: $0.0001/cup', 'May be interrupted with', '2 minutes notice.', '', 'Decaf: deprecated.'],
    interact: { kind: 'generic', title: 'Elastic Coffee Service', sub: 'ECS (no, the other one)', prompt: 'Order a', onUse: (w) => w.hud.notify('Elastic Coffee Service', pickRandom(['Your Spot coffee was interrupted. Here is half a cup.', 'Cold brew provisioned. Cold start: 4 minutes.', 'Throttled: too many requests from the 3rd floor.', 'Your latte has been placed in a FIFO queue. Position: 9,214.']), 'generic') },
  });

  // Snowball, ice ice baby
  const ball = new THREE.Group();
  const shell = new THREE.Mesh(G.box(0.7, 0.9, 0.5), M.color('#c9ced6', 0.35, 0.5));
  shell.position.y = 0.55;
  const stripe = new THREE.Mesh(G.box(0.72, 0.08, 0.52), M.glow('#ff9900', 1.8));
  stripe.position.y = 0.8;
  const eink = new THREE.Mesh(G.plane(0.3, 0.2), M.glow('#9fd6ff', 1.2));
  eink.position.set(0, 0.6, -0.26);
  eink.rotation.y = Math.PI;
  [-0.25, 0.25].forEach((wx) => [-0.15, 0.15].forEach((wz) => {
    const wheel = new THREE.Mesh(G.cyl(0.08, 0.08, 0.06, 12), M.black());
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.08, wz);
    ball.add(wheel);
  }));
  ball.add(shell, stripe, eink);
  b.add(ball);
  const snowIt = b.interact({ x: 8, z: 4, kind: 'generic', title: 'AWS Snowball', sub: 'ice ice baby', radius: 2.2, prompt: 'Pat the', onUse: (w) => w.hud.say('AWS Snowball', pickRandom(['Beep. I contain 80 TB of someone\'s "temporary" backups.', 'Stop, collaborate and listen. Snowball is back with a brand new edition.', 'I was shipped here by FedEx. Do not tell Snowmobile.'])) });
  b.update((dt, t) => {
    const x = Math.sin(t * 0.21) * 12, z = 6 + Math.sin(t * 0.37) * 4;
    const dx = Math.cos(t * 0.21) * 0.21 * 12, dz = Math.cos(t * 0.37) * 0.37 * 4;
    ball.position.set(x, 0, z);
    ball.rotation.y = Math.atan2(-dx, -dz);
    snowIt.pos.set(x, 1, z);
  });

  const avoidDesk = (x, z) => Math.hypot(x - deskC[0], z - deskC[1]) < 5.5;
  const area = { minX: -26, maxX: 26, minZ: -15, maxZ: 15, avoid: avoidDesk };
  npc(b, { name: 'Solutions Architect', style: { shirt: '#3a5f8f', vest: false, hatOn: false, hair: '#5a3a22' }, x: -10, z: 6, wander: area, lines: NPC_LINES['Solutions Architect'] });
  npc(b, { name: 'Intern', style: { shirt: '#7aa116', vest: true, hat: '#ff9900' }, x: 10, z: -10, wander: area, lines: NPC_LINES.Intern, speed: 1.8 });
  npc(b, { name: 'Developer Advocate', style: { shirt: '#e7157b', vest: false, hatOn: false, hair: '#222' }, x: 14, z: 10, wander: area, lines: NPC_LINES['Developer Advocate'] });

  for (let x = -24; x <= 24; x += 12) cableTray(b, x, -18, x, 18, 6.8);
  addLight(b, -20, 6, 0, '#9fc8ff', 30, 30);
  addLight(b, 20, 6, 0, '#9fc8ff', 30, 30);

  b.onEnter = (w) => {
    if (!w.greeted) {
      w.greeted = true;
      setTimeout(() => w.hud.notify('Your manager', 'Welcome to your first shift! You have ReadOnlyAccess. Please keep it that way.', 'iam'), 1500);
      setTimeout(() => w.hud.notify('Tip', 'WASD to move, mouse to look, E to inspect, V for bird\'s eye view, H for help.', 'generic'), 5000);
    } else if (Math.random() < 0.3) w.hud.notify('Tip', pickRandom(TIPS), 'generic');
  };
  return b.finalize();
}

// ---------------------------------------------------------------------------

const RACKISH = new Set(['lambda', 'dynamodb', 'rds', 'elasticache', 'iam', 'logs', 'ec2']);
const CAP = 260;

export async function serviceRoom(world, spec) {
  const key = spec.key;
  const svc = SERVICES[key];
  const data = world.data.services[key] || { items: [] };
  const all = data.items || [];
  const items = all.slice(0, CAP);
  // Items that need a bigger cell (e.g. event-bus camper vans) get their own rows up front.
  const big = items.filter((it) => cellForItem(it) !== cellFor(key));
  const small = items.filter((it) => cellForItem(it) === cellFor(key));
  const [cw, cd] = cellFor(key);
  const [bw, bd] = big.length ? cellForItem(big[0]) : [0, 0];
  const L = gridLayout(Math.max(small.length, 1), cw, cd);
  const BL = big.length ? gridLayout(big.length, bw, bd, { maxCols: Math.max(1, Math.floor(Math.max(L.w, 18) / bw)) }) : { w: 0, d: 0, cols: 1 };
  if (big.length) BL.d += 1.5;
  const W = Math.max(22, L.w + 9, BL.w + 9), D = Math.max(20, L.d + BL.d + 14);
  const b = newArea({
    id: `svc:${key}`, title: svc.room,
    subtitle: `${all.length} ${all.length === 1 ? 'resource' : 'resources'}${data.viaCloudFormation ? ' · discovered via CloudFormation' : ''}`,
    color: svc.color,
  });
  room(b, {
    w: W, d: D, h: 5.5, accent: svc.color, floorTint: '#1f252f', perforated: RACKISH.has(key) ? 0.35 : 0.1,
    doors: [exitDoor({ spec: { type: 'lobby' }, spawn: `door:svc-${key}` })],
  });
  useExitSpawn(b);

  big.forEach((it, i) => {
    const c = i % BL.cols, r = Math.floor(i / BL.cols);
    const n = Math.min(BL.cols, big.length - r * BL.cols);
    buildProp(b, it, -(n * bw) / 2 + bw / 2 + c * bw, -D / 2 + 4.2 + bd / 2 + r * bd, 0);
  });
  const x0 = -L.w / 2 + cw / 2, z0 = -D / 2 + 4.2 + BL.d + cd / 2;
  small.forEach((it, i) => {
    const c = i % L.cols, r = Math.floor(i / L.cols);
    const ry = RACKISH.has(key) && r % 2 === 1 ? Math.PI : 0;
    buildProp(b, it, x0 + c * cw, z0 + r * cd, ry);
  });
  if (RACKISH.has(key) && items.length) {
    for (let r = 0; r < L.rows; r++) cableTray(b, -L.w / 2 - 0.5, z0 + r * cd, L.w / 2 + 0.5, z0 + r * cd, 3.4);
  }

  const sign = signMesh(b, { title: svc.room, subtitle: svc.flavor, icon: key, color: svc.color }, Math.min(W - 4, 13), Math.min(W - 4, 13) / 4);
  sign.position.set(0, 3.9, -D / 2 + 0.17);
  b.add(sign);

  const lines = [`${svc.title}`, `${all.length} found in ${world.data.meta.region}`];
  if (data.viaCloudFormation) lines.push('', ['Discovered via CloudFormation.', '#ffd28a'], ['This service\'s own List API is', '#ffd28a'], ['billed per request. We are frugal.', '#ffd28a']);
  if (data.error) lines.push('', [`${data.error.code}`, '#ff8080'], [String(data.error.message).slice(0, 60), '#ff8080']);
  if (all.length > CAP) lines.push('', [`…and ${all.length - CAP} more not shown.`, '#9fb0c6'], ['Pagination is left as an', '#9fb0c6'], ['exercise for the reader.', '#9fb0c6']);
  kiosk(b, W / 2 - 3, D / 2 - 3.5, -Math.PI / 4, {
    title: svc.short, color: svc.color, lines,
    interact: { kind: key, title: `${svc.short} terminal`, item: { name: svc.title, kind: key, sub: `${all.length} resources`, info: { count: all.length, viaCloudFormation: !!data.viaCloudFormation, error: data.error, flavor: svc.flavor } } },
  });

  if (!all.length) {
    buildProp(b, { name: 'Nothing here', kind: 'generic', sub: 'Very cost-optimized', info: { ResourceType: 'AWS::Nothing::AtAll', note: 'An empty room is the most Well-Architected room.' } }, 0, -1, 0);
    const weed = new THREE.Mesh(G.sphere(0.45, 7), new THREE.MeshStandardMaterial({ color: '#8a6a3a', wireframe: true }));
    b.add(weed);
    b.track(weed.material);
    b.update((dt, t) => {
      weed.position.set(Math.sin(t * 0.4) * (W / 2 - 3), 0.45 + Math.abs(Math.sin(t * 3)) * 0.3, 3);
      weed.rotation.z -= dt * 3;
    });
  }
  addLight(b, 0, 4.6, 0, svc.color, 25, 30);
  b.onEnter = (w) => w.hud.notify(svc.short, svc.flavor, key);
  return b.finalize();
}

export { toWorld };
