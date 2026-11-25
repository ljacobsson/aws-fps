// Renders the game's own WebAudio sounds (public/js/audio.js) offline to WAV files.
import fs from 'node:fs';
import { chromium } from '/home/lars/code/ljacobsson/aws-fps/node_modules/playwright-core/index.mjs';
const out = '/home/lars/code/ljacobsson/aws-fps/trailer/assets/sfx';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:8086/');
const files = await page.evaluate(async () => {
  const SR = 48000;
  const wav = (buf) => {
    const ch = buf.numberOfChannels, n = buf.length, data = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const w = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true); data.setUint32(24, SR, true);
    data.setUint32(28, SR * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); w(36, 'data'); data.setUint32(40, n * ch * 2, true);
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, buf.getChannelData(c)[i])); data.setInt16(o, v * 32767, true); o += 2; }
    let s = ''; const u = new Uint8Array(data.buffer);
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const noiseBuf = (ctx) => {
    const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    return buf;
  };
  const render = async (secs, build) => {
    const ctx = new OfflineAudioContext(1, Math.round(SR * secs), SR);
    const master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    build(ctx, master, noiseBuf(ctx));
    return wav(await ctx.startRendering());
  };
  // Ambience as in Sound.start()/setAmbience(): indoor = filtered noise 700 Hz + 60/120/180 Hz hum; outdoor = 300 Hz noise, no hum.
  const ambience = (indoor) => (ctx, master, nb) => {
    const amb = ctx.createGain(); amb.gain.value = indoor ? 0.35 : 0.25; amb.connect(master);
    const n = ctx.createBufferSource(); n.buffer = nb; n.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = indoor ? 700 : 300;
    n.connect(f).connect(amb); n.start();
    if (indoor) [60, 120, 180].forEach((fr, i) => { const o = ctx.createOscillator(); o.frequency.value = fr; const g = ctx.createGain(); g.gain.value = [0.05, 0.025, 0.01][i]; o.connect(g).connect(amb); o.start(); });
  };
  const whoosh = (ctx, master, nb) => {
    const t = 0.02, src = ctx.createBufferSource(); src.buffer = nb;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.35);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.6, t + 0.08); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    src.connect(f).connect(g).connect(master); src.start(t); src.stop(t + 0.6);
  };
  const beep = (freqs, dur) => (ctx, master) => freqs.forEach((fr, i) => {
    const t = 0.02 + i * (dur + 0.03), o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
  });
  return {
    'game-hum-indoor.wav': await render(40, ambience(true)),
    'game-wind-outdoor.wav': await render(32, ambience(false)),
    'game-whoosh-1.wav': await render(0.7, whoosh),
    'game-whoosh-2.wav': await render(0.7, whoosh),
    'game-whoosh-3.wav': await render(0.7, whoosh),
    'game-jingle.wav': await render(0.8, beep([523, 659, 784, 1047], 0.12)),
    'game-respect.wav': await render(0.4, beep([392, 523], 0.14)),
    'game-pager.wav': await render(0.35, beep([880, 1320], 0.09)),
  };
});
for (const [n, b64] of Object.entries(files)) fs.writeFileSync(`${out}/${n}`, Buffer.from(b64, 'base64'));
console.log(Object.keys(files).join('\n'));
await browser.close();
