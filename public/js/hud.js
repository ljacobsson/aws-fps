import { iconDataUrl } from './textures.js';
import { SERVICES, statusColor } from './theme.js';
import { pickRandom, READONLY_QUIPS } from './humor.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function highlightJson(obj) {
  const json = JSON.stringify(obj, null, 2) ?? 'null';
  return esc(json).replace(
    /(&quot;(?:\\.|[^&]|&(?!quot;))*?&quot;)(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (m, str, colon, lit, num) => {
      if (str) return colon ? `<span class="j-key">${str}</span>${colon}` : `<span class="j-str">${str}</span>`;
      if (lit) return `<span class="j-lit">${lit}</span>`;
      return `<span class="j-num">${num}</span>`;
    },
  );
}

export class Hud {
  constructor() {
    this.root = $('#hud');
    this.minimap = $('#minimap');
    this.mctx = this.minimap.getContext('2d');
    this.notifyQueue = [];
    this.respect = 0;
    this.onAction = null;
    this.panelOpen = false;
    $('#inspect-close').addEventListener('click', () => this.hideInspect());
    $('#inspect-actions').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (btn && this.current) this.onAction?.(btn.dataset.action, this.current, btn);
    });
  }

  show() { this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); }

  setAccount(meta, alarmCount) {
    const id = String(meta.accountId || '000000000000');
    $('#money').textContent = `$${id.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
    $('#money').title = 'Your AWS account ID. Also roughly your monthly bill.';
    $('#whoami').textContent = `${meta.profile} · ${meta.region}${meta.demo ? ' · DEMO' : ''}`;
    const stars = Math.min(5, alarmCount);
    $('#stars').innerHTML = Array.from({ length: 5 }, (_, i) => `<span class="${i < stars ? 'on' : ''}">★</span>`).join('');
    $('#stars').title = `${alarmCount} CloudWatch alarm(s) in ALARM state. The more stars, the more PagerDuty wants you.`;
  }

  tickClock() {
    const d = new Date();
    $('#clock').textContent = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
  }

  banner(title, sub, color = '#ff9900') {
    const el = $('#banner');
    el.innerHTML = `<div class="b-title" style="--c:${color}">${esc(title)}</div>${sub ? `<div class="b-sub">${esc(sub)}</div>` : ''}`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  notify(from, text, kind) {
    const box = $('#notify');
    const el = document.createElement('div');
    el.className = 'note';
    el.innerHTML = `${kind ? `<img src="${iconDataUrl(kind, 48)}">` : ''}<div><b>${esc(from)}</b><span>${esc(text)}</span></div>`;
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 6500);
    setTimeout(() => el.remove(), 7200);
  }

  prompt(text) {
    const el = $('#prompt');
    if (!text) { el.classList.remove('show'); return; }
    if (el.dataset.text !== text) {
      el.innerHTML = text;
      el.dataset.text = text;
    }
    el.classList.add('show');
  }

  say(name, line) {
    const el = $('#subtitle');
    el.innerHTML = `<b>${esc(name)}:</b> ${esc(line)}`;
    el.classList.add('show');
    clearTimeout(this.sayT);
    this.sayT = setTimeout(() => el.classList.remove('show'), 5200);
  }

  floatText(text, color = '#9cff6a') {
    const el = document.createElement('div');
    el.className = 'floater';
    el.style.color = color;
    el.textContent = text;
    this.root.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }

  mission(text, done, total) {
    $('#mission').innerHTML = text
      ? `<div class="m-head">OBJECTIVE <span>${done}/${total}</span></div><div class="m-text">${esc(text)}</div>`
      : `<div class="m-head">ALL OBJECTIVES COMPLETE</div><div class="m-text">Promoted to Senior Data Center Technician. Still read-only.</div>`;
  }

  missionPassed(title = 'MISSION PASSED', sub = 'Well-Architected +1') {
    const el = $('#passed');
    el.innerHTML = `<div class="p-title">${esc(title)}</div><div class="p-sub">${esc(sub)}</div>`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  setMode(mode) {
    $('#mode').textContent = mode === 'fps' ? 'FIRST PERSON' : "BIRD'S EYE";
    $('#crosshair').classList.toggle('hidden', mode !== 'fps');
  }

  setLocked(locked, frozen) {
    $('#click-to-play').classList.toggle('show', !locked && !frozen && !this.panelOpen);
  }

  fade(on, text = '') {
    const el = $('#fade');
    $('#fade-text').textContent = text;
    el.classList.toggle('on', on);
    return new Promise((r) => setTimeout(r, on ? 320 : 50));
  }

  quip() { this.notify('IAM', pickRandom(READONLY_QUIPS), 'iam'); }

  toggleHelp(force) {
    $('#help').classList.toggle('show', force ?? !$('#help').classList.contains('show'));
  }

  // -------------------------------------------------------------------------

  drawMinimap(area, player, mode) {
    const c = this.minimap, ctx = this.mctx;
    const W = c.width, R = W / 2;
    const scale = mode === 'bird' ? 3 : 4;
    ctx.save();
    ctx.clearRect(0, 0, W, W);
    ctx.beginPath();
    ctx.arc(R, R, R - 4, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(14,22,30,0.92)';
    ctx.fillRect(0, 0, W, W);
    ctx.translate(R, R);
    ctx.rotate(player.yaw);
    ctx.scale(scale, scale);
    ctx.translate(-player.pos.x, -player.pos.z);
    if (area) {
      for (const zn of area.minimap.zones) {
        ctx.fillStyle = zn.color;
        ctx.fillRect(zn.x, zn.z, zn.w, zn.d);
      }
      ctx.strokeStyle = '#7d8ea6';
      ctx.lineWidth = 2 / scale * 1.5;
      ctx.beginPath();
      for (const [x1, z1, x2, z2] of area.minimap.walls) { ctx.moveTo(x1, z1); ctx.lineTo(x2, z2); }
      ctx.stroke();
      for (const m of area.minimap.marks) {
        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.arc(m.x, m.z, m.size / scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    // north marker
    ctx.save();
    ctx.translate(R, R);
    const nAng = player.yaw - Math.PI / 2;
    ctx.fillStyle = '#fff';
    ctx.font = '700 15px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', Math.cos(nAng) * (R - 16), Math.sin(nAng) * (R - 16));
    // player arrow
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ff9900';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // ring
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(R, R, R - 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // -------------------------------------------------------------------------

  showInspect(item, { actions = [], extra, image } = {}) {
    this.current = item;
    this.panelOpen = true;
    const kind = item.kind && SERVICES[item.kind] ? item.kind : 'generic';
    const svc = SERVICES[kind];
    const color = svc?.color || '#ff9900';
    $('#inspect').style.setProperty('--c', color);
    $('#inspect-icon').src = iconDataUrl(kind === 'poster' ? 'generic' : kind, 96);
    $('#inspect-kind').textContent = item.typeLabel || svc?.title || item.kind || 'Resource';
    $('#inspect-name').textContent = item.name || item.id || '(unnamed)';
    const st = item.status ? `<span class="pill" style="--s:${statusColor(item.status)}">${esc(item.status)}</span>` : '';
    const rows = [
      item.sub ? ['Detail', item.sub] : null,
      item.id && item.id !== item.name ? ['ID', item.id] : null,
    ].filter(Boolean);
    $('#inspect-meta').innerHTML = `${st}<table>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>`;
    $('#inspect-image').innerHTML = image ? `<img src="${image}">` : '';
    $('#inspect-body').innerHTML = extra ?? `<pre class="json">${highlightJson(item.info ?? {})}</pre>`;
    $('#inspect-actions').innerHTML = [
      ...actions.map((a) => `<button data-action="${a.id}">${esc(a.label)}</button>`),
      item.id ? '<button data-action="copy">Copy ID</button>' : '',
    ].join('');
    $('#inspect-foot').textContent = pickRandom([
      'Read-only mode. Your change request has been filed under /dev/null.',
      'ReadOnlyAccess: look with your eyes, not with your `aws ... delete-*`.',
      'This view was brought to you by free API calls only.',
      'Environment variable values are masked. You are welcome, security team.',
    ]);
    $('#inspect').classList.add('show');
  }

  setInspectBody(html) { $('#inspect-body').innerHTML = html; }
  setInspectJson(obj, title) {
    $('#inspect-body').innerHTML = `${title ? `<div class="sub-h">${esc(title)}</div>` : ''}<pre class="json">${highlightJson(obj)}</pre>`;
  }
  setInspectText(text, title) {
    $('#inspect-body').innerHTML = `${title ? `<div class="sub-h">${esc(title)}</div>` : ''}<pre class="json">${esc(text)}</pre>`;
  }

  hideInspect() {
    $('#inspect').classList.remove('show');
    this.panelOpen = false;
    this.current = null;
    this.onClose?.();
  }
}

export { esc, highlightJson };
