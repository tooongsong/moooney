import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { ManageList } from '@/components/ManageList';
import {
  addPaymentMethod,
  deletePaymentMethod,
  listCustomCategories,
  addCustomCategory,
  deleteCustomCategory,
} from '@/app/actions/manage';
import { signOut } from '@/app/actions/auth';
import { getAccountBalances } from '@/app/actions/accounts';
import { formatCurrency } from '@/lib/utils';
import { CATEGORIES } from '@/lib/categories';

export default async function ManagePage() {
  const [accounts, categories] = await Promise.all([getAccountBalances(), listCustomCategories()]);

  return (
    <div className="max-w-md mx-auto px-6 min-h-screen bg-paper pb-16">
      <PageHeader
        left={
          <HeaderIconButton href="/" className="-ml-2">
            <ArrowLeft />
          </HeaderIconButton>
        }
        title="Manage"
      />

      <div className="pt-6 space-y-10">
        <section>
          <ManageList
            title="Accounts"
            description="Set a starting balance per account — the app tracks it forward from what you record. For a credit card, enter what you currently owe as a negative number."
            placeholder="e.g. Chase Sapphire"
            withStartingBalance
            withAccountType
            items={accounts.map((a) => ({ id: a.id, name: a.name, subtitle: formatCurrency(a.balance), type: a.type }))}
            onAdd={addPaymentMethod}
            onDelete={deletePaymentMethod}
          />
          {accounts.length > 0 && (
            <Link href="/accounts" className="text-xs text-ink-faint hover:text-ink-soft flex items-center gap-0.5 mt-3">
              View balances <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </section>

        <ManageList
          title="Categories"
          description="Add your own on top of the built-in ones."
          placeholder="e.g. Childcare"
          items={categories}
          builtIn={[...CATEGORIES]}
          onAdd={addCustomCategory}
          onDelete={deleteCustomCategory}
        />

        <form action={signOut}>
          <button type="submit" className="text-sm text-ink-faint hover:text-ink-soft transition-colors">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
