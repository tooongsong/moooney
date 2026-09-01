import { drizzle } from 'drizzle-orm/libsql/node';
import { createClient, type Client } from '@libsql/client';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import * as schema from './schema';

const dbPath = process.env.DATABASE_PATH || './data/app.db';
mkdirSync(dirname(dbPath), { recursive: true });

// Cache the client across Next.js dev-mode hot reloads so file changes don't
// open a fresh connection to the same SQLite file on every edit.
const globalForDb = globalThis as unknown as { __libsqlClient?: Client };

const client =
  globalForDb.__libsqlClient ??
  createClient({ url: `file:${dbPath}` });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__libsqlClient = client;
}

await client.execute('PRAGMA journal_mode = WAL;');
await client.execute('PRAGMA busy_timeout = 5000;');
// WAL's default (NORMAL) only fsyncs at checkpoint time, so a commit can return
// successfully in JS while the page is still sitting unflushed in the OS write
// buffer — an abrupt process kill (not just an OS crash) between that commit and
// the next checkpoint can then lose it. FULL fsyncs on every commit, trading a
// little write latency for the write actually being durable the moment it returns.
await client.execute('PRAGMA synchronous = FULL;');

// Best-effort: try to checkpoint the WAL into the main file before the process
// exits, so a dev-server kill leaves as little as possible sitting in the WAL.
function checkpointBeforeExit() {
  client.execute('PRAGMA wal_checkpoint(TRUNCATE);').catch(() => {});
}
process.once('SIGTERM', checkpointBeforeExit);
process.once('SIGINT', checkpointBeforeExit);

await client.execute(`
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date INTEGER NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL DEFAULT 'expense',
    category TEXT NOT NULL,
    merchant TEXT NOT NULL,
    description TEXT NOT NULL,
    payment_method TEXT,
    notes TEXT,
    receipt_url TEXT,
    items TEXT,
    raw_input TEXT,
    needs_review INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

await client.execute(`
  CREATE TABLE IF NOT EXISTS payment_methods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    starting_balance REAL NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'bank',
    created_at INTEGER NOT NULL
  );
`);

// Migrate existing databases created before starting_balance/type existed.
try {
  await client.execute('ALTER TABLE payment_methods ADD COLUMN starting_balance REAL NOT NULL DEFAULT 0;');
} catch {
  // Column already exists — fine.
}
try {
  await client.execute("ALTER TABLE payment_methods ADD COLUMN type TEXT NOT NULL DEFAULT 'bank';");
} catch {
  // Column already exists — fine.
}

await client.execute(`
  CREATE TABLE IF NOT EXISTS custom_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

await client.execute(`
  CREATE TABLE IF NOT EXISTS transfers (
    id TEXT PRIMARY KEY,
    date INTEGER NOT NULL,
    amount REAL NOT NULL,
    from_account TEXT NOT NULL,
    to_account TEXT NOT NULL,
    note TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

export const db = drizzle(client, { schema });
