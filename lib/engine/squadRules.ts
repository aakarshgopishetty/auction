import { AuctionConfig, Player, Purchase, Team } from '../types';

export interface SquadSnapshot {
  team: Team;
  purchases: (Purchase & { player: Player })[];
}

/** Mirrors `max_legal_bid()` in 0002_functions.sql, for instant display only. */
export function maxLegalBid(
  team: Team,
  squadCount: number,
  config: AuctionConfig,
  cheapestBasePriceLakhs: number
): number {
  const remainingMandatorySlots = Math.max(config.min_squad_size - squadCount - 1, 0);
  return Math.max(team.purse_remaining_lakhs - remainingMandatorySlots * cheapestBasePriceLakhs, 0);
}

export function roleCounts(purchases: (Purchase & { player: Player })[]) {
  const counts = { batter: 0, bowler: 0, all_rounder: 0, wicketkeeper: 0 };
  for (const p of purchases) counts[p.player.primary_role]++;
  return counts;
}

export function overseasCount(purchases: (Purchase & { player: Player })[]) {
  return purchases.filter((p) => p.player.is_overseas).length;
}

export function canFieldPlayingXi(purchases: (Purchase & { player: Player })[]): boolean {
  // Loose real-world sanity check: 11+ total, and enough specialist roles to field a side.
  const c = roleCounts(purchases);
  return (
    purchases.length >= 11 &&
    c.wicketkeeper >= 1 &&
    c.bowler + c.all_rounder >= 4 &&
    c.batter + c.all_rounder >= 5
  );
}

/** Human-readable reason a bid would be blocked — mirrors the server's own checks. */
export function explainBidBlock(
  team: Team,
  squadCount: number,
  config: AuctionConfig,
  player: Player,
  overseasOnTeam: number,
  nextAsk: number,
  cheapestBasePriceLakhs: number
): string | null {
  if (squadCount >= config.max_squad_size) {
    return `Bid blocked: ${team.franchise_code} cannot bid because its squad is already at the maximum size.`;
  }
  if (player.is_overseas && overseasOnTeam >= config.max_overseas) {
    return `Bid blocked: this purchase would exceed the maximum overseas-player limit.`;
  }
  if (nextAsk > team.purse_remaining_lakhs) {
    return `Bid blocked: ${team.franchise_code} does not have enough purse remaining.`;
  }
  if (nextAsk > maxLegalBid(team, squadCount, config, cheapestBasePriceLakhs)) {
    return `Bid blocked: this bid would leave ${team.franchise_code} unable to fill its minimum squad size.`;
  }
  return null;
}
