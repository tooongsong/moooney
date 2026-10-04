export interface AggregateInput {
  type: string;
  amount: number;
  category: string;
}

export interface AggregateResult {
  spend: number;
  income: number;
  net: number;
  categoryTotals: { name: string; value: number }[];
}

// Mirrors the exact type-branching rule getHomeData always used: expense adds
// to spend, income adds to income, refund subtracts from spend. Any other
// type (balance_adjustment, or a future type) contributes nothing — there is
// deliberately no trailing else/default branch, same as the original inline
// loop this was extracted from.
export function aggregateTransactions(txns: AggregateInput[]): AggregateResult {
  let spend = 0;
  let income = 0;
  const categoryTotals = new Map<string, number>();

  for (const t of txns) {
    if (t.type === 'expense') {
      spend += t.amount;
      categoryTotals.set(t.category, (categoryTotals.get(t.category) || 0) + t.amount);
    } else if (t.type === 'income') {
      income += t.amount;
    } else if (t.type === 'refund') {
      spend -= t.amount;
    }
  }

  return {
    spend,
    income,
    net: income - spend,
    categoryTotals: Array.from(categoryTotals.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
  };
}

export interface DatedInput extends AggregateInput {
  /** Calendar date, "YYYY-MM-DD". */
  date: string;
}

export interface MonthBucket {
  year: number;
  month: number;
  /** "YYYY-MM" */
  key: string;
  spend: number;
}

/**
 * The `count` calendar months ending at (endYear, endMonth), oldest first.
 * Months with no transactions are present with spend 0 — a trend with gaps
 * punched out of it reads as a different shape than the real one.
 */
export function trailingMonths(
  rows: DatedInput[],
  endYear: number,
  endMonth: number,
  count: number,
): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  const index = new Map<string, DatedInput[]>();

  for (let i = count - 1; i >= 0; i--) {
    const offset = endMonth - 1 - i;
    const year = endYear + Math.floor(offset / 12);
    const month = ((offset % 12) + 12) % 12 + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    buckets.push({ year, month, key, spend: 0 });
    index.set(key, []);
  }

  for (const r of rows) {
    const bucket = index.get(r.date.slice(0, 7));
    if (bucket) bucket.push(r);
  }

  for (const b of buckets) {
    b.spend = aggregateTransactions(index.get(b.key)!).spend;
  }

  return buckets;
}
