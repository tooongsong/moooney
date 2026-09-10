'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { adjustAccountBalance } from '@/app/actions/accounts';
import { computeBalanceAdjustment, isValidEnteredValue } from '@/lib/balanceAdjustment';
import { formatCurrency } from '@/lib/utils';

interface EditBalanceDialogProps {
  accountId: string;
  currentBalance: number;
  isLiability: boolean;
}

export function EditBalanceDialog({ accountId, currentBalance, isLiability }: EditBalanceDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [value, setValue] = useState(() =>
    (isLiability ? Math.abs(currentBalance) : currentBalance).toFixed(2)
  );
  const [isSaving, setIsSaving] = useState(false);

  function reset() {
    setStep('input');
    setValue((isLiability ? Math.abs(currentBalance) : currentBalance).toFixed(2));
    setIsSaving(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  const enteredValue = parseFloat(value);
  const valid = Number.isFinite(enteredValue) && isValidEnteredValue(enteredValue, isLiability);
  const adjustment = valid
    ? computeBalanceAdjustment({ currentBalance, enteredValue, isLiability })
    : null;

  function handleContinue() {
    if (!adjustment) return;
    if (adjustment.deltaCents === 0) {
      setOpen(false);
      reset();
      return;
    }
    setStep('confirm');
  }

  async function handleConfirm() {
    if (!adjustment) return;
    setIsSaving(true);
    const result = await adjustAccountBalance(accountId, adjustment.targetBalance);
    setIsSaving(false);
    if (result.success) {
      toast.success('Balance updated');
      setOpen(false);
      reset();
      router.refresh();
    } else {
      toast.error(result.error || 'Could not update balance');
    }
  }

  const label = isLiability ? 'owed amount' : 'balance';

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-ink-faint hover:text-ink transition-colors"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        {step === 'input' ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Update {label}</AlertDialogTitle>
            </AlertDialogHeader>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^0-9.-]/g, ''))}
              inputMode="decimal"
              autoFocus
              className="text-lg tabular-nums"
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <button
                type="button"
                onClick={handleContinue}
                disabled={!valid}
                className="inline-flex items-center justify-center rounded-md bg-ink text-paper text-sm font-medium h-10 px-4 disabled:opacity-40"
              >
                Continue
              </button>
            </AlertDialogFooter>
          </>
        ) : adjustment ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Update {label} to {formatCurrency(enteredValue)}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will create a balance adjustment of {adjustment.deltaCents >= 0 ? '+' : '−'}
                {formatCurrency(Math.abs(adjustment.deltaDollars))}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirm} disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Confirm'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}
