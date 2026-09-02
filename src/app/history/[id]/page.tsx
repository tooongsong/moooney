import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { getTransaction } from '@/app/actions/transactions';
import { getAllCategories, getPaymentMethodNames } from '@/app/actions/manage';
import { EditTransactionClient } from '@/components/EditTransactionClient';
import { DeleteTransactionButton } from '@/components/DeleteTransactionButton';

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [transaction, categories, paymentMethods] = await Promise.all([
    getTransaction(id),
    getAllCategories(),
    getPaymentMethodNames(),
  ]);

  if (!transaction) {
    return (
      <div className="d-max-md max-lg:max-w-md mx-auto px-6 min-h-screen flex items-center justify-center bg-paper">
        <p className="text-sm text-ink-soft">Transaction not found.</p>
      </div>
    );
  }

  return (
    <div className="d-max-md max-lg:max-w-md mx-auto px-6 min-h-screen bg-paper pb-16">
      <PageHeader
        left={
          <HeaderIconButton href="/history" className="-ml-2">
            <ArrowLeft />
          </HeaderIconButton>
        }
        title="Edit"
        right={<DeleteTransactionButton id={transaction.id} />}
      />

      <section className="pt-6">
        <EditTransactionClient transaction={transaction} categories={categories} paymentMethods={paymentMethods} />
      </section>
    </div>
  );
}
