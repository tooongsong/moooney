'use client';

import { AccountLedger } from '@/components/AccountLedger';
import { formatCurrency } from '@/lib/utils';
import type { AccountLedger as Ledger, AccountDetail } from '@/app/actions/accounts';

/**
 * The reconciliation column: this month's flows, then the entries behind them.
 *
 * The entries and their running balance come from AccountLedger, built for the
 * account detail page — the spec described this panel before that existed and
 * would have had us write a second one.
 */
export function AccountsPanel({
  ledger,
  detail,
  flow,
}: {
  ledger: Ledger | null;
  detail: AccountDetail | null;
  flow: { monthIn: number; monthOut: number; label: string };
}) {
  const selected = ledger !== null && detail !== null;

  return (
    <section>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className={`text-[9px] font-bold uppercase tracking-[0.2em] truncate ${selected ? 'text-accent' : 'text-ink-faint'}`}>
            {selected ? detail!.name : `All accounts · ${flow.label}`}
          </p>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint mt-3">In this month</p>
          <p className="text-2xl font-bold tabular-nums mt-1">
            {formatCurrency(selected ? detail!.thisMonthIn : flow.monthIn)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint mt-[1.6rem]">Out</p>
          <p className="text-2xl font-bold tabular-nums text-accent mt-1">
            {formatCurrency(selected ? detail!.thisMonthOut : flow.monthOut)}
          </p>
        </div>
      </div>

      <div className="border-t border-ink mt-6 pt-2">
        {selected ? (
          <AccountLedger ledger={ledger!} />
        ) : (
          <p className="py-4 text-sm text-ink-faint">
            Pick an account to see its entries and running balance.
          </p>
        )}
      </div>
    </section>
  );
}
