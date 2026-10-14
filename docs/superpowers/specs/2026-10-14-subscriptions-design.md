# Subscriptions — Design Spec

Status: pre-implementation. Scope decisions approved by user (single currency, three states, fixed cycles); awaiting review of this document.

## Problem / Goal

Recurring charges are the spending you forget you agreed to. They already land
in MOOONEY as ordinary transactions after the fact, but nothing says what is
coming, what the standing commitment costs per month, or which of these you are
still paying for.

Subscriptions adds the schedule: what renews, when, and what it adds up to —
without pretending a scheduled charge is a charge that happened.

## The one rule everything else follows

**A subscription is an expectation. A transaction is a fact.**

A subscription never enters any spending figure in the app — not Home's month
spend, not Overview, not History, not an account balance. Those are built from
`transactions` and stay that way. The money shows up there when it is actually
spent, as it does today.

This is what keeps the feature from double-counting, and it is why the
Subscriptions page carries its own vocabulary — "expected", "upcoming",
"monthly equivalent" — rather than reusing "spent".

## Non-goals

- **No currency field.** `formatCurrency` hard-codes USD, the stored currency
  preference changes no output anywhere, and there is no conversion logic in the
  codebase. A per-subscription currency would advertise a capability the app
  does not have. Multi-currency is a separate project that starts with the rest
  of the app, not here.
- **No Canceled state** distinct from Ended. The four-state model needs an
  `access_end_date` and a fourth branch in the calendar, the totals, the list
  filter and the detail view, to express "cancelled but paid through February".
  Three states carry the useful information.
- **No custom intervals.** Weekly, monthly and yearly. An arbitrary "every N
  months" doubles the month-end and calendar arithmetic for a case neither
  reference screenshot shows.
- **No trends view.** The second screenshot has a Calendar / Trends toggle. A
  trend line of *expected* charges reads as money spent, which is the one
  confusion this feature exists to avoid.
- **No automatic transaction matching.** Manual linking only.
- **No reminders or notifications.** The app has no notification channel.
- **No "unlock Pro".** There is no paywall.

## What the reference screenshots contribute

Taken: the big-figure-and-small-label hierarchy, which the app already uses;
grouping the list by billing cycle; **relative dates** ("in 4 days") alongside
absolute ones, which is more useful than either alone; and the calendar marking
paying days with the subscription's own mark.

Not taken, and why: the gradient cards and the stacked-deck treatment are the
screenshots' signature, and both the project's design system ("no gradients",
"card-heavy layouts to avoid", "no heavy shadows") and the feature request's own
text ("avoid huge colorful gradient cards", "avoid unnecessary card stacking")
rule them out. The greeting and the Pro button have no counterpart here.

The calendar keeps the reference's shape — a grid of rounded day cells — but
renders them in `--sand` with no shadow, the same treatment `MonthPicker`
already gives its month buttons.

## Identity marks

The screenshots lean on real brand logos. There is no logo source in this
project, and the design system rules out a palette of per-item colours ("no many
category colours — use ink hierarchy").

So: a circle in `--sand` carrying the first character of the name in ink. CJK
names take their first character, which works as well as a Latin initial.

A subscription may optionally carry one emoji instead, typed by the user. An
emoji brings its own colour without introducing a colour system, and a person
who wants Spotify green can type 🎵. No external requests, nothing to fail,
and the interface is complete without it.

## Data model

One new table, following every existing convention: `numeric(12,2)` for money,
a `date` column read as a `"YYYY-MM-DD"` string, `user_id` with RLS enabled and
an `auth.uid() = user_id` policy, as all four existing tables have.

```
subscriptions
  id              text primary key
  user_id         uuid not null
  name            text not null
  emoji           text                     -- optional single character
  amount          numeric(12,2) not null
  cycle           text not null            -- 'weekly' | 'monthly' | 'yearly'
  start_date      date not null            -- anchors the whole series
  status          text not null default 'active'   -- 'active' | 'paused' | 'ended'
  ended_on        date                     -- set when status becomes 'ended'
  category        text                     -- reuses the existing category names
  payment_method_id text references payment_methods(id)
  website         text
  notes           text
  created_at      timestamptz not null default now()
  updated_at      timestamptz not null default now()
```

`category` is a plain text column holding a name from `getAllCategories()`,
exactly as `transactions.category` does. No second category system.

### Linking a payment to its transaction

Two nullable columns on `transactions`, rather than a join table:

```
subscription_id      text references subscriptions(id) on delete set null
subscription_period  date          -- which scheduled occurrence this paid
```

The transaction *is* the payment, so the link belongs on it. `on delete set
null` means deleting a subscription leaves its real expenses untouched — the
money was still spent.

An occurrence is confirmed when a transaction exists carrying that
subscription's id and that occurrence's date. Nothing else confirms it: a date
in the past is not evidence that anything was paid.

Neither column joins `LIST_COLUMNS`, so no existing query's payload changes.

## Billing arithmetic

The hard part, and the part that gets its own tested module — `src/lib/
subscriptionSchedule.ts`, in the manner of `lib/dates.ts`.

**Occurrences are derived from `start_date`, never stored.** There is no
`next_billing_date` column. A stored cursor drifts: a subscription billed on the
31st, advanced into February, lands on the 28th, and every later month inherits
the 28th. Deriving from the anchor makes that impossible.

```
occurrencesBetween(sub, from, to): CalendarDate[]
```

- **weekly** — `start_date + 7k` days.
- **monthly** — month advanced by `k`, day = `min(anchorDay, daysInMonth(y, m))`.
  A 31st subscription bills on the 28th in February 2026, the 29th in February
  2028, and returns to the 31st in March. The anchor is never rewritten.
- **yearly** — year advanced by `k`, same day clamp, so February 29th bills on
  the 28th in common years.

Status filters the result:

- **active** — every occurrence, past and future.
- **paused** — occurrences up to today only. The past happened; the future is
  suspended. Resuming simply stops filtering.
- **ended** — occurrences up to `ended_on`.

Editing the next payment date moves `start_date`, which re-anchors the series.
The detail view says so where it is edited, because it also changes where past
occurrences fall on the calendar.

All of it works on `"YYYY-MM-DD"` strings through `lib/dates.ts`. No `Date`
object touches a calendar date, for the reason the date column was migrated in
the first place.

## Normalised totals

```
monthly equivalent = weekly  → amount × (365.25 / 7 / 12)
                     monthly → amount
                     yearly  → amount ÷ 12
annual equivalent  = monthly equivalent × 12
```

Active subscriptions only; paused and ended contribute nothing.

The screen labels these "monthly equivalent" and "annual equivalent", not
"monthly spend". They are a normalised rate, not a forecast of any particular
calendar month — a yearly subscription contributes a twelfth every month and its
whole amount in the month it actually bills, and both numbers are true.

## Page structure

`/subscriptions`. Where it is reached from is the one open question below; the
page itself is the same either way.

### Main column

1. **Header** — "Subscriptions" in the small-caps page label the other pages
   use, with an Add control. Not an oversized title; no page in this app has one.
2. **Overview** — three figures: monthly equivalent, annual equivalent, active
   count. Hero figure through `ResponsiveAmount`, labels at 9px uppercase. No
   chart.
3. **Upcoming** — the next three occurrences, each with mark, name, cycle,
   amount, date and relative date. Tapping one opens the subscription.
4. **All subscriptions** — filter (All / Active / Paused / Ended), sort (next
   payment, amount high→low, amount low→high, name), grouped under cycle
   headings as the reference does. Default sort: next payment ascending.

### Calendar

A toggle between List and Calendar, as the reference has at the foot of the
screen.

The grid shows a month of rounded `--sand` cells. A day with occurrences shows
up to three marks and a `+N`. Above it: expected this month, and remaining from
today to month end — the latter hidden for past months, where "remaining" is
meaningless.

Tapping a day opens the same dialog shell `MonthPicker` uses — centred on
desktop, bottom sheet on the phone — listing that day's occurrences with their
state.

### Occurrence states

Three, and never inferred from the date alone:

- **Upcoming** — scheduled, in the future.
- **Confirmed** — a linked transaction exists for that occurrence.
- **Unconfirmed** — scheduled, in the past, nothing linked.

Each carries a text label, not only a colour.

## Desktop and mobile

Desktop uses the `d-split` layout the other three surfaces now use: overview,
upcoming and the list in the main column, the calendar in the panel. Both at
once, no toggle.

The phone keeps one column and the List/Calendar toggle, since both will not
fit. Order: header, overview, upcoming, toggle, content.

## Forms

The add and edit form is a dialog using the existing shell, and follows
`ConfirmTransactionForm`: plain `useState`, no form library, with the optional
fields behind the same "more" disclosure that form already has.

Required: name, amount, cycle, first payment date. Behind the disclosure:
category, payment account, emoji, website, notes.

Validation: a non-empty name; an amount that parses to a positive number; a
cycle from the three; a date that `toCalendarDate` accepts. The save control
disables while saving, which is how the existing forms prevent double
submission.

## Verification

- `subscriptionSchedule` unit-tested first: the 31st across February in a common
  and a leap year, February 29th yearly, weekly across a month boundary, year
  rollover, the three status filters, an empty range, and a range that starts
  before `start_date`.
- Normalisation tested against the stated examples.
- Totals exclude paused and ended, verified in the unit tests.
- A past occurrence with no linked transaction reads Unconfirmed, never Paid.
- Adding a subscription changes no figure on Home, Overview, History or
  Accounts — checked against the live database before and after.
- The usual sweep: 1280/1440/1920 and 375, both colour schemes, no horizontal
  scroll, amounts never truncated.
- RLS confirmed enabled on the new table by querying `pg_tables`.

## Open questions

**Where does Subscriptions live in the navigation?** The bottom nav pill is
299px wide with four tabs and clears a 320px screen by 10px. A fifth tab does
not fit without dropping the labels, which would make Overview and Subscriptions
hard to tell apart as icons.

Three options, needing a decision before implementation:

1. **Desktop sidebar only**, reached on the phone from a link on Home — the
   arrangement Settings already uses, and the one Overview had until recently.
2. **Replace a bottom-nav tab.** Accounts and History both have desktop sidebar
   entries; one could leave the phone's pill.
3. **Drop the labels on the phone**, five icons only.

Recommendation: (1). Settings already works exactly this way — absent from the
phone's pill, present in the desktop sidebar, reached on a phone from the icon
in Home's header — so there is a precedent to follow rather than a new pattern
to invent. Subscriptions is also something you check weekly rather than several
times a day, which is what the pill's four tabs are for.
