// Drives the game in Chrome with a virtual clock so footage can be captured frame by frame.
import { chromium } from '/home/lars/code/ljacobsson/aws-fps/node_modules/playwright-core/index.mjs';

export const W = 1920, H = 1080, FPS = 30;

// Runs before the game's scripts: rAF and performance.now switch to a stepped clock on demand.
const CLOCK = () => {
  const realNow = performance.now.bind(performance);
  const realRAF = window.requestAnimationFrame.bind(window);
  let manual = false, vnow = 0, queue = [];
  performance.now = () => (manual ? vnow : realNow());
  window.requestAnimationFrame = (cb) => {
    if (manual) { queue.push(cb); return 1; }
    return realRAF((t) => (manual ? queue.push(cb) : cb(t)));
  };
  window.__manual = (on) => {
    if (on) { vnow = realNow(); manual = true; return; }
    manual = false;
    const q = queue; queue = [];
    q.forEach((cb) => realRAF(cb));
  };
  // Waits for the game's loop to have a frame queued, so every step renders exactly once.
  window.__step = async (ms) => {
    for (let i = 0; i < 100 && !queue.length; i++) await new Promise((r) => setTimeout(r, 5));
    vnow += ms;
    const q = queue; queue = [];
    q.forEach((cb) => cb(vnow));
  };
};

// HUD elements that animate with CSS on wall-clock time; they are rebuilt in the edit instead.
const CAPTURE_CSS = `
  *, *::before, *::after { transition: none !important; animation: none !important; }
  #banner, #notify, #passed, #subtitle, #click-to-play, #keys, #mode, #fade, .floater, #help { display: none !important; }
`;

export async function launch({ headless = true } = {}) {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless,
    args: ['--use-gl=angle', '--use-angle=vulkan', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.addInitScript(CLOCK);
  await page.goto('http://localhost:8086/?demo');
  await page.waitForFunction(() => window.__game?.world?.area && !window.__game.world.busy, null, { timeout: 60000 });
  await page.addStyleTag({ content: CAPTURE_CSS });
  // The pager fires random notifications; we hide #notify, but also keep the sound off.
  await page.evaluate(() => { window.__game.world.sound.toggleMute?.(); });
  return { browser, page };
}

export async function goArea(page, spec, spawn = 'default') {
  await page.evaluate(async ([s, sp]) => {
    const w = window.__game.world;
    while (w.busy) await new Promise((r) => setTimeout(r, 50));
    await w.go(s, sp);
  }, [spec, spawn]);
  await page.waitForFunction(() => !window.__game.world.busy);
  await page.waitForTimeout(300);
}

export async function info(page) {
  return page.evaluate(() => {
    const a = window.__game.world.area;
    const r = (n) => Math.round(n * 100) / 100;
    return {
      title: a.title,
      bounds: a.bounds,
      spawns: a.spawns,
      portals: a.portals.map((p) => ({ x: r(p.x), z: r(p.z), ry: r(p.ry), w: p.width, open: p.open, target: p.target && JSON.stringify(p.target.spec).slice(0, 160) })),
      interactables: a.interactables.map((i) => ({ x: r(i.pos.x), z: r(i.pos.z), kind: i.kind, title: i.title })),
    };
  });
}
