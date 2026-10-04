'use client';

import Link from 'next/link';
import { TrendBars, type TrendBarItem } from '@/components/TrendBars';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { getCategoryDetail } from '@/app/actions/overview';

type Detail = Awaited<ReturnType<typeof getCategoryDetail>>;

/**
 * The overview's right column with a category selected: what it cost, what
 * share of the period that is, when it was spent, and the entries behind it.
 *
 * The share is the number that says whether a category is genuinely large or
 * merely first — a circle can only show the ordering.
 */
export function CategoryDetailPanel({ detail }: { detail: Detail }) {
  const items: TrendBarItem[] = detail.daily.map((d) => ({ key: String(d.day), value: d.spend }));
  const labelEvery = detail.daily.length > 20 ? 7 : 1;

  return (
    <section>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-accent truncate">
            {detail.category} · {detail.count} {detail.count === 1 ? 'entry' : 'entries'}
          </p>
          <p className="text-4xl font-bold tabular-nums tracking-tight mt-1">
            {formatCurrency(detail.total)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint">Share of spend</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{Math.round(detail.share * 100)}%</p>
        </div>
      </div>

      <div className="mt-6">
        <TrendBars items={items} height={96} labelEvery={labelEvery} />
      </div>

      <div className="border-t border-ink mt-6">
        {detail.transactions.length === 0 ? (
          <p className="py-4 text-sm text-ink-faint">No entries in this period.</p>
        ) : (
          detail.transactions.map((t) => (
            <Link
              key={t.id}
              href={`/history/${t.id}`}
              className="flex items-baseline justify-between gap-4 py-3 border-b border-line last:border-0 hover:bg-sand/40 transition-colors"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold truncate">{t.merchant}</span>
                <span className="block text-[9px] font-bold uppercase tracking-[0.15em] text-ink-faint mt-0.5">
                  {formatDate(t.date, { day: 'numeric', month: 'short' })}
                  {t.paymentMethod ? ` · ${t.paymentMethod}` : ''}
                </span>
              </span>
              <span className="text-base font-bold tabular-nums shrink-0">
                −{formatCurrency(t.amount)}
              </span>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
