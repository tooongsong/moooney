import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { getTransfer } from '@/app/actions/transfers';
import { getPaymentMethodNames } from '@/app/actions/manage';
import { TransferDetailClient } from '@/components/TransferDetailClient';
import { DeleteTransferButton } from '@/components/DeleteTransferButton';

export default async function TransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [transfer, accounts] = await Promise.all([getTransfer(id), getPaymentMethodNames()]);

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
          <HeaderIconButton href="/history" className="-ml-2">
            <ArrowLeft />
          </HeaderIconButton>
        }
        title="Edit transfer"
        right={<DeleteTransferButton id={transfer.id} />}
      />

      <section className="pt-6">
        <TransferDetailClient transfer={transfer} accounts={accounts} />
      </section>
    </div>
  );
}
