import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { getTransfer } from '@/app/actions/transfers';
import { getAccountsForTransfer } from '@/app/actions/manage';
import { TransferDetailClient } from '@/components/TransferDetailClient';
import { DeleteTransferButton } from '@/components/DeleteTransferButton';
import { BACK_PARAM, safeBackTarget } from '@/lib/backTarget';

export default async function TransferDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  // Where the list that sent us here lives. Validated: it is a redirect target
  // taken straight off the URL.
  const backTo = safeBackTarget((await searchParams)[BACK_PARAM], '/history');
  const [transfer, accounts] = await Promise.all([getTransfer(id), getAccountsForTransfer()]);

  if (!transfer) {
    return (
      <div className="max-w-md mx-auto px-6 min-h-screen flex items-center justify-center bg-paper">
        <p className="text-sm text-ink-soft">Transfer not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 min-h-screen bg-paper pb-16">
      <PageHeader
        left={
          <HeaderIconButton href={backTo} className="-ml-2">
            <ArrowLeft />
          </HeaderIconButton>
        }
        title="Edit transfer"
        right={<DeleteTransferButton id={transfer.id} backTo={backTo} />}
      />

      <section className="pt-6">
        <TransferDetailClient transfer={transfer} accounts={accounts} backTo={backTo} />
      </section>
    </div>
  );
}
