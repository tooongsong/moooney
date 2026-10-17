import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SubscriptionCalendar } from '@/components/SubscriptionCalendar';
import { SubscriptionList, type ListItem } from '@/components/SubscriptionList';
import { SubscriptionMark } from '@/components/SubscriptionMark';
import { ResponsiveAmount } from '@/components/ResponsiveAmount';
import { monthRange } from '@/lib/dates';
import { occurrencesBetween, relativeDayLabel } from '@/lib/subscriptionSchedule';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { LinkCandidate, MonthOccurrences, OccurrenceState, UpcomingOccurrence } from '@/app/actions/subscriptions';

// A folder named with a leading underscore is private in Next.js and never
// routes at all — hence "dev-preview". Gated so it cannot ship.
const TODAY = '2026-10-15';

const ITEMS: ListItem[] = [
  { id: '1', name: 'Spotify', emoji: '🎵', amount: 11.99, cycle: 'monthly', anchorDate: '2026-01-15',
    status: 'active', stoppedOn: null, category: 'Entertainment', paymentMethodId: null, website: null,
    notes: null, next: '2026-10-15' },
  { id: '2', name: 'iCloud+ with a deliberately long product name', emoji: null, amount: 2.99,
    cycle: 'monthly', anchorDate: '2026-01-31', status: 'active', stoppedOn: null, category: 'Bills',
    paymentMethodId: null, website: null, notes: null, next: '2026-10-31' },
  { id: '3', name: '网易云音乐', emoji: null, amount: 1288.88, cycle: 'yearly', anchorDate: '2026-03-09',
    status: 'active', stoppedOn: null, category: 'Entertainment', paymentMethodId: null, website: null,
    notes: null, next: '2027-03-09' },
  { id: '4', name: 'Oatly delivery', emoji: '🥛', amount: 24.5, cycle: 'weekly', anchorDate: '2026-10-12',
    status: 'active', stoppedOn: null, category: 'Groceries', paymentMethodId: null, website: null,
    notes: null, next: '2026-10-19' },
  { id: '5', name: 'Figma', emoji: null, amount: 15, cycle: 'monthly', anchorDate: '2026-02-01',
    status: 'paused', stoppedOn: null, category: 'Other', paymentMethodId: null, website: null,
    notes: null, next: null },
  { id: '6', name: 'Old gym', emoji: null, amount: 89, cycle: 'monthly', anchorDate: '2025-06-01',
    status: 'ended', stoppedOn: '2026-08-31', category: 'Health', paymentMethodId: null, website: null,
    notes: null, next: null },
];

// What the page's Upcoming section shows for ITEMS. On the page it sits above
// the toggle, so it has to stay put in both views.
const UPCOMING: UpcomingOccurrence[] = [
  { subscriptionId: '1', name: 'Spotify', emoji: '🎵', cycle: 'monthly', amount: 11.99,
    date: '2026-10-15', daysAway: 0 },
  { subscriptionId: '4', name: 'Oatly delivery', emoji: '🥛', cycle: 'weekly', amount: 24.5,
    date: '2026-10-19', daysAway: 4 },
  { subscriptionId: '2', name: 'iCloud+ with a deliberately long product name', emoji: null,
    cycle: 'monthly', amount: 2.99, date: '2026-10-31', daysAway: 16 },
];

const MONTH: MonthOccurrences = {
  // 34.99 on the 5th + 11.99 + 24.50 + 2.99; remaining counts from the 15th.
  monthKey: '2026-10', year: 2026, month: 10, today: TODAY, expected: 74.47,
  remaining: 39.48, isPastMonth: false,
  byDay: {
    '2026-10-05': [
      { subscriptionId: '5', name: 'Figma', emoji: null, amount: 15, cycle: 'monthly',
        date: '2026-10-05', state: 'confirmed', paidAmount: 15 },
      { subscriptionId: '7', name: 'Notion', emoji: null, amount: 8, cycle: 'monthly',
        date: '2026-10-05', state: 'unconfirmed', paidAmount: null },
      { subscriptionId: '8', name: 'Dropbox', emoji: '📦', amount: 11.99, cycle: 'monthly',
        date: '2026-10-05', state: 'confirmed', paidAmount: 13.99 },
    ],
    '2026-10-15': [
      { subscriptionId: '1', name: 'Spotify', emoji: '🎵', amount: 11.99, cycle: 'monthly',
        date: '2026-10-15', state: 'upcoming', paidAmount: null },
    ],
    '2026-10-19': [
      { subscriptionId: '4', name: 'Oatly delivery', emoji: '🥛', amount: 24.5, cycle: 'weekly',
        date: '2026-10-19', state: 'upcoming', paidAmount: null },
    ],
    '2026-10-31': [
      { subscriptionId: '2', name: 'iCloud+', emoji: null, amount: 2.99, cycle: 'monthly',
        date: '2026-10-31', state: 'upcoming', paidAmount: null },
    ],
  },
};

// One 31st anchor across the month-end clamp. The occurrences come from the
// real schedule rather than being typed, so the grid shows the clamp's own
// output: the 28th in a common February, the 29th in a leap one, the 31st
// again in March.
const ANCHOR_31ST = { anchorDate: '2026-01-31', cycle: 'monthly', status: 'active', stoppedOn: null } as const;

function monthFrom31st(year: number, month: number, paid: number | null): MonthOccurrences {
  const [first, last] = monthRange(year, month);
  const byDay: MonthOccurrences['byDay'] = {};
  for (const date of occurrencesBetween(ANCHOR_31ST, first, last, TODAY)) {
    byDay[date] = [{
      subscriptionId: '2', name: 'iCloud+', emoji: null, amount: 2.99, cycle: 'monthly', date,
      state: paid !== null ? 'confirmed' : date >= TODAY ? 'upcoming' : 'unconfirmed',
      paidAmount: paid,
    }];
  }
  return {
    monthKey: first.slice(0, 7), year, month, today: TODAY, byDay,
    expected: 2.99, remaining: last < TODAY ? 0 : 2.99, isPastMonth: last < TODAY,
  };
}

const MONTHS: MonthOccurrences[] = [
  MONTH,
  monthFrom31st(2026, 2, null),
  monthFrom31st(2026, 3, 2.99),
  monthFrom31st(2028, 2, null),
];

// ---- SubscriptionHistory, as the dialog shows it once loaded -----------------
// Hand-typed OccurrenceState values: the component fetches through a server action and this
// page has no session. A list always ends at the *next* occurrence, which is today for one
// subscription and a later date for another, never both. Hence two.

// iCloud+ on the 31st, $2.99 expected. Newest first, as the component lists them:
//   Oct 31  Upcoming     after today, nothing to do yet          no Link control
//   Sep 30  Unconfirmed  in the past, nothing linked             Link
//   Aug 31  Confirmed    paid what was expected                  one amount
//   Jul 31  Confirmed    paid $3.49, so the price rose           the actual, with "expected" beneath
const HISTORY_ICLOUD: { expected: number; occurrences: OccurrenceState[] } = {
  expected: 2.99,
  occurrences: [
    { date: '2026-06-30', periodKey: '2026-06', state: 'unconfirmed', paidAmount: null, transactionId: null },
    { date: '2026-07-31', periodKey: '2026-07', state: 'confirmed', paidAmount: 3.49, transactionId: 't-jul' },
    { date: '2026-08-31', periodKey: '2026-08', state: 'confirmed', paidAmount: 2.99, transactionId: 't-aug' },
    { date: '2026-09-30', periodKey: '2026-09', state: 'unconfirmed', paidAmount: null, transactionId: null },
    { date: '2026-10-31', periodKey: '2026-10', state: 'upcoming', paidAmount: null, transactionId: null },
  ],
};

// Spotify on the 15th, $11.99. The 15th of October is today, so it reads Upcoming: a charge
// dated today may not have landed yet. August's picker is open, with a merchant long enough to
// need its ellipsis and an amount long enough to tempt one.
const HISTORY_SPOTIFY: { expected: number; occurrences: OccurrenceState[] } = {
  expected: 11.99,
  occurrences: [
    { date: '2026-08-15', periodKey: '2026-08', state: 'unconfirmed', paidAmount: null, transactionId: null },
    { date: '2026-09-15', periodKey: '2026-09', state: 'confirmed', paidAmount: 11.99, transactionId: 't-sep' },
    { date: '2026-10-15', periodKey: '2026-10', state: 'upcoming', paidAmount: null, transactionId: null },
  ],
};

const CANDIDATES: LinkCandidate[] = [
  { id: 'c-1', date: '2026-08-17', merchant: 'Spotify', amount: 11.99, category: 'Entertainment' },
  { id: 'c-2', date: '2026-08-14', merchant: "Trader Joe's #412, 4 Union Square East, New York", amount: 123456.78, category: 'Groceries' },
  { id: 'c-3', date: '2026-08-09', merchant: '网易云音乐', amount: 12.5, category: 'Entertainment' },
];

// What SubscriptionHistory renders once its data has loaded, minus the click handlers, which a
// server component cannot carry. The classes, the order and the words are the component's own,
// lifted from its source by script and checked against it, so the fixtures above are read
// through the markup that ships.
const STATE_LABEL = { upcoming: 'Upcoming', confirmed: 'Confirmed', unconfirmed: 'Unconfirmed' } as const;

function HistoryPanel({ data, picking = null, candidates = [] }: {
  data: { expected: number; occurrences: OccurrenceState[] };
  picking?: string | null;
  candidates?: LinkCandidate[];
}) {
  const busy = false;
  return (
    <div className="pt-1 min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-1">Payments</p>
      {/* Newest first: the ones you are most likely to be confirming. */}
      {[...data.occurrences].reverse().map((o) => (
        <div key={o.date} className="border-t border-line py-2">
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ink">
                {formatDate(o.date, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              {/* A word, not only a colour. */}
              <span className="block text-[11px] text-ink-faint">{STATE_LABEL[o.state]}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-semibold tabular-nums text-ink">
                {formatCurrency(o.paidAmount ?? data.expected)}
              </span>
              {o.paidAmount !== null && o.paidAmount !== data.expected && (
                <span className="block text-[10px] tabular-nums text-ink-faint">
                  expected {formatCurrency(data.expected)}
                </span>
              )}
            </span>
            {o.state === 'confirmed' ? (
              <button type="button" disabled={busy}
                      className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink disabled:opacity-40">
                Unlink
              </button>
            ) : o.state === 'unconfirmed' ? (
              <button type="button" disabled={busy}
                      className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink disabled:opacity-40">
                Link
              </button>
            ) : null}
          </div>

          {/* Inline rather than a second dialog: a dialog inside a dialog is
              a focus-trap argument nobody wins. */}
          {picking === o.date && (
            <div className="pt-2 pl-1">
              {candidates.length === 0 ? (
                <p className="text-[11px] text-ink-faint">
                  No unlinked transactions within ten days of this date.
                </p>
              ) : (
                candidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={busy}
                    className="w-full flex items-center gap-3 py-1.5 text-left disabled:opacity-40"
                  >
                    <span className="text-[11px] tabular-nums text-ink-faint shrink-0">
                      {formatDate(c.date, { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-ink">{c.merchant}</span>
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-ink">
                      {formatCurrency(c.amount)}
                    </span>
                  </button>
                ))
              )}
              <button type="button"
                      className="pt-1 text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink">
                Cancel
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default async function DevPreview({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const calendarView = (await searchParams).view === 'calendar';
  return (
    <div className="d-max-xl max-lg:max-w-md mx-auto px-6 min-h-screen bg-paper pb-28">
      <section className="pt-3 pb-5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-3">Subscriptions</p>
        {/* The four active fixtures: 11.99 + 2.99 + 1288.88/12 + 24.5 × (365.25/7/12). */}
        <ResponsiveAmount value={228.92} baseSize={68} minSize={28} className="mb-3" split />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="text-ink-faint">Monthly equivalent</span>
          <span className="text-line">·</span>
          <span className="text-ink-faint">Annual <span className="font-semibold text-ink tabular-nums">{formatCurrency(2747.02)}</span></span>
          <span className="text-line">·</span>
          <span className="text-ink-faint"><span className="font-semibold text-ink tabular-nums">4</span> active</span>
        </div>
      </section>
      <div className="flex items-center gap-3 pb-6">
        <SubscriptionMark name="Spotify" emoji="🎵" size={36} />
        <SubscriptionMark name="网易云音乐" emoji={null} size={36} />
        <SubscriptionMark name="iCloud" emoji={null} size={36} />
      </div>

      <section className="pb-6">
        <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-1">Upcoming</p>
        {UPCOMING.map((o) => (
          <div
            key={`${o.subscriptionId}-${o.date}`}
            className="flex items-center gap-3 py-3 border-t border-line"
          >
            <SubscriptionMark name={o.name} emoji={o.emoji} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{o.name}</span>
              <span className="block text-[11px] text-ink-faint">
                {formatDate(o.date, { month: 'short', day: 'numeric' })} · {relativeDayLabel(o.daysAway)}
              </span>
            </span>
            <span className="shrink-0 text-sm font-bold tabular-nums text-ink">
              {formatCurrency(o.amount)}
            </span>
          </div>
        ))}
      </section>

      {/* The page's toggle and split, as the page writes them — pointed at the
          harness so toggling stays here. */}
      <div className="d-mobile-only">
        <div className="flex items-center gap-4 pb-3 border-t border-line pt-4">
          <Link href="/dev-preview"
                className={cn('text-[10px] font-bold uppercase tracking-widest transition-colors',
                              calendarView ? 'text-ink-faint' : 'text-ink')}>
            List
          </Link>
          <Link href="/dev-preview?view=calendar"
                className={cn('text-[10px] font-bold uppercase tracking-widest transition-colors',
                              calendarView ? 'text-ink' : 'text-ink-faint')}>
            Calendar
          </Link>
        </div>
      </div>

      <div className="d-split">
        <div className={cn('d-split-main', calendarView && 'max-lg:hidden')}>
          <SubscriptionList items={ITEMS} today={TODAY} categories={['Entertainment', 'Bills', 'Groceries', 'Health', 'Other']} accounts={[{ id: 'a1', name: 'Amex Gold', archived: false }, { id: 'a2', name: 'Chase Checking', archived: true }]} />
        </div>
        <div className={cn('d-split-panel d-panel-rule', !calendarView && 'max-lg:hidden')}>
          {MONTHS.map((m) => (
            <div key={m.monthKey} className="pb-10">
              <SubscriptionCalendar data={m} preserveView={calendarView} />
            </div>
          ))}
        </div>
      </div>

      {/* SubscriptionHistory's loaded state, in a frame that mirrors the dialog's own: a grid with a
          16px gap, 24px of padding, 400px of content at desktop width, and overflow-y-auto, which
          turns any sideways overflow into a scroll bar inside the frame. */}
      <section id="history" className="pt-10">
        <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-3">Payments panel</p>
        {[
          { name: 'iCloud+', data: HISTORY_ICLOUD, picking: null },
          { name: 'Spotify', data: HISTORY_SPOTIFY, picking: '2026-08-15' },
        ].map((f) => (
          <div
            key={f.name}
            className="mb-6 grid gap-4 overflow-y-auto rounded-3xl bg-paper-card p-6 max-lg:-mx-6 max-lg:rounded-none lg:max-w-md"
          >
            <p className="pr-6 text-base font-bold tracking-tight">{f.name}</p>
            <HistoryPanel data={f.data} picking={f.picking} candidates={f.picking ? CANDIDATES : []} />
          </div>
        ))}
      </section>
    </div>
  );
}
