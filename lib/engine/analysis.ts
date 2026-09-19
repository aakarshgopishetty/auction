import { AuctionConfig, Player, Purchase, Team } from '../types';
import { roleCounts, overseasCount } from './squadRules';

export interface TeamPurchase extends Purchase {
  player: Player;
}

export interface TeamAnalysis {
  team: Team;
  purchases: TeamPurchase[];
  scores: {
    batting: number;
    bowling: number;
    allRounders: number;
    wicketkeeping: number;
    indianCore: number;
    overseasBalance: number;
    squadDepth: number;
    purseEfficiency: number;
    roleBalance: number;
    overall: number;
  };
  strengths: string[];
  weaknesses: string[];
  bestPurchase: TeamPurchase | null;
  valuePurchase: TeamPurchase | null;
  biggestOverpay: TeamPurchase | null;
}

const avg = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/** "Value" = rating delivered per crore spent, relative to the player's base price. */
function valueScore(p: TeamPurchase): number {
  const spentOverBase = Math.max(p.final_price_lakhs, 1) / Math.max(p.player.base_price_lakhs, 1);
  return p.player.rating_overall / spentOverBase;
}

export function analyzeTeam(
  team: Team,
  purchases: TeamPurchase[],
  config: AuctionConfig
): TeamAnalysis {
  const batters = purchases.filter((p) => p.player.primary_role === 'batter' || p.player.secondary_role === 'batter');
  const bowlers = purchases.filter((p) => p.player.primary_role === 'bowler' || p.player.secondary_role === 'bowler');
  const allRounders = purchases.filter((p) => p.player.primary_role === 'all_rounder');
  const keepers = purchases.filter((p) => p.player.primary_role === 'wicketkeeper');
  const counts = roleCounts(purchases);
  const overseas = overseasCount(purchases);

  const battingScore = clamp(avg(batters.map((p) => p.player.rating_batting ?? p.player.rating_overall)));
  const bowlingScore = clamp(avg(bowlers.map((p) => p.player.rating_bowling ?? p.player.rating_overall)));
  const allRounderScore = clamp(avg(allRounders.map((p) => p.player.rating_impact ?? p.player.rating_overall)));
  const wkScore = clamp(avg(keepers.map((p) => p.player.rating_overall)));

  const indianCore = clamp(
    100 - (overseas / Math.max(purchases.length, 1)) * 40 // rewards a strong Indian spine without penalizing overseas quality directly
  );

  const overseasBalance = clamp(
    100 - Math.abs(overseas - config.max_overseas * 0.75) * (100 / Math.max(config.max_overseas, 1))
  );

  const squadDepth = clamp((purchases.length / Math.max(config.max_squad_size, 1)) * 100);

  const totalSpentCr = purchases.reduce((s, p) => s + p.final_price_lakhs, 0) / 100;
  const avgRating = avg(purchases.map((p) => p.player.rating_overall));
  const purseEfficiency = clamp(totalSpentCr > 0 ? (avgRating / totalSpentCr) * 8 : 50);

  const idealShare = 0.25;
  const shares = [
    counts.batter / Math.max(purchases.length, 1),
    counts.bowler / Math.max(purchases.length, 1),
    counts.all_rounder / Math.max(purchases.length, 1),
    counts.wicketkeeper / Math.max(purchases.length, 1),
  ];
  const roleBalance = clamp(100 - avg(shares.map((s) => Math.abs(s - idealShare))) * 200);

  const overall = clamp(
    battingScore * 0.2 +
      bowlingScore * 0.2 +
      allRounderScore * 0.1 +
      wkScore * 0.1 +
      indianCore * 0.1 +
      overseasBalance * 0.1 +
      squadDepth * 0.05 +
      purseEfficiency * 0.1 +
      roleBalance * 0.05
  );

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (battingScore >= 80) strengths.push('Excellent top-order batting');
  if (bowlingScore >= 80) strengths.push('Strong, varied bowling attack');
  if (allRounderScore >= 78) strengths.push('Genuine all-round depth');
  if (wkScore >= 78) strengths.push('Reliable wicketkeeping options');
  if (overseasBalance >= 80) strengths.push('Well-balanced overseas quota');
  if (purseEfficiency >= 70) strengths.push('Smart, efficient purse management');
  if (battingScore < 60 && batters.length > 0) weaknesses.push('Thin top-order batting');
  if (bowlingScore < 60 && bowlers.length > 0) weaknesses.push('Limited bowling firepower');
  if (counts.wicketkeeper < 2) weaknesses.push('Weak backup wicketkeeper cover');
  if (counts.all_rounder < 2) weaknesses.push('Limited all-round balance');
  if (purchases.length < config.min_squad_size) weaknesses.push('Squad below the minimum recommended size');
  if (!strengths.length) strengths.push('A balanced, if unspectacular, squad on paper');
  if (!weaknesses.length) weaknesses.push('No glaring gaps — a well-rounded squad');

  const sortedByValue = [...purchases].sort((a, b) => valueScore(b) - valueScore(a));
  const bestPurchase = purchases.length
    ? [...purchases].sort((a, b) => b.player.rating_overall - a.player.rating_overall)[0]
    : null;
  const valuePurchase = sortedByValue[0] ?? null;
  const biggestOverpay = sortedByValue.length ? sortedByValue[sortedByValue.length - 1] : null;

  return {
    team,
    purchases,
    scores: {
      batting: Math.round(battingScore),
      bowling: Math.round(bowlingScore),
      allRounders: Math.round(allRounderScore),
      wicketkeeping: Math.round(wkScore),
      indianCore: Math.round(indianCore),
      overseasBalance: Math.round(overseasBalance),
      squadDepth: Math.round(squadDepth),
      purseEfficiency: Math.round(purseEfficiency),
      roleBalance: Math.round(roleBalance),
      overall: Math.round(overall),
    },
    strengths,
    weaknesses,
    bestPurchase,
    valuePurchase,
    biggestOverpay,
  };
}

export interface Award {
  title: string;
  team: Team;
  reason: string;
}

export function computeAwards(analyses: TeamAnalysis[], bidCountByTeam: Record<string, number>): Award[] {
  if (!analyses.length) return [];
  const by = (fn: (a: TeamAnalysis) => number) => [...analyses].sort((a, b) => fn(b) - fn(a))[0];

  const awards: Award[] = [];
  const bestSquad = by((a) => a.scores.overall);
  awards.push({ title: 'Best Squad', team: bestSquad.team, reason: `Highest overall squad score at ${bestSquad.scores.overall}/100.` });

  const bestBatting = by((a) => a.scores.batting);
  awards.push({ title: 'Best Batting Lineup', team: bestBatting.team, reason: `Top batting rating at ${bestBatting.scores.batting}/100.` });

  const bestBowling = by((a) => a.scores.bowling);
  awards.push({ title: 'Best Bowling Attack', team: bestBowling.team, reason: `Top bowling rating at ${bestBowling.scores.bowling}/100.` });

  const bestOverseas = by((a) => a.scores.overseasBalance);
  awards.push({ title: 'Best Overseas Combination', team: bestOverseas.team, reason: `Best-balanced overseas quota at ${bestOverseas.scores.overseasBalance}/100.` });

  const mostBalanced = by((a) => a.scores.roleBalance);
  awards.push({ title: 'Most Balanced Squad', team: mostBalanced.team, reason: `Closest to an ideal role mix at ${mostBalanced.scores.roleBalance}/100.` });

  const bestPurse = by((a) => a.scores.purseEfficiency);
  awards.push({ title: 'Best Purse Management', team: bestPurse.team, reason: `Best rating delivered per crore spent.` });

  const mostAggressive = Object.entries(bidCountByTeam).sort((a, b) => b[1] - a[1])[0];
  if (mostAggressive) {
    const team = analyses.find((a) => a.team.id === mostAggressive[0])?.team;
    if (team) awards.push({ title: 'Most Aggressive Franchise', team, reason: `Placed the most bids across the auction (${mostAggressive[1]}).` });
  }

  const allBought = analyses.flatMap((a) => a.purchases.map((p) => ({ team: a.team, purchase: p })));
  if (allBought.length) {
    const steal = [...allBought].sort((a, b) => valueScore(b.purchase) - valueScore(a.purchase))[0];
    awards.push({ title: 'Biggest Steal', team: steal.team, reason: `${steal.purchase.player.full_name} for just ${steal.purchase.final_price_lakhs >= 100 ? (steal.purchase.final_price_lakhs / 100).toFixed(2) + ' Cr' : steal.purchase.final_price_lakhs + ' L'}.` });

    const overpay = [...allBought].sort((a, b) => valueScore(a.purchase) - valueScore(b.purchase))[0];
    awards.push({ title: 'Biggest Overpay', team: overpay.team, reason: `${overpay.purchase.player.full_name} went for well above scouted value.` });
  }

  return awards;
}
