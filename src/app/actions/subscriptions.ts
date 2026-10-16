'use server';

import { randomUUID } from 'crypto';
import { and, asc, eq, exists, isNull, or, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { paymentMethods, subscriptions } from '@/db/schema';
import { createClient } from '@/lib/supabase/server';
import { daysBetween, safeTimeZone, toCalendarDate, todayIn, type CalendarDate } from '@/lib/dates';
import { isSingleGrapheme } from '@/lib/utils';
import {
  monthlyEquivalent,
  nextOccurrence,
  SUBSCRIPTION_CYCLES,
  SUBSCRIPTION_STATUSES,
  type SubscriptionCycle,
  type SubscriptionStatus,
} from '@/lib/subscriptionSchedule';

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return user;
}

// Drizzle returns Postgres `numeric` as a string at runtime despite .$type<number>().
// Same guard the accounts actions use.
function toNum(v: unknown, field?: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    console.error(`[subscriptions] non-numeric value for ${field ?? '?'}:`, v);
    return 0;
  }
  return n;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Report a failed write.
 *
 * Drizzle puts the entire failed statement in its error message, and these
 * strings go straight into a toast. The real error belongs in the server log;
 * the user gets something they can act on, named for what they were doing.
 */
function failed(op: string, error: unknown, message: string) {
  console.error(`[subscriptions] ${op} failed:`, error);
  return { success: false as const, error: message };
}

// Named columns, always. notes and website are included because the edit form
// needs them and the rows are few; created_at and updated_at are not, because
// nothing renders them.
const SUB_COLUMNS = {
  id: true, name: true, emoji: true, amount: true, cycle: true,
  anchorDate: true, status: true, stoppedOn: true, category: true,
  paymentMethodId: true, website: true, notes: true,
} as const;

export interface SubscriptionRow {
  id: string;
  name: string;
  emoji: string | null;
  amount: number;
  cycle: SubscriptionCycle;
  anchorDate: CalendarDate;
  status: SubscriptionStatus;
  stoppedOn: CalendarDate | null;
  category: string | null;
  paymentMethodId: string | null;
  website: string | null;
  notes: string | null;
}

export interface UpcomingOccurrence {
  subscriptionId: string;
  name: string;
  emoji: string | null;
  cycle: SubscriptionCycle;
  amount: number;
  date: CalendarDate;
  /** Negative is in the past. 0 is today. */
  daysAway: number;
}

export interface SubscriptionsView {
  today: CalendarDate;
  subscriptions: (SubscriptionRow & { next: CalendarDate | null })[];
  /** Normalised rate, not a forecast of any calendar month. Active only. */
  monthlyTotal: number;
  annualTotal: number;
  activeCount: number;
  upcoming: UpcomingOccurrence[];
}

async function loadRows(userId: string): Promise<SubscriptionRow[]> {
  const rows = await db.query.subscriptions.findMany({
    where: eq(subscriptions.userId, userId),
    columns: SUB_COLUMNS,
    orderBy: [asc(subscriptions.name)],
  });
  return rows.map((r) => ({ ...r, amount: toNum(r.amount, 'amount') })) as SubscriptionRow[];
}

export async function getSubscriptionsView(): Promise<SubscriptionsView> {
  const user = await getUser();
  const today = todayIn(safeTimeZone(user.user_metadata?.timezone as string | undefined));

  const rows = await loadRows(user.id);
  const withNext = rows.map((s) => ({ ...s, next: nextOccurrence(s, today, today) }));

  // Paused and ended contribute nothing: you are not committed to them.
  const active = rows.filter((s) => s.status === 'active');
  const monthly = active.reduce((sum, s) => sum + monthlyEquivalent(s.amount, s.cycle), 0);

  const upcoming = withNext
    .filter((s): s is typeof s & { next: CalendarDate } => s.next !== null)
    .sort((a, b) => (a.next < b.next ? -1 : a.next > b.next ? 1 : 0))
    .slice(0, 3)
    .map((s) => ({
      subscriptionId: s.id,
      name: s.name,
      emoji: s.emoji,
      cycle: s.cycle,
      amount: s.amount,
      date: s.next,
      daysAway: daysBetween(today, s.next),
    }));

  return {
    today,
    subscriptions: withNext,
    monthlyTotal: round2(monthly),
    annualTotal: round2(monthly * 12),
    activeCount: active.length,
    upcoming,
  };
}

/**
 * Just the figure Overview's entry row shows. Two columns of the active rows —
 * Overview already runs four queries and this one must not be the expensive one.
 */
export async function getRecurringMonthlyTotal(): Promise<{ monthly: number; activeCount: number }> {
  const user = await getUser();
  const rows = await db.query.subscriptions.findMany({
    where: and(eq(subscriptions.userId, user.id), eq(subscriptions.status, 'active')),
    columns: { amount: true, cycle: true },
  });
  const monthly = rows.reduce((sum, r) => sum + monthlyEquivalent(toNum(r.amount, 'amount'), r.cycle), 0);
  return { monthly: round2(monthly), activeCount: rows.length };
}

/** id + name for the form's account picker. The existing listPaymentMethods
 *  selects every column, which this does not need. */
export async function getAccountOptions(): Promise<
  { id: string; name: string; archived: boolean }[]
> {
  const user = await getUser();
  // The core builder, not db.query: the relational API aliases the table as
  // "paymentMethods", which hides the name "payment_methods" — and the
  // correlated subquery below refers to the table by that name, so Postgres
  // rejects it (42P01, "invalid reference to FROM-clause entry").
  const rows = await db
    .select({ id: paymentMethods.id, name: paymentMethods.name, archivedAt: paymentMethods.archivedAt })
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.userId, user.id),
        or(
          isNull(paymentMethods.archivedAt),
          // An archived account that a subscription still pays from stays in the
          // picker. Deleting such an account archives it rather than removing
          // it, on the promise that it stays findable — and if the picker
          // dropped it, opening that subscription would show an empty "Pays
          // from" and clear the link on the next save.
          exists(
            db
              .select({ one: sql`1` })
              .from(subscriptions)
              .where(
                and(
                  eq(subscriptions.userId, user.id),
                  eq(subscriptions.paymentMethodId, paymentMethods.id),
                ),
              ),
          ),
        ),
      ),
    )
    .orderBy(asc(paymentMethods.name));
  return rows.map(({ id, name, archivedAt }) => ({ id, name, archived: archivedAt !== null }));
}

export interface SaveSubscriptionInput {
  /** Absent for a new subscription. */
  id?: string;
  name: string;
  amount: number;
  cycle: SubscriptionCycle;
  /** The first payment date. Re-anchors the whole series when edited. */
  anchorDate: string;
  emoji?: string | null;
  category?: string | null;
  paymentMethodId?: string | null;
  website?: string | null;
  notes?: string | null;
}

function clean(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export async function saveSubscription(
  input: SaveSubscriptionInput,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const user = await getUser();

  const name = input.name?.trim();
  if (!name) return { success: false, error: 'Name is required' };
  // Rounded first: the column holds two decimals, so 0.004 would pass this
  // check and then store as 0.00 — a subscription that costs nothing.
  if (!Number.isFinite(input.amount) || round2(input.amount) <= 0) {
    return { success: false, error: 'Amount must be greater than zero' };
  }
  if (!SUBSCRIPTION_CYCLES.includes(input.cycle)) {
    return { success: false, error: 'Pick a billing cycle' };
  }

  let anchorDate: CalendarDate;
  try {
    // Throws on 2026-02-30 rather than silently coercing it to March.
    anchorDate = toCalendarDate(input.anchorDate);
  } catch {
    return { success: false, error: 'Enter a valid first payment date' };
  }

  // numeric(12,2) tops out at 9,999,999,999.99. Past that Postgres rejects the
  // write with an overflow error the user can do nothing with, so catch it
  // here where there is something useful to say.
  if (input.amount > 9_999_999_999.99) {
    return { success: false, error: 'Amount is too large' };
  }

  const emoji = clean(input.emoji);
  if (emoji && !isSingleGrapheme(emoji)) {
    return { success: false, error: 'Use a single emoji' };
  }

  const paymentMethodId = clean(input.paymentMethodId);

  const values = {
    name,
    emoji,
    amount: input.amount,
    cycle: input.cycle,
    anchorDate,
    category: clean(input.category),
    paymentMethodId,
    website: clean(input.website),
    notes: clean(input.notes),
    updatedAt: new Date(),
  };

  try {
    // An account id arriving from the client is not evidence the caller owns
    // that account. RLS does not apply on this path, so the check is ours.
    //
    // Inside the try, because it is a database call: outside it, a connection
    // failure here would reject the action rather than return a result the
    // form can show, and the user would get a 500 instead of a message.
    if (paymentMethodId) {
      const [owned] = await db.query.paymentMethods.findMany({
        where: and(eq(paymentMethods.id, paymentMethodId), eq(paymentMethods.userId, user.id)),
        columns: { id: true },
        limit: 1,
      });
      if (!owned) return { success: false, error: 'Account not found' };
    }

    if (input.id) {
      const res = await db
        .update(subscriptions)
        .set(values)
        .where(and(eq(subscriptions.id, input.id), eq(subscriptions.userId, user.id)))
        .returning({ id: subscriptions.id });
      if (res.length === 0) return { success: false, error: 'Subscription not found' };
      revalidate();
      return { success: true, id: input.id };
    }

    const id = randomUUID();
    await db.insert(subscriptions).values({ id, userId: user.id, ...values });
    revalidate();
    return { success: true, id };
  } catch (error) {
    return failed('saveSubscription', error, 'Could not save. Please try again.');
  }
}

export async function setSubscriptionStatus(
  id: string,
  status: SubscriptionStatus,
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser();
  if (!SUBSCRIPTION_STATUSES.includes(status)) return { success: false, error: 'Unknown status' };

  const today = todayIn(safeTimeZone(user.user_metadata?.timezone as string | undefined));
  try {
    const res = await db
      .update(subscriptions)
      // Pausing and ending both record the day billing stopped, which is what
      // keeps a paused subscription from accruing an imaginary charge for
      // every month it stays paused. Reactivating clears it, or the series
      // would go on stopping at the old date.
      //
      // coalesce, not a plain assignment: the *first* stop is the one that
      // counts. Pause in October and end in December, and re-stamping would
      // move the stop to December and bring November's charge back as an
      // unconfirmed past occurrence — exactly what the stop date is for.
      .set({
        status,
        stoppedOn: status === 'active'
          ? null
          : sql`coalesce(${subscriptions.stoppedOn}, ${today}::date)`,
        updatedAt: new Date(),
      })
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, user.id)))
      .returning({ id: subscriptions.id });
    if (res.length === 0) return { success: false, error: 'Subscription not found' };
    revalidate();
    return { success: true };
  } catch (error) {
    return failed('setSubscriptionStatus', error, 'Could not update. Please try again.');
  }
}

export async function deleteSubscription(id: string): Promise<{ success: boolean; error?: string }> {
  const user = await getUser();
  try {
    // `on delete set null` on transactions.subscription_id: the expenses this
    // subscription was linked to survive untouched.
    await db
      .delete(subscriptions)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, user.id)));
    revalidate();
    return { success: true };
  } catch (error) {
    return failed('deleteSubscription', error, 'Could not delete. Please try again.');
  }
}

function revalidate() {
  revalidatePath('/subscriptions');
  // Overview carries the phone's entry row, which shows the monthly figure.
  revalidatePath('/overview');
}
