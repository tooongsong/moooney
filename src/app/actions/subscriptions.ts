'use server';

import { randomUUID } from 'crypto';
import { and, asc, eq, exists, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { paymentMethods, subscriptions, transactions } from '@/db/schema';
import { createClient } from '@/lib/supabase/server';
import { addDays, daysBetween, monthRange, safeTimeZone, toCalendarDate, todayIn, yearRange, type CalendarDate } from '@/lib/dates';
import { isSingleGrapheme } from '@/lib/utils';
import {
  LINK_CANDIDATE_LIMIT,
  monthlyEquivalent,
  nextOccurrence,
  occurrencesBetween,
  occurrenceState,
  periodKeyOf,
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

export interface DayOccurrence {
  subscriptionId: string;
  name: string;
  emoji: string | null;
  amount: number;
  cycle: SubscriptionCycle;
  date: CalendarDate;
  /** Never inferred from the date alone. A past date is not a payment. */
  state: 'upcoming' | 'confirmed' | 'unconfirmed';
  /** What actually moved, when confirmed. Differs from `amount` after a price change. */
  paidAmount: number | null;
}

export interface MonthOccurrences {
  monthKey: string;
  year: number;
  /** 1-based. */
  month: number;
  today: CalendarDate;
  /** Keyed by full "YYYY-MM-DD". Days with nothing on them are absent. */
  byDay: Record<string, DayOccurrence[]>;
  expected: number;
  /** Still to pay between today and the end of the month: future occurrences
   *  with nothing linked. A charge already taken and linked is not remaining,
   *  whatever its date says. Meaningless for a past month. */
  remaining: number;
  isPastMonth: boolean;
}

export async function getMonthOccurrences(monthKey?: string): Promise<MonthOccurrences> {
  const user = await getUser();
  const today = todayIn(safeTimeZone(user.user_metadata?.timezone as string | undefined));

  // A month key off the URL is untrusted. monthRange(2026, 13) would happily
  // produce "2026-13-01", which is not a date.
  let year = Number(monthKey?.slice(0, 4));
  let month = Number(monthKey?.slice(5, 7));
  // Defence in depth, and the two halves guard different things. The lower
  // bound is not about string order — makeCalendarDate pads the year now. It
  // is partly Date.UTC, which reads years 0 to 99 as 1900 to 1999 so
  // "0050-01" would quietly become 1950, and partly that `key` below and
  // `shiftMonth` in the calendar both build "YYYY-MM" by hand without
  // padding, so a three-digit year yields a key its own shape check rejects.
  // The upper bound is about string order: past four digits it inverts.
  if (!/^\d{4}-\d{2}$/.test(monthKey ?? '') || !(month >= 1 && month <= 12)
      || !(year >= 1000 && year < 9999)) {
    year = Number(today.slice(0, 4));
    month = Number(today.slice(5, 7));
  }
  const key = `${year}-${String(month).padStart(2, '0')}`;
  const [first, last] = monthRange(year, month);

  const rows = await loadRows(user.id);

  // Links whose period could match something in this month. Four small
  // columns, bounded — not every link ever made.
  //
  // A yearly subscription matches by year, so its link can carry any date in
  // the year and still belong to this month's occurrence: edit the renewal
  // from March to May after March was paid, and a month-bounded query would
  // never see the March link, so May would read Unconfirmed here while Task
  // 8's history read Confirmed. Two views of one payment disagreeing is worse
  // than a slightly wider query.
  const hasYearly = rows.some((s) => s.cycle === 'yearly');
  const [linkFrom, linkTo] = hasYearly ? yearRange(year) : [first, last];

  const links = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, user.id),
      gte(transactions.subscriptionPeriod, linkFrom),
      lte(transactions.subscriptionPeriod, linkTo),
    ),
    columns: { id: true, amount: true, subscriptionId: true, subscriptionPeriod: true },
  });

  const paid = new Map<string, { id: string; amount: number }>();
  for (const l of links) {
    if (!l.subscriptionId || !l.subscriptionPeriod) continue;
    const cycle = rows.find((s) => s.id === l.subscriptionId)?.cycle;
    if (!cycle) continue;
    paid.set(`${l.subscriptionId}|${periodKeyOf(cycle, l.subscriptionPeriod)}`,
             { id: l.id, amount: toNum(l.amount, 'amount') });
  }

  const byDay: Record<string, DayOccurrence[]> = {};
  let expected = 0;
  let remaining = 0;

  for (const s of rows) {
    for (const date of occurrencesBetween(s, first, last, today)) {
      const hit = paid.get(`${s.id}|${periodKeyOf(s.cycle, date)}`);
      const state = occurrenceState(Boolean(hit), date, today);
      (byDay[date] ??= []).push({
        subscriptionId: s.id,
        name: s.name,
        emoji: s.emoji,
        amount: s.amount,
        cycle: s.cycle,
        date,
        state,
        paidAmount: hit ? hit.amount : null,
      });
      expected += s.amount;
      // Not merely still to come — still to *pay*. A charge dated the 19th
      // that was taken on the 14th and linked is confirmed, and counting it
      // as remaining would overstate what the rest of the month costs.
      //
      // Asked of occurrenceState rather than spelled out again: `date >=
      // today && !hit` is the same boundary in different words, sitting two
      // lines from the call, and if the rule ever moves they would disagree.
      if (state === 'upcoming') remaining += s.amount;
    }
  }

  return {
    monthKey: key,
    year,
    month,
    today,
    byDay,
    expected: round2(expected),
    remaining: round2(remaining),
    isPastMonth: last < today,
  };
}

/** A link whose period answers to no occurrence in the series any more. */
export interface OrphanedLink {
  transactionId: string;
  period: CalendarDate;
  amount: number;
}

export interface OccurrenceState {
  date: CalendarDate;
  periodKey: string;
  state: 'upcoming' | 'confirmed' | 'unconfirmed';
  paidAmount: number | null;
  transactionId: string | null;
}

/**
 * The last twelve occurrences, each with its state, plus any stranded links.
 *
 * Computed over the whole series rather than a rolling window: for a monthly
 * subscription five years old that is sixty string comparisons, which costs
 * nothing, and an arbitrary window would quietly lose a yearly subscription's
 * history.
 */
export async function getSubscriptionHistory(id: string): Promise<{
  today: CalendarDate;
  expected: number;
  occurrences: OccurrenceState[];
  orphaned: OrphanedLink[];
} | null> {
  const user = await getUser();
  const today = todayIn(safeTimeZone(user.user_metadata?.timezone as string | undefined));

  const [sub] = await db.query.subscriptions.findMany({
    where: and(eq(subscriptions.id, id), eq(subscriptions.userId, user.id)),
    columns: SUB_COLUMNS,
    limit: 1,
  });
  if (!sub) return null;
  const row = { ...sub, amount: toNum(sub.amount, 'amount') } as SubscriptionRow;

  const upTo = nextOccurrence(row, today, today) ?? today;
  const all = occurrencesBetween(row, row.anchorDate, upTo, today);

  const links = await db.query.transactions.findMany({
    where: and(eq(transactions.userId, user.id), eq(transactions.subscriptionId, id)),
    columns: { id: true, amount: true, subscriptionPeriod: true },
  });

  const paid = new Map<string, { id: string; amount: number }>();
  for (const l of links) {
    if (!l.subscriptionPeriod) continue;
    paid.set(periodKeyOf(row.cycle, l.subscriptionPeriod),
             { id: l.id, amount: toNum(l.amount, 'amount') });
  }

  // Moving the anchor across a month, or changing the cycle, can leave a link
  // pointing at a period the series no longer has. The spec calls that the
  // known ceiling and says it is "fixed by re-linking" — which is only true
  // if the stranded link is visible somewhere, because a linked transaction
  // is excluded from every candidate list. So surface them.
  const liveKeys = new Set(all.map((d) => periodKeyOf(row.cycle, d)));
  const orphaned: OrphanedLink[] = links
    .filter((l) => l.subscriptionPeriod && !liveKeys.has(periodKeyOf(row.cycle, l.subscriptionPeriod)))
    .map((l) => ({
      transactionId: l.id,
      period: l.subscriptionPeriod as CalendarDate,
      amount: toNum(l.amount, 'amount'),
    }));

  const occurrences = all.slice(-12).map((date) => {
    const key = periodKeyOf(row.cycle, date);
    const hit = paid.get(key);
    return {
      date,
      periodKey: key,
      state: occurrenceState(Boolean(hit), date, today),
      paidAmount: hit ? hit.amount : null,
      transactionId: hit ? hit.id : null,
    };
  });

  return { today, expected: row.amount, occurrences, orphaned };
}

export interface LinkCandidate {
  id: string;
  date: CalendarDate;
  merchant: string;
  amount: number;
  category: string;
}

/** Transactions near an occurrence that are not already claimed by something. */
export async function getLinkCandidates(
  subscriptionId: string,
  date: string,
): Promise<LinkCandidate[]> {
  const user = await getUser();
  let anchor: CalendarDate;
  try {
    anchor = toCalendarDate(date);
  } catch {
    return [];
  }

  // Ten days either side: a charge rarely lands on the stated day, and a
  // wider net would make the list something to search rather than pick from.
  const rows = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, user.id),
      // Expenses only. An income row, a refund or a balance adjustment is not
      // a subscription payment, and offering one invites a link that would
      // make the occurrence read Confirmed against money that came in.
      eq(transactions.type, 'expense'),
      gte(transactions.date, addDays(anchor, -10)),
      lte(transactions.date, addDays(anchor, 10)),
      isNull(transactions.subscriptionId),
    ),
    columns: { id: true, date: true, merchant: true, amount: true, category: true },
    // Nearest the occurrence first, not newest first. The window is 21 days
    // wide and the cap is 25, and after a statement import there can easily
    // be more than 25 expenses in it — in which case newest-first silently
    // drops the older half of the window, which is where a charge posted on
    // or before the stated day lives. The one transaction most likely to be
    // the right one was the one being cut.
    // Then the earlier day, not the later one: at equal distance a charge
    // posted the day *before* the stated date is the likelier match, which
    // is the same reasoning that put distance first. Then the id, because
    // same-day rows tie on both keys above and without a final one which of
    // them survives the cap is whatever order Postgres returns.
    orderBy: [sql`abs(${transactions.date} - ${anchor}::date)`, asc(transactions.date), asc(transactions.id)],
    limit: LINK_CANDIDATE_LIMIT,
  });

  return rows.map((r) => ({ ...r, amount: toNum(r.amount, 'amount') }));
}

export async function linkTransaction(
  transactionId: string,
  subscriptionId: string,
  period: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser();
  let periodDate: CalendarDate;
  try {
    periodDate = toCalendarDate(period);
  } catch {
    return { success: false, error: 'Not a valid period' };
  }

  try {
    // Inside the try, because it is a database call — the same reason
    // saveSubscription's ownership lookup is. Without this check a crafted id
    // could attach someone else's subscription to this transaction.
    const [owned] = await db.query.subscriptions.findMany({
      where: and(eq(subscriptions.id, subscriptionId), eq(subscriptions.userId, user.id)),
      columns: { id: true },
      limit: 1,
    });
    if (!owned) return { success: false, error: 'Subscription not found' };

    const res = await db
      .update(transactions)
      .set({ subscriptionId, subscriptionPeriod: periodDate, updatedAt: new Date() })
      // isNull: the picker only ever offers unlinked expenses, so a request
      // to link one that is already linked came from a stale view — a second
      // device, or a tab left open. Moving it would silently revert whatever
      // occurrence it currently confirms.
      .where(and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, user.id),
        isNull(transactions.subscriptionId),
        // The picker only offers expenses, but the picker is a read filter
        // and this is the write. A crafted call could otherwise confirm an
        // occurrence against money that came in.
        eq(transactions.type, 'expense'),
      ))
      .returning({ id: transactions.id });
    if (res.length === 0) {
      return { success: false, error: 'That payment is no longer available to link' };
    }
    revalidate();
    revalidatePath('/history');
    return { success: true };
  } catch (error) {
    return failed('linkTransaction', error, 'Could not link. Please try again.');
  }
}

export async function unlinkTransaction(
  transactionId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser();
  try {
    // Clears the link only. The expense itself is untouched — the money moved.
    await db
      .update(transactions)
      .set({ subscriptionId: null, subscriptionPeriod: null, updatedAt: new Date() })
      .where(and(eq(transactions.id, transactionId), eq(transactions.userId, user.id)));
    revalidate();
    revalidatePath('/history');
    return { success: true };
  } catch (error) {
    return failed('unlinkTransaction', error, 'Could not unlink. Please try again.');
  }
}
