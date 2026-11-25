import * as THREE from 'three';
import { sharedTime, makeLabelSprite, toLocal } from './kit.js';
import { AREAS } from './areas.js';
import { esc } from './hud.js';
import { PAGER, TIPS, pickRandom } from './humor.js';

const MISSIONS = [
  { id: 'cfn', text: 'Find the CloudFormation Stacks hall.', test: (e) => e.type === 'enter' && e.area === 'cfnHall' },
  { id: 'stack', text: 'Walk through a stack door.', test: (e) => e.type === 'enter' && e.area === 'stack' },
  { id: 'lambda', text: 'Inspect a Lambda function (press E near one).', test: (e) => e.type === 'inspect' && e.kind === 'lambda' },
  { id: 'vpc', text: 'Pass through the VPC air tunnel.', test: (e) => e.type === 'enter' && e.area === 'vpcTunnel' },
  { id: 'cw', text: 'Report to the CloudWatch surveillance center.', test: (e) => e.type === 'enter' && e.area === 'cloudwatch' },
  { id: 'template', text: 'Read a stack template at a terminal. Do not edit it. Seriously.', test: (e) => e.type === 'template' },
  { id: 'respects', text: 'Pay respects at the Service Graveyard (press F at a grave).', test: (e) => e.type === 'respects' },
];

const DETAIL_KINDS = new Set(['lambda', 'dynamodb', 'sfn']);

export class World {
  constructor({ engine, hud, sound, data, api }) {
    Object.assign(this, { engine, hud, sound, data, api });
    this.cache = new Map();
    this.area = null;
    this.spec = null;
    this.busy = false;
    this.frame = 0;
    this.focus = null;
    this.missionsDone = new Set();
    this.alarmCount = (data.services.alarm?.items || []).filter((a) => a.status === 'ALARM').length;

    engine.updaters.add((dt, t) => this.update(dt, t));
    engine.on('key', (code, e) => this.onKey(code, e));
    engine.on('mode', (m) => { hud.setMode(m); this.applyCeilings(); });
    engine.on('lockchange', (locked) => hud.setLocked(locked, engine.frozen));
    hud.onAction = (action, item, btn) => this.onAction(action, item, btn);
    hud.onClose = () => {
      this.engine.frozen = false;
      this.engine.lock();
      setTimeout(() => hud.setLocked(this.engine.locked, this.engine.frozen), 400);
    };
    this.updateMission();
    this.schedulePager();
  }

  // -------------------------------------------------------------------------

  async go(spec, spawn = 'default') {
    if (this.busy) return;
    this.busy = true;
    const eng = this.engine;
    eng.frozen = true;
    this.sound.whoosh();
    await this.hud.fade(true, spec.loading || pickRandom(TIPS));
    let built = null;
    try {
      built = await AREAS[spec.type](this, spec);
    } catch (e) {
      console.error(e);
      this.hud.notify('CloudFormation', `UPDATE_ROLLBACK_COMPLETE: could not build area (${e.message})`, 'cfn');
    }
    if (built) {
      this.#disposeArea();
      this.area = built;
      this.spec = spec;
      eng.scene.add(built.group);
      eng.colliders = built.colliders;
      eng.bounds = built.bounds;
      eng.scene.fog = new THREE.Fog(built.fog.color, built.fog.near, built.fog.far);
      eng.scene.background = new THREE.Color(built.background);
      eng.hemi.intensity = built.lighting.hemi;
      eng.sun.intensity = built.lighting.sun;
      eng.scene.environmentIntensity = built.lighting.env;
      eng.renderer.toneMappingExposure = built.lighting.exposure;
      this.applyCeilings();
      const sp = built.spawns[spawn] || built.spawns.default || { x: 0, z: 0, yaw: 0 };
      eng.teleport(sp.x, sp.z, sp.yaw);
      this.updateLabels(true);
    }
    await this.hud.fade(false);
    eng.frozen = this.hud.panelOpen;
    this.busy = false;
    if (built) {
      this.hud.banner(built.title, built.subtitle, built.color);
      this.sound.setAmbience(built.ambience || 'indoor');
      built.onEnter?.(this);
      this.event({ type: 'enter', area: spec.type });
    }
  }

  #disposeArea() {
    const a = this.area;
    if (!a) return;
    this.engine.scene.remove(a.group);
    for (const l of a.labels) {
      if (l.sprite) { l.sprite.material.map.dispose(); l.sprite.material.dispose(); l.sprite = null; }
    }
    for (const d of a.disposables) d?.dispose?.();
    this.area = null;
  }

  applyCeilings() {
    if (!this.area) return;
    const show = this.engine.mode === 'fps';
    for (const c of this.area.ceilings) c.visible = show;
  }

  // -------------------------------------------------------------------------

  update(dt, t) {
    sharedTime.value = t;
    const a = this.area;
    if (!a) return;
    const ctx = { player: this.engine.player, world: this, mode: this.engine.mode };
    for (const fn of a.updaters) fn(dt, t, ctx);
    if (!this.busy && !this.engine.frozen) this.#checkPortals();
    this.frame++;
    if (this.frame % 3 === 0) this.#updateFocus();
    if (this.frame % 8 === 0) this.updateLabels();
    if (this.frame % 2 === 0) this.hud.drawMinimap(a, this.engine.player, this.engine.mode);
    if (this.frame % 120 === 0) this.hud.tickClock();
  }

  #checkPortals() {
    const p = this.engine.player.pos;
    for (const portal of this.area.portals) {
      if (portal.open < 0.6 || !portal.target) continue;
      const [lx, lz] = toLocal(portal.x, portal.z, portal.ry, p.x, p.z);
      const inside = Math.abs(lx) < portal.width / 2 && (portal.twoSided ? Math.abs(lz) < 0.3 : lz < 0.3 && lz > -0.7);
      if (inside) {
        const { spec, spawn } = portal.target;
        this.go(spec, spawn);
        return;
      }
    }
  }

  #updateFocus() {
    const eng = this.engine;
    const p = eng.player.pos;
    const fwd = eng.forward();
    const minDot = eng.mode === 'fps' ? 0.4 : -0.2;
    let best = null, bestScore = Infinity;
    for (const it of this.area.interactables) {
      const dx = it.pos.x - p.x, dz = it.pos.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > it.radius) continue;
      const dot = d < 0.05 ? 1 : (dx * fwd.x + dz * fwd.z) / d;
      if (dot < minDot) continue;
      const score = d * (1.8 - dot);
      if (score < bestScore) { bestScore = score; best = it; }
    }
    this.focus = best;
    if (!best || this.hud.panelOpen) { this.hud.prompt(null); return; }
    const verb = best.prompt || (best.npc ? 'Talk to' : 'Inspect');
    const extra = best.kind === 'grave' ? ' &nbsp;<kbd>F</kbd> Pay respects' : '';
    this.hud.prompt(`<kbd>E</kbd> ${esc(verb)} <b>${esc(best.title)}</b>${best.sub ? ` <i>${esc(best.sub)}</i>` : ''}${extra}`);
  }

  updateLabels(force = false) {
    const a = this.area;
    if (!a) return;
    const p = this.engine.player.pos;
    const mult = this.engine.mode === 'bird' ? 1.5 : 1;
    let created = 0;
    for (const l of a.labels) {
      const R = (l.opts.range || 22) * mult;
      const d = Math.hypot(l.x - p.x, l.z - p.z);
      if (d < R && !l.sprite && (force || created < 16)) {
        l.sprite = makeLabelSprite(l.text, l.opts);
        l.sprite.position.set(l.x, l.y, l.z);
        a.group.add(l.sprite);
        created++;
      } else if (d > R + 8 && l.sprite) {
        a.group.remove(l.sprite);
        l.sprite.material.map.dispose();
        l.sprite.material.dispose();
        l.sprite = null;
      }
    }
  }

  // -------------------------------------------------------------------------

  onKey(code) {
    const hud = this.hud;
    if (code === 'Escape') {
      if (hud.panelOpen) hud.hideInspect();
      hud.toggleHelp(false);
      return;
    }
    if (code === 'KeyH' || code === 'F1') { hud.toggleHelp(); return; }
    if (code === 'KeyN') { const m = this.sound.toggleMute(); hud.notify('Facilities', m ? 'Muted. The servers are still humming, you just can\'t hear them.' : 'Sound on. Enjoy the 60 Hz.', 'generic'); return; }
    if (this.busy) return;
    if (hud.panelOpen) {
      if (code === 'KeyE') hud.hideInspect();
      return;
    }
    switch (code) {
      case 'KeyV': this.engine.toggleMode(); break;
      case 'KeyE':
        if (this.focus) this.use(this.focus);
        break;
      case 'KeyF':
        if (this.focus?.kind === 'grave') this.payRespects(this.focus);
        else hud.notify('HR', 'F. (There is nothing here to pay respects to. Yet.)', 'iam');
        break;
      case 'KeyL':
        if (this.spec?.type !== 'lobby') this.go({ type: 'lobby' });
        break;
      case 'KeyX': case 'Delete': case 'Backspace':
        this.sound.denied();
        hud.quip();
        break;
      default:
    }
  }

  use(it) {
    if (it.onUse) { it.onUse(this, it); return; }
    this.inspect(it.item);
  }

  inspect(item, opts = {}) {
    if (!item) return;
    const actions = [...(opts.actions || [])];
    if (DETAIL_KINDS.has(item.kind) && !this.data.meta.demo) actions.unshift({ id: 'details', label: 'Load live details' });
    if (item.kind === 'cfnStack') actions.unshift({ id: 'stackDetails', label: 'Describe stack' }, { id: 'template', label: 'View template' });
    this.engine.frozen = true;
    this.engine.unlock();
    this.hud.showInspect(item, { ...opts, actions });
    this.hud.setLocked(true, true);
    this.event({ type: 'inspect', kind: item.kind });
  }

  async onAction(action, item, btn) {
    const hud = this.hud;
    const busy = (label) => { if (btn) { btn.disabled = true; btn.textContent = label; } };
    try {
      if (action === 'copy') {
        await navigator.clipboard.writeText(item.id);
        btn.textContent = 'Copied!';
      } else if (action === 'details') {
        busy('Loading…');
        const d = await this.api.details(item.kind, item.id);
        hud.setInspectJson(d, 'Live details — fetched with a free, read-only call');
        btn.textContent = 'Loaded';
      } else if (action === 'stackDetails') {
        busy('Loading…');
        const d = await this.stackDetails(item.id);
        hud.setInspectJson(d.stack, 'DescribeStacks');
        btn.disabled = false;
        btn.textContent = 'Describe stack';
      } else if (action === 'template') {
        busy('Loading…');
        const d = await this.api.details('cfnTemplate', item.id);
        hud.setInspectText(d?.TemplateBody || '(empty template?! how?)', 'GetTemplate — look, but do not deploy');
        btn.disabled = false;
        btn.textContent = 'View template';
        this.event({ type: 'template' });
      } else if (item.actionHandlers?.[action]) {
        await item.actionHandlers[action](this, btn);
      }
    } catch (e) {
      hud.setInspectText(`${e.code || 'Error'}: ${e.message}`, 'The API said no');
      if (btn) { btn.disabled = false; btn.textContent = 'Retry'; }
    }
  }

  async stackDetails(id) {
    const key = `stack:${id}`;
    if (!this.cache.has(key)) this.cache.set(key, await this.api.details('cfnStack', id));
    return this.cache.get(key);
  }

  payRespects(it) {
    if (it.respected) {
      this.hud.notify('Graveyard', `You already paid respects to ${it.title}. It appreciates it. Eventually consistently.`, 'grave');
      return;
    }
    it.respected = true;
    this.hud.respect++;
    this.hud.floatText('RESPECT +');
    this.sound.beep([392, 523], 0.14);
    this.event({ type: 'respects' });
  }

  // -------------------------------------------------------------------------

  event(e) {
    let changed = false;
    for (const m of MISSIONS) {
      if (!this.missionsDone.has(m.id) && m.test(e)) {
        this.missionsDone.add(m.id);
        changed = true;
        setTimeout(() => {
          this.sound.jingle();
          this.hud.missionPassed('MISSION PASSED', pickRandom(['Well-Architected +1', 'Respect +', 'Operational Excellence +1', 'Frugality +1', 'Bias for Action +1']));
        }, 600);
      }
    }
    if (changed) this.updateMission();
  }

  updateMission() {
    const next = MISSIONS.find((m) => !this.missionsDone.has(m.id));
    this.hud.mission(next?.text, this.missionsDone.size, MISSIONS.length);
  }

  schedulePager() {
    const fire = () => {
      if (!this.engine.frozen) {
        const [from, text] = pickRandom(PAGER);
        this.hud.notify(from, text, from === 'CloudWatch' ? 'alarm' : from === 'AWS Health' ? 'generic' : undefined);
        this.sound.beep();
      }
      setTimeout(fire, 45000 + Math.random() * 45000);
    };
    setTimeout(fire, 25000);
  }
}
