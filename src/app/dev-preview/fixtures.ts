// THROWAWAY — scaffolding for visual verification during the desktop rebuild.
// Deleted before this branch is finished. See /src/app/__preview/page.tsx.

export const CATEGORY_TOTALS = [
  { name: 'Car', value: 4582.72 },
  { name: 'Rent', value: 3116.0 },
  { name: 'Home Improvement', value: 157.24 },
  { name: 'Groceries', value: 119.39 },
  { name: 'Transport', value: 100.38 },
];

export const TREND = {
  buckets: [
    { year: 2025, month: 10, key: '2025-10', spend: 1840.22 },
    { year: 2025, month: 11, key: '2025-11', spend: 2310.5 },
    { year: 2025, month: 12, key: '2025-12', spend: 3980.1 },
    { year: 2026, month: 1, key: '2026-01', spend: 1620.0 },
    { year: 2026, month: 2, key: '2026-02', spend: 2104.88 },
    { year: 2026, month: 3, key: '2026-03', spend: 2890.45 },
    { year: 2026, month: 4, key: '2026-04', spend: 1455.3 },
    { year: 2026, month: 5, key: '2026-05', spend: 2680.0 },
    { year: 2026, month: 6, key: '2026-06', spend: 3220.75 },
    { year: 2026, month: 7, key: '2026-07', spend: 2538.91 },
    { year: 2026, month: 8, key: '2026-08', spend: 8075.73 },
    { year: 2026, month: 9, key: '2026-09', spend: 2549.61 },
  ],
  average: 2939.12,
  peak: 8075.73,
};

export const DETAIL = {
  category: 'Car',
  total: 4582.72,
  share: 0.567,
  count: 5,
  daily: Array.from({ length: 31 }, (_, i) => ({
    day: i + 1,
    spend: [0, 0, 42.1, 0, 0, 0, 1200, 0, 0, 86.4, 0, 0, 0, 0, 0,
            3014.22, 0, 0, 0, 55, 0, 0, 0, 0, 0, 0, 185, 0, 0, 0, 0][i] ?? 0,
  })),
  transactions: [
    { id: 'p1', merchant: 'Tesla Service Center', date: '2026-08-16', amount: 3014.22, paymentMethod: 'Amex Gold' },
    { id: 'p2', merchant: 'State Farm Insurance', date: '2026-08-07', amount: 1200.0, paymentMethod: 'Chase Checking' },
    { id: 'p3', merchant: 'CA DMV Registration Renewal', date: '2026-08-27', amount: 185.0, paymentMethod: 'Chase Checking' },
    { id: 'p4', merchant: 'Tesla Supercharger', date: '2026-08-10', amount: 86.4, paymentMethod: 'Amex Gold' },
    { id: 'p5', merchant: 'Shell', date: '2026-08-20', amount: 55.0, paymentMethod: 'Cash' },
  ],
};
