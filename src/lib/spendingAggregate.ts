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
