'use client';

import { useState } from 'react';
import { SubscriptionDialog } from '@/components/SubscriptionDialog';
import { SubscriptionMark } from '@/components/SubscriptionMark';
import { daysBetween } from '@/lib/dates';
import {
  relativeDayLabel,
  type SubscriptionCycle,
  type SubscriptionStatus,
} from '@/lib/subscriptionSchedule';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { SubscriptionRow } from '@/app/actions/subscriptions';

export type ListItem = SubscriptionRow & { next: string | null };

type Filter = 'all' | SubscriptionStatus;
type Sort = 'next' | 'high' | 'low' | 'name';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'ended', label: 'Ended' },
];

const SORTS: { value: Sort; label: string }[] = [
  { value: 'next', label: 'Next payment' },
  { value: 'high', label: 'Amount, high first' },
  { value: 'low', label: 'Amount, low first' },
  { value: 'name', label: 'Name' },
];

// Monthly first because that is what most subscriptions are, so the list opens
// on the part you came to read.
const CYCLE_ORDER: SubscriptionCycle[] = ['monthly', 'yearly', 'weekly'];
const CYCLE_LABEL: Record<SubscriptionCycle, string> = {
  monthly: 'Monthly',
  yearly: 'Yearly',
  weekly: 'Weekly',
};
const CYCLE_SUFFIX: Record<SubscriptionCycle, string> = {
  monthly: '/mo',
  yearly: '/yr',
  weekly: '/wk',
};

export function SubscriptionList({
  items,
  today,
  categories,
  accounts,
}: {
  items: ListItem[];
  today: string;
  categories: string[];
  accounts: { id: string; name: string; archived: boolean }[];
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('next');

  const shown = items.filter((s) => filter === 'all' || s.status === filter);

  const sorted = [...shown].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'high') return b.amount - a.amount || a.name.localeCompare(b.name);
    if (sort === 'low') return a.amount - b.amount || a.name.localeCompare(b.name);
    // Next payment. A paused or ended subscription has none and goes last —
    // which is not where sorting a null as an empty string would put it.
    if (a.next === null && b.next === null) return a.name.localeCompare(b.name);
    if (a.next === null) return 1;
    if (b.next === null) return -1;
    if (a.next === b.next) return a.name.localeCompare(b.name);
    return a.next < b.next ? -1 : 1;
  });

  const groups = CYCLE_ORDER.map((cycle) => ({
    cycle,
    rows: sorted.filter((s) => s.cycle === cycle),
  })).filter((g) => g.rows.length > 0);

  return (
    <section>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-3">
        <div className="flex items-center gap-3">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                'text-[10px] font-bold uppercase tracking-widest transition-colors',
                filter === f.value ? 'text-ink' : 'text-ink-faint hover:text-ink-soft',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {/* Native select: already type-to-search and already correct on a
            phone. A custom menu would be more code and worse. */}
        <select
          aria-label="Sort by"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="ml-auto bg-transparent text-[10px] font-bold uppercase tracking-widest text-ink-faint cursor-pointer focus:outline-none"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {groups.length === 0 && (
        <p className="py-6 text-sm text-ink-faint">
          {filter === 'all' ? 'Nothing here yet.' : `No ${filter} subscriptions.`}
        </p>
      )}

      {groups.map((group) => (
        <div key={group.cycle} className="pb-5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-1">
            {CYCLE_LABEL[group.cycle]}
          </p>
          {group.rows.map((s) => (
            <SubscriptionDialog key={s.id} subscription={s} today={today} categories={categories} accounts={accounts}>
              <button type="button" className="w-full flex items-center gap-3 py-3 border-t border-line text-left hover:bg-sand/40 transition-colors">
                <SubscriptionMark name={s.name} emoji={s.emoji} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate text-sm font-semibold text-ink">{s.name}</span>
                    {s.status !== 'active' && (
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-ink-faint">
                        {s.status}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[11px] text-ink-faint">
                    {s.next
                      ? `${formatDate(s.next, { month: 'short', day: 'numeric' })} · ${relativeDayLabel(daysBetween(today, s.next))}`
                      : s.stoppedOn
                        ? `${s.status === 'ended' ? 'Ended' : 'Paused'} ${formatDate(s.stoppedOn, { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : s.status === 'ended'
                          ? 'Ended'
                          : 'Paused'}
                  </span>
                </span>
                {/* shrink-0 on the amount, truncate on the name: the number is
                    never the thing that gets cut. */}
                <span className="shrink-0 text-right">
                  <span className="block text-base font-bold tracking-tight tabular-nums text-ink">
                    {formatCurrency(s.amount)}
                  </span>
                  <span className="block text-[10px] text-ink-faint">{CYCLE_SUFFIX[s.cycle]}</span>
                </span>
              </button>
            </SubscriptionDialog>
          ))}
        </div>
      ))}
    </section>
  );
}
