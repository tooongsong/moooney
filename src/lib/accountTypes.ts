export const ACCOUNT_TYPES = [
  { value: 'cash',            label: 'Cash',           isLiability: false },
  { value: 'checking',        label: 'Checking',       isLiability: false },
  { value: 'savings',         label: 'Savings',        isLiability: false },
  { value: 'investment',      label: 'Investment',     isLiability: false },
  { value: 'other_asset',     label: 'Other Asset',    isLiability: false },
  { value: 'credit_card',     label: 'Credit Card',    isLiability: true  },
  { value: 'loan',            label: 'Loan',           isLiability: true  },
  { value: 'mortgage',        label: 'Mortgage',       isLiability: true  },
  { value: 'other_liability', label: 'Other Liability', isLiability: true },
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number]['value'];

// 'bank' is a legacy alias; treated as asset
export const ASSET_TYPES      = new Set<string>(['cash', 'checking', 'savings', 'investment', 'other_asset', 'bank']);
export const LIABILITY_TYPES  = new Set<string>(['credit_card', 'loan', 'mortgage', 'other_liability']);

export function isLiabilityType(type: string): boolean {
  return LIABILITY_TYPES.has(type);
}

export function accountTypeLabel(type: string): string {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.label
    ?? (type === 'bank' ? 'Checking' : type);
}

// Groups used on the Accounts page (order matters)
export const ACCOUNT_GROUPS = [
  { types: ['cash'],                      label: 'Cash',         isLiability: false },
  { types: ['checking', 'bank'],          label: 'Checking',     isLiability: false },
  { types: ['savings'],                   label: 'Savings',      isLiability: false },
  { types: ['investment'],                label: 'Investments',  isLiability: false },
  { types: ['other_asset'],               label: 'Other Assets', isLiability: false },
  { types: ['credit_card'],               label: 'Credit Cards', isLiability: true  },
  { types: ['loan'],                      label: 'Loans',        isLiability: true  },
  { types: ['mortgage'],                  label: 'Mortgages',    isLiability: true  },
  { types: ['other_liability'],           label: 'Other Liabilities', isLiability: true },
] as const;

export interface NetWorthSummary {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
}

// Balance sign convention:
//   Assets     → positive balance = money available
//   Liabilities → negative balance = money owed
// Net worth = sum of all balances (liabilities are already negative, so simple addition works)
export function computeNetWorth(accounts: { type: string; balance: number }[]): NetWorthSummary {
  let totalAssets = 0;
  let totalLiabilities = 0;

  for (const a of accounts) {
    if (ASSET_TYPES.has(a.type)) {
      totalAssets += a.balance;
    } else if (LIABILITY_TYPES.has(a.type)) {
      // balance is negative when money is owed; display as positive amount owed
      totalLiabilities += Math.max(0, -a.balance);
    }
  }

  return {
    netWorth: totalAssets - totalLiabilities,
    totalAssets,
    totalLiabilities,
  };
}
