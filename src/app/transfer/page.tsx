'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { TransferForm, type TransferFormValues, type AccountOption } from '@/components/TransferForm';
import { PageHeader } from '@/components/PageHeader';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { createTransfer, type TransferInput } from '@/app/actions/transfers';
import { getAccountsForTransfer } from '@/app/actions/manage';
import { toDateInputValue } from '@/lib/utils';

export default function TransferPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountOption[] | null>(null);

  useEffect(() => {
    getAccountsForTransfer().then(setAccounts);
  }, []);

  async function handleSave(input: TransferInput) {
    const result = await createTransfer(input);
    if (result.success) {
      toast.success('Transferred');
      router.push('/');
    } else {
      toast.error(result.error || 'Could not save');
    }
  }

  const initial: TransferFormValues = {
    amount: '',
    fromAccount: '',
    toAccount: '',
    date: toDateInputValue(),
    note: '',
  };

  return (
    <div className="max-w-md mx-auto px-6 min-h-screen bg-paper flex flex-col">
      <PageHeader
        left={
          <HeaderIconButton className="-ml-2" onClick={() => router.push('/')}>
            <X />
          </HeaderIconButton>
        }
        title="Transfer"
      />

      <div className="pt-6 pb-10 flex-1">
        {accounts === null ? null : accounts.length < 2 ? (
          <div className="text-center py-16 text-ink-faint text-sm border border-dashed border-line mt-6">
            <p>You need at least 2 accounts to make a transfer.</p>
            <Link href="/manage" className="inline-block mt-4 text-ink font-medium underline underline-offset-4">
              Add an account
            </Link>
          </div>
        ) : (
          <TransferForm initial={initial} accounts={accounts} onSave={handleSave} onCancel={() => router.push('/')} />
        )}
      </div>
    </div>
  );
}
