import { Pool, type QueryResultRow } from "pg";

// Vercel's dashboard names the injected connection string differently
// depending on how Postgres storage was provisioned — check the project's
// Storage tab / environment variables to confirm which one is actually set.
// The STORAGE_-prefixed names are what Vercel's Supabase marketplace
// integration injects when a custom env var prefix ("STORAGE") is used.
const CONNECTION_STRING_ENV_VARS = [
  "POSTGRES_URL",
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "STORAGE_POSTGRES_URL",
  "STORAGE_POSTGRES_PRISMA_URL",
  "STORAGE_POSTGRES_URL_NON_POOLING",
] as const;

// pg builds its final config as `Object.assign({}, config, parse(connectionString))`
// (see pg/lib/connection-parameters.js) — the *parsed connection string*
// wins over an `ssl` option passed alongside it. So a Pool config like
// `{ connectionString, ssl: { rejectUnauthorized: false } }` silently drops
// that `ssl` override whenever the string itself carries a `sslmode` param,
// which managed providers (Supabase, Neon, ...) always include. Those modes
// (`require`, `prefer`, `verify-ca`) require full chain verification, which
// fails against Node's default CA bundle with "self-signed certificate in
// certificate chain". `no-verify` is the one mode pg-connection-string maps
// directly to `rejectUnauthorized: false`, so force it in the string itself
// instead of fighting the merge order.
function withNoVerifySsl(connectionString: string): string {
  if (connectionString.includes("localhost") || connectionString.includes("127.0.0.1")) {
    return connectionString;
  }
  if (/[?&]sslmode=/.test(connectionString)) {
    return connectionString.replace(/([?&])sslmode=[^&]*/, "$1sslmode=no-verify");
  }
  const separator = connectionString.includes("?") ? "&" : "?";
  return `${connectionString}${separator}sslmode=no-verify`;
}

export function resolveConnectionString(): string {
  for (const name of CONNECTION_STRING_ENV_VARS) {
    const value = process.env[name];
    if (value) return withNoVerifySsl(value);
  }
  throw new Error(
    `No database connection string found. Set one of: ${CONNECTION_STRING_ENV_VARS.join(", ")}.`,
  );
}

let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: resolveConnectionString() });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}
