import { api } from './api.js';
import { Engine } from './engine.js';
import { Hud } from './hud.js';
import { World } from './world.js';
import { Sound } from './audio.js';
import { TIPS, pickRandom } from './humor.js';
import { drawAwsLogo, canvas } from './textures.js';

const $ = (s) => document.querySelector(s);
const REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'ca-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
  'eu-central-2', 'eu-north-1', 'eu-south-1', 'eu-south-2', 'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
  'ap-northeast-2', 'ap-northeast-3', 'sa-east-1', 'me-central-1', 'af-south-1',
];
const params = new URLSearchParams(location.search);
const sound = new Sound();
let profiles = [];

function setStatus(text, kind = '') {
  const el = $('#start-status');
  el.className = kind;
  el.innerHTML = text;
}

async function init() {
  const logo = canvas(400, 290);
  drawAwsLogo(logo.getContext('2d'), 40, 10, 320);
  $('#title-logo').src = logo.toDataURL();
  $('#title-tip').textContent = pickRandom(TIPS);

  const regionSel = $('#region');
  regionSel.innerHTML = REGIONS.map((r) => `<option>${r}</option>`).join('');
  try {
    profiles = (await api.profiles()).profiles;
  } catch (e) {
    setStatus(`Could not read ~/.aws/config: ${e.message}. Try the demo account.`, 'err');
  }
  const sel = $('#profile');
  sel.innerHTML = [
    '<option value="demo">🎮 Demo account (no credentials needed)</option>',
    ...profiles.map((p) => `<option value="${p.name}">${p.sso ? '🔐' : '🔑'} ${p.name}${p.accountId ? ` · ${p.accountId}` : ''}${p.roleName ? ` · ${p.roleName}` : ''}</option>`),
  ].join('');
  const last = localStorage.getItem('gtas.profile');
  if (last && [...sel.options].some((o) => o.value === last)) sel.value = last;
  const syncRegion = () => {
    const p = profiles.find((x) => x.name === sel.value);
    const saved = localStorage.getItem(`gtas.region.${sel.value}`);
    regionSel.value = saved || p?.region || (sel.value === 'demo' ? 'eu-west-1' : 'us-east-1');
  };
  sel.addEventListener('change', syncRegion);
  syncRegion();
  $('#start-form').addEventListener('submit', (e) => { e.preventDefault(); clockIn(); });
  if (params.has('demo')) { sel.value = 'demo'; syncRegion(); clockIn(); }
}

async function clockIn() {
  sound.start();
  const profile = $('#profile').value;
  const region = $('#region').value;
  localStorage.setItem('gtas.profile', profile);
  localStorage.setItem(`gtas.region.${profile}`, region);
  api.profile = profile;
  api.region = region;
  $('#clock-in').disabled = true;
  setStatus('Checking your badge with STS…');
  try {
    let s = await api.session(profile, region);
    if (!s.ok && s.error?.code === 'SSO_LOGIN_REQUIRED') {
      s = await ssoLogin(profile, region);
    }
    if (!s.ok && s.error?.code === 'CREDENTIALS_INVALID') s.error.message += ' (This is not an SSO profile — refresh its keys in ~/.aws/credentials.)';
    if (!s.ok) throw Object.assign(new Error(s.error?.message || 'Unknown error'), { code: s.error?.code });
    await scan(profile, region);
  } catch (e) {
    setStatus(`<b>${e.code || 'Error'}</b>: ${e.message}`, 'err');
    $('#clock-in').disabled = false;
  }
}

async function ssoLogin(profile, region) {
  setStatus(`Your SSO session for <b>${profile}</b> has expired. <button type="button" id="do-login">Log in via browser</button>`, 'warn');
  await new Promise((resolve) => $('#do-login').addEventListener('click', resolve, { once: true }));
  await api.login(profile);
  setStatus('Running <code>aws sso login</code> — approve the request in the browser tab that just opened…', 'warn');
  for (let i = 0; i < 150; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const st = await api.loginStatus(profile);
    if (!st.running) {
      const s = await api.session(profile, region);
      if (s.ok) return s;
      if (st.code !== 0) throw new Error(`aws sso login exited with code ${st.code}: ${st.output || ''}`.slice(0, 400));
    }
  }
  throw new Error('Timed out waiting for SSO login');
}

async function scan(profile, region) {
  $('#start').classList.add('hidden');
  $('#loading').classList.remove('hidden');
  $('#loading-tip').textContent = pickRandom(TIPS);
  const tipTimer = setInterval(() => { $('#loading-tip').textContent = pickRandom(TIPS); }, 4500);
  try {
    const { id } = await api.startScan(profile, region);
    let res;
    for (;;) {
      await new Promise((r) => setTimeout(r, 400));
      res = await api.scanStatus(id);
      $('#loading-bar').style.width = `${Math.round(res.progress * 100)}%`;
      $('#loading-log').innerHTML = res.log.map((l) => `<div>${l.replace(/[<>&]/g, '')}</div>`).join('');
      if (res.status !== 'running') break;
    }
    if (res.status === 'error') throw Object.assign(new Error(res.error?.message), { code: res.error?.code });
    await startGame(res.result);
  } catch (e) {
    $('#loading').classList.add('hidden');
    $('#start').classList.remove('hidden');
    setStatus(`<b>${e.code || 'Scan failed'}</b>: ${e.message}`, 'err');
    $('#clock-in').disabled = false;
  } finally {
    clearInterval(tipTimer);
  }
}

async function startGame(data) {
  const engine = new Engine($('#game'));
  const hud = new Hud();
  const world = new World({ engine, hud, sound, data, api });
  window.__game = { engine, world, hud, data };
  hud.setAccount(data.meta, world.alarmCount);
  hud.setMode(engine.mode);
  hud.tickClock();
  $('#loading').classList.add('hidden');
  hud.show();
  if (params.get('mode') === 'bird') engine.setMode('bird');
  const start = params.get('area');
  await world.go(start ? JSON.parse(start) : { type: 'lobby' });
  hud.setLocked(false, false);
  $('#click-to-play').addEventListener('click', () => engine.lock());
  $('#help-close').addEventListener('click', () => hud.toggleHelp(false));
}

init();
