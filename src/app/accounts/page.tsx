import Link from 'next/link';
import { ArrowRightLeft, Plus, Wallet2 } from 'lucide-react';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { AccountTypeIcon } from '@/components/AccountTypeIcon';
import { BottomNav } from '@/components/BottomNav';
import { getAccountBalances } from '@/app/actions/accounts';
import { ACCOUNT_GROUPS, computeNetWorth } from '@/lib/accountTypes';
import { formatCurrency } from '@/lib/utils';

export default async function AccountsPage() {
  const accounts = await getAccountBalances();
  const { netWorth, totalAssets, totalLiabilities } = computeNetWorth(accounts);

  // Build groups: match each ACCOUNT_GROUP to the accounts that belong to it
  const groups = ACCOUNT_GROUPS.map((g) => ({
    label:       g.label,
    isLiability: g.isLiability,
    accounts:    accounts.filter((a) => (g.types as readonly string[]).includes(a.type)),
    subtotal:    accounts
      .filter((a) => (g.types as readonly string[]).includes(a.type))
      .reduce((s, a) => s + a.balance, 0),
  })).filter((g) => g.accounts.length > 0);

  return (
    <div className="max-w-md mx-auto px-6 min-h-screen bg-paper pb-28">
      <header className="sticky top-0 z-30 bg-paper -mx-6 px-6 py-4 flex items-center justify-between border-b-2 border-ink">
        <h1 className="text-4xl font-bold tracking-tighter text-ink">Accounts</h1>
        {accounts.length >= 2 && (
          <HeaderIconButton href="/transfer" className="-mr-2">
            <ArrowRightLeft />
          </HeaderIconButton>
        )}
      </header>

      {accounts.length === 0 ? (
        <div className="text-center py-16 text-ink-faint text-sm border border-dashed border-line mt-6">
          <Wallet2 className="h-6 w-6 mx-auto mb-3 text-ink-faint" />
          <p>No accounts yet.</p>
          <Link href="/manage" className="inline-block mt-4 text-ink font-medium underline underline-offset-4">
            Add one in Manage
          </Link>
        </div>
      ) : (
        <>
          {/* Net Worth hero */}
          <section className="pt-8 pb-6 border-b border-line">
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft mb-2">Net Worth</p>
            <p className="text-7xl font-bold tracking-tighter text-ink tabular-nums leading-none">
              {formatCurrency(netWorth)}
            </p>
          </section>

          {/* Assets / Liabilities summary */}
          <section className="grid grid-cols-2 gap-4 py-6 border-b border-line">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint mb-1">Total Assets</p>
              <p className="text-lg font-bold text-ink tabular-nums">{formatCurrency(totalAssets)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint mb-1">Total Liabilities</p>
              <p className="text-lg font-bold text-accent tabular-nums">{formatCurrency(totalLiabilities)}</p>
            </div>
          </section>

          {/* Account groups */}
          {groups.map((group) => {
            const subtotalDisplay = group.isLiability
              ? formatCurrency(Math.abs(group.subtotal))
              : formatCurrency(group.subtotal);

            return (
              <section key={group.label} className="py-6 border-b border-line last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
                    {group.label}
                  </p>
                  <p className={`text-xs tabular-nums font-semibold ${group.isLiability && group.subtotal < 0 ? 'text-accent' : 'text-ink-faint'}`}>
                    {subtotalDisplay}
                    {group.isLiability && group.subtotal < 0 ? ' owed' : ''}
                  </p>
                </div>

                <div className="divide-y divide-line">
                  {group.accounts.map((account) => (
                    <Link
                      key={account.id}
                      href={`/accounts/${account.id}`}
                      className="py-4 flex items-center justify-between gap-3 hover:bg-sand/50 -mx-2 px-2 transition-colors"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <AccountTypeIcon type={account.type} className="h-4 w-4 text-ink-faint shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-ink truncate">{account.name}</span>
                          {account.institution && (
                            <span className="block text-xs text-ink-faint truncate">{account.institution}</span>
                          )}
                        </span>
                      </span>
                      <span className={`text-lg font-bold tracking-tight tabular-nums shrink-0 ${account.balance < 0 ? 'text-accent' : 'text-ink'}`}>
                        {account.isLiability && account.balance < 0
                          ? `${formatCurrency(Math.abs(account.balance))} owed`
                          : formatCurrency(account.balance)}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}

          {/* Add account shortcut */}
          <div className="py-6">
            <Link
              href="/manage"
              className="flex items-center gap-2 text-sm text-ink-faint hover:text-ink transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add account
            </Link>
          </div>
        </>
      )}

      <BottomNav />
    </div>
  );
}
