'use client';

import { useState } from 'react';
import { ArrowRightLeft, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TransferInput } from '@/app/actions/transfers';

export interface TransferFormValues {
  amount: string;
  fromAccount: string;
  toAccount: string;
  date: string;
  note: string;
}

interface TransferFormProps {
  initial: TransferFormValues;
  accounts: string[];
  saveLabel?: string;
  onSave: (input: TransferInput) => Promise<void>;
  onCancel?: () => void;
}

export function TransferForm({ initial, accounts, saveLabel = 'Transfer', onSave, onCancel }: TransferFormProps) {
  const [values, setValues] = useState<TransferFormValues>(initial);
  const [isSaving, setIsSaving] = useState(false);

  const amountNumber = parseFloat(values.amount);
  const canSave =
    !isNaN(amountNumber) &&
    amountNumber > 0 &&
    values.fromAccount.length > 0 &&
    values.toAccount.length > 0 &&
    values.fromAccount !== values.toAccount &&
    !isSaving;

  function set<K extends keyof TransferFormValues>(key: K, value: TransferFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSave() {
    if (!canSave) return;
    setIsSaving(true);
    try {
      await onSave({
        amount: amountNumber,
        fromAccount: values.fromAccount,
        toAccount: values.toAccount,
        date: values.date,
        note: values.note.trim() || null,
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Amount — big and central, same treatment as the expense form */}
      <div className="text-center py-2">
        <div className="flex items-center justify-center gap-1">
          <span className="text-3xl text-ink-faint font-light">$</span>
          <input
            inputMode="decimal"
            value={values.amount}
            onChange={(e) => set('amount', e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
            className="text-6xl font-bold text-ink tracking-tighter w-56 text-center bg-transparent outline-none placeholder:text-ink-faint"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-widest text-ink-faint">From</Label>
          <div className="flex flex-wrap gap-2">
            {accounts.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => set('fromAccount', name)}
                disabled={name === values.toAccount}
                className={cn(
                  'text-xs px-3 py-1.5 transition-colors disabled:opacity-30',
                  values.fromAccount === name ? 'bg-accent text-white' : 'bg-sand text-ink-soft'
                )}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-center text-ink-faint">
          <ArrowRightLeft className="h-4 w-4" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-widest text-ink-faint">To</Label>
          <div className="flex flex-wrap gap-2">
            {accounts.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => set('toAccount', name)}
                disabled={name === values.fromAccount}
                className={cn(
                  'text-xs px-3 py-1.5 transition-colors disabled:opacity-30',
                  values.toAccount === name ? 'bg-accent text-white' : 'bg-sand text-ink-soft'
                )}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="date" className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
              Date
            </Label>
            <Input id="date" type="date" value={values.date} onChange={(e) => set('date', e.target.value)} className="border-line bg-paper-card" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note" className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
              Note
            </Label>
            <Input
              id="note"
              value={values.note}
              onChange={(e) => set('note', e.target.value)}
              placeholder="Optional"
              className="border-line bg-paper-card"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" className="flex-1 h-12 border-line" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        )}
        <Button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="flex-1 h-12 bg-accent hover:bg-accent/90 text-white text-sm font-semibold uppercase tracking-widest"
        >
          {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : saveLabel}
        </Button>
      </div>
    </div>
  );
}
