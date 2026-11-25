import fs from 'node:fs';
import { chromium } from '/home/lars/code/ljacobsson/aws-fps/node_modules/playwright-core/index.mjs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:8086/');
await p.waitForFunction(() => document.querySelector('#title-logo')?.src?.startsWith('data:'));
// Re-draw the game's logo at 3x for a crisp title card.
const url = await p.evaluate(async () => {
  const { drawAwsLogo, canvas } = await import('/js/textures.js');
  const c = canvas(1200, 870);
  drawAwsLogo(c.getContext('2d'), 120, 30, 960);
  return c.toDataURL('image/png');
});
fs.writeFileSync('/home/lars/code/ljacobsson/aws-fps/trailer/assets/aws-logo.png', Buffer.from(url.split(',')[1], 'base64'));
await p.screenshot({ path: 'explore/title.png' });
await b.close();
