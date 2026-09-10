'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { animate, AnimatePresence, motion } from 'motion/react';
import { ResponsiveAmount } from '@/components/ResponsiveAmount';
import { TrendBars, type TrendBarItem } from '@/components/TrendBars';
import { CategoryBlocks } from '@/components/CategoryBlocks';
import { formatCurrency } from '@/lib/utils';
import type { OverviewData, OverviewPeriod } from '@/app/actions/overview';

interface OverviewClientProps {
  month: OverviewData;
  year: OverviewData;
  all: OverviewData;
}

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function AnimatedAmount({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const controls = animate(display, value, {
      duration: 0.35,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <ResponsiveAmount value={display} baseSize={56} minSize={28} />;
}

export function OverviewClient({ month, year, all }: OverviewClientProps) {
  const [mode, setMode] = useState<OverviewPeriod>('month');
  const data = mode === 'month' ? month : mode === 'year' ? year : all;

  const trendItems: TrendBarItem[] =
    mode === 'month'
      ? (data.dailyTrend ?? []).map((d) => ({ key: String(d.day).padStart(2, '0'), value: d.spend }))
      : mode === 'year'
        ? (data.monthlyTrend ?? []).map((m) => ({
            key: MONTH_NAMES[m.month - 1],
            value: m.spend,
            href: `/history?month=${year.label}-${String(m.month).padStart(2, '0')}`,
          }))
        : (data.yearlyTrend ?? []).map((y) => ({ key: String(y.year), value: y.spend }));

  const labelEvery = mode === 'month' ? 5 : 1;

  const viewAllHref =
    mode === 'month'
      ? `/history?month=${month.monthKey}`
      : mode === 'all'
        ? '/history?allTime=true'
        : '/history'; // year mode: known deviation, see spec — falls back to History's own current-month default

  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-4">Overview</p>

      <div className="flex gap-2 mb-8">
        {(['month', 'year', 'all'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full transition-colors ${
              mode === m ? 'bg-ink text-paper' : 'bg-sand text-ink-soft'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <section className="pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft mb-3">
          {data.label} SPENDING
        </p>
        <AnimatedAmount value={data.spend} />
        <div className="flex items-center gap-4 mt-3 text-sm">
          <span className="text-ink-faint">Income <span className="font-bold text-ink tabular-nums">{formatCurrency(data.income)}</span></span>
          <span className="text-ink-faint">
            Net <span className={`font-bold tabular-nums ${data.net >= 0 ? 'text-ink' : 'text-accent'}`}>
              {data.net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(data.net))}
            </span>
          </span>
          {data.dailyAverage !== undefined && (
            <span className="text-ink-faint">Daily avg <span className="font-bold text-ink tabular-nums">{formatCurrency(data.dailyAverage)}</span></span>
          )}
          {data.monthlyAverage !== undefined && (
            <span className="text-ink-faint">Avg/month <span className="font-bold text-ink tabular-nums">{formatCurrency(data.monthlyAverage)}</span></span>
          )}
          {data.netWorth !== undefined && (
            <span className="text-ink-faint">Net worth <span className="font-bold text-ink tabular-nums">{formatCurrency(data.netWorth)}</span></span>
          )}
        </div>
      </section>

      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <section className="pb-8 border-b border-line">
            <TrendBars items={trendItems} labelEvery={labelEvery} />
          </section>

          <section className="pt-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft mb-5">Top Categories</h2>
            <CategoryBlocks data={data.categoryTotals} />
            {data.categoryTotals.length > 0 && (
              <Link href={viewAllHref} className="mt-4 inline-flex items-center gap-0.5 text-xs text-ink-faint hover:text-ink transition-colors">
                View all →
              </Link>
            )}
          </section>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
