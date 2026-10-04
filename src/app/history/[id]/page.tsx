import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { getTransaction } from '@/app/actions/transactions';
import { getAllCategories, getPaymentMethodNames } from '@/app/actions/manage';
import { EditTransactionClient } from '@/components/EditTransactionClient';
import { DeleteTransactionButton } from '@/components/DeleteTransactionButton';
import { BALANCE_ADJUSTMENT_TYPE } from '@/lib/categories';
import { BACK_PARAM, safeBackTarget } from '@/lib/backTarget';

export default async function TransactionDetailPage({
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

  if (transaction.type === BALANCE_ADJUSTMENT_TYPE) {
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
          <HeaderIconButton href={backTo} className="-ml-2">
            <ArrowLeft />
          </HeaderIconButton>
        }
        title="Edit"
        right={<DeleteTransactionButton id={transaction.id} backTo={backTo} />}
      />

      <section className="pt-6">
        <EditTransactionClient transaction={transaction} categories={categories} paymentMethods={paymentMethods} backTo={backTo} />
      </section>
    </div>
  );
}
