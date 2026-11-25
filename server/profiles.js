import { loadSharedConfigFiles } from '@smithy/shared-ini-file-loader';

/** List profiles from ~/.aws/config (and credentials), flagging SSO ones. */
export async function listProfiles() {
  const { configFile, credentialsFile } = await loadSharedConfigFiles({ ignoreCache: true });
  const names = new Set([...Object.keys(configFile || {}), ...Object.keys(credentialsFile || {})]);
  const profiles = [];
  for (const name of names) {
    if (/^(sso-session|services)\./.test(name)) continue; // other config section types, not profiles
    const cfg = configFile?.[name] || {};
    const sso = Boolean(cfg.sso_session || cfg.sso_start_url || cfg.sso_account_id);
    profiles.push({
      name,
      region: cfg.region || null,
      sso,
      accountId: cfg.sso_account_id || null,
      roleName: cfg.sso_role_name || null,
      ssoSession: cfg.sso_session || null,
    });
  }
  profiles.sort((a, b) => Number(b.sso) - Number(a.sso) || a.name.localeCompare(b.name));
  return profiles;
}
