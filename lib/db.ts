import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// ws is configured once per process. The globalThis.WebSocket guard prevents
// double-init in environments that already have a native WebSocket (browsers, Deno).
// serverExternalPackages in next.config.ts keeps ws out of the webpack bundle.
if (typeof globalThis.WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

// Lazy singleton: the pool is created on first query, not at module import.
// This prevents build-time crashes when DATABASE_URL is absent (CI, Vercel previews
// from forks, local builds without .env.local). The error surfaces at request time
// instead of crashing the entire Next.js build.
let _pool: Pool | null = null;

function getPool(): Pool {
  if (_pool) return _pool;
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return _pool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
