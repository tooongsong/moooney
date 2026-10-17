'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { SubscriptionMark } from '@/components/SubscriptionMark';
import { daysInMonth, makeCalendarDate, weekdayOf } from '@/lib/dates';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { MonthOccurrences } from '@/app/actions/subscriptions';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const STATE_LABEL = { upcoming: 'Upcoming', confirmed: 'Confirmed', unconfirmed: 'Unconfirmed' } as const;

/** The month `delta` away, as "YYYY-MM". Month is 1-based. */
function shiftMonth(year: number, month: number, delta: number): string {
  const t = year * 12 + (month - 1) + delta;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

export function SubscriptionCalendar({
  data,
  preserveView,
}: {
  data: MonthOccurrences;
  /** True on the phone's calendar tab, so month navigation stays on it. */
  preserveView: boolean;
}) {
  // The day and the open flag are separate on purpose. Keyed off one value,
  // closing the sheet empties it instantly and you watch a blank panel run
  // through its 200ms exit animation.
  const [day, setDay] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const href = (monthKey: string) =>
    preserveView
      ? `/subscriptions?view=calendar&month=${monthKey}`
      : `/subscriptions?month=${monthKey}`;

  const lead = weekdayOf(makeCalendarDate(data.year, data.month, 1));
  const total = daysInMonth(data.year, data.month);
  const days = Array.from({ length: total }, (_, i) => makeCalendarDate(data.year, data.month, i + 1));

  const dayItems = day ? (data.byDay[day] ?? []) : [];

  return (
    <section>
      <div className="flex items-center justify-between gap-2 pb-3">
        <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint">
          {MONTH_NAMES[data.month - 1]} {data.year}
        </p>
        <div className="flex items-center gap-1">
          {/* scroll={false}: after a Link navigation Next resets the scroll
              position whenever the page root is scrolled at all, and on the
              phone this calendar sits ~530px down. Without it, stepping
              through months throws you back to the top every time. */}
          <Link href={href(shiftMonth(data.year, data.month, -1))} aria-label="Previous month" scroll={false}
                className="min-h-9 min-w-9 flex items-center justify-center text-ink-faint hover:text-ink transition-colors">
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
          </Link>
          <Link href={href(shiftMonth(data.year, data.month, 1))} aria-label="Next month" scroll={false}
                className="min-h-9 min-w-9 flex items-center justify-center text-ink-faint hover:text-ink transition-colors">
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-4 text-sm">
        <span className="text-ink-faint">
          Expected <span className="font-semibold text-ink tabular-nums">{formatCurrency(data.expected)}</span>
        </span>
        {/* "Remaining" in a month that is already over means nothing. */}
        {!data.isPastMonth && (
          <>
            <span className="text-line">·</span>
            <span className="text-ink-faint">
              Remaining <span className="font-semibold text-ink tabular-nums">{formatCurrency(data.remaining)}</span>
            </span>
          </>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="text-center text-[9px] font-bold uppercase tracking-widest text-ink-faint pb-1">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => <span key={`lead-${i}`} />)}
        {days.map((date) => {
          const items = data.byDay[date] ?? [];
          const isToday = date === data.today;
          return (
            <button
              key={date}
              type="button"
              disabled={items.length === 0}
              // Without this the only thing announced is the day number. The
              // marks are aria-hidden, so a screen reader would have no way to
              // know which days carry a charge — which is the whole grid.
              aria-label={
                items.length > 0
                  ? `${MONTH_NAMES[data.month - 1]} ${Number(date.slice(8))}, ` +
                    `${items.length} ${items.length === 1 ? 'charge' : 'charges'}`
                  : undefined
              }
              onClick={() => { setDay(date); setOpen(true); }}
              className={cn(
                // rounded-lg, not xl: this theme maps lg to 16px, which is on
                // the 16/24/pill scale, and xl to 20px, which is not — and at a
                // 43px cell a 20px radius turns the grid into circles.
                'aspect-square rounded-lg bg-sand p-1 flex flex-col items-center justify-start gap-0.5',
                'transition-colors disabled:cursor-default',
                items.length > 0 && 'hover:bg-ink/10',
                // Today is marked by an outline, not a fill: a filled cell
                // would compete with the marks that carry the information.
                isToday && 'ring-1 ring-inset ring-ink',
              )}
            >
              <span className={cn('text-[10px] tabular-nums leading-none pt-0.5',
                                   isToday ? 'font-bold text-ink' : 'text-ink-faint')}>
                {date.slice(8)}
              </span>
              {items.length > 0 && (
                <span className="flex items-center gap-0.5">
                  {/* Two marks, not three: at 375px the grid gives each cell
                      about 43px, and three 13px circles plus gaps fill it edge
                      to edge with no room to breathe. */}
                  {items.slice(0, 2).map((o) => (
                    <SubscriptionMark key={o.subscriptionId} name={o.name} emoji={o.emoji} size={13}
                                      className="bg-ink/15" />
                  ))}
                  {items.length > 2 && (
                    <span className="text-[8px] font-bold tabular-nums text-ink-faint">
                      +{items.length - 2}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="
            border-0 p-6 gap-3 bg-paper-card
            max-lg:rounded-t-3xl max-lg:rounded-b-none max-lg:max-w-none max-lg:w-full
            max-lg:pb-[calc(1.5rem+env(safe-area-inset-bottom))]
            max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-auto
            max-lg:translate-x-0 max-lg:translate-y-0
            lg:rounded-3xl lg:max-w-sm
          "
        >
          <DialogTitle className="text-base font-bold tracking-tight">
            {day ? formatDate(day, { weekday: 'long', month: 'long', day: 'numeric' }) : ''}
          </DialogTitle>
          {dayItems.map((o) => (
            <div key={o.subscriptionId} className="flex items-center gap-3 py-2 border-t border-line">
              <SubscriptionMark name={o.name} emoji={o.emoji} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{o.name}</span>
                {/* The state always carries a word, not only a colour. */}
                <span className="block text-[11px] text-ink-soft">{STATE_LABEL[o.state]}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-bold tabular-nums text-ink">
                  {formatCurrency(o.paidAmount ?? o.amount)}
                </span>
                {/* A price change shows up here: what was paid, and what was expected. */}
                {o.paidAmount !== null && o.paidAmount !== o.amount && (
                  <span className="block text-[10px] text-ink-soft tabular-nums">
                    expected {formatCurrency(o.amount)}
                  </span>
                )}
              </span>
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </section>
  );
}
