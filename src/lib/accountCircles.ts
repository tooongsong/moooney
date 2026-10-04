import { circleSizes, type CircleSizeOptions } from '@/lib/circleSizes';

export interface AccountCircle {
  name: string;
  balance: number;
  size: number;
  /** Outlined rather than filled — money owed, whatever the account type. */
  owing: boolean;
}

/**
 * Sizes and treatments for the accounts on the reconciliation surface.
 *
 * Magnitude drives the size, so a balance is passed through Math.abs — both
 * because circleSizes takes a square root and would return NaN otherwise, and
 * because a circle reads as "how much", with the sign carried by the fill.
 *
 * `owing` follows the sign rather than the account type. A checking account
 * that has gone negative owes money just as a card does, and drawing it filled
 * would read as money being there. One real account is nothing but these.
 */
export function accountCircles(
  accounts: { name: string; type: string; balance: number }[],
  opts: CircleSizeOptions,
): AccountCircle[] {
  const sorted = [...accounts].sort((x, y) => Math.abs(y.balance) - Math.abs(x.balance));
  const sizes = circleSizes(sorted.map((s) => Math.abs(s.balance)), opts);
  return sorted.map((s, i) => ({
    name: s.name,
    balance: s.balance,
    size: sizes[i],
    owing: s.balance < 0,
  }));
}
