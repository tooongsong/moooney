'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

interface MonthPickerProps {
  open: boolean;
  onClose: () => void;
  selectedYear: number;
  selectedMonth: number; // 1-12
  onSelect: (year: number, month: number) => void;
}

export function MonthPicker({ open, onClose, selectedYear, selectedMonth, onSelect }: MonthPickerProps) {
  const [gridYear, setGridYear] = useState(selectedYear);

  // Re-sync the grid's year to whatever is actually selected each time the
  // sheet opens, so reopening it doesn't show wherever it was left scrolled to.
  useEffect(() => {
    if (open) setGridYear(selectedYear);
  }, [open, selectedYear]);

  const now = new Date();
  const isCurrentYear = gridYear === now.getFullYear();

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="rounded-t-3xl rounded-b-none border-0 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] gap-4 bg-paper-card max-w-none w-full"
        style={{ position: 'fixed', top: 'auto', bottom: 0, left: 0, right: 0, transform: 'none' }}
      >
        <DialogTitle className="sr-only">Select month</DialogTitle>
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setGridYear((y) => y - 1)}
            className="min-h-11 min-w-11 flex items-center justify-center text-ink-faint active:text-ink"
            aria-label="Previous year"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <span className="text-base font-bold tabular-nums text-ink">{gridYear}</span>
          <button
            type="button"
            onClick={() => setGridYear((y) => y + 1)}
            disabled={isCurrentYear}
            className="min-h-11 min-w-11 flex items-center justify-center text-ink-faint active:text-ink disabled:opacity-25"
            aria-label="Next year"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MONTH_LABELS.map((label, i) => {
            const monthNum = i + 1;
            const isFuture = gridYear === now.getFullYear() && monthNum > now.getMonth() + 1;
            const isSelected = gridYear === selectedYear && monthNum === selectedMonth;
            return (
              <button
                key={label}
                type="button"
                disabled={isFuture}
                onClick={() => onSelect(gridYear, monthNum)}
                className={cn(
                  'h-14 rounded-2xl text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-25',
                  isSelected ? 'bg-accent text-white' : 'bg-sand text-ink-soft active:bg-ink/10'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
