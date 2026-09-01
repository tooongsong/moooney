'use client';

import { useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TransactionType } from '@/lib/categories';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { TransactionDraft } from '@/app/actions/transactions';
import type { SaveTransactionInput } from '@/app/actions/transactions';

interface Row {
  included: boolean;
  amount: string;
  merchant: string;
  category: string;
  date: string;
  type: TransactionType;
  description: string;
  needsReview: boolean;
}

function draftToRow(draft: TransactionDraft): Row {
  return {
    included: true,
    amount: draft.amount != null ? String(draft.amount) : '',
    merchant: draft.merchant || '',
    category: draft.category,
    date: draft.date,
    type: draft.type,
    description: draft.description,
    needsReview: draft.needsReview,
  };
}

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'refund', label: 'Refund' },
];

interface BatchConfirmListProps {
  drafts: TransactionDraft[];
  categories: string[];
  receiptImage?: string | null;
  onSave: (inputs: SaveTransactionInput[]) => Promise<void>;
  onCancel: () => void;
}

export function BatchConfirmList({ drafts, categories, receiptImage, onSave, onCancel }: BatchConfirmListProps) {
  const [rows, setRows] = useState<Row[]>(() => drafts.map(draftToRow));
  const [expanded, setExpanded] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedCount = rows.filter((r) => r.included).length;
  const allSelected = selectedCount === rows.length;

  function update(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function toggleAll() {
    setRows((prev) => prev.map((r) => ({ ...r, included: !allSelected })));
  }

  async function handleSave() {
    const validRows = rows
      .map((r, i) => ({ row: r, draft: drafts[i] }))
      .filter(({ row }) => row.included && parseFloat(row.amount) > 0 && row.merchant.trim());

    if (validRows.length === 0) return;

    setIsSaving(true);
    try {
      await onSave(
        validRows.map(({ row, draft }) => ({
          amount: parseFloat(row.amount),
          merchant: row.merchant.trim(),
          category: row.category,
          date: row.date,
          type: row.type,
          description: row.description.trim() || row.merchant.trim(),
          paymentMethod: draft.paymentMethod || null,
          items: draft.items || null,
          receiptImage: receiptImage || null,
          needsReview: false,
        }))
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-ink">Found {rows.length} transactions</p>
          <p className="text-xs text-ink-faint">Review, uncheck any you don&apos;t want, then save</p>
        </div>
        <button type="button" onClick={toggleAll} className="text-xs font-semibold uppercase tracking-widest text-ink-soft underline underline-offset-2 shrink-0">
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>

      <div className="border border-line bg-paper-card divide-y divide-line">
        {rows.map((row, i) => {
          const isOpen = expanded === i;
          return (
            <div key={i}>
              <div className="flex items-center gap-3 px-3 py-3">
                <input
                  type="checkbox"
                  checked={row.included}
                  onChange={(e) => update(i, { included: e.target.checked })}
                  className="h-4 w-4 rounded border-line accent-accent shrink-0"
                />
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : i)}
                  className={cn('flex-1 flex items-center justify-between min-w-0 text-left', !row.included && 'opacity-40')}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{row.merchant || 'Unknown merchant'}</p>
                    <p className="text-xs text-ink-faint flex items-center gap-1.5">
                      <span className="truncate uppercase tracking-wide">{row.category}</span>
                      <span className="w-0.5 h-0.5 rounded-full bg-ink-faint shrink-0" />
                      <span className="shrink-0">{formatDate(row.date, { day: 'numeric', month: 'short' })}</span>
                      {row.needsReview && <span className="shrink-0 text-accent font-medium">· Review</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-sm font-medium text-ink tabular-nums">
                      {row.amount ? formatCurrency(parseFloat(row.amount)) : '—'}
                    </span>
                    <ChevronDown className={cn('h-4 w-4 text-ink-faint transition-transform', isOpen && 'rotate-180')} />
                  </div>
                </button>
              </div>

              {isOpen && (
                <div className="px-3 pb-4 space-y-3 bg-sand/40">
                  <div className="flex gap-2 pt-1">
                    {TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => update(i, { type: opt.value })}
                        className={cn(
                          'flex-1 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors',
                          row.type === opt.value ? 'bg-accent text-white' : 'bg-sand text-ink-soft'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      inputMode="decimal"
                      value={row.amount}
                      onChange={(e) => update(i, { amount: e.target.value.replace(/[^0-9.]/g, '') })}
                      placeholder="Amount"
                      className="rounded-lg border-line bg-paper-card text-sm h-9"
                    />
                    <Input
                      value={row.merchant}
                      onChange={(e) => update(i, { merchant: e.target.value })}
                      placeholder="Merchant"
                      className="rounded-lg border-line bg-paper-card text-sm h-9"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={row.category} onValueChange={(v) => update(i, { category: v })}>
                      <SelectTrigger className="rounded-lg border-line bg-paper-card w-full h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="date"
                      value={row.date}
                      onChange={(e) => update(i, { date: e.target.value })}
                      className="rounded-lg border-line bg-paper-card text-sm h-9"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1 h-12 border-line" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={selectedCount === 0 || isSaving}
          className="flex-1 h-12 bg-accent hover:bg-accent/90 text-white text-sm font-semibold uppercase tracking-widest"
        >
          {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : `Save ${selectedCount}`}
        </Button>
      </div>
    </div>
  );
}
