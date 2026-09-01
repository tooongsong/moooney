export const ACCOUNT_TYPES = [
  { value: 'cash',        label: 'Cash',        isLiability: false },
  { value: 'checking',    label: 'Checking',    isLiability: false },
  { value: 'savings',     label: 'Savings',     isLiability: false },
  { value: 'investment',  label: 'Investment',  isLiability: false },
  { value: 'credit_card', label: 'Credit Card', isLiability: true  },
  { value: 'loan',        label: 'Loan',        isLiability: true  },
  { value: 'mortgage',    label: 'Mortgage',    isLiability: true  },
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number]['value'];

// Legacy 'bank' type treated as asset (checking).
export const ASSET_TYPES = new Set<string>(['cash', 'checking', 'savings', 'investment', 'bank']);
export const LIABILITY_TYPES = new Set<string>(['credit_card', 'loan', 'mortgage']);

export function isLiabilityType(type: string): boolean {
  return LIABILITY_TYPES.has(type);
}

export function accountTypeLabel(type: string): string {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? (type === 'bank' ? 'Bank' : type);
}

export interface NetWorthSummary {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
}

export function computeNetWorth(accounts: { type: string; balance: number }[]): NetWorthSummary {
  let totalAssets = 0;
  let totalLiabilitiesRaw = 0;
  for (const a of accounts) {
    if (ASSET_TYPES.has(a.type)) totalAssets += a.balance;
    else if (LIABILITY_TYPES.has(a.type)) totalLiabilitiesRaw += a.balance;
  }
  const totalLiabilities = Math.max(0, -totalLiabilitiesRaw);
  return { netWorth: totalAssets - totalLiabilities, totalAssets, totalLiabilities };
}
