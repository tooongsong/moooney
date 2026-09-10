'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { subMonths, addMonths, format } from 'date-fns';
import { PeriodNavigator } from '@/components/PeriodNavigator';
import { MonthPicker } from '@/components/MonthPicker';
import { YearPicker } from '@/components/YearPicker';
import { getAvailableYears } from '@/app/actions/overview';

interface HistoryPeriodNavProps {
  currentYear: number;
  currentMonth: number; // 1-12, server-computed "now" — see history/page.tsx
}

export function HistoryPeriodNav({ currentYear, currentMonth }: HistoryPeriodNavProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  const monthParam = searchParams.get('month');
  const yearParam = searchParams.get('year');
  const isYearMode = !monthParam && !!yearParam;

  function navigate(date: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('month', format(date, 'yyyy-MM'));
    params.delete('year'); // month is more specific than year; picking a month always clears any year filter
    params.delete('allTime');
    startTransition(() => router.push(`?${params.toString()}`));
  }

  function navigateYear(year: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('year', String(year));
    params.delete('month'); // stay in year mode
    params.delete('allTime');
    startTransition(() => router.push(`?${params.toString()}`));
  }

  async function openYearPicker() {
    const years = await getAvailableYears();
    setAvailableYears(years);
    setYearPickerOpen(true);
  }

  if (isYearMode) {
    const viewYear = Number(yearParam);
    return (
      <>
        <PeriodNavigator
          label={String(viewYear)}
          onPrev={() => navigateYear(viewYear - 1)}
          onNext={() => navigateYear(viewYear + 1)}
          nextDisabled={viewYear >= currentYear}
          onLabelClick={openYearPicker}
        />
        <YearPicker
          open={yearPickerOpen}
          onClose={() => setYearPickerOpen(false)}
          selectedYear={viewYear}
          availableYears={availableYears}
          onSelect={(y) => {
            setYearPickerOpen(false);
            navigateYear(y);
          }}
        />
      </>
    );
  }

  const currentDate = monthParam
    ? (() => { const [y, m] = monthParam.split('-').map(Number); return new Date(y, m - 1, 1); })()
    : new Date(currentYear, currentMonth - 1, 1);
  const isCurrentMonth = currentDate.getFullYear() === currentYear && currentDate.getMonth() + 1 === currentMonth;

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
