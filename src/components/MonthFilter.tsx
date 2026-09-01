'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, subMonths, addMonths, startOfMonth } from 'date-fns';

export function MonthFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const now = new Date();
  const param = searchParams.get('month');
  const currentDate = param ? startOfMonth(new Date(param + '-01')) : startOfMonth(now);
  const isCurrentMonth = format(currentDate, 'yyyy-MM') === format(now, 'yyyy-MM');

  function navigate(date: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('month', format(date, 'yyyy-MM'));
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => navigate(subMonths(currentDate, 1))}
        className="p-2 -ml-2 text-ink-faint active:text-ink transition-colors"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm font-bold uppercase tracking-widest text-ink min-w-[9rem] text-center">
        {format(currentDate, 'MMMM yyyy')}
      </span>
      <button
        onClick={() => navigate(addMonths(currentDate, 1))}
        disabled={isCurrentMonth}
        className="p-2 -mr-2 text-ink-faint active:text-ink transition-colors disabled:opacity-25"
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
