import { sql } from 'drizzle-orm';
import { db } from '@/db';

// Hit daily by the Vercel cron in vercel.json so the free Supabase project never looks idle.
// ponytail: public and unauthenticated — it only runs `select 1`. Add a CRON_SECRET check if it ever does more.
export const dynamic = 'force-dynamic';

export async function GET() {
  await db.execute(sql`select 1`);
  return Response.json({ ok: true });
}
