import * as THREE from 'three';
import { SERVICES, AWS_ORANGE, CAT } from './theme.js';

export const FONT = '"Rajdhani", "Oswald", "Arial Narrow", sans-serif';
export const DISPLAY_FONT = '"Anton", "Bebas Neue", Impact, sans-serif';
export const MONO = '"JetBrains Mono", "Fira Code", Consolas, monospace';

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function toTexture(c, { repeat, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function fitText(ctx, text, maxW, size, weight = 700, family = FONT) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(text).width <= maxW) break;
    s -= 2;
  } while (s > 10);
  if (ctx.measureText(text).width > maxW) {
    let t = text;
    while (t.length > 3 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
    return `${t}…`;
  }
  return text;
}

function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return `#${c.getHexString()}`;
}

// ---------------------------------------------------------------------------
// Service icons (drawn, not copied — but close enough that you'll nod knowingly)
// ---------------------------------------------------------------------------

export function drawIcon(ctx, kind, x, y, s, { bg = true } = {}) {
  const color = SERVICES[kind]?.color || CAT.neutral;
  ctx.save();
  ctx.translate(x, y);
  if (bg) {
    const g = ctx.createLinearGradient(0, s, s, 0);
    g.addColorStop(0, shade(color, -0.12));
    g.addColorStop(1, shade(color, 0.1));
    ctx.fillStyle = g;
    roundRect(ctx, 0, 0, s, s, s * 0.12);
    ctx.fill();
  }
  ctx.strokeStyle = '#fff';
  ctx.fillStyle = '#fff';
  ctx.lineWidth = s * 0.055;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const u = s / 100;
  const P = (fn) => { ctx.beginPath(); fn(); ctx.stroke(); };
  const cyl = (cx, top, w, h, bands = 2) => {
    const rx = w / 2, ry = w * 0.16;
    P(() => ctx.ellipse(cx, top, rx, ry, 0, 0, Math.PI * 2));
    P(() => { ctx.moveTo(cx - rx, top); ctx.lineTo(cx - rx, top + h); ctx.ellipse(cx, top + h, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(cx + rx, top); });
    for (let i = 1; i <= bands; i++) P(() => ctx.ellipse(cx, top + (h * i) / (bands + 1), rx, ry, 0, 0, Math.PI));
  };
  switch (kind) {
    case 'lambda':
      ctx.font = `700 ${70 * u}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('λ', 50 * u, 54 * u);
      break;
    case 's3':
      P(() => ctx.ellipse(50 * u, 28 * u, 30 * u, 9 * u, 0, 0, Math.PI * 2));
      P(() => { ctx.moveTo(20 * u, 28 * u); ctx.lineTo(28 * u, 74 * u); ctx.ellipse(50 * u, 74 * u, 22 * u, 7 * u, 0, Math.PI, 0, true); ctx.lineTo(80 * u, 28 * u); });
      P(() => ctx.ellipse(50 * u, 50 * u, 27 * u, 8 * u, 0, 0.1, Math.PI - 0.1));
      break;
    case 'dynamodb':
      cyl(50 * u, 24 * u, 52 * u, 52 * u, 2);
      ctx.beginPath();
      ctx.moveTo(56 * u, 36 * u); ctx.lineTo(44 * u, 54 * u); ctx.lineTo(52 * u, 54 * u); ctx.lineTo(46 * u, 70 * u); ctx.lineTo(60 * u, 50 * u); ctx.lineTo(52 * u, 50 * u);
      ctx.closePath(); ctx.fill();
      break;
    case 'rds':
      cyl(50 * u, 24 * u, 54 * u, 52 * u, 3);
      break;
    case 'elasticache':
      ctx.beginPath();
      ctx.moveTo(58 * u, 14 * u); ctx.lineTo(30 * u, 56 * u); ctx.lineTo(48 * u, 56 * u); ctx.lineTo(40 * u, 86 * u); ctx.lineTo(72 * u, 42 * u); ctx.lineTo(54 * u, 42 * u);
      ctx.closePath(); ctx.fill();
      break;
    case 'ec2':
      P(() => ctx.rect(30 * u, 30 * u, 40 * u, 40 * u));
      P(() => ctx.rect(40 * u, 40 * u, 20 * u, 20 * u));
      for (let i = 0; i < 4; i++) {
        const o = (36 + i * 9.3) * u;
        P(() => { ctx.moveTo(o, 18 * u); ctx.lineTo(o, 30 * u); ctx.moveTo(o, 70 * u); ctx.lineTo(o, 82 * u); ctx.moveTo(18 * u, o); ctx.lineTo(30 * u, o); ctx.moveTo(70 * u, o); ctx.lineTo(82 * u, o); });
      }
      break;
    case 'ecs':
      [[22, 52], [50, 52], [36, 26]].forEach(([bx, by]) => P(() => { ctx.rect(bx * u, by * u, 26 * u, 22 * u); ctx.moveTo((bx + 9) * u, by * u); ctx.lineTo((bx + 9) * u, (by + 22) * u); ctx.moveTo((bx + 17) * u, by * u); ctx.lineTo((bx + 17) * u, (by + 22) * u); }));
      break;
    case 'sqs':
      P(() => { ctx.rect(14 * u, 38 * u, 18 * u, 24 * u); ctx.rect(41 * u, 38 * u, 18 * u, 24 * u); ctx.rect(68 * u, 38 * u, 18 * u, 24 * u); });
      P(() => { ctx.moveTo(8 * u, 74 * u); ctx.lineTo(92 * u, 74 * u); ctx.moveTo(84 * u, 68 * u); ctx.lineTo(92 * u, 74 * u); ctx.lineTo(84 * u, 80 * u); });
      break;
    case 'sns':
      ctx.beginPath(); ctx.arc(50 * u, 50 * u, 8 * u, 0, Math.PI * 2); ctx.fill();
      [18, 30].forEach((r) => { P(() => ctx.arc(50 * u, 50 * u, r * u, -0.7, 0.7)); P(() => ctx.arc(50 * u, 50 * u, r * u, Math.PI - 0.7, Math.PI + 0.7)); });
      break;
    case 'eventbridge':
      P(() => ctx.arc(50 * u, 50 * u, 11 * u, 0, Math.PI * 2));
      [[22, 22], [78, 22], [22, 78], [78, 78]].forEach(([nx, ny]) => {
        P(() => { ctx.moveTo(50 * u, 50 * u); ctx.lineTo(nx * u, ny * u); });
        ctx.beginPath(); ctx.arc(nx * u, ny * u, 7 * u, 0, Math.PI * 2); ctx.fill();
      });
      break;
    case 'sfn':
      P(() => ctx.rect(36 * u, 12 * u, 28 * u, 16 * u));
      P(() => { ctx.moveTo(50 * u, 28 * u); ctx.lineTo(50 * u, 38 * u); ctx.moveTo(50 * u, 38 * u); ctx.lineTo(62 * u, 50 * u); ctx.lineTo(50 * u, 62 * u); ctx.lineTo(38 * u, 50 * u); ctx.closePath(); });
      P(() => { ctx.moveTo(38 * u, 50 * u); ctx.lineTo(24 * u, 50 * u); ctx.lineTo(24 * u, 72 * u); ctx.moveTo(62 * u, 50 * u); ctx.lineTo(76 * u, 50 * u); ctx.lineTo(76 * u, 72 * u); });
      P(() => { ctx.rect(12 * u, 72 * u, 24 * u, 14 * u); ctx.rect(64 * u, 72 * u, 24 * u, 14 * u); });
      break;
    case 'apigw':
      P(() => { ctx.moveTo(32 * u, 26 * u); ctx.lineTo(14 * u, 50 * u); ctx.lineTo(32 * u, 74 * u); ctx.moveTo(68 * u, 26 * u); ctx.lineTo(86 * u, 50 * u); ctx.lineTo(68 * u, 74 * u); });
      P(() => { ctx.moveTo(42 * u, 50 * u); ctx.lineTo(44 * u, 50 * u); ctx.moveTo(50 * u, 50 * u); ctx.lineTo(52 * u, 50 * u); ctx.moveTo(58 * u, 50 * u); ctx.lineTo(60 * u, 50 * u); });
      break;
    case 'cloudfront':
      P(() => ctx.arc(50 * u, 50 * u, 32 * u, 0, Math.PI * 2));
      P(() => ctx.ellipse(50 * u, 50 * u, 14 * u, 32 * u, 0, 0, Math.PI * 2));
      P(() => { ctx.moveTo(18 * u, 50 * u); ctx.lineTo(82 * u, 50 * u); ctx.moveTo(23 * u, 34 * u); ctx.lineTo(77 * u, 34 * u); ctx.moveTo(23 * u, 66 * u); ctx.lineTo(77 * u, 66 * u); });
      break;
    case 'route53':
      P(() => { ctx.moveTo(50 * u, 12 * u); ctx.lineTo(82 * u, 24 * u); ctx.quadraticCurveTo(82 * u, 74 * u, 50 * u, 88 * u); ctx.quadraticCurveTo(18 * u, 74 * u, 18 * u, 24 * u); ctx.closePath(); });
      ctx.font = `700 ${34 * u}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('53', 50 * u, 50 * u);
      break;
    case 'iam':
      ctx.beginPath(); ctx.arc(50 * u, 34 * u, 13 * u, 0, Math.PI * 2); ctx.stroke();
      P(() => { ctx.moveTo(24 * u, 82 * u); ctx.quadraticCurveTo(24 * u, 54 * u, 50 * u, 54 * u); ctx.quadraticCurveTo(76 * u, 54 * u, 76 * u, 82 * u); ctx.closePath(); });
      break;
    case 'kms':
      P(() => ctx.arc(32 * u, 50 * u, 15 * u, 0, Math.PI * 2));
      P(() => { ctx.moveTo(47 * u, 50 * u); ctx.lineTo(86 * u, 50 * u); ctx.moveTo(74 * u, 50 * u); ctx.lineTo(74 * u, 62 * u); ctx.moveTo(84 * u, 50 * u); ctx.lineTo(84 * u, 60 * u); });
      break;
    case 'secrets':
      P(() => { ctx.moveTo(34 * u, 46 * u); ctx.lineTo(34 * u, 34 * u); ctx.arc(50 * u, 34 * u, 16 * u, Math.PI, 0); ctx.lineTo(66 * u, 46 * u); });
      P(() => ctx.rect(26 * u, 46 * u, 48 * u, 36 * u));
      ctx.beginPath(); ctx.arc(50 * u, 62 * u, 5 * u, 0, Math.PI * 2); ctx.fill();
      break;
    case 'logs':
      P(() => { ctx.moveTo(28 * u, 14 * u); ctx.lineTo(62 * u, 14 * u); ctx.lineTo(76 * u, 28 * u); ctx.lineTo(76 * u, 86 * u); ctx.lineTo(28 * u, 86 * u); ctx.closePath(); });
      [36, 50, 64, 76].forEach((ly) => P(() => { ctx.moveTo(38 * u, ly * u); ctx.lineTo(66 * u, ly * u); }));
      break;
    case 'alarm':
      P(() => ctx.arc(44 * u, 44 * u, 26 * u, 0, Math.PI * 2));
      P(() => { ctx.moveTo(63 * u, 63 * u); ctx.lineTo(84 * u, 84 * u); });
      P(() => { ctx.moveTo(28 * u, 50 * u); ctx.lineTo(37 * u, 40 * u); ctx.lineTo(45 * u, 48 * u); ctx.lineTo(57 * u, 32 * u); });
      break;
    case 'vpc':
      P(() => { ctx.moveTo(26 * u, 70 * u); ctx.arc(28 * u, 58 * u, 12 * u, Math.PI / 2, Math.PI * 1.5); ctx.arc(46 * u, 42 * u, 18 * u, Math.PI, 0); ctx.arc(72 * u, 56 * u, 14 * u, -Math.PI / 2, Math.PI / 2); ctx.closePath(); });
      ctx.font = `700 ${20 * u}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('VPC', 50 * u, 58 * u);
      break;
    case 'cfn':
    case 'cfnStack':
      [62, 46, 30].forEach((ly) => P(() => { ctx.moveTo(50 * u, (ly - 12) * u); ctx.lineTo(82 * u, ly * u); ctx.lineTo(50 * u, (ly + 12) * u); ctx.lineTo(18 * u, ly * u); ctx.closePath(); }));
      break;
    case 'subnet':
      P(() => { ctx.rect(22 * u, 22 * u, 24 * u, 24 * u); ctx.rect(54 * u, 22 * u, 24 * u, 24 * u); ctx.rect(22 * u, 54 * u, 24 * u, 24 * u); ctx.rect(54 * u, 54 * u, 24 * u, 24 * u); });
      break;
    case 'nat':
    case 'igw':
    case 'net':
      ctx.font = `700 ${(kind === 'net' ? 24 : 30) * u}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      P(() => ctx.arc(50 * u, 50 * u, 34 * u, 0, Math.PI * 2));
      ctx.fillText(kind === 'nat' ? 'NAT' : kind === 'igw' ? 'IGW' : 'NET', 50 * u, 52 * u);
      break;
    case 'grave':
      P(() => { ctx.moveTo(30 * u, 84 * u); ctx.lineTo(30 * u, 40 * u); ctx.arc(50 * u, 40 * u, 20 * u, Math.PI, 0); ctx.lineTo(70 * u, 84 * u); });
      ctx.font = `700 ${18 * u}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('RIP', 50 * u, 52 * u);
      break;
    default:
      drawAwsLogo(ctx, 14 * u, 24 * u, 72 * u, '#fff');
  }
  ctx.restore();
}

/** The lowercase "aws" with the smile. Every AWS user has this burned into their retina. */
export function drawAwsLogo(ctx, x, y, w, textColor = '#fff') {
  ctx.save();
  ctx.fillStyle = textColor;
  ctx.font = `800 ${w * 0.5}px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('aws', x + w / 2, y + w * 0.46);
  ctx.strokeStyle = AWS_ORANGE;
  ctx.fillStyle = AWS_ORANGE;
  ctx.lineWidth = w * 0.065;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.1, y + w * 0.56);
  ctx.quadraticCurveTo(x + w * 0.5, y + w * 0.8, x + w * 0.86, y + w * 0.55);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.92, y + w * 0.5);
  ctx.lineTo(x + w * 0.78, y + w * 0.5);
  ctx.lineTo(x + w * 0.9, y + w * 0.64);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

const iconTexCache = new Map();
export function iconTexture(kind, size = 256) {
  const key = `${kind}:${size}`;
  if (!iconTexCache.has(key)) {
    const c = canvas(size, size);
    drawIcon(c.getContext('2d'), kind, 0, 0, size);
    iconTexCache.set(key, toTexture(c));
  }
  return iconTexCache.get(key);
}

export function iconDataUrl(kind, size = 96) {
  const c = canvas(size, size);
  drawIcon(c.getContext('2d'), kind, 0, 0, size);
  return c.toDataURL();
}

// ---------------------------------------------------------------------------
// Surface textures
// ---------------------------------------------------------------------------

const cache = new Map();
const memo = (key, fn) => {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
};

/** Raised data-center floor tiles: mostly solid, some perforated. */
export function floorTileTexture(tint = '#2a313c', perforated = 0.25) {
  return memo(`floor:${tint}:${perforated}`, () => {
    const c = canvas(512, 512);
    const ctx = c.getContext('2d');
    const n = 4, ts = 512 / n;
    let seed = 3;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x = i * ts, y = j * ts;
        const g = ctx.createLinearGradient(x, y, x + ts, y + ts);
        g.addColorStop(0, shade(tint, 0.03));
        g.addColorStop(1, shade(tint, -0.03));
        ctx.fillStyle = g;
        ctx.fillRect(x, y, ts, ts);
        if (r() < perforated) {
          ctx.fillStyle = shade(tint, -0.12);
          for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) {
            ctx.beginPath();
            ctx.arc(x + 12 + a * 10.5, y + 12 + b * 10.5, 2.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.strokeStyle = shade(tint, -0.18);
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 1.5, y + 1.5, ts - 3, ts - 3);
        ctx.strokeStyle = shade(tint, 0.1);
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 4, y + 4, ts - 8, ts - 8);
      }
    }
    return c;
  });
}

export function wallTexture(tint = '#1b2029') {
  return memo(`wall:${tint}`, () => {
    const c = canvas(512, 512);
    const ctx = c.getContext('2d');
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4; i++) {
      const x = i * 128;
      const g = ctx.createLinearGradient(x, 0, x + 128, 0);
      g.addColorStop(0, shade(tint, 0.04));
      g.addColorStop(0.5, shade(tint, 0.015));
      g.addColorStop(1, shade(tint, -0.02));
      ctx.fillStyle = g;
      ctx.fillRect(x + 3, 0, 122, 512);
      ctx.fillStyle = shade(tint, -0.1);
      ctx.fillRect(x, 0, 3, 512);
    }
    ctx.fillStyle = shade(tint, -0.08);
    ctx.fillRect(0, 254, 512, 4);
    return c;
  });
}

export function rackFrontCanvas(color, variant = 'server') {
  return memo(`rack:${color}:${variant}`, () => {
    const W = 256, H = 640;
    const c = canvas(W, H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0c0f14';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1a1f28';
    ctx.fillRect(8, 8, W - 16, H - 16);
    const units = variant === 'disks' ? 10 : 16;
    const uh = (H - 40) / units;
    let seed = color.length * 7 + variant.length;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < units; i++) {
      const y = 20 + i * uh;
      const g = ctx.createLinearGradient(0, y, 0, y + uh);
      g.addColorStop(0, '#2b323e');
      g.addColorStop(1, '#161a21');
      ctx.fillStyle = g;
      ctx.fillRect(18, y + 2, W - 36, uh - 4);
      if (variant === 'disks') {
        for (let d = 0; d < 6; d++) {
          ctx.fillStyle = '#0d1117';
          ctx.fillRect(26 + d * 34, y + 6, 28, uh - 12);
          ctx.fillStyle = shade(color, -0.1);
          ctx.fillRect(26 + d * 34, y + uh - 12, 28, 3);
        }
      } else {
        ctx.fillStyle = '#0a0d12';
        for (let v = 0; v < 18; v++) ctx.fillRect(60 + v * 9, y + 8, 4, uh - 16);
        ctx.fillStyle = color;
        ctx.fillRect(22, y + 6, 6, uh - 12);
        if (r() > 0.5) {
          ctx.fillStyle = '#2c3442';
          ctx.fillRect(W - 60, y + 8, 30, uh - 16);
        }
      }
    }
    return c;
  });
}

export function rackEmissiveCanvas(color, variant = 'server') {
  return memo(`rackE:${color}:${variant}`, () => {
    const W = 256, H = 640;
    const c = canvas(W, H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const units = variant === 'disks' ? 10 : 16;
    const uh = (H - 40) / units;
    ctx.fillStyle = color;
    for (let i = 0; i < units; i++) {
      const y = 20 + i * uh;
      if (variant === 'disks') {
        for (let d = 0; d < 6; d++) ctx.fillRect(26 + d * 34, y + uh - 12, 28, 3);
      } else {
        ctx.fillRect(22, y + 6, 6, uh - 12);
      }
    }
    return c;
  });
}

export function fenceTexture() {
  return memo('fence', () => {
    const c = canvas(128, 128);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(190,200,215,0.9)';
    ctx.lineWidth = 3;
    for (let i = -128; i < 256; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 128, 128); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i + 128, 0); ctx.lineTo(i, 128); ctx.stroke();
    }
    return c;
  });
}

export function grassTexture() {
  return memo('grass', () => {
    const c = canvas(512, 512);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#142017';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * 512, y = Math.random() * 512;
      ctx.fillStyle = `hsla(${100 + Math.random() * 40}, ${30 + Math.random() * 30}%, ${8 + Math.random() * 14}%, 0.8)`;
      ctx.fillRect(x, y, 1.5, 3 + Math.random() * 4);
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = 'rgba(40,30,20,0.35)';
      ctx.beginPath();
      ctx.ellipse(Math.random() * 512, Math.random() * 512, 10 + Math.random() * 30, 6 + Math.random() * 18, Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    return c;
  });
}

export function stoneTexture() {
  return memo('stone', () => {
    const c = canvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#6d717a';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4000; i++) {
      const v = 80 + Math.random() * 60;
      ctx.fillStyle = `rgba(${v},${v + 2},${v + 8},0.25)`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(60,90,50,${Math.random() * 0.3})`;
      ctx.beginPath();
      ctx.arc(Math.random() * 256, 200 + Math.random() * 56, 4 + Math.random() * 14, 0, Math.PI * 2);
      ctx.fill();
    }
    return c;
  });
}

export function corrugatedTexture(color) {
  return memo(`corr:${color}`, () => {
    const c = canvas(256, 128);
    const ctx = c.getContext('2d');
    for (let x = 0; x < 256; x += 16) {
      const g = ctx.createLinearGradient(x, 0, x + 16, 0);
      g.addColorStop(0, shade(color, -0.12));
      g.addColorStop(0.5, shade(color, 0.08));
      g.addColorStop(1, shade(color, -0.12));
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 16, 128);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, 256, 6);
    ctx.fillRect(0, 122, 256, 6);
    return c;
  });
}

export function cardboardCanvas(type) {
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b8864b';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = `rgba(90,60,30,${Math.random() * 0.12})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 1);
  }
  ctx.fillStyle = 'rgba(220,200,150,0.6)';
  ctx.fillRect(112, 0, 32, 256);
  drawAwsLogo(ctx, 64, 70, 128, '#2a1a0a');
  ctx.fillStyle = '#2a1a0a';
  const t = fitText(ctx, type.replace('AWS::', ''), 230, 26, 700);
  ctx.textAlign = 'center';
  ctx.fillText(t, 128, 210);
  return c;
}
