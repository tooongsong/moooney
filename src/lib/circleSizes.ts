export interface CircleSizeOptions {
  /** Nothing is drawn smaller than this. */
  min: number;
  /** The largest value gets exactly this. */
  max: number;
  /** Guaranteed gap between adjacent ranks, so the ordering reads. */
  minStep: number;
}

/**
 * Diameters for a set of values, largest first.
 *
 * Two rules, in this order:
 *
 * 1. Area tracks the value, so the diameter tracks its square root. Scaling
 *    the diameter directly makes area grow with the square of the value,
 *    which balloons the leader and collapses everything behind it.
 *
 * 2. Adjacent ranks are then forced at least `minStep` apart. Area scaling
 *    alone leaves near-equal values looking identical — on a real month,
 *    $646.80 and $600.00 both came out at 81px — and the ordering is the
 *    thing the chart exists to show.
 *
 * Rule 2 overstates a difference when two values really are close. That is a
 * deliberate trade of accuracy for legibility, asked for explicitly: the
 * ranking has to be visible.
 */
export function circleSizes(valuesDescending: number[], opts: CircleSizeOptions): number[] {
  const { min, max, minStep } = opts;
  if (valuesDescending.length === 0) return [];

  const n = valuesDescending.length;
  const peak = valuesDescending[0];
  const span = max - min;

  // A ladder of n rungs needs (n-1) steps of headroom. Past that the band
  // cannot hold the requested step, so every rank shares what there is.
  const step = n > 1 ? Math.min(minStep, span / (n - 1)) : 0;

  const sizes = valuesDescending.map((v, i) => {
    const byValue = peak > 0 ? min + Math.sqrt(Math.max(0, v) / peak) * span : min;
    // Floor for this rank: enough room beneath it for everyone still to come.
    // Without it the value-based size can start so low that stepping down
    // runs through the floor, and clamping there silently eats the step.
    return Math.max(byValue, min + (n - 1 - i) * step);
  });

  // Then cap each rank below the one above. This can never breach the floor
  // above: sizes[i-1] is at least min + (n-i)*step, so sizes[i-1] - step is at
  // least this rank's own floor.
  for (let i = 1; i < n; i++) {
    sizes[i] = Math.min(sizes[i], sizes[i - 1] - step);
  }

  // Repeated subtraction drifts, and these land in a style attribute — 56px
  // reads better than 56.00000000000006px.
  return sizes.map((v) => Math.round(v * 100) / 100);
}
