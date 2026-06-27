// Round "nice" tick values from 0..max for a value axis, e.g. niceTicks(2400)
// → [0, 500, 1000, 1500, 2000]. Steps snap to 1/2/5 × a power of ten so labels
// read cleanly.
export function niceTicks(max: number, approxCount = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0];
  const rawStep = max / approxCount;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 1e-6; v += step) ticks.push(v);
  return ticks;
}
