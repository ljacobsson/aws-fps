import { launch, info } from './harness.mjs';
import fs from 'node:fs';
const { browser, page } = await launch();
const t0 = Date.now();
await page.screenshot({ path: 'explore/lobby.png' });
console.log('shot ms', Date.now() - t0);
console.log(await page.evaluate(() => { const g = window.__game.engine.renderer.getContext(); const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'n/a'; }));
fs.writeFileSync('explore/lobby.json', JSON.stringify(await info(page), null, 1));
await browser.close();
