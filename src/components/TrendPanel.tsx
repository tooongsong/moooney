'use client';

import { TrendBars, type TrendBarItem } from '@/components/TrendBars';
import { formatCurrency } from '@/lib/utils';
import type { MonthBucket } from '@/lib/spendingAggregate';

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/**
 * The overview's right column with nothing selected: a continuous trend across
 * the trailing months. Twelve bars of one letter each is the one view the phone
 * has no room for, which is why it earns the default slot.
 */
export function TrendPanel({
  buckets,
  average,
  peak,
}: {
  buckets: MonthBucket[];
  average: number;
  peak: number;
}) {
  const items: TrendBarItem[] = buckets.map((b) => ({
    key: b.key,
    label: MONTH_INITIALS[b.month - 1],
    value: b.spend,
    href: `/overview?period=month&month=${b.key}`,
  }));

  return (
    <section>
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint mb-4">
        Past {buckets.length} months
      </p>

      <TrendBars items={items} height={176} />

      <div className="border-t border-line mt-6 pt-4 flex gap-10">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint">Monthly average</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{formatCurrency(average)}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint">Peak</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{formatCurrency(peak)}</p>
        </div>
      </div>
    </section>
  );
}
