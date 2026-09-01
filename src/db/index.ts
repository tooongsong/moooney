import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { __pgClient?: ReturnType<typeof postgres> };

const client =
  globalForDb.__pgClient ??
  postgres(process.env.DATABASE_URL!, {
    prepare: false,
    // Parse NUMERIC columns as JS numbers (default is string). Safe because
    // all monetary columns are NUMERIC(12,2) — no precision loss with parseFloat.
    types: {
      numeric: {
        to: 1700,
        from: [1700],
        serialize: (x: number | string) => String(x),
        parse: (x: string) => parseFloat(x),
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__pgClient = client;
}

export const db = drizzle(client, { schema });
