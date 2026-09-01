import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;
const g = globalThis as { __db?: DrizzleDb };

// Lazy init: postgres() parses the URL immediately, so deferring it to first
// property access lets the Next.js build succeed without DATABASE_URL set.
export const db = new Proxy({} as DrizzleDb, {
  get(_, key: string | symbol) {
    if (!g.__db) {
      const client = postgres(process.env.DATABASE_URL!, {
        prepare: false,
        // Parse NUMERIC columns as JS numbers (default is string).
        types: {
          numeric: {
            to: 1700,
            from: [1700],
            serialize: (x: number | string) => String(x),
            parse: (x: string) => parseFloat(x),
          },
        },
      });
      g.__db = drizzle(client, { schema });
    }
    return (g.__db as unknown as Record<string | symbol, unknown>)[key];
  },
});
