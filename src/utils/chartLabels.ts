/**
 * Nudge a column of labels apart so none overlap, keeping them as close to
 * their true positions as possible and inside [min, max].
 *
 * Price targets cluster: a stock can easily have its mean target within a
 * couple of dollars of spot, which puts two callouts on the same pixel row.
 */
export function spreadLabels(
  positions: number[],
  minGap: number,
  bounds?: { min: number; max: number }
): number[] {
  if (positions.length === 0) return [];

  // Work in sorted order, then map back — the caller's order is meaningful
  // (it pairs with their labels) but the spreading has to run top to bottom.
  const order = positions
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);

  // Forward pass: push each label below the one before it.
  for (let i = 1; i < order.length; i++) {
    const gap = order[i].value - order[i - 1].value;
    if (gap < minGap) order[i].value = order[i - 1].value + minGap;
  }

  if (bounds) {
    // The forward pass can push the last label past the bottom edge. Pull the
    // whole stack back up, then re-separate upward from the bottom.
    const overflow = order[order.length - 1].value - bounds.max;
    if (overflow > 0) {
      for (const item of order) item.value -= overflow;
    }

    for (let i = order.length - 2; i >= 0; i--) {
      const gap = order[i + 1].value - order[i].value;
      if (gap < minGap) order[i].value = order[i + 1].value - minGap;
    }

    // If everything cannot fit, clamp — an overlapping label beats one drawn
    // outside the plot where it would be clipped away entirely.
    const underflow = bounds.min - order[0].value;
    if (underflow > 0) {
      for (const item of order) {
        item.value = Math.min(bounds.max, item.value + underflow);
      }
    }
  }

  const out = new Array<number>(positions.length);
  for (const item of order) out[item.index] = item.value;
  return out;
}
