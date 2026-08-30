import { Pool, type QueryResultRow } from "pg";

// Vercel's dashboard names the injected connection string differently
// depending on how Postgres storage was provisioned — check the project's
// Storage tab / environment variables to confirm which one is actually set.
const CONNECTION_STRING_ENV_VARS = [
  "POSTGRES_URL",
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
] as const;

function resolveConnectionString(): string {
  for (const name of CONNECTION_STRING_ENV_VARS) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(
    `No database connection string found. Set one of: ${CONNECTION_STRING_ENV_VARS.join(", ")}.`,
  );
}

let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    const connectionString = resolveConnectionString();
    pool = new Pool({
      connectionString,
      // Neon (and most managed Postgres) terminate TLS with a cert chain
      // that Node's default CA bundle doesn't include; the connection is
      // still encrypted, we just don't verify the chain.
      ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
    });
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
