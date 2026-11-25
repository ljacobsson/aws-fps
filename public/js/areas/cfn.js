import * as THREE from 'three';
import { room, M, G, door, kiosk, addLight, signMesh, textPanel, cableTray } from '../kit.js';
import { SERVICES, statusColor, typeToKind, serviceOfType } from '../theme.js';
import { buildProp, cellForItem } from '../props.js';
import { newArea, exitDoor, useExitSpawn, floorZone, floorText, beacons } from './common.js';

const CFN_PINK = '#ff4fa3';
const FAILED = /FAILED|ROLLBACK/;

function stackColor(status) {
  if (FAILED.test(status)) return '#ff3b3b';
  if (/PROGRESS/.test(status)) return '#ffb020';
  return CFN_PINK;
}

export async function cfnHall(world) {
  const data = world.data.services.cfn || { items: [] };
  const stacks = data.items || [];
  const ids = new Set(stacks.map((s) => s.id));
  const top = stacks.filter((s) => !s.nested || !ids.has(s.parentId)).sort((a, b2) => a.name.localeCompare(b2.name));
  const n = Math.max(1, top.length);
  const SX = 5.4, SZ = 7.5;
  const cols = Math.max(3, Math.min(22, Math.ceil(Math.sqrt(n * 1.3))));
  const rows = Math.ceil(n / cols);
  const W = Math.max(30, cols * SX + 10), D = Math.max(30, rows * SZ + 20), H = 9;
  const failed = top.filter((s) => FAILED.test(s.status));

  const b = newArea({
    id: 'cfnHall', title: 'CloudFormation Stacks',
    subtitle: `${stacks.length} stacks · ${failed.length} in a rollback-ish mood · ${stacks.length - top.length} nested`,
    color: CFN_PINK,
  });
  room(b, {
    w: W, d: D, h: H, accent: CFN_PINK, floorTint: '#221d27', wallTint: '#15121a', perforated: 0,
    doors: [exitDoor({ spec: { type: 'lobby' }, spawn: 'door:cfn' })],
  });
  useExitSpawn(b);

  const x0 = -((cols - 1) * SX) / 2, z0 = -D / 2 + 8;
  const blink = [];
  top.forEach((s, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const x = x0 + c * SX, z = z0 + r * SZ;
    const color = stackColor(s.status);
    door(b, {
      id: `stack-${i}`, x, z, ry: 0, width: 2.4, height: 3.1, color, icon: 'cfn', lite: true,
      title: s.name, subtitle: `${s.status}${s.resourceCount != null ? ` · ${s.resourceCount} resources` : ''}`,
      target: { spec: { type: 'stack', id: s.id, name: s.name, parent: { type: 'cfnHall' }, parentDoor: `door:stack-${i}` }, spawn: 'default' },
    });
    b.interact({ x, z: z + 1.2, y: 1.6, radius: 1.6, kind: 'cfnStack', title: s.name, sub: s.status, prompt: 'Inspect stack', item: s });
    if (FAILED.test(s.status)) {
      const bulb = new THREE.Mesh(G.sphere(0.18, 12), M.glow('#ff2020', 3));
      bulb.position.set(x, 3.65, z);
      b.add(bulb);
      blink.push(bulb);
    }
  });
  b.update((dt, t) => { const on = Math.sin(t * 6) > 0; for (const m of blink) m.visible = on; });

  // Monsters-Inc style door rails overhead
  b.overhead = true;
  for (let r = 0; r < rows; r++) {
    const z = z0 + r * SZ;
    b.inst(G.box(1, 1, 1), M.steel(), 0, H - 1.2, z, 0, cols * SX, 0.18, 0.25);
    b.inst(G.box(1, 1, 1), M.glow(CFN_PINK, 1.6), 0, H - 1.31, z, 0, cols * SX, 0.03, 0.08);
    for (let c = 0; c < cols && r * cols + c < top.length; c++) b.inst(G.cyl(0.03, 0.03, H - 1.2 - 3.3, 6), M.steel(), x0 + c * SX, 3.3 + (H - 4.5) / 2, z);
  }
  b.overhead = false;

  const sign = signMesh(b, { title: 'CloudFormation Stacks', subtitle: 'Infrastructure as code. Drift as a lifestyle.', icon: 'cfn', color: CFN_PINK }, 14, 3.5);
  sign.position.set(0, 6, -D / 2 + 0.18);
  b.add(sign);

  const oldest = [...stacks].sort((a, b2) => String(a.info?.CreationTime).localeCompare(String(b2.info?.CreationTime)))[0];
  kiosk(b, W / 2 - 3.5, D / 2 - 4, -Math.PI / 4, {
    title: 'Stack census', color: CFN_PINK,
    lines: [
      `${stacks.length} stacks (${stacks.length - top.length} nested)`,
      [`${failed.length} rollback / failed`, failed.length ? '#ff8080' : '#2fe37a'],
      oldest ? `Oldest: ${oldest.name}` : '',
      oldest ? `  since ${String(oldest.info?.CreationTime).slice(0, 10)}` : '',
      data.error ? [`${data.error.code}`, '#ff8080'] : 'Nobody knows what CDKToolkit does.',
    ],
    interact: { kind: 'cfn', title: 'Stack census terminal', item: { name: 'CloudFormation', kind: 'cfn', info: { stacks: stacks.length, nested: stacks.length - top.length, failed: failed.map((s) => `${s.name}: ${s.status}`) } } },
  });
  if (failed.length) beacons(b, [[-W / 2 + 2, H - 0.5, -D / 2 + 2], [W / 2 - 2, H - 0.5, -D / 2 + 2]]);
  addLight(b, 0, H - 2, 0, CFN_PINK, 30, 40);
  b.onEnter = (w) => {
    w.hud.notify('CloudFormation', top.length ? 'Each door is a stack. Walk through one to see what it built.' : 'No stacks. Click-ops detected. Sending thoughts and prayers.', 'cfn');
    if (failed.length) setTimeout(() => w.hud.notify('CloudFormation', `${failed.length} stack(s) in ${failed[0].status}. Someone check the events tab.`, 'cfn'), 3000);
  };
  return b.finalize();
}

// ---------------------------------------------------------------------------

function resourceItem(r) {
  const kind = typeToKind(r.ResourceType);
  return {
    id: r.PhysicalResourceId || r.LogicalResourceId,
    name: r.LogicalResourceId,
    kind,
    sub: r.ResourceType.replace(/^AWS::/, ''),
    typeLabel: r.ResourceType,
    status: r.ResourceStatus,
    info: { ...r, ResourceType: r.ResourceType },
  };
}

export async function stackRoom(world, spec) {
  const details = await world.stackDetails(spec.id);
  const stack = details.stack || {};
  const resources = details.resources || [];
  const name = stack.StackName || spec.name;
  const status = stack.StackStatus || '';

  // Group resources by service namespace and size a zone per group.
  // Alarms: show their CloudWatch state (from the DescribeAlarms scan), not their CFN resource status.
  const alarmsByName = new Map((world.data.services.alarm?.items || []).filter((a) => a.info?.StateValue).map((a) => [a.name, a]));
  const rulesByName = new Map((world.data.services.eventbridge?.items || []).filter((r) => r.sub !== 'event bus').map((r) => [r.name, r]));
  const groups = new Map();
  for (const r of resources) {
    const ns = serviceOfType(r.ResourceType);
    if (!groups.has(ns)) groups.set(ns, []);
    const it = resourceItem(r);
    if (it.kind === 'alarm') {
      const real = alarmsByName.get(r.PhysicalResourceId);
      it.status = real?.status || 'UNKNOWN';
      it.info = { ...r, ...(real?.info || { StateValue: 'UNKNOWN', note: 'Alarm not found in DescribeAlarms (different region, or the scan was not allowed to read alarms).' }) };
    }
    if (it.kind === 'eventbridge' && r.ResourceType === 'AWS::Events::Rule' && r.PhysicalResourceId) {
      // Physical id is "rule" on the default bus, "bus|rule" on custom buses.
      const real = rulesByName.get(r.PhysicalResourceId.split('|').pop());
      if (real) {
        it.status = real.status;
        it.info = { ...r, ...real.info };
        it.sub = real.sub;
      }
    }
    groups.get(ns).push(it);
  }
  const zones = [...groups.entries()].sort((a, b2) => b2[1].length - a[1].length).map(([ns, items]) => {
    const cw = Math.max(...items.map((i) => cellForItem(i)[0]));
    const cd = Math.max(...items.map((i) => cellForItem(i)[1]));
    const cols = Math.max(1, Math.min(7, Math.ceil(Math.sqrt(items.length * 1.4))));
    const rows = Math.ceil(items.length / cols);
    const color = SERVICES[items[0].kind]?.color || '#b07c3c';
    return { ns, items, cw, cd, cols, rows, w: cols * cw + 1.6, d: rows * cd + 2.4, color };
  });
  const area = zones.reduce((a, z) => a + z.w * z.d, 0);
  const maxRowW = Math.max(18, Math.min(70, Math.sqrt(area) * 1.35));
  // shelf packing
  let rx = 0, rz = 0, rowH = 0, packW = 0;
  const G2 = 1.6;
  for (const z of zones) {
    if (rx > 0 && rx + z.w > maxRowW) { rz += rowH + G2; rx = 0; rowH = 0; }
    z.px = rx; z.pz = rz;
    rx += z.w + G2;
    rowH = Math.max(rowH, z.d);
    packW = Math.max(packW, rx - G2);
  }
  const packD = rz + rowH;
  const W = Math.max(24, packW + 8), D = Math.max(24, packD + 20), H = 6;

  const failed = FAILED.test(status);
  const color = stackColor(status);
  const b = newArea({ id: `stack:${spec.id}`, title: name, subtitle: `${status} · ${resources.length} resources · ${zones.length} services`, color });
  room(b, {
    w: W, d: D, h: H, accent: color, floorTint: '#1f1c25', wallTint: '#141219', perforated: 0.15,
    doors: [exitDoor({ spec: spec.parent, spawn: spec.parentDoor }, spec.parent.type === 'stack'
      ? { title: 'Parent stack', subtitle: 'Back up the nesting', icon: 'cfn', color: CFN_PINK }
      : { title: 'Stack hall', subtitle: 'Back to all stacks', icon: 'cfn', color: CFN_PINK })],
  });
  useExitSpawn(b);

  const ox = -packW / 2, oz = -D / 2 + 9;
  let nestedI = 0;
  for (const z of zones) {
    const zx = ox + z.px, zz = oz + z.pz;
    floorZone(b, zx, zz, z.w, z.d, z.color, { opacity: 0.09 });
    floorText(b, `${z.ns} × ${z.items.length}`, zx + z.w / 2, zz + 0.55, Math.min(z.w - 0.4, 6), { color: z.color });
    z.items.forEach((it, i) => {
      const c = i % z.cols, r = Math.floor(i / z.cols);
      const x = zx + 0.8 + z.cw / 2 + c * z.cw;
      const y = zz + 1.4 + z.cd / 2 + r * z.cd;
      if (it.kind === 'cfnStack' && it.info.PhysicalResourceId) {
        const id = `nested-${nestedI++}`;
        door(b, {
          id, x, z: y, width: 2.2, height: 3.0, color: CFN_PINK, icon: 'cfn', lite: true,
          title: it.name, subtitle: 'nested stack →',
          target: { spec: { type: 'stack', id: it.info.PhysicalResourceId, name: it.name, parent: spec, parentDoor: `door:${id}` }, spawn: 'default' },
        });
      } else {
        buildProp(b, it, x, y, 0);
      }
    });
    if (z.items.some((i) => ['lambda', 'dynamodb', 'rds', 'ec2', 'iam', 'logs'].includes(i.kind))) {
      for (let r = 0; r < z.rows; r++) {
        const y = zz + 1.4 + z.cd / 2 + r * z.cd;
        cableTray(b, zx, y, zx + z.w, y, 3.4);
      }
    }
  }

  // North wall: the stack's own billboard
  const params = (stack.Parameters || []).slice(0, 6).map((p) => `  ${p.ParameterKey} = ${p.ParameterValue}`);
  const outputs = (stack.Outputs || []).slice(0, 6).map((o) => `  ${o.OutputKey} → ${o.OutputValue}`);
  const board = textPanel(b, [
    [status, statusColor(status)],
    stack.Description ? String(stack.Description).slice(0, 90) : '(no description — a mystery stack)',
    `Created ${String(stack.CreationTime || '').slice(0, 10)}   Updated ${String(stack.LastUpdatedTime || '—').slice(0, 10)}`,
    stack.DriftStatus ? `Drift: ${stack.DriftStatus}` : '',
    '',
    ['Parameters', '#ffd28a'], ...(params.length ? params : ['  (none)']),
    ['Outputs', '#ffd28a'], ...(outputs.length ? outputs : ['  (none)']),
  ], { w: Math.min(W - 4, 14), h: 4.6, title: name, color, size: 24 });
  board.position.set(0, 3.2, -D / 2 + 0.17);
  b.add(board);

  const stackItem = { id: stack.StackId || spec.id, name, kind: 'cfnStack', status, sub: stack.Description, info: stack };
  kiosk(b, -W / 2 + 3.2, D / 2 - 4, Math.PI / 4, {
    title: 'Template', color: '#ffd34d',
    lines: ['GetTemplate terminal', 'Read only. No `deploy`.', 'No `--force`. No.', '', 'Press E to read.'],
    interact: { kind: 'cfnStack', title: 'Template terminal', sub: name, prompt: 'Read', onUse: (w) => w.inspect(stackItem) },
  });
  kiosk(b, W / 2 - 3.2, D / 2 - 4, -Math.PI / 4, {
    title: 'Stack info', color,
    lines: [`${resources.length} resources`, `${zones.length} services`, ...zones.slice(0, 4).map((z) => `${z.ns}: ${z.items.length}`)],
    interact: { kind: 'cfnStack', title: name, sub: status, item: stackItem },
  });
  if (failed) {
    beacons(b, [[-W / 2 + 2, H - 0.5, -D / 2 + 2], [W / 2 - 2, H - 0.5, -D / 2 + 2]]);
  }
  if (!resources.length) {
    buildProp(b, { name: 'Empty stack', kind: 'generic', sub: 'zero resources', info: { ResourceType: 'AWS::CloudFormation::WaitCondition', note: 'Waiting. Forever.' } }, 0, 0, 0);
  }
  addLight(b, 0, H - 1, 0, color, 25, 35);
  b.onEnter = (w) => {
    if (failed) w.hud.notify('CloudFormation', `${status}. The rollback is coming from inside the house.`, 'cfn');
    else if (/CDKToolkit/i.test(name)) w.hud.notify('Solutions Architect', 'CDKToolkit. Nobody knows what it does. Do not delete it. Ever.', 'cfn');
  };
  return b.finalize();
}
