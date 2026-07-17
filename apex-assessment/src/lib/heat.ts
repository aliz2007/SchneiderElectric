/** Heat-map cell class from a (score − required) gap. Green = at/above target. */
export function gapClass(gap: number | null): string {
  if (gap == null) return "hm-na";
  if (gap >= 0) return "hm-good";
  if (gap >= -0.5) return "hm-mild";
  if (gap >= -1) return "hm-warn";
  return "hm-crit";
}

export function fmt(n: number | null | undefined, digits = 1): string {
  return n == null ? "—" : n.toFixed(digits);
}
