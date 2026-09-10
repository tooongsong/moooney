'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { subMonths, addMonths, format } from 'date-fns';
import { PeriodNavigator } from '@/components/PeriodNavigator';
import { MonthPicker } from '@/components/MonthPicker';

interface HistoryPeriodNavProps {
  currentYear: number;
  currentMonth: number; // 1-12, server-computed "now" — see history/page.tsx
}

export function HistoryPeriodNav({ currentYear, currentMonth }: HistoryPeriodNavProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);

  const param = searchParams.get('month');
  const currentDate = param
    ? (() => { const [y, m] = param.split('-').map(Number); return new Date(y, m - 1, 1); })()
    : new Date(currentYear, currentMonth - 1, 1);
  const isCurrentMonth = currentDate.getFullYear() === currentYear && currentDate.getMonth() + 1 === currentMonth;

  function navigate(date: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('month', format(date, 'yyyy-MM'));
    params.delete('year'); // month is more specific than year; picking a month always clears any year filter
    startTransition(() => router.push(`?${params.toString()}`));
  }

  return (
    <>
      <PeriodNavigator
        label={format(currentDate, 'MMMM yyyy').toUpperCase()}
        onPrev={() => navigate(subMonths(currentDate, 1))}
        onNext={() => navigate(addMonths(currentDate, 1))}
        nextDisabled={isCurrentMonth}
        onLabelClick={() => setPickerOpen(true)}
      />
      <MonthPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedYear={currentDate.getFullYear()}
        selectedMonth={currentDate.getMonth() + 1}
        onSelect={(y, m) => {
          setPickerOpen(false);
          navigate(new Date(y, m - 1, 1));
        }}
      />
    </>
  );
}
