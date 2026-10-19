function resolvePostgresUrl(env = process.env) {
  const configuredUrl = [env.URL_POSTGRES, env.POSTGRES_URL, env.DATABASE_URL]
    .find((value) => typeof value === 'string' && value.trim());
  const host = String(env.PGHOST || '').trim();
  const value = configuredUrl || (/^postgres(?:ql)?:/i.test(host) ? host : '');
  if (!value) return undefined;

  // Some configurations put the whole URI in PGHOST, sometimes with only one slash.
  // A PostgreSQL URI must be passed as connectionString, never as a DNS hostname.
  return value.trim().replace(/^postgres(?:ql)?:\/*/i, 'postgresql://');
}

module.exports = { resolvePostgresUrl };
