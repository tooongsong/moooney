'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { subMonths, addMonths } from 'date-fns';
import { animate, AnimatePresence, motion } from 'motion/react';
import { ResponsiveAmount } from '@/components/ResponsiveAmount';
import { TrendBars, type TrendBarItem } from '@/components/TrendBars';
import { CategoryBlocks } from '@/components/CategoryBlocks';
import { PeriodNavigator } from '@/components/PeriodNavigator';
import { MonthPicker } from '@/components/MonthPicker';
import { YearPicker } from '@/components/YearPicker';
import { getAvailableYears, type OverviewData, type OverviewPeriod } from '@/app/actions/overview';
import { formatCurrency } from '@/lib/utils';

interface OverviewClientProps {
  data: OverviewData;
  period: OverviewPeriod;
  currentYear: number;
  currentMonth: number;
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

function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [y, m] = monthKey.split('-').map(Number);
  return { year: y, month: m };
}

export function OverviewClient({ data, period, currentYear, currentMonth }: OverviewClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  const { year: viewYear, month: viewMonth } =
    period === 'month' && data.monthKey
      ? parseMonthKey(data.monthKey)
      : { year: period === 'year' ? Number(data.label) : currentYear, month: currentMonth };

  function navigate(params: Record<string, string>) {
    startTransition(() => router.push(`/overview?${new URLSearchParams(params).toString()}`));
  }

  function goToMode(nextMode: OverviewPeriod) {
    if (nextMode === period) return;
    if (nextMode === 'year' && period === 'month') {
      navigate({ period: 'year', year: String(viewYear) });
    } else if (nextMode === 'all') {
      navigate({ period: 'all' });
    } else if (nextMode === 'month') {
      navigate({ period: 'month', month: `${currentYear}-${String(currentMonth).padStart(2, '0')}` });
    } else {
      navigate({ period: 'year', year: String(currentYear) });
    }
  }

  function prevPeriod() {
    if (period === 'month') {
      const d = subMonths(new Date(viewYear, viewMonth - 1, 1), 1);
      navigate({ period: 'month', month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
    } else if (period === 'year') {
      navigate({ period: 'year', year: String(viewYear - 1) });
    }
  }

  function nextPeriod() {
    if (period === 'month') {
      const d = addMonths(new Date(viewYear, viewMonth - 1, 1), 1);
      navigate({ period: 'month', month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
    } else if (period === 'year') {
      navigate({ period: 'year', year: String(viewYear + 1) });
    }
  }

  const isCurrentPeriod =
    period === 'month' ? viewYear === currentYear && viewMonth === currentMonth
    : period === 'year' ? viewYear === currentYear
    : true;

  async function openYearPicker() {
    const years = await getAvailableYears();
    setAvailableYears(years);
    setYearPickerOpen(true);
  }

  const trendItems: TrendBarItem[] =
    period === 'month'
      ? (data.dailyTrend ?? []).map((d) => ({ key: String(d.day).padStart(2, '0'), value: d.spend }))
      : period === 'year'
        ? (data.monthlyTrend ?? []).map((m) => ({
            key: MONTH_NAMES[m.month - 1],
            value: m.spend,
            href: `/overview?period=month&month=${viewYear}-${String(m.month).padStart(2, '0')}`,
          }))
        : (data.yearlyTrend ?? []).map((y) => ({ key: String(y.year), value: y.spend }));

  const labelEvery = period === 'month' ? 5 : 1;

  const viewAllHref =
    period === 'month' ? `/history?month=${data.monthKey}`
    : period === 'all' ? '/history?allTime=true'
    : `/history?year=${viewYear}`;

  const navigatorLabel =
    period === 'month'
      ? new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(viewYear, viewMonth - 1, 1)).toUpperCase()
      : String(viewYear);

  const contentKey = period === 'month' ? `month-${data.monthKey}` : period === 'year' ? `year-${data.label}` : 'all';

  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-4">Overview</p>

      <div className="flex gap-2 mb-6">
        {(['month', 'year', 'all'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => goToMode(m)}
            className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full transition-colors ${
              period === m ? 'bg-ink text-paper' : 'bg-sand text-ink-soft'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {period !== 'all' && (
        <div className="mb-4">
          <PeriodNavigator
            label={navigatorLabel}
            onPrev={prevPeriod}
            onNext={nextPeriod}
            nextDisabled={isCurrentPeriod}
            onLabelClick={() => (period === 'month' ? setMonthPickerOpen(true) : openYearPicker())}
          />
        </div>
      )}

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
          key={contentKey}
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

      {period === 'month' && (
        <MonthPicker
          open={monthPickerOpen}
          onClose={() => setMonthPickerOpen(false)}
          selectedYear={viewYear}
          selectedMonth={viewMonth}
          onSelect={(y, m) => {
            setMonthPickerOpen(false);
            navigate({ period: 'month', month: `${y}-${String(m).padStart(2, '0')}` });
          }}
        />
      )}
      {period === 'year' && (
        <YearPicker
          open={yearPickerOpen}
          onClose={() => setYearPickerOpen(false)}
          selectedYear={viewYear}
          availableYears={availableYears}
          onSelect={(y) => {
            setYearPickerOpen(false);
            navigate({ period: 'year', year: String(y) });
          }}
        />
      )}
    </div>
  );
}
