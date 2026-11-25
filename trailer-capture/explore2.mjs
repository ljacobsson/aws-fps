import { launch, info, goArea } from './harness.mjs';
import fs from 'node:fs';
const { browser, page } = await launch();
const stacks = await page.evaluate(() => window.__game.data.services.cfn.items.map(s => ({ name: s.name, n: s.resourceCount, status: s.status, id: s.id })).sort((a,b)=>b.n-a.n));
console.log(stacks.slice(0,6));
const areas = {
  lambda: { type: 'service', key: 'lambda' },
  eventbridge: { type: 'service', key: 'eventbridge' },
  cloudwatch: { type: 'cloudwatch' },
  cfnHall: { type: 'cfnHall' },
  graveyard: { type: 'graveyard' },
};
for (const [name, spec] of Object.entries(areas)) {
  await goArea(page, spec);
  await page.waitForTimeout(500);
  fs.writeFileSync(`explore/${name}.json`, JSON.stringify(await info(page), null, 1));
  await page.screenshot({ path: `explore/${name}.png` });
  await page.evaluate(() => { const e = window.__game.engine; e.setMode('bird'); e.birdDist = 45; });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `explore/${name}-bird.png` });
  await page.evaluate(() => { const e = window.__game.engine; e.setMode('fps'); e.birdDist = 15; });
}
fs.writeFileSync('explore/stacks.json', JSON.stringify(stacks, null, 1));
await browser.close();
