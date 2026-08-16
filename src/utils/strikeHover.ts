/**
 * Hit-testing and placement helpers shared by the price-axis-aligned strike
 * panels (open interest / volume and gamma exposure). The panels paint to a
 * canvas, so hovering a bar means finding the strike whose y coordinate the
 * pointer is closest to and then parking an HTML tooltip beside the cursor.
 */

export interface PlacedStrike {
  /** Pixel y the chart's price scale mapped this strike to. */
  y: number;
  strike: number;
}

/**
 * The bar closest to the pointer's y, or null when every bar is farther away
 * than `tolerance`. Matching on y alone (rather than requiring the pointer to
 * be over the drawn bar) keeps short bars reachable — the panel reads as a
 * stack of price levels, so anywhere on the row should hit.
 */
export function findHoveredStrike<T extends PlacedStrike>(
  bars: readonly T[],
  y: number,
  tolerance: number
): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const bar of bars) {
    const dist = Math.abs(bar.y - y);
    if (dist <= tolerance && dist < bestDist) {
      best = bar;
      bestDist = dist;
    }
  }
  return best;
}

export interface TooltipPlacement {
  left: number;
  top: number;
}

/**
 * Where to pin a tooltip box of `tipW` × `tipH` for a pointer at (x, y) inside
 * a panel of `panelW` × `panelH`. The box sits to the pointer's right by
 * default and flips left when it would overflow; vertically it is centered on
 * the pointer and clamped to the panel.
 */
export function placeStrikeTooltip({
  x,
  y,
  panelW,
  panelH,
  tipW,
  tipH,
  offset = 12,
}: {
  x: number;
  y: number;
  panelW: number;
  panelH: number;
  tipW: number;
  tipH: number;
  offset?: number;
}): TooltipPlacement {
  let left = x + offset;
  if (left + tipW > panelW) left = x - offset - tipW;
  left = Math.max(2, Math.min(left, Math.max(2, panelW - tipW - 2)));

  const top = Math.max(2, Math.min(y - tipH / 2, Math.max(2, panelH - tipH - 2)));
  return { left, top };
}
