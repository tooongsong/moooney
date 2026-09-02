export const CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Shopping',
  'Home',
  'Transport',
  'Car',
  'Bills',
  'Entertainment',
  'Health',
  'Travel',
  'Pet',
  'Other',
] as const;

// Legacy names that may exist on old transactions — map to current name for display
export const CATEGORY_ALIASES: Record<string, string> = {
  'Transportation':    'Transport',
  'Bills & Utilities': 'Bills',
};

export type Category = (typeof CATEGORIES)[number];

export const TRANSACTION_TYPES = ['expense', 'income', 'refund'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const DEFAULT_CATEGORY: Category = 'Other';
