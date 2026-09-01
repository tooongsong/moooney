'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TransferForm, type TransferFormValues, type AccountOption } from '@/components/TransferForm';
import { updateTransfer, type TransferInput } from '@/app/actions/transfers';
import { toDateInputValue } from '@/lib/utils';
import type { Transfer } from '@/db/schema';

interface TransferDetailClientProps {
  transfer: Transfer;
  accounts: AccountOption[];
}

export function TransferDetailClient({ transfer, accounts }: TransferDetailClientProps) {
  const router = useRouter();

  const initial: TransferFormValues = {
    amount: String(transfer.amount),
    fromAccount: transfer.fromAccount,
    toAccount: transfer.toAccount,
    date: toDateInputValue(transfer.date),
    note: transfer.note || '',
  };

  async function handleSave(input: TransferInput) {
    const result = await updateTransfer(transfer.id, input);
    if (result.success) {
      toast.success('Saved');
      router.push('/history');
    } else {
      toast.error(result.error || 'Could not save');
    }
  }

  return (
    <TransferForm
      initial={initial}
      accounts={accounts}
      saveLabel="Save changes"
      onSave={handleSave}
      onCancel={() => router.push('/history')}
    />
  );
}
