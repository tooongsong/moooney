'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PeriodNavigatorProps {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  onLabelClick: () => void;
}

export function PeriodNavigator({ label, onPrev, onNext, nextDisabled, onLabelClick }: PeriodNavigatorProps) {
  return (
    <div className="flex items-center gap-1 -ml-2.5">
      <button
        type="button"
        onClick={onPrev}
        className="min-h-11 min-w-11 flex items-center justify-center text-ink-faint active:text-ink transition-colors"
        aria-label="Previous period"
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={onLabelClick}
        className="text-sm font-bold uppercase tracking-widest text-ink px-1"
      >
        {label}
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="min-h-11 min-w-11 flex items-center justify-center text-ink-faint active:text-ink transition-colors disabled:opacity-25"
        aria-label="Next period"
      >
        <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
