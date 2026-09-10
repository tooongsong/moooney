'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ConfirmTransactionForm, type ConfirmFormValues } from '@/components/ConfirmTransactionForm';
import { updateTransaction, type SaveTransactionInput } from '@/app/actions/transactions';
import { toDateInputValue } from '@/lib/utils';
import type { Transaction } from '@/db/schema';
import type { TransactionType } from '@/lib/categories';

interface EditTransactionClientProps {
  transaction: Transaction;
  categories: string[];
  paymentMethods: string[];
}

export function EditTransactionClient({ transaction, categories, paymentMethods }: EditTransactionClientProps) {
  const router = useRouter();

  const initial: ConfirmFormValues = {
    amount: String(transaction.amount),
    merchant: transaction.merchant,
    category: transaction.category,
    date: toDateInputValue(transaction.date),
    type: transaction.type as TransactionType, // safe: the parent page (/history/[id]/page.tsx) never renders this component for a balance_adjustment row
    description: transaction.description,
    paymentMethod: transaction.paymentMethod || '',
    notes: transaction.notes || '',
    items: transaction.items,
  };

  async function handleSave(input: SaveTransactionInput) {
    const result = await updateTransaction(transaction.id, input);
    if (result.success) {
      toast.success('Updated');
      router.push('/history');
    } else {
      toast.error(result.error);
    }
  }

  return (
    <ConfirmTransactionForm
      initial={initial}
      categories={categories}
      paymentMethods={paymentMethods}
      receiptImage={transaction.receiptUrl}
      saveLabel="Save changes"
      onSave={handleSave}
      onCancel={() => router.push('/history')}
    />
  );
}
