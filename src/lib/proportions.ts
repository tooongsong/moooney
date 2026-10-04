/**
 * Rule widths for a list of amounts, each against the largest on screen.
 *
 * Scaled within the visible result set rather than globally: the rule answers
 * "how big is this next to the others here", which is the question a list of
 * one cannot pose — hence null rather than a full-width rule implying a
 * comparison that does not exist.
 */
export function proportions(amounts: number[]): (number | null)[] {
  if (amounts.length < 2) return amounts.map(() => null);
  const max = Math.max(...amounts.map((a) => Math.abs(a)));
  if (max <= 0) return amounts.map(() => null);
  return amounts.map((a) => Math.abs(a) / max);
}
