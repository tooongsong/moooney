'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { nowPartsIn, todayIn, safeTimeZone, type CalendarDate } from '@/lib/dates';

/**
 * "Now" according to the user's configured zone, not the server's.
 *
 * Pages need this to decide which month is the current one and to stop period
 * navigation from running into the future. Computing it from the server clock
 * puts the app in UTC — a transaction added at 7pm Pacific on the 30th would
 * land in the next month.
 */
export async function getCurrentPeriod(): Promise<{
  year: number;
  month: number;
  today: CalendarDate;
  timezone: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const timezone = safeTimeZone(user.user_metadata?.timezone as string | undefined);
  const { year, month } = nowPartsIn(timezone);
  return { year, month, today: todayIn(timezone), timezone };
}
