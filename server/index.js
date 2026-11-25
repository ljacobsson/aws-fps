import express from 'express';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listProfiles } from './profiles.js';
import { scanAccount, getDetails, getMetrics, whoAmI, friendlyError, forgetCredentials } from './aws.js';
import { demoScan, demoDetails, demoMetrics } from './demo.js';
import { allowlist, budgets } from './readonly.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8086);
const HOST = '127.0.0.1';
const DEMO = 'demo';

const app = express();
app.use(express.json());

// Only answer requests addressed to localhost (blocks DNS-rebinding tricks from other sites).
app.use((req, res, next) => {
  const host = (req.headers.host || '').split(':')[0];
  if (!['localhost', '127.0.0.1'].includes(host)) return res.status(403).send('localhost only');
  next();
});

app.use('/vendor/three', express.static(path.join(root, 'node_modules/three')));
app.use(express.static(path.join(root, 'public')));

const wrap = (fn) => async (req, res) => {
  try {
    res.json(await fn(req, res));
  } catch (e) {
    res.status(500).json({ error: friendlyError(e) });
  }
};

app.get('/api/profiles', wrap(async () => ({ profiles: await listProfiles() })));

app.get('/api/allowlist', wrap(async () => ({ operations: allowlist(), budgets: budgets() })));

app.get('/api/session', wrap(async (req) => {
  const { profile, region } = req.query;
  if (profile === DEMO) return { ok: true, identity: demoScan().meta };
  try {
    return { ok: true, identity: await whoAmI(profile, region) };
  } catch (e) {
    const error = friendlyError(e);
    const isSso = (await listProfiles()).find((p) => p.name === profile)?.sso;
    if (error.code === 'SSO_LOGIN_REQUIRED' && !isSso) error.code = 'CREDENTIALS_INVALID';
    return { ok: false, error };
  }
}));

// `aws sso login` opens the browser for the device flow. We just start it and let the UI poll /api/session.
const logins = new Map();
app.post('/api/login', wrap(async (req) => {
  const { profile } = req.body || {};
  const profiles = await listProfiles();
  if (!profiles.some((p) => p.name === profile)) throw new Error(`Unknown profile ${profile}`);
  if (logins.get(profile)?.running) return { started: true };
  const child = spawn('aws', ['sso', 'login', '--profile', profile], { stdio: ['ignore', 'pipe', 'pipe'] });
  const state = { running: true, output: '' };
  logins.set(profile, state);
  child.stdout.on('data', (d) => { state.output += d; });
  child.stderr.on('data', (d) => { state.output += d; });
  child.on('error', (e) => { state.running = false; state.output += String(e); });
  child.on('close', (code) => { state.running = false; state.code = code; forgetCredentials(profile); });
  return { started: true };
}));

app.get('/api/login/status', wrap(async (req) => {
  const s = logins.get(req.query.profile);
  return s ? { running: s.running, code: s.code, output: s.output.slice(-2000) } : { running: false };
}));

const jobs = new Map();
const lastScan = new Map();

app.post('/api/scan', wrap(async (req) => {
  const { profile, region } = req.body || {};
  const id = randomUUID();
  const job = { status: 'running', progress: 0, log: [], result: null, error: null };
  jobs.set(id, job);
  const finish = (result) => {
    job.result = result;
    job.status = 'done';
    job.progress = 1;
    lastScan.set(`${profile}:${region}`, result);
  };
  if (profile === DEMO) {
    const steps = ['Badge accepted: intern@demo', 'lambda: found 46', 'dynamodb: found 9', 'vpc: found 3', 'cfn: found 20', 'Reading stack resources… (pretending)'];
    steps.forEach((m, i) => setTimeout(() => { job.log.push(m); job.progress = (i + 1) / (steps.length + 1); }, 150 * i));
    setTimeout(() => finish(demoScan()), 150 * steps.length + 200);
  } else {
    scanAccount({
      profile, region,
      onProgress: ({ msg, progress }) => {
        if (msg) job.log.push(msg);
        if (progress != null) job.progress = progress;
      },
    }).then(finish).catch((e) => { job.status = 'error'; job.error = friendlyError(e); });
  }
  return { id };
}));

app.get('/api/scan/:id', wrap(async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) { res.status(404); return { error: { code: 'NOT_FOUND', message: 'No such scan' } }; }
  return { status: job.status, progress: job.progress, log: job.log.slice(-12), result: job.status === 'done' ? job.result : null, error: job.error };
}));

app.get('/api/details', wrap(async (req) => {
  const { profile, region, kind, id } = req.query;
  if (profile === DEMO) return { details: demoDetails(kind, id) };
  return { details: await getDetails({ profile, region, kind, id }) };
}));

app.get('/api/metrics', wrap(async (req) => {
  const { profile, region } = req.query;
  const scan = lastScan.get(`${profile}:${region}`);
  if (!scan) throw new Error('Scan the account first');
  if (profile === DEMO) return demoMetrics(scan);
  return getMetrics({ profile, region, scan });
}));

app.listen(PORT, HOST, () => {
  console.log(`\n  🏢  Grand Theft Auto Scaling — data center open at http://localhost:${PORT}\n`);
  console.log('  Read-only, free API calls only. CloudWatch graphs are capped per session.');
  console.log('  The intern has been told not to touch anything.\n');
});
