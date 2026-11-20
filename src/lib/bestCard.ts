// Credit-card reward rates and the "which card for this category" answer.
// Rates are percentages as plain numbers: 3 means 3%.

export interface CardRewards {
  base: number;
  categories: Record<string, number>;
}

export interface RewardCard {
  id: string;
  name: string;
  rewards: CardRewards | null;
}

export interface BestCardPick {
  rate: number;
  cards: { id: string; name: string }[];
}

export interface BestCardRow extends BestCardPick {
  category: string;
}

export interface BestCards {
  rows: BestCardRow[];
  fallback: BestCardPick | null;
}

/** 0–100 with at most two decimals. The epsilon absorbs float noise (1.15 * 100). */
function isRate(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100
    && Math.abs(Math.round(n * 100) - n * 100) < 1e-6;
}

const RATE_ERROR = 'A rate must be between 0 and 100, with at most two decimals.';

/** Validates what the editor sends. `rewards: null` means "store nothing". */
export function cleanRewards(
  input: { base: number; categories: Record<string, number> },
): { ok: true; rewards: CardRewards | null } | { ok: false; error: string } {
  if (!isRate(input.base)) return { ok: false, error: RATE_ERROR };
  const categories: Record<string, number> = {};
  for (const [name, rate] of Object.entries(input.categories)) {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: 'A category rate needs a category.' };
    if (!isRate(rate)) return { ok: false, error: RATE_ERROR };
    categories[trimmed] = rate;
  }
  if (input.base === 0 && Object.keys(categories).length === 0) return { ok: true, rewards: null };
  return { ok: true, rewards: { base: input.base, categories } };
}

/**
 * One row per category in `categories` that at least one card has a rate for,
 * plus the best base rate as the "everything else" fallback. A card without a
 * rate for a category competes with its base rate.
 */
export function bestCards(cards: RewardCard[], categories: readonly string[]): BestCards {
  const ruled = cards.filter((c): c is RewardCard & { rewards: CardRewards } => c.rewards !== null);
  if (ruled.length === 0) return { rows: [], fallback: null };

  const pick = (rateOf: (r: CardRewards) => number): BestCardPick => {
    const rate = Math.max(...ruled.map((c) => rateOf(c.rewards)));
    return {
      rate,
      cards: ruled.filter((c) => rateOf(c.rewards) === rate).map(({ id, name }) => ({ id, name })),
    };
  };

  const rows = categories
    .filter((cat) => ruled.some((c) => c.rewards.categories[cat] !== undefined))
    .map((cat) => ({ category: cat, ...pick((r) => r.categories[cat] ?? r.base) }))
    .sort((a, b) => b.rate - a.rate || a.category.localeCompare(b.category));

  return { rows, fallback: pick((r) => r.base) };
}

/** Same object back when `from` is not a key, so callers can skip the write. */
export function renameRewardCategory(rewards: CardRewards, from: string, to: string): CardRewards {
  const rate = rewards.categories[from];
  if (rate === undefined) return rewards;
  const categories = { ...rewards.categories };
  delete categories[from];
  // A rate already stored under the new name wins over the renamed one.
  if (categories[to] === undefined) categories[to] = rate;
  return { base: rewards.base, categories };
}

/** Same object back when `name` is not a key; null when nothing is left to store. */
export function removeRewardCategory(rewards: CardRewards, name: string): CardRewards | null {
  if (rewards.categories[name] === undefined) return rewards;
  const categories = { ...rewards.categories };
  delete categories[name];
  if (rewards.base === 0 && Object.keys(categories).length === 0) return null;
  return { base: rewards.base, categories };
}

export function formatRate(rate: number): string {
  return `${rate}%`;
}
