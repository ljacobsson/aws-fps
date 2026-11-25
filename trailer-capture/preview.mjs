// node preview.mjs <name> '<json [{area, poses:[{x,z,yaw,pitch,mode,dist}]}]>' → explore/<name>.jpg contact sheet
import { launch, goArea, info } from './harness.mjs';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const [name, json] = process.argv.slice(2);
const groups = JSON.parse(json);
const { browser, page } = await launch();
const files = [];
for (const g of groups) {
  let spec = g.area;
  if (spec.stack) {
    spec = await page.evaluate(async (stackName) => {
      const w = window.__game.world;
      if (w.spec?.type !== 'cfnHall') await w.go({ type: 'cfnHall' });
      return w.area.portals.find((p) => p.target?.spec?.name === stackName).target.spec;
    }, spec.stack);
  }
  await goArea(page, spec);
  if (g.dump) fs.writeFileSync(`explore/${g.dump}.json`, JSON.stringify(await info(page), null, 1));
  for (const [i, p] of g.poses.entries()) {
    await page.evaluate((p) => {
      const e = window.__game.engine;
      e.setMode(p.mode || 'fps');
      if (p.dist) e.birdDist = p.dist;
      e.teleport(p.x, p.z, p.yaw);
      e.player.pitch = p.pitch || 0;
      e.modeBlend = 0;
      window.__game.world.updateLabels(true);
    }, p);
    await page.waitForTimeout(p.mode === 'bird' ? 1200 : 350);
    const f = `explore/_p${files.length}.png`;
    await page.screenshot({ path: f });
    files.push(f);
  }
}
await browser.close();
// tile 3 per row at 640x360
const cols = 3, rows = Math.ceil(files.length / cols);
const inputs = files.flatMap((f) => ['-i', f]);
const scaled = files.map((_, i) => `[${i}]scale=640:360,drawtext=text='${i}':x=10:y=10:fontsize=36:fontcolor=yellow:box=1:boxcolor=black[s${i}]`).join(';');
const pad = Array.from({ length: rows * cols - files.length }, (_, i) => `color=black:640x360:d=1[e${i}]`).join(';');
const all = [...files.map((_, i) => `[s${i}]`), ...Array.from({ length: rows * cols - files.length }, (_, i) => `[e${i}]`)].join('');
const layout = Array.from({ length: rows * cols }, (_, i) => `${(i % cols) * 640}_${Math.floor(i / cols) * 360}`).join('|');
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...inputs, '-filter_complex', `${scaled}${pad ? ';' + pad : ''};${all}xstack=inputs=${rows * cols}:layout=${layout}`, '-frames:v', '1', `explore/${name}.jpg`]);
files.forEach((f) => fs.unlinkSync(f));
console.log(`explore/${name}.jpg`);
