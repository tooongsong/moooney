'use client';

import { useState } from 'react';
import { notFound } from 'next/navigation';
import { CategoryBlocks } from '@/components/CategoryBlocks';
import { MonthPicker } from '@/components/MonthPicker';
import { TrendPanel } from '@/components/TrendPanel';
import { CategoryDetailPanel } from '@/components/CategoryDetailPanel';
import { OverviewClient } from '@/components/OverviewClient';
import { CATEGORY_TOTALS, TREND, DETAIL, OVERVIEW_DATA } from './fixtures';

// THROWAWAY — scaffolding so the desktop rebuild can be verified without
// signing in, and without a test account writing to the real database.
// Deleted before this branch is finished.
//
// Two gates, because a route that bypasses auth is worth being paranoid about:
// the middleware matcher skips /__preview, and this notFound() means that even
// if that line survived a merge, production would still 404.

export default function PreviewPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  if (process.env.NODE_ENV !== 'development') notFound();

  return (
    <div className="min-h-screen bg-paper text-ink px-10 py-10">
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-accent mb-8">
        Throwaway preview — not part of the app
      </p>

      <Section title="CategoryBlocks — phone defaults (must be unchanged)">
        <CategoryBlocks data={CATEGORY_TOTALS} />
      </Section>

      <Section title={`CategoryBlocks — desktop, live. Selected: ${selected ?? 'none'}`}>
        <CategoryBlocks
          data={CATEGORY_TOTALS}
          maxSize={168}
          labelOutside
          selected={selected}
          onSelect={setSelected}
        />
      </Section>

      <Section title="Right panel — default state (nothing selected)">
        <div className="max-w-[46rem]"><TrendPanel {...TREND} /></div>
      </Section>

      <Section title="Right panel — selected state ('Car')">
        <div className="max-w-[46rem]"><CategoryDetailPanel detail={DETAIL} /></div>
      </Section>

      <Section title="Right panel — selected state with no entries">
        <div className="max-w-[46rem]">
          <CategoryDetailPanel detail={{ ...DETAIL, total: 0, share: 0, count: 0, transactions: [] }} />
        </div>
      </Section>

      <Section title="Full /overview — default state (no category selected)">
        <div className="d-max-xl max-lg:max-w-md mx-auto">
          <OverviewClient
            data={OVERVIEW_DATA}
            period="month"
            currentYear={2026}
            currentMonth={9}
            trend={TREND}
            detail={null}
          />
        </div>
      </Section>

      <Section title="Full /overview — 'Car' selected">
        <div className="d-max-xl max-lg:max-w-md mx-auto">
          <OverviewClient
            data={OVERVIEW_DATA}
            period="month"
            currentYear={2026}
            currentMonth={9}
            trend={TREND}
            detail={DETAIL}
          />
        </div>
      </Section>

      <Section title="MonthPicker — centred above lg, bottom sheet below it">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="h-9 px-5 rounded-full bg-ink text-paper text-[10px] font-bold uppercase tracking-widest"
        >
          Open month picker
        </button>
        <MonthPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          selectedYear={2026}
          selectedMonth={9}
          onSelect={() => setPickerOpen(false)}
        />
      </Section>

      <Section title="CategoryBlocks — empty state">
        <CategoryBlocks data={[]} maxSize={168} labelOutside />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-14 border-t border-line pt-5">
      <h2 className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint mb-6">{title}</h2>
      {children}
    </section>
  );
}
