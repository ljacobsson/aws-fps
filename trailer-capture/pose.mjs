// node pose.mjs out.jpg '{"area":{...},"x":..,"z":..,"yaw":..,"pitch":..}'
import { launch, goArea } from './harness.mjs';
const [out, json] = process.argv.slice(2);
const p = JSON.parse(json);
const { browser, page } = await launch();
await goArea(page, p.area);
await page.evaluate((p) => { const e = window.__game.engine; e.teleport(p.x, p.z, p.yaw); e.player.pitch = p.pitch || 0; window.__game.world.updateLabels(true); }, p);
await page.waitForTimeout(500);
await page.screenshot({ path: out, type: 'jpeg', quality: 85 });
await browser.close();
