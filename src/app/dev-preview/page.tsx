import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { SubscriptionCalendar } from '@/components/SubscriptionCalendar';
import { SubscriptionList, type ListItem } from '@/components/SubscriptionList';
import { SubscriptionMark } from '@/components/SubscriptionMark';
import { ResponsiveAmount } from '@/components/ResponsiveAmount';
import { monthRange } from '@/lib/dates';
import { nextOccurrence, occurrencesBetween, relativeDayLabel } from '@/lib/subscriptionSchedule';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type {
  LinkCandidate, MonthOccurrences, OccurrenceState, OrphanedLink, UpcomingOccurrence,
} from '@/app/actions/subscriptions';

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
// subscription and a later date for another, never both. Hence more than one.

type HistoryData = { expected: number; occurrences: OccurrenceState[]; orphaned: OrphanedLink[] };

// iCloud+ on the 31st, $2.99 expected. Newest first, as the component lists them:
//   Oct 31  Upcoming     after today, nothing to do yet          no Link control
//   Sep 30  Unconfirmed  in the past, nothing linked             Link
//   Aug 31  Confirmed    paid what was expected                  one amount
//   Jul 31  Confirmed    paid $3.49, so the price rose           the actual, with "expected" beneath
// The December payment is linked to a date the series no longer has (the first payment date was
// moved later), so it is listed apart, with an Unlink.
const HISTORY_ICLOUD: HistoryData = {
  expected: 2.99,
  occurrences: [
    { date: '2026-06-30', periodKey: '2026-06', state: 'unconfirmed', paidAmount: null, transactionId: null },
    { date: '2026-07-31', periodKey: '2026-07', state: 'confirmed', paidAmount: 3.49, transactionId: 't-jul' },
    { date: '2026-08-31', periodKey: '2026-08', state: 'confirmed', paidAmount: 2.99, transactionId: 't-aug' },
    { date: '2026-09-30', periodKey: '2026-09', state: 'unconfirmed', paidAmount: null, transactionId: null },
    { date: '2026-10-31', periodKey: '2026-10', state: 'upcoming', paidAmount: null, transactionId: null },
  ],
  orphaned: [{ transactionId: 't-old', period: '2025-12-31', amount: 2.99 }],
};

// Spotify on the 15th, $11.99. The 15th of October is today, so it reads Upcoming: a charge
// dated today may not have landed yet. August's picker is open, with a merchant long enough to
// need its ellipsis and an amount long enough to tempt one.
const HISTORY_SPOTIFY: HistoryData = {
  expected: 11.99,
  occurrences: [
    { date: '2026-08-15', periodKey: '2026-08', state: 'unconfirmed', paidAmount: null, transactionId: null },
    { date: '2026-09-15', periodKey: '2026-09', state: 'confirmed', paidAmount: 11.99, transactionId: 't-sep' },
    { date: '2026-10-15', periodKey: '2026-10', state: 'upcoming', paidAmount: null, transactionId: null },
  ],
  orphaned: [],
};

// Oatly on Mondays, weekly, so the period is the exact date. The picker for October 5 is still
// looking. Two payments are linked to dates that are not Mondays (the anchor moved by a day), so
// they match no occurrence and are listed apart.
const HISTORY_OATLY: HistoryData = {
  expected: 24.5,
  occurrences: [
    { date: '2026-09-21', periodKey: '2026-09-21', state: 'unconfirmed', paidAmount: null, transactionId: null },
    { date: '2026-09-28', periodKey: '2026-09-28', state: 'unconfirmed', paidAmount: null, transactionId: null },
    { date: '2026-10-05', periodKey: '2026-10-05', state: 'unconfirmed', paidAmount: null, transactionId: null },
    { date: '2026-10-12', periodKey: '2026-10-12', state: 'confirmed', paidAmount: 24.5, transactionId: 't-oat' },
    { date: '2026-10-19', periodKey: '2026-10-19', state: 'upcoming', paidAmount: null, transactionId: null },
  ],
  orphaned: [
    { transactionId: 't-x1', period: '2026-10-09', amount: 24.5 },
    { transactionId: 't-x2', period: '2026-09-12', amount: 24.5 },
  ],
};

// Zoom, paused on October 1, with its first payment date then edited to December: after the stop, so
// the series has no occurrence at all. Its one payment is stranded. The panel used to return nothing
// for an empty series, which hid exactly this; now it shows the stranded list on its own.
const HISTORY_ZOOM: HistoryData = {
  expected: 20,
  occurrences: [],
  orphaned: [{ transactionId: 't-z1', period: '2026-06-10', amount: 20 }],
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
  data: HistoryData;
  picking?: string | null;
  candidates?: LinkCandidate[] | null;
}) {
  const busy = false;
  return (
    // min-w-0: this panel sits in a grid, and a grid item's default
    // min-width is auto, so it refuses to shrink below its content and
    // pushes the dialog sideways instead — measured at 361.7px in a 327px
    // column, and again at 1280 with a long merchant name.
    <div className="min-w-0 pt-1">
      <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-1">Payments</p>
      {/* Newest first: the ones you are most likely to be confirming. */}
      {[...data.occurrences].reverse().map((o) => (
        <div key={o.date} className="border-t border-line py-2">
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ink">
                {formatDate(o.date, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              {/* A word, not only a colour — and not in the faintest ink
                  available, since the state is the thing being read. */}
              <span className="block text-[11px] text-ink-soft">{STATE_LABEL[o.state]}</span>
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
              {candidates === null ? (
                <p className="flex items-center gap-2 text-[11px] text-ink-faint">
                  <Loader2 className="h-3 w-3 animate-spin" /> Looking…
                </p>
              ) : candidates.length === 0 ? (
                <p className="text-[11px] text-ink-faint">
                  No unlinked expense within ten days of this date.
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

      {/* Links the series no longer has a period for — after the billing day
          moved across a month, or the cycle changed. The spec calls this the
          known ceiling and says it is fixed by re-linking; that is only true
          if the stranded link can be found, because a linked transaction is
          excluded from every candidate list. Unlink here, then link it where
          it belongs. */}
      {data.orphaned.length > 0 && (
        <div className="pt-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-1">
            No longer matches a payment date
          </p>
          {data.orphaned.map((o) => (
            <div key={o.transactionId} className="flex items-center gap-3 border-t border-line py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink">
                  {formatDate(o.period, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="block text-[11px] text-ink-soft">Linked to a date this subscription no longer bills on</span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                {formatCurrency(o.amount)}
              </span>
              <button type="button" disabled={busy}
                      className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink disabled:opacity-40">
                Unlink
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Opening a subscription from the list ----------------------------------------------------
// The dialog mounts SubscriptionHistory, which loads through getSubscriptionHistory. This page has
// no session, so the real action redirects to /login and the browser leaves the harness about a
// second after a row is opened. The script below answers the panel's four actions (history,
// candidates, link, unlink) inside the page instead, from the list's own subscriptions and a few
// fixture transactions, so a dialog opens, shows its payments and takes a link and an unlink with no
// server. Nothing else is touched: Save, Pause, End and Delete still reach the real server and still
// redirect, as they did before the panel existed.
type StandInTx = {
  id: string; date: string; merchant: string; amount: number; category: string;
  subscriptionId: string | null; subscriptionPeriod: string | null;
};
const standInTx = (
  id: string, date: string, merchant: string, amount: number, category: string,
  subscriptionId: string | null = null, subscriptionPeriod: string | null = null,
): StandInTx => ({ id, date, merchant, amount, category, subscriptionId, subscriptionPeriod });

const STAND_IN_TX: StandInTx[] = [
  // Linked. Spotify (1): May at a lower price, June as expected, and December, which is before its
  // first payment date and so matches nothing. iCloud+ (2): July at a higher price, August as
  // expected. Oatly (4): one payment on the 9th, which is not a Monday, so it matches nothing:
  // unlink it and the 12th, three days away, offers it back.
  standInTx('t-may', '2026-05-15', 'Spotify', 9.99, 'Entertainment', '1', '2026-05-15'),
  standInTx('t-jun', '2026-06-16', 'Spotify', 11.99, 'Entertainment', '1', '2026-06-15'),
  standInTx('t-dec', '2025-12-20', 'Spotify', 11.99, 'Entertainment', '1', '2025-12-20'),
  standInTx('t-jul', '2026-07-31', 'Apple.com/bill', 3.49, 'Bills', '2', '2026-07-31'),
  standInTx('t-aug', '2026-08-31', 'Apple.com/bill', 2.99, 'Bills', '2', '2026-08-31'),
  standInTx('t-oat-old', '2026-10-09', 'Oatly delivery', 24.5, 'Groceries', '4', '2026-10-09'),
  // Free. Around Spotify's August and September, and iCloud+'s September; nothing near the rest, so
  // their pickers say so.
  standInTx('t-c1', '2026-08-17', 'Spotify', 11.99, 'Entertainment'),
  standInTx('t-c2', '2026-08-14', "Trader Joe's #412, 4 Union Square East, New York", 123456.78, 'Groceries'),
  standInTx('t-c3', '2026-08-09', '网易云音乐', 12.5, 'Entertainment'),
  standInTx('t-c4', '2026-09-14', 'Spotify', 13.99, 'Entertainment'),
  standInTx('t-c5', '2026-09-29', 'Apple.com/bill', 2.99, 'Bills'),
];

// Each subscription's whole series up to its next occurrence, from the real schedule.
const standInSeries = (s: ListItem) =>
  occurrencesBetween(s, s.anchorDate, nextOccurrence(s, TODAY, TODAY) ?? TODAY, TODAY);

const STAND_IN = {
  today: TODAY,
  series: Object.fromEntries(
    ITEMS.map((s) => [s.id, { expected: s.amount, cycle: s.cycle, dates: standInSeries(s) }]),
  ),
  transactions: STAND_IN_TX,
};

// Plain ES5 on purpose, and no backslashes: it is serialised into the page as text. It answers what
// the real actions would, to the same contract: the last twelve occurrences with a state each, plus
// the links whose period matches nothing in the series; candidates within ten days that are not
// linked, newest first; a link; an unlink. A single-argument call that is not a transaction id is the
// panel's own load only the first time its action id is seen, which is how a later Delete, whose
// arguments look the same, is told apart and left to the real server.
const STAND_IN_SCRIPT = `(function (data) {
  if (window.__historyStandIn) return;
  window.__historyStandIn = data;
  var realFetch = window.fetch.bind(window);
  var tx = data.transactions;
  var historyAction = null;
  var key = function (cycle, d) { return cycle === 'monthly' ? d.slice(0, 7) : cycle === 'yearly' ? d.slice(0, 4) : d; };
  var apart = function (a, b) {
    return Math.round((Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8)) - Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8))) / 864e5);
  };
  var isDate = function (s) { return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s); };

  function history(id) {
    var s = data.series[id];
    var mine = tx.filter(function (t) { return t.subscriptionId === id && t.subscriptionPeriod; });
    var paid = {};
    mine.forEach(function (t) { paid[key(s.cycle, t.subscriptionPeriod)] = t; });
    var live = {};
    s.dates.forEach(function (d) { live[key(s.cycle, d)] = true; });
    return {
      today: data.today,
      expected: s.expected,
      occurrences: s.dates.slice(-12).map(function (d) {
        var hit = paid[key(s.cycle, d)];
        return { date: d, periodKey: key(s.cycle, d), state: hit ? 'confirmed' : d >= data.today ? 'upcoming' : 'unconfirmed', paidAmount: hit ? hit.amount : null, transactionId: hit ? hit.id : null };
      }),
      orphaned: mine.filter(function (t) { return !live[key(s.cycle, t.subscriptionPeriod)]; })
        .map(function (t) { return { transactionId: t.id, period: t.subscriptionPeriod, amount: t.amount }; }),
    };
  }
  function candidates(date) {
    return tx.filter(function (t) { return !t.subscriptionId && Math.abs(apart(t.date, date)) <= 10; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 25)
      .map(function (t) { return { id: t.id, date: t.date, merchant: t.merchant, amount: t.amount, category: t.category }; });
  }
  function link(tid, sid, period) {
    var t = tx.filter(function (x) { return x.id === tid; })[0];
    if (!data.series[sid]) return { success: false, error: 'Subscription not found' };
    if (!t) return { success: false, error: 'Transaction not found' };
    t.subscriptionId = sid;
    t.subscriptionPeriod = period;
    return { success: true };
  }
  function unlink(tid) {
    tx.forEach(function (t) { if (t.id === tid) { t.subscriptionId = null; t.subscriptionPeriod = null; } });
    return { success: true };
  }

  window.fetch = function (input, init) {
    var h = init && init.headers;
    var id = h && (h['next-action'] || h['Next-Action']);
    if (!id || init.method !== 'POST' || typeof init.body !== 'string') return realFetch(input, init);
    var args;
    try { args = JSON.parse(init.body); } catch (e) { return realFetch(input, init); }
    var strings = args.length > 0 && args.every(function (a) { return typeof a === 'string'; });
    var value;
    if (strings && args.length === 3 && isDate(args[2])) value = link(args[0], args[1], args[2]);
    else if (strings && args.length === 2 && isDate(args[1])) value = candidates(args[1]);
    else if (strings && args.length === 1 && /^t-/.test(args[0])) value = unlink(args[0]);
    else if (strings && args.length === 1 && data.series[args[0]] && (historyAction === null || historyAction === id)) { historyAction = id; value = history(args[0]); }
    else return realFetch(input, init);
    var root = JSON.stringify({ a: '$@1', f: '', b: 'development', q: '', i: false });
    var nl = String.fromCharCode(10);
    return Promise.resolve(new Response('0:' + root + nl + '1:' + JSON.stringify(value) + nl, { status: 200, headers: { 'content-type': 'text/x-component' } }));
  };
})(${JSON.stringify(STAND_IN)});`;

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
          { name: 'iCloud+', data: HISTORY_ICLOUD, picking: null, candidates: [] },
          { name: 'Spotify', data: HISTORY_SPOTIFY, picking: '2026-08-15', candidates: CANDIDATES },
          { name: 'Oatly delivery', data: HISTORY_OATLY, picking: '2026-10-05', candidates: null },
          { name: 'Zoom (paused, no occurrences)', data: HISTORY_ZOOM, picking: null, candidates: [] },
        ].map((f) => (
          <div
            key={f.name}
            className="mb-6 grid gap-4 overflow-y-auto rounded-3xl bg-paper-card p-6 max-lg:-mx-6 max-lg:rounded-none lg:max-w-md"
          >
            <p className="pr-6 text-base font-bold tracking-tight">{f.name}</p>
            <HistoryPanel data={f.data} picking={f.picking} candidates={f.candidates} />
          </div>
        ))}
      </section>
      <Script id="history-stand-in" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: STAND_IN_SCRIPT }} />
    </div>
  );
}
