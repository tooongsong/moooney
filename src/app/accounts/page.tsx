import Link from 'next/link';
import { ArrowLeft, ArrowRightLeft, Wallet2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { AccountTypeIcon } from '@/components/AccountTypeIcon';
import { getAccountBalances } from '@/app/actions/accounts';
import { ACCOUNT_TYPES } from '@/lib/accountTypes';
import { formatCurrency } from '@/lib/utils';

export default async function AccountsPage() {
  const accounts = await getAccountBalances();
  const netWorth = accounts.reduce((sum, a) => sum + a.balance, 0);
  const assets = accounts.filter((a) => a.balance >= 0).reduce((sum, a) => sum + a.balance, 0);
  const liabilities = accounts.filter((a) => a.balance < 0).reduce((sum, a) => sum + a.balance, 0);

  const groups = ACCOUNT_TYPES.map((t) => ({
    type: t.value,
    label: t.label,
    accounts: accounts.filter((a) => a.type === t.value),
  })).filter((g) => g.accounts.length > 0);

  return (
    <div className="max-w-md mx-auto px-6 min-h-screen bg-paper pb-16">
      <PageHeader
        left={
          <HeaderIconButton href="/" className="-ml-2">
            <ArrowLeft />
          </HeaderIconButton>
        }
        title="Accounts"
        right={
          accounts.length >= 2 ? (
            <HeaderIconButton href="/transfer" className="-mr-2">
              <ArrowRightLeft />
            </HeaderIconButton>
          ) : undefined
        }
      />

      {accounts.length === 0 ? (
        <div className="text-center py-16 text-ink-faint text-sm border border-dashed border-line mt-6">
          <Wallet2 className="h-6 w-6 mx-auto mb-3 text-ink-faint" />
          <p>No accounts yet.</p>
          <Link href="/manage" className="inline-block mt-4 text-ink font-medium underline underline-offset-4">
            Add one
          </Link>
        </div>
      ) : (
        <>
          <section className="pt-8 pb-6 border-b border-line">
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft mb-2">Net worth</p>
            <p className="text-7xl font-bold tracking-tighter text-ink tabular-nums leading-none">{formatCurrency(netWorth)}</p>
          </section>

          <section className="grid grid-cols-2 gap-4 py-6 border-b border-line">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint mb-1">Assets</p>
              <p className="text-lg font-bold text-ink tabular-nums">{formatCurrency(assets)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint mb-1">Liabilities</p>
              <p className="text-lg font-bold text-accent tabular-nums">{formatCurrency(Math.abs(liabilities))}</p>
            </div>
          </section>

          {groups.map((group) => (
            <section key={group.type} className="py-6 border-b border-line last:border-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">{group.label}</p>
                <p className="text-xs text-ink-faint tabular-nums">
                  {formatCurrency(group.accounts.reduce((sum, a) => sum + a.balance, 0))}
                </p>
              </div>
              <div className="divide-y divide-line">
                {group.accounts.map((account) => (
                  <Link
                    key={account.id}
                    href={`/history?account=${encodeURIComponent(account.name)}`}
                    className="py-4 flex items-center justify-between gap-3 hover:bg-sand/50 -mx-2 px-2 transition-colors"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <AccountTypeIcon type={account.type} className="h-4 w-4 text-ink-faint shrink-0" />
                      <span className="text-sm font-semibold text-ink truncate">{account.name}</span>
                    </span>
                    <span className="text-lg font-bold tracking-tight text-ink tabular-nums shrink-0">
                      {formatCurrency(account.balance)}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
