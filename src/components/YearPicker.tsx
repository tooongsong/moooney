'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface YearPickerProps {
  open: boolean;
  onClose: () => void;
  selectedYear: number;
  availableYears: number[]; // years with ≥1 transaction, ascending
  onSelect: (year: number) => void;
}

export function YearPicker({ open, onClose, selectedYear, availableYears, onSelect }: YearPickerProps) {
  const currentYear = new Date().getFullYear();
  // Always show at least 5 years (current back to current-4); extend further
  // back automatically if real data goes back further. Never gated on data
  // existing — this only informs the range, per the spec.
  const earliest = Math.min(availableYears[0] ?? currentYear, currentYear - 4);
  const years: number[] = [];
  for (let y = currentYear; y >= earliest; y--) years.push(y);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="
          border-0 p-6 gap-2 bg-paper-card max-h-[70vh] overflow-y-auto
          max-lg:rounded-t-3xl max-lg:rounded-b-none max-lg:max-w-none max-lg:w-full
          max-lg:pb-[calc(1.5rem+env(safe-area-inset-bottom))]
          max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-auto
          max-lg:translate-x-0 max-lg:translate-y-0
          lg:rounded-3xl lg:max-w-sm
        "
      >
        <DialogTitle className="sr-only">Select year</DialogTitle>
        <div className="flex flex-col gap-1.5">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => onSelect(y)}
              className={cn(
                'h-14 rounded-2xl text-base font-bold tabular-nums transition-colors',
                y === selectedYear ? 'bg-accent text-white' : 'bg-sand text-ink-soft active:bg-ink/10'
              )}
            >
              {y}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
