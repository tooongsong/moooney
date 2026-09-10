export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export interface BalanceAdjustmentInput {
  /** Signed dollars: positive for assets, negative for liabilities (owed). */
  currentBalance: number;
  /** What the user typed, in the UI's framing — "Balance" for assets, "Owed" for liabilities. */
  enteredValue: number;
  isLiability: boolean;
}

export interface BalanceAdjustmentResult {
  /** Signed dollars the account balance should become. */
  targetBalance: number;
  /** Signed integer cents to add via the adjustment row. */
  deltaCents: number;
  /** deltaCents / 100 — for building the transaction row's `amount`. */
  deltaDollars: number;
}

export function computeBalanceAdjustment({
  currentBalance,
  enteredValue,
  isLiability,
}: BalanceAdjustmentInput): BalanceAdjustmentResult {
  // `|| 0` normalizes -0 (from `-enteredValue` when enteredValue is 0) to +0 —
  // otherwise a liability reaching exactly $0 owed would carry a -0 balance,
  // and Intl.NumberFormat renders that as "-$0.00".
  const targetBalance = (isLiability ? -enteredValue : enteredValue) || 0;
  const deltaCents = toCents(targetBalance) - toCents(currentBalance);
  return { targetBalance, deltaCents, deltaDollars: deltaCents / 100 };
}

export function isValidEnteredValue(enteredValue: number, isLiability: boolean): boolean {
  if (!Number.isFinite(enteredValue)) return false;
  if (isLiability && enteredValue < 0) return false;
  return true;
}
