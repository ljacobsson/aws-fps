async function req(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || res.statusText);
    err.code = data?.error?.code;
    throw err;
  }
  return data;
}

export const api = {
  profile: null,
  region: null,
  profiles: () => req('/api/profiles'),
  session: (profile, region) => req(`/api/session?${new URLSearchParams({ profile, region })}`),
  login: (profile) => req('/api/login', { method: 'POST', body: { profile } }),
  loginStatus: (profile) => req(`/api/login/status?${new URLSearchParams({ profile })}`),
  startScan: (profile, region) => req('/api/scan', { method: 'POST', body: { profile, region } }),
  scanStatus: (id) => req(`/api/scan/${id}`),
  details(kind, id) {
    return req(`/api/details?${new URLSearchParams({ profile: this.profile, region: this.region, kind, id })}`).then((r) => r.details);
  },
  metrics() {
    return req(`/api/metrics?${new URLSearchParams({ profile: this.profile, region: this.region })}`);
  },
};
