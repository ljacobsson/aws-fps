// node capture.mjs [--preview] [shot …]  → frames/<shot>/00000.jpg … and clips/<shot>.mp4
// --preview screenshots every 15th frame into explore/path-<shot>.jpg instead.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { launch, goArea, FPS } from './harness.mjs';
import { SHOTS } from './shots.mjs';

const args = process.argv.slice(2);
const preview = args.includes('--preview');
const names = args.filter((a) => !a.startsWith('--'));
const list = names.length ? names : Object.keys(SHOTS);

// Cubic Hermite through keyed values with Catmull-Rom tangents (non-uniform times).
function sampler(keys, ch) {
  const t = keys.map((k) => k[0]), v = keys.map((k) => k[ch]);
  const n = t.length;
  const m = v.map((_, i) => {
    if (n === 1) return 0;
    if (i === 0) return (v[1] - v[0]) / (t[1] - t[0]);
    if (i === n - 1) return (v[n - 1] - v[n - 2]) / (t[n - 1] - t[n - 2]);
    return (v[i + 1] - v[i - 1]) / (t[i + 1] - t[i - 1]);
  });
  return (x) => {
    if (x <= t[0]) return v[0];
    if (x >= t[n - 1]) return v[n - 1];
    let i = 0;
    while (x > t[i + 1]) i++;
    const h = t[i + 1] - t[i], s = (x - t[i]) / h;
    const s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * v[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * v[i + 1] + (s3 - s2) * h * m[i + 1];
  };
}

const { browser, page } = await launch();
fs.mkdirSync('explore', { recursive: true });
fs.mkdirSync('clips', { recursive: true });
const meta = fs.existsSync('clips/meta.json') ? JSON.parse(fs.readFileSync('clips/meta.json', 'utf8')) : {};

for (const name of list) {
  const shot = SHOTS[name];
  let spec = shot.area;
  if (spec.stack) {
    spec = await page.evaluate(async (stackName) => {
      const w = window.__game.world;
      if (w.spec?.type !== 'cfnHall') await w.go({ type: 'cfnHall' });
      return w.area.portals.find((p) => p.target?.spec?.name === stackName).target.spec;
    }, spec.stack);
  }
  await page.evaluate(() => { const e = window.__game.engine; e.setMode('fps'); e.modeBlend = 0; });
  await goArea(page, spec);
  meta[name] = await page.evaluate(() => { const a = window.__game.world.area; return { title: a.title, subtitle: a.subtitle, color: a.color }; });

  const X = sampler(shot.keys, 1), Z = sampler(shot.keys, 2), YAW = sampler(shot.keys, 3), PITCH = sampler(shot.keys, 4);
  const birdStart = shot.bird ? shot.bird[0][0] : Infinity;
  const DIST = shot.bird ? sampler(shot.bird.map(([t, d]) => [t, d]), 1) : null;
  const frames = Math.round(shot.dur * FPS);
  const dt = 1 / FPS;
  const dir = `frames/${name}`;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  // Place the player on the path, then hand over to the stepped clock.
  await page.evaluate(([x, z, yaw, pitch]) => {
    const e = window.__game.engine;
    e.teleport(x, z, yaw);
    e.player.pitch = pitch;
    window.__manual(true);
  }, [X(0), Z(0), YAW(0), PITCH(0)]);

  const pressAt = new Map((shot.press || []).map(([t, code]) => [Math.round(t * FPS), code]));
  const thumbs = [];
  const t0 = Date.now();
  const bumps = [];
  for (let f = -3; f < frames; f++) {
    const t = Math.max(0, f) * dt, tn = (Math.max(0, f) + 1) * dt;
    const miss = await page.evaluate(([x0, z0, x1, z1, yaw, pitch, dt, bird, dist, key]) => {
      const e = window.__game.engine;
      if (bird && e.mode !== 'bird') e.setMode('bird');
      if (dist) e.birdDist = dist;
      // Start the frame at x0 with the velocity that the engine's damping turns into exactly x1.
      const k = Math.exp(12 * dt);
      e.player.pos.set(x0, 0, z0);
      e.player.vel.set(((x1 - x0) / dt) * k, 0, ((z1 - z0) / dt) * k);
      e.player.yaw = yaw;
      e.player.pitch = pitch;
      e.mouse.dx = e.mouse.dy = 0;
      e.keys.clear();
      e.frozen = false;
      if (key) window.dispatchEvent(new KeyboardEvent('keydown', { code: key }));
      return window.__step(dt * 1000).then(() => Math.hypot(e.player.pos.x - x1, e.player.pos.z - z1));
    }, [X(t), Z(t), X(tn), Z(tn), YAW(tn), PITCH(tn), dt, tn >= birdStart, DIST ? DIST(tn) : 0, pressAt.get(f) || null]);
    if (f < 0) continue;
    // The game's collision moved the player off the path: the camera will visibly snag here.
    if (miss > 0.01) bumps.push(`${(f / FPS).toFixed(2)}s:${miss.toFixed(2)}m`);
    if (preview) {
      if (f % 15 === 0 || f === frames - 1) {
        const p = `${dir}/p${String(f).padStart(5, '0')}.jpg`;
        await page.screenshot({ path: p, type: 'jpeg', quality: 70 });
        thumbs.push(p);
      }
    } else {
      await page.screenshot({ path: `${dir}/${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 94 });
    }
  }
  await page.evaluate(() => window.__manual(false));
  if (bumps.length) console.log(`${name}: COLLISION on ${bumps.length} frames → ${bumps.slice(0, 12).join(' ')}`);
  const secs = ((Date.now() - t0) / 1000).toFixed(0);

  if (preview) {
    const cols = 6, rows = Math.ceil(thumbs.length / cols);
    const tiles = rows * cols;
    const inputs = thumbs.flatMap((f) => ['-i', f]);
    const parts = thumbs.map((_, i) => `[${i}]scale=480:270,drawtext=text='${(i * 15 / FPS).toFixed(1)}s':x=8:y=8:fontsize=26:fontcolor=yellow:box=1:boxcolor=black[s${i}]`);
    for (let i = thumbs.length; i < tiles; i++) parts.push(`color=black:480x270:d=1[s${i}]`);
    const layout = Array.from({ length: tiles }, (_, i) => `${(i % cols) * 480}_${Math.floor(i / cols) * 270}`).join('|');
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...inputs, '-filter_complex', `${parts.join(';')};${Array.from({ length: tiles }, (_, i) => `[s${i}]`).join('')}xstack=inputs=${tiles}:layout=${layout}`, '-frames:v', '1', `explore/path-${name}.jpg`]);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`${name}: preview explore/path-${name}.jpg (${secs}s)`);
  } else {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', `${dir}/%05d.jpg`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `clips/${name}.mp4`]);
    console.log(`${name}: ${frames} frames → clips/${name}.mp4 (${secs}s)`);
  }
  fs.writeFileSync('clips/meta.json', JSON.stringify(meta, null, 1));
}
await browser.close();
