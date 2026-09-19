/** All money in the DB is stored as integer LAKHS. 100 lakhs = 1 crore. */

export function formatLakhs(lakhs: number | null | undefined): string {
  if (lakhs == null) return '—';
  if (lakhs >= 100) {
    const cr = lakhs / 100;
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2)} Cr`;
  }
  return `₹${lakhs} L`;
}

export function formatLakhsCompact(lakhs: number | null | undefined): string {
  if (lakhs == null) return '—';
  if (lakhs >= 100) return `₹${(lakhs / 100).toFixed(2)}Cr`;
  return `₹${lakhs}L`;
}

/**
 * Client-side mirror of the server's next_min_bid() function — used only
 * to render the "next ask" instantly and optimistically. The server
 * (the server's place_bid Postgres function, called from an API route)
 * is the actual source of truth and re-validates
 * everything; this is display-only.
 */
export function computeNextMinBid(
  currentHighestLakhs: number | null,
  basePriceLakhs: number,
  schedule: { upTo: number | null; increment: number }[]
): number {
  if (currentHighestLakhs == null) return basePriceLakhs;
  const entry = schedule.find((e) => e.upTo == null || currentHighestLakhs < e.upTo);
  const increment = entry ? entry.increment : 100;
  return currentHighestLakhs + increment;
}
