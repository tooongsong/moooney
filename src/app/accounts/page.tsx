import Link from 'next/link';
import { ArrowRightLeft, Plus } from 'lucide-react';
import { AccountTypeIcon } from '@/components/AccountTypeIcon';
import { BottomNav } from '@/components/BottomNav';
import { QuickAddIsland } from '@/components/QuickAddIsland';
import { getAccountBalances } from '@/app/actions/accounts';
import { ACCOUNT_GROUPS, computeNetWorth } from '@/lib/accountTypes';
import { formatCurrency } from '@/lib/utils';

export default async function AccountsPage() {
  const accounts = await getAccountBalances();
  const { netWorth, totalAssets, totalLiabilities } = computeNetWorth(accounts);

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

      {/* Minimal sticky strip — covers safe area as content scrolls under it */}
      <div className="sticky top-0 z-30 bg-paper -mx-6 px-6 pt-[calc(env(safe-area-inset-top)+0.25rem)] pb-1" />

      {/* QuickAddIsland — first interaction, top of page */}
      <QuickAddIsland />

      {accounts.length === 0 ? (
        <div className="pt-10 pb-16">
          <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-6">Accounts</p>
          <p className="text-3xl font-bold tracking-tighter text-ink-faint leading-tight">
            NO ACCOUNTS<br />YET.
          </p>
          <Link
            href="/manage"
            className="inline-block mt-6 text-xs font-bold uppercase tracking-widest text-ink underline underline-offset-4"
          >
            Add one
          </Link>
        </div>
      ) : (
        <>
          {/* ── Net Worth hero ── */}
          <section className="pt-5 pb-5">
            {/* Page identity — small, not a headline */}
            <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-3">Accounts</p>

            {/* Net worth number */}
            <p className="text-[4.25rem] font-bold tracking-tighter text-ink tabular-nums leading-none mb-3">
              {formatCurrency(netWorth)}
            </p>

            {/* Inline assets / owed — one line, no grid */}
            <div className="flex items-center gap-3 text-sm">
              <span className="text-ink-faint">
                Assets{' '}
                <span className="font-semibold text-ink tabular-nums">
                  {formatCurrency(totalAssets)}
                </span>
              </span>
              {totalLiabilities > 0 && (
                <>
                  <span className="text-line">·</span>
                  <span className="text-ink-faint">
                    Owed{' '}
                    <span className="font-semibold text-accent tabular-nums">
                      {formatCurrency(totalLiabilities)}
                    </span>
                  </span>
                </>
              )}
            </div>
          </section>

          {/* ── Transfer — inline action, not a top-bar icon ── */}
          {accounts.length >= 2 && (
            <div className="pb-5">
              <Link
                href="/transfer"
                className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink transition-colors"
              >
                <ArrowRightLeft className="h-3 w-3" />
                Transfer
              </Link>
            </div>
          )}

          {/* ── Account groups — no horizontal dividers ── */}
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.label}>
                {/* Group label + subtotal */}
                <div className="flex items-baseline justify-between mb-1">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint">
                    {group.label}
                  </p>
                  <p className={`text-[10px] tabular-nums font-semibold ${group.isLiability && group.subtotal < 0 ? 'text-accent' : 'text-ink-faint'}`}>
                    {group.isLiability && group.subtotal < 0
                      ? `${formatCurrency(Math.abs(group.subtotal))} owed`
                      : formatCurrency(group.subtotal)}
                  </p>
                </div>

                {/* Account rows */}
                <div>
                  {group.accounts.map((account) => (
                    <Link
                      key={account.id}
                      href={`/accounts/${account.id}`}
                      className="flex items-center justify-between py-3 -mx-2 px-2 rounded-xl hover:bg-sand/50 transition-colors gap-3"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <AccountTypeIcon type={account.type} className="h-3.5 w-3.5 text-ink-faint shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-ink truncate">
                            {account.name}
                          </span>
                          {account.institution && (
                            <span className="block text-[10px] text-ink-faint/60 truncate">
                              {account.institution}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className={`text-base font-bold tracking-tight tabular-nums shrink-0 ${account.balance < 0 ? 'text-accent' : 'text-ink'}`}>
                        {account.isLiability && account.balance < 0
                          ? `${formatCurrency(Math.abs(account.balance))} owed`
                          : formatCurrency(account.balance)}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* ── Add account ── */}
          <div className="pt-6 pb-4">
            <Link
              href="/manage"
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add account
            </Link>
          </div>
        </>
      )}

      <BottomNav />
    </div>
  );
}
