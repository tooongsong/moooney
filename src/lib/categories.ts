export const CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Home',
  'Transportation',
  'Car',
  'Shopping',
  'Pet',
  'Entertainment',
  'Bills & Utilities',
  'Travel',
  'Health',
  'Education',
  'Work',
  'Gifts',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const TRANSACTION_TYPES = ['expense', 'income', 'refund'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const DEFAULT_CATEGORY: Category = 'Other';
